import {
  BIRD_HEIGHT,
  BIRD_START_X,
  BIRD_WIDTH,
  PIPE_GAP,
  PIPE_WIDTH,
} from './constants.js';

export function checkCollision(
  birdY: number,
  playH: number,
  pipeCount: number,
  pipesX: number[],
  pipesGapY: number[],
): boolean {
  'main thread';
  const birdX = BIRD_START_X;

  // Ground collision
  if (birdY + BIRD_HEIGHT >= playH) return true;
  // Ceiling collision
  if (birdY <= 0) return true;

  // Pipe collision (AABB)
  for (let i = 0; i < pipeCount; i++) {
    const pipeX = pipesX[i]!;
    const gapY = pipesGapY[i]!;

    if (birdX + BIRD_WIDTH > pipeX && birdX < pipeX + PIPE_WIDTH) {
      const gapTop = gapY - PIPE_GAP / 2;
      const gapBottom = gapY + PIPE_GAP / 2;
      if (birdY < gapTop || birdY + BIRD_HEIGHT > gapBottom) return true;
    }
  }

  return false;
}
