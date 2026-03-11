import { useMainThreadRef, useState } from '@lynx-js/react';
import { runOnBackground } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

// ===== Configuration =====
// Change this one constant to adjust the number of shadow birds.
// All refs, positions, and loop bounds derive from it.
export const SHADOW_BIRD_COUNT = 8;

// Compute shadow bird X positions: half left of main bird (x=60), half right
function computeShadowPositions(count: number): number[] {
  const positions: number[] = [];
  const half = Math.ceil(count / 2);
  const rest = count - half;
  // Left side: spread from 0 to ~52 (just before main bird at x=60)
  for (let i = 0; i < half; i++) {
    positions.push(Math.round((i / half) * 52));
  }
  // Right side: spread from 80 to ~210
  for (let i = 0; i < rest; i++) {
    positions.push(80 + Math.round((i / Math.max(rest - 1, 1)) * 130));
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

  // Stress level button refs
  const stressBtnRef = useMainThreadRef<MainThread.Element>(null);
  const stressBtnTextRef = useMainThreadRef<MainThread.Element>(null);

  // ===== MTS helpers (callee-before-caller order) =====

  // Show/hide all shadow birds (called on stress level transitions)
  function showShadowBirds(visible: boolean): void {
    'main thread';
    for (let i = 0; i < SHADOW_BIRD_COUNT; i++) {
      const ref = shadowRefs[i]?.current;
      if (ref) {
        ref.setStyleProperty('display', visible ? 'flex' : 'none');
      }
    }
  }

  // L1: Update shadow birds to match main bird state
  // N birds × (2 setStyleProperty + 1 setAttribute) MTS ops per frame
  function updateShadowBirds(
    birdY: number,
    rotation: number,
    wingFrame: number,
    allBirdFrames: string[][],
  ): void {
    'main thread';
    if (stressLevelRef.current < 1) return;
    for (let i = 0; i < SHADOW_BIRD_COUNT; i++) {
      const container = shadowRefs[i]?.current;
      const img = shadowImgRefs[i]?.current;
      if (container) {
        container.setStyleProperty('top', `${birdY}px`);
        container.setStyleProperty('transform', `rotate(${rotation}deg)`);
      }
      if (img) {
        // Each variant ×2: shadow 0,1 = variant 0; 2,3 = variant 1; etc.
        const variant = Math.floor(i / 2) % 4;
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

  // Cycle stress level: L0 → L1 → L2 → L3 → L0
  function cycleStressLevel(
    getPipeTopRef: (idx: number) => MainThread.Element | null,
    getPipeBotRef: (idx: number) => MainThread.Element | null,
  ): void {
    'main thread';
    const prev = stressLevelRef.current;
    const next = (prev + 1) % 4;
    stressLevelRef.current = next;

    // Show shadow birds when entering L1+
    if (prev === 0 && next >= 1) showShadowBirds(true);
    // Hide shadow birds + reset pipes when cycling back to L0
    if (next === 0) {
      showShadowBirds(false);
      resetPipeColors(getPipeTopRef, getPipeBotRef);
    }

    if (stressBtnTextRef.current) {
      stressBtnTextRef.current.setAttribute('text', `L${next}`);
    }
  }

  // L3: Cross-thread flood — send full game state snapshot to BTS every frame
  // Costs: JSON.stringify on MTS + postMessage serialization + BTS setState
  function sendStressSnapshot(snapshot: Record<string, unknown>): void {
    'main thread';
    if (stressLevelRef.current < 3) return;
    const json = JSON.stringify(snapshot);
    runOnBackground(setStressPayload)(json);
  }

  return {
    stressLevelRef,
    shadowRefs,
    shadowImgRefs,
    stressBtnRef,
    stressBtnTextRef,
    showShadowBirds,
    updateShadowBirds,
    applyPipeColorCycling,
    resetPipeColors,
    cycleStressLevel,
    sendStressSnapshot,
  };
}
