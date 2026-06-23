export type GameState = 'idle' | 'playing' | 'gameover';

export interface PipePair {
  x: number;
  gapY: number; // center Y of the gap
  scored: boolean;
}

/**
 * Minimal shape of a Lynx main-thread element node, as exposed through
 * `useMainThreadRef(...).current` inside `'main thread'` functions.
 * Typed loosely because the node API is only available on the main thread.
 */
export interface MTElement {
  setStyleProperty(name: string, value: string): void;
  setStyleProperties?(styles: Record<string, string>): void;
  setAttribute(name: string, value: string): void;
  getAttribute?(name: string): unknown;
  clientWidth?: number;
  clientHeight?: number;
}

/** A main-thread ref object (the return value of `useMainThreadRef`). */
export interface MTRef {
  current: MTElement | null;
}
