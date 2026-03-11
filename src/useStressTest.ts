import { useMainThreadRef, useState } from '@lynx-js/react';
import { runOnBackground } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

// ===== Configuration =====
// Change this one constant to adjust the number of shadow birds.
// All refs, positions, and loop bounds derive from it.
export const SHADOW_BIRD_COUNT = 32;

// L3 cross-thread flood: N calls per frame, each with padded payload
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

  // BTS state for L3 cross-thread flood target
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

  // Stress button group: container + 3 individual button refs for highlight
  const stressGroupRef = useMainThreadRef<MainThread.Element>(null);
  const stressBtnRefs: { current: MainThread.Element | null }[] = [];
  for (let i = 0; i < 3; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    stressBtnRefs.push(useMainThreadRef<MainThread.Element>(null));
  }

  // ===== MTS helpers (callee-before-caller order) =====

  // Show/hide all shadow birds (called on stress level transitions)
  function showShadowBirds(visible: boolean): void {
    'main thread';
    for (let i = 0; i < SHADOW_BIRD_COUNT; i++) {
      const ref = shadowRefs[i]?.current;
      if (ref) {
        ref.setStyleProperty('display', visible ? 'flex' : 'none');
        // Reset opacity to CSS default when re-showing (L2+ flicker may have changed it)
        if (visible) ref.setStyleProperty('opacity', '0.5');
      }
    }
  }

  // L1: Update shadow birds to match main bird state
  // N birds × (2 setStyleProperty + 1 setAttribute) MTS ops per frame
  // L2+: extra style mutations per bird (opacity flicker) for more pressure
  function updateShadowBirds(
    birdY: number,
    rotation: number,
    wingFrame: number,
    allBirdFrames: string[][],
  ): void {
    'main thread';
    if (stressLevelRef.current < 1) return;
    const level = stressLevelRef.current;
    for (let i = 0; i < SHADOW_BIRD_COUNT; i++) {
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

  // L2: HSL color cycling on pipe backgrounds
  // 4 pipes × top/bot = 8 setStyleProperty(backgroundColor) per frame
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

  // Reset pipe colors when exiting L2+ (restore CSS defaults)
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

  // Update button highlights to reflect current stress level
  function updateStressBtnHighlight(): void {
    'main thread';
    const level = stressLevelRef.current;
    for (let i = 0; i < 3; i++) {
      const btn = stressBtnRefs[i]?.current;
      if (btn) {
        const isActive = level === i + 1;
        btn.setStyleProperty('background-color', isActive ? 'rgba(0, 255, 136, 0.25)' : 'transparent');
      }
    }
  }

  // Set stress level directly; tapping the active level toggles back to L0
  function setStressLevel(
    target: number,
    getPipeTopRef: (idx: number) => MainThread.Element | null,
    getPipeBotRef: (idx: number) => MainThread.Element | null,
  ): void {
    'main thread';
    const prev = stressLevelRef.current;
    const next = prev === target ? 0 : target;
    stressLevelRef.current = next;

    if (prev === 0 && next >= 1) showShadowBirds(true);
    if (next === 0) {
      showShadowBirds(false);
      resetPipeColors(getPipeTopRef, getPipeBotRef);
    }

    updateStressBtnHighlight();
  }

  // L3: Cross-thread flood — multiple runOnBackground calls per frame
  // Costs: JSON.stringify on MTS + N × (postMessage serialization + BTS setState)
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
    stressGroupRef,
    stressBtnRefs,
    showShadowBirds,
    updateShadowBirds,
    applyPipeColorCycling,
    resetPipeColors,
    setStressLevel,
    updateStressBtnHighlight,
    sendStressSnapshot,
  };
}
