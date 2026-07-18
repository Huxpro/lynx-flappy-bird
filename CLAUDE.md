# Flappy Bird on Lynx (Vue Lynx)

This project is built with **[Vue Lynx](https://vue.lynxjs.org)** — a Vue 3 custom
renderer for Lynx. UI is written in Vue Single-File Components (`.vue`) using
`<script setup>` and the Composition API; the per-frame game loop runs in Main
Thread Script (MTS). All framework imports come from `vue-lynx` (not `vue` or
`@lynx-js/react`).

## Reference
- `.context/floppybird-main.js` — Game logic and physics constants. READ THIS FIRST.
- `assets/` — All sprite assets.
- Vue Lynx docs entry point: <https://vue.lynxjs.org/llms.txt> — read this when working on Vue Lynx tasks.

## Architecture Rules (MUST FOLLOW)

1. The game loop, touch handling, and ALL per-frame animation MUST run in Main Thread Script (MTS).
2. Vue (BTS) is ONLY for: Score display, StartScreen, GameOverPanel, and the game state machine (idle/playing/gameover).
3. MTS → BTS communication is ONLY for low-frequency events: score updates and game state transitions.
4. NEVER use setInterval, setTimeout, or requestAnimationFrame in Vue components/BTS to drive the game loop.
5. NEVER use Pinia or any Vue/React state manager for per-frame game state (position, velocity, pipe positions).
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

## Project Structure (Vue Lynx)
- `src/index.ts` — entry; `createApp(App).mount()` from `vue-lynx`.
- `src/App.vue` — root component, renders `<Game />`.
- `src/Game.vue` — main game. BTS reactive state (`ref` + plain setter functions)
  and ALL MTS game-loop functions live in its `<script setup>`.
- `src/*.vue` — UI components (`PipePair`, `ScoreDigits`, `GameOverScreen`, `DevPanel`).
- `src/useDebugMode.ts`, `src/useStressTest.ts` — composables that own MTS refs + MTS helpers.
- `src/mts/*.ts` — pure, framework-agnostic MTS modules (`'main thread'` functions taking plain params).
- `lynx.config.ts` — uses `pluginVueLynx` (with `pluginQRCode`).

## MTS Patterns in Vue Lynx
- Use `'main thread'` string directive to mark functions as running on main thread
- Use `:main-thread-ref="ref"` in templates for refs accessible on main thread
- Use `:main-thread-bindtouchstart="handler"` for MTS touch events (`:main-thread-bindtap`, etc.)
- Use `useMainThreadRef` (from `vue-lynx`) for state that lives on the main thread; read/write via `.current`
- Use `runOnMainThread()` to execute BTS code on main thread; `runOnBackground()` for MTS → BTS
- Use `requestAnimationFrame` in MTS for the game loop
- BTS reactive state uses Vue `ref()`; expose a plain setter function (e.g. `function setScore(v){ score.value = v }`)
  so MTS can call it via `runOnBackground(setScore)(v)`. In `<script setup>` script code, read refs with `.value`;
  templates auto-unwrap.

### TDZ (Temporal Dead Zone) in MTS Functions

**Problem:** The MTS compiler turns `function` declarations inside `<script setup>` into `let` bindings, removing JavaScript's normal function hoisting. This means:

```js
// What you write:
function a() { b(); }   // ← calls b
function b() { ... }

// What it compiles to:
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
- **Inline style lengths need units as strings.** `:style="{ height: '82px' }"` not `:style="{ height: 82 }"`.

### Touch/Mouse Events on Web (Observed-Touch Pattern)

**BTS runs in a Web Worker.** `globalThis` in BTS is `WorkerGlobalScope`, NOT `window`. DOM-based capability checks like `'ontouchstart' in globalThis` always return `false` in BTS, regardless of device. **Never use DOM feature detection in BTS code.**

On web, we bind **both** `touchstart`/`touchend` and `mousedown`/`mouseup` on the same element so that:
- Mobile web → responds to touch (zero-latency)
- Desktop web → responds to mouse clicks

**Double-fire problem:** Mobile browsers synthesize `mousedown`/`mouseup` from touch events. With both event types bound, a single tap fires `touchstart` then a delayed `mousedown`, causing double jumps on real devices.

**Solution — "Observed Touch" pattern:** Instead of trying to detect touch capability upfront (impossible in BTS Worker), detect it at runtime from the first real event:

```ts
const hasTouchRef = useMainThreadRef(false);

function onTouchStart(e: any) {
  'main thread';
  const isTouch = !!e.touches;  // TouchEvent has touches, MouseEvent doesn't
  if (isTouch) hasTouchRef.current = true;       // Remember: this is a touch device
  else if (hasTouchRef.current) return;           // Mouse on touch device → synthesized, skip
  // ... handle event
}
```

Bind both event families in the template:
```vue
<view
  :main-thread-bindtouchstart="onTouchStart"
  :main-thread-bindtouchend="onTouchEnd"
  :main-thread-bindmousedown="onTouchStart"
  :main-thread-bindmouseup="onTouchEnd"
/>
```

- **Self-adapting:** First real touch event teaches the system; desktop never sees touch.
- **No timing hacks:** No setTimeout, no debounce, no magic delays.
- **No capability detection:** Works regardless of thread/worker context.
- **Long press safe:** `startLongPress` also has its own re-entry guard (timer ref check) as defense-in-depth.

### runOnBackground (MTS → BTS)
- MUST be called **inline inside MTS functions**, NOT at the setup/component level
- Pass stable function references (plain setter functions defined in `<script setup>` that mutate a `ref`) directly
- Correct: `runOnBackground(setScore)(newValue)` inside MTS, where `function setScore(v){ score.value = v }`
- WRONG: `const fn = runOnBackground(...)` at setup level — the worklet exec context can be released, causing "JS function not found" errors
- For complex BTS updates, track state on the MTS side with `useMainThreadRef` and pass the final value
