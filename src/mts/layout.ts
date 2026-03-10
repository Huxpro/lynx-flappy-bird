import { GAME_WIDTH, GROUND_HEIGHT } from './constants.js';

// Cap game height at 640 design-px to keep gameplay tight on tall screens
const MAX_DESIGN_HEIGHT = 640;
// Target aspect ratio — matches the classic 288×512 Flappy Bird canvas
const TARGET_RATIO = GAME_WIDTH / MAX_DESIGN_HEIGHT;

export interface GameLayout {
  /** Uniform scale factor from design coords to screen pixels */
  scale: number;
  /** Horizontal offset in screen pixels (pillarbox) */
  offsetX: number;
  /** Vertical offset in screen pixels (letterbox) */
  offsetY: number;
  /** Total game height in design coords (including ground) */
  gameHeight: number;
  /** Playable area height in design coords (excluding ground) */
  playHeight: number;
  /** Bird's resting Y in design coords */
  birdStartY: number;
}

/**
 * Compute layout using a "contain" (fit-inside) strategy:
 * - Tall/narrow screens (phones): scale to fill width, letterbox vertically
 * - Wide screens (iPad, landscape): scale to fill height, pillarbox horizontally
 *
 * @param cssWidth  Screen width in CSS (logical) pixels
 * @param cssHeight Screen height in CSS (logical) pixels
 */
export function computeLayout(
  cssWidth: number,
  cssHeight: number,
): GameLayout {
  'main thread';
  const screenRatio = cssWidth / cssHeight;

  let scale: number;
  let gameH: number;

  if (screenRatio > TARGET_RATIO) {
    // Wide screen → height is the limiting dimension
    gameH = MAX_DESIGN_HEIGHT;
    scale = cssHeight / gameH;
  } else {
    // Tall screen → width is the limiting dimension
    scale = cssWidth / GAME_WIDTH;
    gameH = Math.min(cssHeight / scale, MAX_DESIGN_HEIGHT);
  }

  const visualWidth = GAME_WIDTH * scale;
  const visualHeight = gameH * scale;
  const offsetX = Math.max(0, (cssWidth - visualWidth) / 2);
  const offsetY = Math.max(0, (cssHeight - visualHeight) / 2);

  const playH = gameH - GROUND_HEIGHT;
  const birdStartY = Math.round(playH * 0.45);

  return {
    scale,
    offsetX,
    offsetY,
    gameHeight: gameH,
    playHeight: playH,
    birdStartY,
  };
}
