import { useMainThreadRef, useState } from '@lynx-js/react';
import { runOnBackground } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

// 8 shadow bird X positions: 4 left of main bird (x=60), 4 right
export const SHADOW_X = [0, 20, 38, 48, 78, 100, 130, 160];

export function useStressTest() {
  const stressLevelRef = useMainThreadRef(0);
  const hueRef = useMainThreadRef(0);

  // BTS state for L3 cross-thread flood target
  const [, setStressPayload] = useState<unknown>(null);

  // Shadow bird refs: 8 containers + 8 images
  const sb0Ref = useMainThreadRef<MainThread.Element>(null);
  const sb0ImgRef = useMainThreadRef<MainThread.Element>(null);
  const sb1Ref = useMainThreadRef<MainThread.Element>(null);
  const sb1ImgRef = useMainThreadRef<MainThread.Element>(null);
  const sb2Ref = useMainThreadRef<MainThread.Element>(null);
  const sb2ImgRef = useMainThreadRef<MainThread.Element>(null);
  const sb3Ref = useMainThreadRef<MainThread.Element>(null);
  const sb3ImgRef = useMainThreadRef<MainThread.Element>(null);
  const sb4Ref = useMainThreadRef<MainThread.Element>(null);
  const sb4ImgRef = useMainThreadRef<MainThread.Element>(null);
  const sb5Ref = useMainThreadRef<MainThread.Element>(null);
  const sb5ImgRef = useMainThreadRef<MainThread.Element>(null);
  const sb6Ref = useMainThreadRef<MainThread.Element>(null);
  const sb6ImgRef = useMainThreadRef<MainThread.Element>(null);
  const sb7Ref = useMainThreadRef<MainThread.Element>(null);
  const sb7ImgRef = useMainThreadRef<MainThread.Element>(null);

  // ===== MTS helpers (callee-before-caller order) =====

  function getShadowRef(idx: number) {
    'main thread';
    if (idx === 0) return sb0Ref.current;
    if (idx === 1) return sb1Ref.current;
    if (idx === 2) return sb2Ref.current;
    if (idx === 3) return sb3Ref.current;
    if (idx === 4) return sb4Ref.current;
    if (idx === 5) return sb5Ref.current;
    if (idx === 6) return sb6Ref.current;
    if (idx === 7) return sb7Ref.current;
    return null;
  }

  function getShadowImgRef(idx: number) {
    'main thread';
    if (idx === 0) return sb0ImgRef.current;
    if (idx === 1) return sb1ImgRef.current;
    if (idx === 2) return sb2ImgRef.current;
    if (idx === 3) return sb3ImgRef.current;
    if (idx === 4) return sb4ImgRef.current;
    if (idx === 5) return sb5ImgRef.current;
    if (idx === 6) return sb6ImgRef.current;
    if (idx === 7) return sb7ImgRef.current;
    return null;
  }

  // Show/hide all shadow birds (called on stress level transitions)
  function showShadowBirds(visible: boolean): void {
    'main thread';
    for (let i = 0; i < 8; i++) {
      const ref = getShadowRef(i);
      if (ref) {
        ref.setStyleProperty('display', visible ? 'flex' : 'none');
      }
    }
  }

  // L1: Update shadow birds to match main bird state
  // 8 birds × (2 setStyleProperty + 1 setAttribute) = 24 MTS ops per frame
  function updateShadowBirds(
    birdY: number,
    rotation: number,
    wingFrame: number,
    allBirdFrames: string[][],
  ): void {
    'main thread';
    if (stressLevelRef.current < 1) return;
    for (let i = 0; i < 8; i++) {
      const container = getShadowRef(i);
      const img = getShadowImgRef(i);
      if (container) {
        container.setStyleProperty('top', `${birdY}px`);
        container.setStyleProperty('transform', `rotate(${rotation}deg)`);
      }
      if (img) {
        // Each variant ×2: shadow 0,1 = variant 0; 2,3 = variant 1; etc.
        const variant = Math.floor(i / 2);
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
    // Shadow bird refs for JSX
    sb0Ref, sb0ImgRef, sb1Ref, sb1ImgRef,
    sb2Ref, sb2ImgRef, sb3Ref, sb3ImgRef,
    sb4Ref, sb4ImgRef, sb5Ref, sb5ImgRef,
    sb6Ref, sb6ImgRef, sb7Ref, sb7ImgRef,
    // MTS functions
    showShadowBirds,
    updateShadowBirds,
    applyPipeColorCycling,
    resetPipeColors,
    sendStressSnapshot,
  };
}
