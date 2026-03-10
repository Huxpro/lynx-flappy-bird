import { ROTATION_DOWN, ROTATION_UP, TERMINAL_VELOCITY } from './constants.js';

export function mapVelocityToRotation(v: number): number {
  'main thread';
  if (v < 0) {
    return ROTATION_UP;
  }
  const t = Math.min(v / TERMINAL_VELOCITY, 1);
  return t * ROTATION_DOWN;
}
