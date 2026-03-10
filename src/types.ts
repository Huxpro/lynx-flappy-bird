export type GameState = 'idle' | 'playing' | 'gameover';

export interface PipePair {
  x: number;
  gapY: number; // center Y of the gap
  scored: boolean;
}
