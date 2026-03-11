import { useMainThreadRef, useState } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';
import { BIRD_START_X, PIPE_WIDTH } from './mts/constants.js';

export interface DebugSnapshot {
  birdY: number;
  velocity: number;
  rotation: number;
  birdVariant: number;
  pipeCount: number;
  pipesX: number[];
  pipesGapY: number[];
  score: number;
}

export function useDebugMode() {
  const [debugMode, setDebugMode] = useState(false);

  // Refs
  const debugModeRef = useMainThreadRef(false);
  const longPressTimerRef = useMainThreadRef(0);
  const longPressFiredRef = useMainThreadRef(false);
  const debugTextRef = useMainThreadRef<MainThread.Element>(null);
  const mtsBtsLedRef = useMainThreadRef<MainThread.Element>(null);
  const btsMtsLedRef = useMainThreadRef<MainThread.Element>(null);
  const mtsBtsCountRef = useMainThreadRef(0);
  const btsMtsCountRef = useMainThreadRef(0);
  const fpsRef = useMainThreadRef(0);
  const fpsFrameCount = useMainThreadRef(0);
  const fpsLastTime = useMainThreadRef(0);

  // Gap zone refs
  const gap0Ref = useMainThreadRef<MainThread.Element>(null);
  const gap1Ref = useMainThreadRef<MainThread.Element>(null);
  const gap2Ref = useMainThreadRef<MainThread.Element>(null);
  const gap3Ref = useMainThreadRef<MainThread.Element>(null);

  // Pipe spawn boundary lines (upper/lower safe area limits)
  const boundaryTopRef = useMainThreadRef<MainThread.Element>(null);
  const boundaryBottomRef = useMainThreadRef<MainThread.Element>(null);

  // ===== MTS functions (callee-before-caller order) =====

  function getGapRef(idx: number) {
    'main thread';
    if (idx === 0) return gap0Ref.current;
    if (idx === 1) return gap1Ref.current;
    if (idx === 2) return gap2Ref.current;
    if (idx === 3) return gap3Ref.current;
    return null;
  }

  function applyDebugOverlay(birdRef: { current: MainThread.Element | null }): void {
    'main thread';
    const on = debugModeRef.current;
    if (birdRef.current) {
      birdRef.current.setStyleProperty('border', on ? '1px solid red' : 'none');
    }
    if (debugTextRef.current) {
      debugTextRef.current.setStyleProperty('display', on ? 'flex' : 'none');
    }
    if (mtsBtsLedRef.current) {
      mtsBtsLedRef.current.setStyleProperty('display', on ? 'flex' : 'none');
    }
    if (btsMtsLedRef.current) {
      btsMtsLedRef.current.setStyleProperty('display', on ? 'flex' : 'none');
    }
    if (boundaryTopRef.current) {
      boundaryTopRef.current.setStyleProperty('display', on ? 'flex' : 'none');
    }
    if (boundaryBottomRef.current) {
      boundaryBottomRef.current.setStyleProperty('display', on ? 'flex' : 'none');
    }
  }

  function flashLed(ref: { current: MainThread.Element | null }): void {
    'main thread';
    if (ref.current) {
      ref.current.setStyleProperty('opacity', '1');
      setTimeout(() => {
        if (ref.current) {
          ref.current.setStyleProperty('opacity', '0.15');
        }
      }, 200);
    }
  }

  function flashMtsToBts(): void {
    'main thread';
    if (!debugModeRef.current) return;
    mtsBtsCountRef.current++;
    flashLed(mtsBtsLedRef);
  }

  function flashBtsToMts(): void {
    'main thread';
    if (!debugModeRef.current) return;
    btsMtsCountRef.current++;
    flashLed(btsMtsLedRef);
  }

  function updateDebugText(
    timestamp: number,
    snap: DebugSnapshot,
  ): void {
    'main thread';
    if (!debugModeRef.current || !debugTextRef.current) return;

    // FPS calculation
    fpsFrameCount.current++;
    if (fpsLastTime.current === 0) {
      fpsLastTime.current = timestamp;
    }
    const elapsed = timestamp - fpsLastTime.current;
    if (elapsed >= 500) {
      fpsRef.current = Math.round((fpsFrameCount.current / elapsed) * 1000);
      fpsFrameCount.current = 0;
      fpsLastTime.current = timestamp;
    }

    // Nearest pipe info
    let pipeInfo = '--';
    for (let i = 0; i < snap.pipeCount; i++) {
      if (snap.pipesX[i]! + PIPE_WIDTH > BIRD_START_X) {
        pipeInfo = `x:${snap.pipesX[i]!.toFixed(0)} gap:${snap.pipesGapY[i]!.toFixed(0)}`;
        break;
      }
    }

    const lines = [
      `fps: ${fpsRef.current}`,
      `y: ${snap.birdY.toFixed(1)}  vel: ${snap.velocity.toFixed(2)}`,
      `rot: ${snap.rotation.toFixed(0)}°  bird: ${snap.birdVariant === 3 ? 'lynx' : ['yel', 'blu', 'red'][snap.birdVariant]}`,
      `pipe: ${pipeInfo}  n:${snap.pipeCount}`,
      `score: ${snap.score}`,
      `mts→bts: ${mtsBtsCountRef.current}  bts→mts: ${btsMtsCountRef.current}`,
    ];
    debugTextRef.current.setAttribute('text', lines.join('\n'));
  }

  function updateGapZone(
    idx: number,
    topPipeHeight: number,
    gapSize: number,
  ): void {
    'main thread';
    const ref = getGapRef(idx);
    if (ref) {
      ref.setStyleProperty('top', `${topPipeHeight}px`);
      ref.setStyleProperty('height', `${gapSize}px`);
      ref.setStyleProperty(
        'display',
        debugModeRef.current ? 'flex' : 'none',
      );
    }
  }

  function updateBoundaryLines(playHeight: number, pipeGap: number): void {
    'main thread';
    // Must match spawnPipe's GAP_RANGE logic
    const GAP_RANGE = 260;
    const minGapY = Math.round((playHeight - GAP_RANGE) / 2);
    const maxGapY = Math.round((playHeight + GAP_RANGE) / 2);
    // Show extreme gap opening positions (not gap center)
    const topLine = minGapY - pipeGap / 2; // topmost gap-top edge
    const botLine = maxGapY + pipeGap / 2; // bottommost gap-bottom edge
    if (boundaryTopRef.current) {
      boundaryTopRef.current.setStyleProperty('top', `${topLine}px`);
    }
    if (boundaryBottomRef.current) {
      boundaryBottomRef.current.setStyleProperty('top', `${botLine}px`);
    }
  }

  // Long press management

  function startLongPress(onFired: () => void): void {
    'main thread';
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onFired();
    }, 500) as unknown as number;
  }

  function endLongPress(): boolean {
    'main thread';
    clearTimeout(longPressTimerRef.current);
    return longPressFiredRef.current;
  }

  return {
    // BTS state
    debugMode,
    setDebugMode,
    // MTS ref (read by game logic)
    debugModeRef,
    // Element refs (for JSX)
    debugTextRef,
    mtsBtsLedRef,
    btsMtsLedRef,
    gap0Ref,
    gap1Ref,
    gap2Ref,
    gap3Ref,
    boundaryTopRef,
    boundaryBottomRef,
    // MTS functions
    applyDebugOverlay,
    updateBoundaryLines,
    flashMtsToBts,
    flashBtsToMts,
    updateDebugText,
    updateGapZone,
    startLongPress,
    endLongPress,
  };
}
