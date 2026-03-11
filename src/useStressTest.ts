import { useMainThreadRef, useState } from '@lynx-js/react';
import { runOnBackground } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

// ===== Configuration =====
// Total shadow bird elements (all allocated upfront; L4 shows all, L1-L3 show BASE count)
export const SHADOW_BIRD_COUNT = 96;
export const BASE_BIRD_COUNT = 32;

// L3+ cross-thread flood: N calls per frame, each with padded payload
const FLOOD_CALLS_PER_FRAME = 10;
const PAYLOAD_PAD = 'x'.repeat(1024); // 1KB padding per call

// Compute shadow bird X positions: evenly spaced across game width.
// Overlap with main bird (x=60) is fine — shadows are translucent
// and the real bird renders on top.
function computeShadowPositions(count: number): number[] {
  const GAME_W = 288;
  const BIRD_W = 34;
  const step = (GAME_W - BIRD_W) / (count - 1 || 1);
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    positions.push(Math.round(step * i));
  }
  return positions;
}

export const SHADOW_X = computeShadowPositions(SHADOW_BIRD_COUNT);

export function useStressTest() {
  const stressLevelRef = useMainThreadRef(0);
  const hueRef = useMainThreadRef(0);

  // BTS state for L3+ cross-thread flood target
  const [, setStressPayload] = useState<unknown>(null);

  // Shadow bird refs — constant loop count ensures deterministic hook ordering
  const shadowRefs: { current: MainThread.Element | null }[] = [];
  const shadowImgRefs: { current: MainThread.Element | null }[] = [];
  for (let i = 0; i < SHADOW_BIRD_COUNT; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    shadowRefs.push(useMainThreadRef<MainThread.Element>(null));
    // eslint-disable-next-line react-hooks/rules-of-hooks
    shadowImgRefs.push(useMainThreadRef<MainThread.Element>(null));
  }

  // ===== MTS helpers (callee-before-caller order) =====

  // Show/hide shadow birds — count-aware for L4 (all) vs L1-L3 (base)
  function showShadowBirds(visible: boolean, count: number): void {
    'main thread';
    for (let i = 0; i < SHADOW_BIRD_COUNT; i++) {
      const ref = shadowRefs[i]?.current;
      if (ref) {
        const show = visible && i < count;
        ref.setStyleProperty('display', show ? 'flex' : 'none');
        // Reset opacity when showing (L2+ flicker may have changed it)
        if (show) ref.setStyleProperty('opacity', '0.5');
      }
    }
  }

  // L1+: Update shadow birds to match main bird state
  // L4 updates all SHADOW_BIRD_COUNT; L1-L3 update BASE_BIRD_COUNT
  // L2+: extra opacity flicker per bird for more pressure
  function updateShadowBirds(
    birdY: number,
    rotation: number,
    wingFrame: number,
    allBirdFrames: string[][],
  ): void {
    'main thread';
    if (stressLevelRef.current < 1) return;
    const level = stressLevelRef.current;
    const count = level >= 4 ? SHADOW_BIRD_COUNT : BASE_BIRD_COUNT;
    for (let i = 0; i < count; i++) {
      const container = shadowRefs[i]?.current;
      const img = shadowImgRefs[i]?.current;
      if (container) {
        container.setStyleProperty('top', `${birdY}px`);
        container.setStyleProperty('transform', `rotate(${rotation}deg)`);
        // L2+: per-bird opacity flicker — extra setStyleProperty per bird per frame
        if (level >= 2) {
          const flicker = 0.3 + 0.2 * Math.sin(hueRef.current * 0.1 + i);
          container.setStyleProperty('opacity', `${flicker.toFixed(2)}`);
        }
      }
      if (img) {
        // Each variant ×2, classic birds only (skip lynx — different size)
        const variant = Math.floor(i / 2) % 3;
        const frames = allBirdFrames[variant]!;
        img.setAttribute('src', frames[wingFrame]!);
      }
    }
  }

  // L2+: HSL color cycling on pipe backgrounds
  function applyPipeColorCycling(
    getPipeTopRef: (idx: number) => MainThread.Element | null,
    getPipeBotRef: (idx: number) => MainThread.Element | null,
    pipeCount: number,
  ): void {
    'main thread';
    if (stressLevelRef.current < 2) return;
    hueRef.current = (hueRef.current + 3) % 360;
    for (let i = 0; i < Math.min(pipeCount, 4); i++) {
      const hue = (hueRef.current + i * 90) % 360;
      const color = `hsl(${hue}, 80%, 50%)`;
      const top = getPipeTopRef(i);
      const bot = getPipeBotRef(i);
      if (top) top.setStyleProperty('background-color', color);
      if (bot) bot.setStyleProperty('background-color', color);
    }
  }

  // Reset pipe colors (restore CSS defaults)
  function resetPipeColors(
    getPipeTopRef: (idx: number) => MainThread.Element | null,
    getPipeBotRef: (idx: number) => MainThread.Element | null,
  ): void {
    'main thread';
    for (let i = 0; i < 4; i++) {
      const top = getPipeTopRef(i);
      const bot = getPipeBotRef(i);
      if (top) top.setStyleProperty('background-color', 'transparent');
      if (bot) bot.setStyleProperty('background-color', 'transparent');
    }
  }

  // Apply a new stress level — handles show/hide birds + reset pipes
  function applyStressLevel(
    newLevel: number,
    getPipeTopRef: (idx: number) => MainThread.Element | null,
    getPipeBotRef: (idx: number) => MainThread.Element | null,
  ): void {
    'main thread';
    const prev = stressLevelRef.current;
    stressLevelRef.current = newLevel;

    const newCount = newLevel >= 4 ? SHADOW_BIRD_COUNT : BASE_BIRD_COUNT;

    if (prev === 0 && newLevel >= 1) {
      showShadowBirds(true, newCount);
    } else if (newLevel === 0) {
      showShadowBirds(false, 0);
      resetPipeColors(getPipeTopRef, getPipeBotRef);
    } else if (newLevel >= 1) {
      // Level changed between L1-L4: adjust visible bird count
      showShadowBirds(true, newCount);
    }
  }

  // L3+: Cross-thread flood — multiple runOnBackground calls per frame
  function sendStressSnapshot(snapshot: Record<string, unknown>): void {
    'main thread';
    if (stressLevelRef.current < 3) return;
    snapshot['_pad'] = PAYLOAD_PAD;
    const json = JSON.stringify(snapshot);
    for (let k = 0; k < FLOOD_CALLS_PER_FRAME; k++) {
      // Unique suffix prevents any dedup; each call is a real cross-thread message
      runOnBackground(setStressPayload)(json + k);
    }
  }

  return {
    stressLevelRef,
    shadowRefs,
    shadowImgRefs,
    showShadowBirds,
    updateShadowBirds,
    applyPipeColorCycling,
    resetPipeColors,
    applyStressLevel,
    sendStressSnapshot,
  };
}
