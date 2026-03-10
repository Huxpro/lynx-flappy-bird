// Physics constants - derived from nebez/floppybird, normalized for 60fps
// All values are in px/frame at 60fps. Multiply by (dt / 16.67) for frame independence.

export const GRAVITY = 0.25;
export const FLAP_IMPULSE = -4.6;
export const TERMINAL_VELOCITY = 10;

export const PIPE_SPEED = 2;
export const PIPE_GAP = 100; // vertical gap between top and bottom pipe
export const PIPE_SPACING = 250; // horizontal distance between pipe pairs
export const PIPE_WIDTH = 52;

export const BIRD_WIDTH = 34;
export const BIRD_HEIGHT = 24;

export const GROUND_HEIGHT = 112;

// Rotation mapping: velocity → bird angle in degrees
export const ROTATION_UP = -30; // nose up when flapping
export const ROTATION_DOWN = 90; // nose down when falling
export const ROTATION_SPEED = 2; // degrees per frame when tilting down

// Game dimensions — GAME_WIDTH is the design-coordinate width (fixed).
// Game height is computed dynamically at runtime to fill the device screen.
export const GAME_WIDTH = 288;

// Bird X position (constant — horizontal position never changes)
export const BIRD_START_X = 60;

// Max number of pipe pairs visible at once
export const MAX_PIPES = 4;

// Ground sprite width (base.png)
export const GROUND_WIDTH = 336;

// Bird wing animation
export const WING_CYCLE_PLAYING = 100; // ms per frame during play
export const WING_CYCLE_IDLE = 150; // ms per frame during idle

// Bird idle bob
export const BOB_AMPLITUDE = 8;
export const BOB_SPEED = 3;
