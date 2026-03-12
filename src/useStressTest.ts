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

// ===== Auto-Ramp Benchmark Constants =====
const BENCH_STEP = 25;          // birds added per step
const BENCH_MAX_BIRDS = 400;
const BENCH_MAX_STEPS = BENCH_MAX_BIRDS / BENCH_STEP; // 16
const BENCH_WARMUP = 500;       // ms — discard transient frames
const BENCH_MEASURE = 1500;     // ms — sample window for FPS
const BENCH_FLOOR = 15;         // fps — stop benchmark below this
const BENCH_THRESHOLDS = [55, 30] as const;

export function useStressTest(setStressBirdsBTS: (n: number) => void) {
  // MTS config refs — set from BTS via runOnMainThread
  const birdCountRef = useMainThreadRef(0);
  const heavyRef = useMainThreadRef(0);   // 0 = basic, 1 = heavy mutations
  const floodRef = useMainThreadRef(0);   // 0, 10, or 20
  const tickRef = useMainThreadRef(0);

  // BTS state for cross-thread flood target
  const [, setStressPayload] = useState<unknown>(null);

  // ===== Auto-Ramp Benchmark State =====
  // BTS: UI state (button highlight, disable bird buttons)
  const [benchActive, setBenchActive] = useState(false);

  // MTS: per-frame state machine
  const benchActiveRef = useMainThreadRef(false);
  const benchPhaseRef = useMainThreadRef('');     // 'warmup' | 'measure'
  const benchStepRef = useMainThreadRef(0);       // current step index (0-16)
  const benchPhaseStartRef = useMainThreadRef(0); // timestamp when current phase started
  const benchFrameCountRef = useMainThreadRef(0); // frames counted during measure phase

  // MTS: threshold tracking (written per-step, read once at finish)
  const benchAt55Ref = useMainThreadRef(-1);      // bird count when FPS first < 55
  const benchAt30Ref = useMainThreadRef(-1);      // bird count when FPS first < 30
  const benchPeakBirdsRef = useMainThreadRef(0);  // last completed step's bird count
  const benchPeakFpsRef = useMainThreadRef(0);    // last completed step's FPS

  // MTS: result line (formatted once at finish, read per-frame by debug text builder)
  const benchResultLineRef = useMainThreadRef('');

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

  // ===== Auto-Ramp Benchmark MTS Functions (TDZ-safe order) =====

  // Record a completed step — update thresholds and peak
  function benchRecordStep(birds: number, fps: number): void {
    'main thread';
    benchPeakBirdsRef.current = birds;
    benchPeakFpsRef.current = fps;
    if (fps < BENCH_THRESHOLDS[0]! && benchAt55Ref.current < 0) {
      benchAt55Ref.current = birds;
    }
    if (fps < BENCH_THRESHOLDS[1]! && benchAt30Ref.current < 0) {
      benchAt30Ref.current = birds;
    }
  }

  // Finish benchmark — format result line and reset bird count
  function benchFinish(): void {
    'main thread';
    benchActiveRef.current = false;
    const parts: string[] = ['Auto:'];
    if (benchAt55Ref.current >= 0) {
      parts.push(`${benchAt55Ref.current}@55`);
    }
    if (benchAt30Ref.current >= 0) {
      parts.push(`${benchAt30Ref.current}@30`);
    }
    parts.push(`peak:${benchPeakBirdsRef.current}@${benchPeakFpsRef.current}`);
    benchResultLineRef.current = parts.join(' ');
    applyStressConfig(0, heavyRef.current, floodRef.current);
    runOnBackground(setStressBirdsBTS)(0);
    runOnBackground(setBenchActive)(false);
  }

  // Cancel a running benchmark (for game-over or leaving debug mode)
  function cancelBenchmark(reason: string): void {
    'main thread';
    if (!benchActiveRef.current) return;
    benchActiveRef.current = false;
    benchResultLineRef.current = reason;
    applyStressConfig(0, heavyRef.current, floodRef.current);
    runOnBackground(setStressBirdsBTS)(0);
    runOnBackground(setBenchActive)(false);
  }

  // Advance to next step — apply new bird count and enter warmup
  function benchAdvance(): void {
    'main thread';
    benchStepRef.current++;
    const birds = benchStepRef.current * BENCH_STEP;
    applyStressConfig(birds, heavyRef.current, floodRef.current);
    benchPhaseRef.current = 'warmup';
    benchPhaseStartRef.current = 0; // initialized on next tick
  }

  // Per-frame benchmark tick — warmup → measure → record → advance/finish
  function tickBenchmark(timestamp: number): void {
    'main thread';
    if (!benchActiveRef.current) return;

    if (benchPhaseRef.current === 'warmup') {
      if (benchPhaseStartRef.current === 0) {
        benchPhaseStartRef.current = timestamp;
        return;
      }
      if (timestamp - benchPhaseStartRef.current >= BENCH_WARMUP) {
        benchPhaseRef.current = 'measure';
        benchPhaseStartRef.current = timestamp;
        benchFrameCountRef.current = 0;
      }
    } else {
      // measure phase
      benchFrameCountRef.current++;
      const elapsed = timestamp - benchPhaseStartRef.current;
      if (elapsed >= BENCH_MEASURE) {
        const avgFps = Math.round((benchFrameCountRef.current / elapsed) * 1000);
        const birds = benchStepRef.current * BENCH_STEP;
        benchRecordStep(birds, avgFps);
        if (avgFps < BENCH_FLOOR || benchStepRef.current >= BENCH_MAX_STEPS) {
          benchFinish();
        } else {
          benchAdvance();
        }
      }
    }
  }

  // Start or cancel the benchmark (Auto button toggle)
  function startBenchmark(): void {
    'main thread';
    if (benchActiveRef.current) {
      cancelBenchmark('cancelled');
      return;
    }
    benchActiveRef.current = true;
    benchStepRef.current = 0;
    benchPhaseRef.current = 'warmup';
    benchPhaseStartRef.current = 0;
    benchFrameCountRef.current = 0;
    benchAt55Ref.current = -1;
    benchAt30Ref.current = -1;
    benchPeakBirdsRef.current = 0;
    benchPeakFpsRef.current = 0;
    benchResultLineRef.current = 'running...';
    // Step 0: 0 birds (baseline)
    applyStressConfig(0, heavyRef.current, floodRef.current);
    runOnBackground(setStressBirdsBTS)(0);
    runOnBackground(setBenchActive)(true);
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
    // Auto-ramp benchmark
    benchActive,
    benchActiveRef,
    benchResultLineRef,
    tickBenchmark,
    startBenchmark,
    cancelBenchmark,
  };
}
