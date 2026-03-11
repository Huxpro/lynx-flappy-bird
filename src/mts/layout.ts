import { GAME_WIDTH, GROUND_HEIGHT } from './constants.js';

// Bounds on game dimensions in design coordinates
const MIN_W = GAME_WIDTH; // 288 — original design width (minimum)
const MAX_H = 640; // max game height (tall phones)
const MIN_H = 480; // min game height (wide screens like iPad)
const MAX_W = 420; // max game width (extreme wide / landscape)

// Ratio thresholds derived from bounds
const RATIO_LETTERBOX = MIN_W / MAX_H; // ~0.45 — below this: letterbox
const RATIO_WIDEN = MIN_W / MIN_H; // 0.6  — above this: widen game
const RATIO_PILLARBOX = MAX_W / MIN_H; // ~0.875 — above this: pillarbox

// Ground height: 112px at gameH >= 512, linearly shrinks to 75px at MIN_H (480)
const GROUND_FULL_H = 512; // gameH at which ground is full GROUND_HEIGHT
const MIN_GROUND = 75; // ground height at MIN_H

export interface GameLayout {
  /** Uniform scale factor from design coords to screen pixels */
  scale: number;
  /** Horizontal offset in screen pixels (pillarbox) */
  offsetX: number;
  /** Vertical offset in screen pixels (letterbox) */
  offsetY: number;
  /** Total game width in design coords */
  gameWidth: number;
  /** Total game height in design coords (including ground) */
  gameHeight: number;
  /** Ground strip height in design coords */
  groundHeight: number;
  /** Playable area height in design coords (excluding ground) */
  playHeight: number;
  /** Bird's resting Y in design coords */
  birdStartY: number;
}

/**
 * Compute layout using a "cover within bounds" strategy:
 * - Phones (ratio 0.45–0.6): fill width at 288, dynamic height (480–640)
 * - Wide screens like iPad vertical (ratio 0.6–0.875): fill height at 480, expand width (288–420)
 * - Very tall screens (ratio < 0.45): letterbox (top/bottom black bars)
 * - Very wide screens (ratio > 0.875): pillarbox (left/right black bars)
 *
 * @param cssWidth  Screen width in CSS (logical) pixels
 * @param cssHeight Screen height in CSS (logical) pixels
 */
export function computeLayout(
  cssWidth: number,
  cssHeight: number,
): GameLayout {
  'main thread';
  const ratio = cssWidth / cssHeight;

  let scale: number;
  let gameW: number;
  let gameH: number;
  let offsetX = 0;
  let offsetY = 0;

  if (ratio < RATIO_LETTERBOX) {
    // Very tall screen → letterbox (top/bottom black bars)
    gameW = MIN_W;
    gameH = MAX_H;
    scale = cssWidth / MIN_W;
    offsetY = (cssHeight - MAX_H * scale) / 2;
  } else if (ratio <= RATIO_WIDEN) {
    // Normal phone range → fill width, dynamic height
    gameW = MIN_W;
    scale = cssWidth / MIN_W;
    gameH = cssHeight / scale;
  } else if (ratio <= RATIO_PILLARBOX) {
    // Wide screen (iPad vertical) → fill height at MIN_H, expand width
    gameH = MIN_H;
    scale = cssHeight / MIN_H;
    gameW = cssWidth / scale;
  } else {
    // Very wide screen → pillarbox (left/right black bars)
    gameW = MAX_W;
    gameH = MIN_H;
    scale = Math.min(cssWidth / MAX_W, cssHeight / MIN_H);
    const visualW = gameW * scale;
    const visualH = gameH * scale;
    offsetX = (cssWidth - visualW) / 2;
    offsetY = (cssHeight - visualH) / 2;
  }

  // Scale ground height: full 112px at gameH>=512, interpolate down to 75px at gameH=480
  const groundH = gameH >= GROUND_FULL_H
    ? GROUND_HEIGHT
    : Math.round(MIN_GROUND + (GROUND_HEIGHT - MIN_GROUND) * (gameH - MIN_H) / (GROUND_FULL_H - MIN_H));
  const playH = gameH - groundH;
  const birdStartY = Math.round(playH * 0.45);

  return {
    scale,
    offsetX,
    offsetY,
    gameWidth: gameW,
    gameHeight: gameH,
    groundHeight: groundH,
    playHeight: playH,
    birdStartY,
  };
}
