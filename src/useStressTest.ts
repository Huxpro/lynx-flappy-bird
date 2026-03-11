import { useMainThreadRef, useState } from '@lynx-js/react';
import { runOnBackground } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

// ===== Orthogonal Stress Dimensions =====
// Freely composable for A/B performance analysis:
//   Element count:  0 | 100 | 200 | 400  (shadow birds in the scene)
//   Mutation level: basic (3 ops/bird) | heavy (+5 ops/bird = 8 total, ~167% increase)
//   Thread flood:   0 | 10 | 50  (runOnBackground calls per frame with 4KB payload)
export const BIRD_COUNT_OPTIONS = [100, 200, 400] as const;
export const FLOOD_OPTIONS = [10, 50] as const;

// Max bird count — determines ref allocation and JSX element count
export const SHADOW_BIRD_COUNT = Math.max(...BIRD_COUNT_OPTIONS);

const PAYLOAD_PAD = 'x'.repeat(4096); // 4KB padding per flood call

// Compute shadow bird X positions: evenly spaced across game width
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
  // MTS config refs — set from BTS via runOnMainThread
  const birdCountRef = useMainThreadRef(0);
  const heavyRef = useMainThreadRef(0);   // 0 = basic, 1 = heavy mutations
  const floodRef = useMainThreadRef(0);   // 0, 10, or 20
  const tickRef = useMainThreadRef(0);

  // BTS state for cross-thread flood target
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

  // Show first `count` shadow birds, hide the rest
  function showShadowBirds(visible: boolean, count: number): void {
    'main thread';
    for (let i = 0; i < SHADOW_BIRD_COUNT; i++) {
      const ref = shadowRefs[i]?.current;
      if (ref) {
        const show = visible && i < count;
        ref.setStyleProperty('display', show ? 'flex' : 'none');
        if (show) ref.setStyleProperty('opacity', '0.5');
      }
    }
  }

  // Per-frame shadow bird updates — ops driven by config refs
  // Basic: 3 ops/bird (top, transform, src)
  // Heavy: 8 ops/bird (+opacity, width, height, backgroundColor, marginTop)
  function updateShadowBirds(
    birdY: number,
    rotation: number,
    wingFrame: number,
    allBirdFrames: string[][],
  ): void {
    'main thread';
    const count = birdCountRef.current;
    if (count === 0) return;
    const heavy = heavyRef.current;
    tickRef.current++;
    for (let i = 0; i < count; i++) {
      const container = shadowRefs[i]?.current;
      const img = shadowImgRefs[i]?.current;
      if (container) {
        container.setStyleProperty('top', `${birdY}px`);
        container.setStyleProperty('transform', `rotate(${rotation}deg)`);
        if (heavy) {
          // +5 extra setStyleProperty calls per bird per frame (~167% more ops)
          const t = tickRef.current * 0.1 + i;
          const sin = Math.sin(t);
          container.setStyleProperty('opacity', `${(0.3 + 0.2 * sin).toFixed(2)}`);
          container.setStyleProperty('width', `${34 + Math.round(4 * sin)}px`);
          container.setStyleProperty('height', `${24 + Math.round(3 * sin)}px`);
          const hue = (tickRef.current * 3 + i * 37) % 360;
          container.setStyleProperty('background-color', `hsl(${hue}, 80%, 50%)`);
          container.setStyleProperty('margin-top', `${Math.round(2 * sin)}px`);
        }
      }
      if (img) {
        const variant = Math.floor(i / 2) % 3;
        const frames = allBirdFrames[variant]!;
        img.setAttribute('src', frames[wingFrame]!);
      }
    }
  }

  // Apply a full stress config — adjusts bird visibility
  function applyStressConfig(birds: number, heavy: number, flood: number): void {
    'main thread';
    const prevBirds = birdCountRef.current;
    birdCountRef.current = birds;
    heavyRef.current = heavy;
    floodRef.current = flood;

    if (birds > 0) {
      showShadowBirds(true, birds);
    } else if (prevBirds > 0) {
      showShadowBirds(false, 0);
    }
  }

  // Cross-thread flood — calls driven by floodRef
  function sendStressSnapshot(snapshot: Record<string, unknown>): void {
    'main thread';
    const flood = floodRef.current;
    if (flood === 0) return;
    snapshot['_pad'] = PAYLOAD_PAD;
    const json = JSON.stringify(snapshot);
    for (let k = 0; k < flood; k++) {
      runOnBackground(setStressPayload)(json + k);
    }
  }

  return {
    birdCountRef,
    heavyRef,
    floodRef,
    shadowRefs,
    shadowImgRefs,
    updateShadowBirds,
    applyStressConfig,
    sendStressSnapshot,
  };
}
