# Flappy Bird on Lynx

## Reference
- `.context/floppybird-main.js` — Game logic and physics constants. READ THIS FIRST.
- `assets/` — All sprite assets.

## Architecture Rules (MUST FOLLOW)

1. The game loop, touch handling, and ALL per-frame animation MUST run in Main Thread Script (MTS).
2. React (BTS) is ONLY for: Score display, StartScreen, GameOverPanel, and the game state machine (idle/playing/gameover).
3. MTS → BTS communication is ONLY for low-frequency events: score updates and game state transitions.
4. NEVER use setInterval, setTimeout, or requestAnimationFrame in React components to drive the game loop.
5. NEVER use Redux or any React state manager for per-frame game state (position, velocity, pipe positions).
6. Collision detection MUST run in MTS, in the same tick as position updates.
7. Touch events MUST be captured in MTS for zero-latency response.

## Implementation Order
Phase 1 (static UI) → Phase 2 (game loop) → Phase 3 (animation polish) → Phase 4 (final polish)

## Key Physics Constants (from nebez/floppybird)
- gravity: ~0.25 px/frame
- flap impulse: ~-4.6 px/frame
- pipe speed: ~2 px/frame
- pipe gap: ~90-100 px
- pipe spacing: ~250-300 px
- rotation: -30° to 90°, mapped from velocity

Adjust for actual screen dimensions and frame rate. Normalize by delta time.

## MTS Patterns in ReactLynx
- Use `'main thread'` string directive to mark functions as running on main thread
- Use `main-thread:ref={ref}` for refs accessible on main thread
- Use `main-thread:bindtouchstart={handler}` for MTS touch events
- Use `useMainThreadRef` for state that lives on the main thread
- Use `runOnMainThread()` to execute BTS code on main thread
- Use `requestAnimationFrame` in MTS for the game loop

### TDZ (Temporal Dead Zone) in MTS Functions

**Problem:** SWC transforms `function` declarations inside components into `let` bindings, removing JavaScript's normal function hoisting. This means:

```js
// What you write:
function a() { b(); }   // ← calls b
function b() { ... }

// What SWC compiles to:
let a = function() { b(); }  // ❌ b is still in TDZ
let b = function() { ... }
```

If function A calls function B, B **must be declared before A** in source order — like C, not like normal JS.

**The error looks like:** `ReferenceError: Cannot access 'xxx' before initialization`

**Solutions (in order of preference):**

1. **Extract to separate modules** (`mts/*.ts`) — Module-level exports are fully initialized before the component runs. TDZ-immune. Best for pure computation functions.
   - `mts/physics.ts`: `mapVelocityToRotation`
   - `mts/collision.ts`: `checkCollision`
   - These take plain values as parameters instead of accessing refs via closure.

2. **Strict declaration order** — For ref-heavy functions that must stay in the component, maintain strict callee-before-caller ordering:
   ```
   updateBirdSprite → applyBirdScale → randomizeVariants → spawnPipe → resetGame → fallToGround → gameTick → idleBob → startIdleAnimation → onTouchStart
   ```

3. **Never** rearrange MTS functions without checking the call graph. Adding a new MTS function? Insert it **before** its first caller.

## Lynx Layout Gotchas

- **All elements are block-level.** No inline display for `<view>` or `<image>`. See [layout guide](https://lynxjs.org/zh/guide/ui/layout/index.html).
- **Horizontal image row → use `<text>` not `<view>`.** `<text>` is the only inline-flow container. See [图文混排](https://lynxjs.org/zh/guide/styling/text-and-typography.html#图文混排实现).
- **`position: absolute` is relative to root**, not nearest positioned ancestor. See [position](https://lynxjs.org/api/css/properties/position.html).
- **Inline style lengths need units as strings.** `style={{ height: '82px' }}` not `style={{ height: 82 }}`.

### Touch/Mouse Events on Web (Double-Fire Problem)

**BTS runs in a Web Worker.** `globalThis` in BTS is `WorkerGlobalScope`, NOT `window`. DOM-based capability checks like `'ontouchstart' in globalThis` always return `false` in BTS, regardless of device. **Never use DOM feature detection in BTS code.**

On web, we bind **both** `touchstart`/`touchend` and `mousedown`/`mouseup` on the same element so that:
- Mobile web → responds to touch (zero-latency)
- Desktop web → responds to mouse clicks

**Double-fire on mobile web:** Browsers synthesize `mousedown`/`mouseup` from touch events. With both bound, a single tap fires `touchstart` then `mousedown`. Mitigation strategy:

1. **Long press (`startLongPress`):** Re-entry guard via timer ref — if a timer is already running, skip. This prevents the synthesized `mousedown` from resetting the long-press timer.
2. **Flap (`onTouchStart`):** `pressedRef` guard blocks the synthesized `mousedown` that arrives in the same press cycle. Even if the guard doesn't block it (e.g., after `touchend` resets the ref), `velocityRef = FLAP_IMPULSE` is an idempotent assignment — setting the same impulse value twice is visually harmless.
3. **Game state transitions (`onTouchEnd`):** Protected by `gameStateRef` checks (e.g., `if (gameStateRef.current === 'idle')` fails on the second call because the first already changed state to `'playing'`).

**Key insight:** Not all double-fires need blocking. Only side-effectful, non-idempotent operations (like starting a timer) need guards. Idempotent assignments (like setting velocity) are naturally safe.

### runOnBackground (MTS → BTS)
- MUST be called **inline inside MTS functions**, NOT at the component level
- Pass stable function references (e.g., React setState setters) directly
- Correct: `runOnBackground(setScore)(newValue)` inside MTS
- WRONG: `const fn = runOnBackground(...)` at component level — worklet exec context gets released on re-render, causing "JS function not found" errors
- For complex BTS updates (e.g., updater functions), track state on MTS side with `useMainThreadRef` and pass the final value
