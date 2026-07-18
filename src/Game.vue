<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue-lynx'
import { runOnBackground, runOnMainThread, useMainThreadRef } from 'vue-lynx'

import './Game.css'
import type { GameState, MTElement } from './types.js'
import {
  BIRD_HEIGHT,
  BIRD_START_X,
  BOB_AMPLITUDE,
  BOB_SPEED,
  FLAP_IMPULSE,
  GAME_WIDTH,
  GRAVITY,
  GROUND_WIDTH,
  MAX_PIPES,
  PIPE_GAP,
  PIPE_SPACING,
  PIPE_SPEED,
  PIPE_WIDTH,
  TERMINAL_VELOCITY,
} from './mts/constants.js'
import { mapVelocityToRotation } from './mts/physics.js'
import { checkCollision } from './mts/collision.js'
import { computeLayout } from './mts/layout.js'
import backgroundDay from '../assets/sprites/background-day.png'
import backgroundNight from '../assets/sprites/background-night.png'
import base from '../assets/sprites/base.png'
import messageImg from '../assets/sprites/message.png'
import yellowBirdDown from '../assets/sprites/yellowbird-downflap.png'
import yellowBirdMid from '../assets/sprites/yellowbird-midflap.png'
import yellowBirdUp from '../assets/sprites/yellowbird-upflap.png'
import blueBirdDown from '../assets/sprites/bluebird-downflap.png'
import blueBirdMid from '../assets/sprites/bluebird-midflap.png'
import blueBirdUp from '../assets/sprites/bluebird-upflap.png'
import redBirdDown from '../assets/sprites/redbird-downflap.png'
import redBirdMid from '../assets/sprites/redbird-midflap.png'
import redBirdUp from '../assets/sprites/redbird-upflap.png'
import lynxBirdDown from '../assets/sprites/lynxbird-downflap.png'
import lynxBirdMid from '../assets/sprites/lynxbird-midflap.png'
import lynxBirdUp from '../assets/sprites/lynxbird-upflap.png'

import ScoreDigits from './ScoreDigits.vue'
import GameOverScreen from './GameOverScreen.vue'
import PipePair from './PipePair.vue'
import DevPanel from './DevPanel.vue'
import { useDebugMode } from './useDebugMode.js'
import type { DebugSnapshot } from './useDebugMode.js'
import { useStressTest, SHADOW_X, SHADOW_BIRD_COUNT } from './useStressTest.js'

const allBirdFrames: string[][] = [
  [yellowBirdMid, yellowBirdDown, yellowBirdMid, yellowBirdUp],
  [blueBirdMid, blueBirdDown, blueBirdMid, blueBirdUp],
  [redBirdMid, redBirdDown, redBirdMid, redBirdUp],
  [lynxBirdMid, lynxBirdDown, lynxBirdMid, lynxBirdUp],
]
const backgrounds = [backgroundDay, backgroundNight]
// Sky colors matching the top of each background image (for the gap above the sprite)
const bgSkyColors = ['#4ec0ca', '#008793']

// ===== BTS reactive state =====
const gameState = ref<GameState>('idle')
function setGameState(v: GameState): void {
  gameState.value = v
}
const score = ref(10) // TODO: reset to 0 after testing
function setScore(v: number): void {
  score.value = v
}
const bestScore = ref(10) // TODO: reset to 0 after testing
function setBestScore(v: number): void {
  bestScore.value = v
}
const groundHeight = ref(112)
function setGroundHeight(v: number): void {
  groundHeight.value = v
}

// Autopilot (independent of benchmark)
const autopilot = ref(false)
function setAutopilot(v: boolean): void {
  autopilot.value = v
}

// Stress test — orthogonal config
const stressBirds = ref(0)
function setStressBirds(v: number): void {
  stressBirds.value = v
}
const stressHeavy = ref(0)
function setStressHeavy(v: number): void {
  stressHeavy.value = v
}
const stressFlood = ref(0)
function setStressFlood(v: number): void {
  stressFlood.value = v
}

// Current variant index (randomized on each game start)
const birdVariantRef = useMainThreadRef(0)
const bgVariantRef = useMainThreadRef(0)

// MTS refs for direct element manipulation
const containerRef = useMainThreadRef<MTElement | null>(null)
const bgRef = useMainThreadRef<MTElement | null>(null)
const bgImgRef = useMainThreadRef<MTElement | null>(null)
const scalerRef = useMainThreadRef<MTElement | null>(null)
const birdRef = useMainThreadRef<MTElement | null>(null)
const birdImgRef = useMainThreadRef<MTElement | null>(null)
const ground0Ref = useMainThreadRef<MTElement | null>(null)
const ground1Ref = useMainThreadRef<MTElement | null>(null)
const ground2Ref = useMainThreadRef<MTElement | null>(null)
const flashRef = useMainThreadRef<MTElement | null>(null)
const pipesContainerRef = useMainThreadRef<MTElement | null>(null)

// Pipe refs: each pipe pair has a container, top pipe, and bottom pipe
const pipe0Ref = useMainThreadRef<MTElement | null>(null)
const pipe0TopRef = useMainThreadRef<MTElement | null>(null)
const pipe0BotRef = useMainThreadRef<MTElement | null>(null)
const pipe1Ref = useMainThreadRef<MTElement | null>(null)
const pipe1TopRef = useMainThreadRef<MTElement | null>(null)
const pipe1BotRef = useMainThreadRef<MTElement | null>(null)
const pipe2Ref = useMainThreadRef<MTElement | null>(null)
const pipe2TopRef = useMainThreadRef<MTElement | null>(null)
const pipe2BotRef = useMainThreadRef<MTElement | null>(null)
const pipe3Ref = useMainThreadRef<MTElement | null>(null)
const pipe3TopRef = useMainThreadRef<MTElement | null>(null)
const pipe3BotRef = useMainThreadRef<MTElement | null>(null)

// Debug mode
const {
  debugMode, setDebugMode, debugModeRef,
  debugTextRef, threadTextRef, mtsBtsLedRef, btsMtsLedRef, mtsBtsCountRef,
  gap0Ref, gap1Ref, gap2Ref, gap3Ref,
  boundaryTopRef, boundaryBottomRef,
  applyDebugOverlay, updateBoundaryLines, flashMtsToBts, flashBtsToMts,
  updateDebugText, updateGapZone,
  startLongPress, endLongPress,
} = useDebugMode()

const autopilotRef = useMainThreadRef(false)

// Stress test
const {
  floodRef,
  shadowRefs, shadowImgRefs,
  updateShadowBirds,
  applyStressConfig,
  sendStressSnapshot,
  benchActive, benchActiveRef, benchResult,
  tickBenchmark, startBenchmark, cancelBenchmark,
} = useStressTest(setStressBirds)

// Once a real touch event is observed, ignore all mouse events (synthesized).
// This self-adapts: mobile sets it on first tap, desktop never sets it.
const hasTouchRef = useMainThreadRef(false)
// Track last input source for debug overlay
const lastPointerRef = useMainThreadRef('--')

// MTS game state (not BTS state — these live on main thread)
const velocityRef = useMainThreadRef(0)
const birdYRef = useMainThreadRef(200)
const birdRotationRef = useMainThreadRef(0)
const groundOffsetRef = useMainThreadRef(0)
const gameStateRef = useMainThreadRef<'idle' | 'playing' | 'gameover'>('idle')
const scoreRef = useMainThreadRef(10) // TODO: reset to 0 after testing
const lastTimeRef = useMainThreadRef(0)
const wingFrameRef = useMainThreadRef(0)
const wingTimerRef = useMainThreadRef(0)
const idleTimeRef = useMainThreadRef(0)

// Override dimensions sent from the website's ResizeObserver
const overrideWRef = useMainThreadRef(0)
const overrideHRef = useMainThreadRef(0)

// Dynamic dimensions (computed once at init from screen size)
const dynamicGameWidthRef = useMainThreadRef(GAME_WIDTH)
const dynamicGroundHeightRef = useMainThreadRef(112)
const dynamicPlayHeightRef = useMainThreadRef(400)
const dynamicBirdStartYRef = useMainThreadRef(200)

// Pipe state on main thread
const pipesXRef = useMainThreadRef<number[]>([])
const pipesGapYRef = useMainThreadRef<number[]>([])
const pipesScoredRef = useMainThreadRef<boolean[]>([])
const pipeCountRef = useMainThreadRef(0)

// MTS-side best score tracking (avoids needing updater function across threads)
const bestScoreMTSRef = useMainThreadRef(0)

// ===== MTS Helper: get pipe refs by index =====

function getPipeRef(idx: number) {
  'main thread'
  if (idx === 0) return pipe0Ref.current
  if (idx === 1) return pipe1Ref.current
  if (idx === 2) return pipe2Ref.current
  if (idx === 3) return pipe3Ref.current
  return null
}

function getPipeTopRef(idx: number) {
  'main thread'
  if (idx === 0) return pipe0TopRef.current
  if (idx === 1) return pipe1TopRef.current
  if (idx === 2) return pipe2TopRef.current
  if (idx === 3) return pipe3TopRef.current
  return null
}

function getPipeBotRef(idx: number) {
  'main thread'
  if (idx === 0) return pipe0BotRef.current
  if (idx === 1) return pipe1BotRef.current
  if (idx === 2) return pipe2BotRef.current
  if (idx === 3) return pipe3BotRef.current
  return null
}

// ===== MTS: Responsive layout (contain / fit-inside strategy) =====

function applyLayout(): void {
  'main thread'
  // Try reading the actual container element dimensions (works on web all-on-ui
  // where MTS elements are real HTMLElements). This makes the game adapt to the
  // lynx-view container instead of the browser viewport.
  // On native, clientWidth/clientHeight aren't available, so fall back to SystemInfo
  // (which correctly reflects the LynxView dimensions on native).
  const overW = overrideWRef.current
  const overH = overrideHRef.current
  const el = containerRef.current as any
  const elW = el?.clientWidth
  const elH = el?.clientHeight
  const sysW = SystemInfo.pixelWidth / SystemInfo.pixelRatio
  const sysH = SystemInfo.pixelHeight / SystemInfo.pixelRatio
  const cssWidth = (overW > 0) ? overW : (elW > 0) ? elW : sysW
  const cssHeight = (overH > 0) ? overH : (elH > 0) ? elH : sysH
  console.log(
    `[applyLayout] override=${overW}x${overH} el=${elW}x${elH} sys=${sysW}x${sysH} → used=${cssWidth}x${cssHeight}`,
  )
  const layout = computeLayout(cssWidth, cssHeight)
  console.log(
    `[applyLayout] scale=${layout.scale.toFixed(3)} offset=(${layout.offsetX.toFixed(1)},${layout.offsetY.toFixed(1)}) game=${layout.gameWidth}x${layout.gameHeight} play=${layout.playHeight}`,
  )

  dynamicGameWidthRef.current = layout.gameWidth
  dynamicGroundHeightRef.current = layout.groundHeight
  dynamicPlayHeightRef.current = layout.playHeight
  dynamicBirdStartYRef.current = layout.birdStartY

  // Apply scale + center (pillarbox / letterbox) to the inner wrapper
  if (scalerRef.current) {
    scalerRef.current.setStyleProperty('width', `${layout.gameWidth}px`)
    scalerRef.current.setStyleProperty('height', `${layout.gameHeight}px`)
    scalerRef.current.setStyleProperty(
      'transform',
      `translate(${layout.offsetX}px, ${layout.offsetY}px) scale(${layout.scale})`,
    )
  }

  // Set dynamic pipe container dimensions
  if (pipesContainerRef.current) {
    pipesContainerRef.current.setStyleProperty('width', `${layout.gameWidth}px`)
    pipesContainerRef.current.setStyleProperty('height', `${layout.playHeight}px`)
  }
  for (let i = 0; i < MAX_PIPES; i++) {
    const ref = getPipeRef(i)
    if (ref) {
      ref.setStyleProperty('height', `${layout.playHeight}px`)
    }
  }

  // Set dynamic ground height on strips and background offset.
  // MTS owns the ground `left` too (no Vue :style binding on the strips) so that
  // a BTS re-render on game-state change can't clobber the scrolled positions.
  const gH = layout.groundHeight
  const groundEls = [ground0Ref, ground1Ref, ground2Ref]
  for (let i = 0; i < 3; i++) {
    if (groundEls[i]!.current) {
      groundEls[i]!.current!.setStyleProperty('height', `${gH}px`)
      groundEls[i]!.current!.setStyleProperty('left', `${groundOffsetRef.current + i * GROUND_WIDTH}px`)
    }
  }
  if (bgImgRef.current) {
    bgImgRef.current.setStyleProperty('bottom', `${gH}px`)
  }

  // Sync ground height to BTS for conditional UI positioning
  runOnBackground(setGroundHeight)(gH)

  // Update debug boundary lines
  updateBoundaryLines(layout.playHeight, PIPE_GAP)

  // Set bird start position
  birdYRef.current = dynamicBirdStartYRef.current
  if (birdRef.current) {
    birdRef.current.setStyleProperty('top', `${dynamicBirdStartYRef.current}px`)
  }
}

// ===== Main Thread Game Loop =====

function updateBirdSprite(): void {
  'main thread'
  if (birdImgRef.current) {
    const frames = allBirdFrames[birdVariantRef.current]!
    birdImgRef.current.setAttribute('src', frames[wingFrameRef.current]!)
  }
}

function applyBirdScale(): void {
  'main thread'
  if (birdImgRef.current) {
    const isLynx = birdVariantRef.current === 3
    birdImgRef.current.setStyleProperty('width', isLynx ? '51px' : '34px')
    birdImgRef.current.setStyleProperty('height', isLynx ? '36px' : '24px')
    birdImgRef.current.setStyleProperty('margin-left', isLynx ? '-8.5px' : '0px')
    birdImgRef.current.setStyleProperty('margin-top', isLynx ? '-6px' : '0px')
  }
}

function getDebugSnapshot(): DebugSnapshot {
  'main thread'
  return {
    birdY: birdYRef.current,
    velocity: velocityRef.current,
    rotation: birdRotationRef.current,
    birdVariant: birdVariantRef.current,
    pipeCount: pipeCountRef.current,
    pipesX: pipesXRef.current,
    pipesGapY: pipesGapYRef.current,
    score: scoreRef.current,
    pointerMode: lastPointerRef.current,
  }
}

function randomizeVariants(): void {
  'main thread'
  if (debugModeRef.current) {
    // Debug mode always uses lynxbird
    birdVariantRef.current = 3
  } else {
    // 50% chance for lynxbird, 50% for a random classic bird
    if (Math.random() < 0.5) {
      birdVariantRef.current = 3 // lynxbird
    } else {
      birdVariantRef.current = Math.floor(Math.random() * 3) // classic birds (0-2)
    }
  }
  bgVariantRef.current = Math.floor(Math.random() * backgrounds.length)

  // Update background image + sky color
  if (bgImgRef.current) {
    bgImgRef.current.setStyleProperty('background-image', `url(${backgrounds[bgVariantRef.current]!})`)
  }
  if (bgRef.current) {
    bgRef.current.setStyleProperty('background-color', bgSkyColors[bgVariantRef.current]!)
  }
  applyBirdScale()
  // Update bird sprite to current variant
  updateBirdSprite()
}

function toggleDebugMode(): void {
  'main thread'
  debugModeRef.current = !debugModeRef.current
  if (debugModeRef.current) {
    // Force lynxbird in debug mode
    birdVariantRef.current = 3
    applyBirdScale()
    updateBirdSprite()
  } else {
    // Cancel benchmark, reset autopilot, and reset stress test when leaving debug mode
    cancelBenchmark('cancelled')
    autopilotRef.current = false
    runOnBackground(setAutopilot)(false)
    applyStressConfig(0, 0, 0)
    runOnBackground(setStressBirds)(0)
    runOnBackground(setStressHeavy)(0)
    runOnBackground(setStressFlood)(0)
    // Re-randomize when leaving debug mode
    randomizeVariants()
  }
  applyDebugOverlay(birdRef)
  flashMtsToBts()
  runOnBackground(setDebugMode)(debugModeRef.current)
}

function spawnPipe(startX: number): void {
  'main thread'
  const playH = dynamicPlayHeightRef.current
  // Fixed 260px gap Y range, centered in play area
  const GAP_RANGE = 260
  const minGapY = Math.round((playH - GAP_RANGE) / 2)
  const maxGapY = Math.round((playH + GAP_RANGE) / 2)
  const gapY = minGapY + Math.random() * (maxGapY - minGapY)

  const idx = pipeCountRef.current
  if (idx < MAX_PIPES) {
    pipesXRef.current[idx] = startX
    pipesGapYRef.current[idx] = gapY
    pipesScoredRef.current[idx] = false
    pipeCountRef.current = idx + 1
  }
}

function resetGame(): void {
  'main thread'
  const birdStartY = dynamicBirdStartYRef.current
  velocityRef.current = 0
  birdYRef.current = birdStartY
  birdRotationRef.current = 0
  groundOffsetRef.current = 0
  scoreRef.current = 0
  pipeCountRef.current = 0
  pipesXRef.current = []
  pipesGapYRef.current = []
  pipesScoredRef.current = []
  wingFrameRef.current = 0
  idleTimeRef.current = 0
  lastTimeRef.current = 0

  // Reset bird position
  if (birdRef.current) {
    birdRef.current.setStyleProperty('top', `${birdStartY}px`)
    birdRef.current.setStyleProperty('transform', 'rotate(0deg)')
  }

  // Hide all pipes off screen
  for (let i = 0; i < MAX_PIPES; i++) {
    const ref = getPipeRef(i)
    if (ref) {
      ref.setStyleProperty('left', `${dynamicGameWidthRef.current + 100}px`)
    }
  }

  // Reset ground
  const groundEls = [ground0Ref, ground1Ref, ground2Ref]
  for (let i = 0; i < 3; i++) {
    if (groundEls[i]!.current) {
      groundEls[i]!.current!.setStyleProperty('left', `${i * GROUND_WIDTH}px`)
    }
  }

  // Randomize bird color and background on each restart
  randomizeVariants()
}

function updatePipeVisuals(): void {
  'main thread'
  const playH = dynamicPlayHeightRef.current
  for (let i = 0; i < pipeCountRef.current; i++) {
    const pipeRef = getPipeRef(i)
    const topRef = getPipeTopRef(i)
    const botRef = getPipeBotRef(i)

    if (pipeRef) {
      pipeRef.setStyleProperty('left', `${pipesXRef.current[i]}px`)
    }

    const gapY = pipesGapYRef.current[i]!
    const topPipeHeight = gapY - PIPE_GAP / 2
    const bottomPipeTop = gapY + PIPE_GAP / 2

    if (topRef) {
      topRef.setStyleProperty('height', `${topPipeHeight}px`)
    }
    if (botRef) {
      botRef.setStyleProperty('top', `${bottomPipeTop}px`)
      botRef.setStyleProperty('height', `${playH - bottomPipeTop}px`)
    }

    // Debug: gap safe zone
    updateGapZone(i, topPipeHeight, PIPE_GAP)
  }

  // Hide unused pipe slots
  for (let i = pipeCountRef.current; i < MAX_PIPES; i++) {
    const ref = getPipeRef(i)
    if (ref) {
      ref.setStyleProperty('left', `${dynamicGameWidthRef.current + 100}px`)
    }
  }
}

// fallToGround must be declared before gameTick (function declarations are
// compiled to let bindings — order matters for TDZ).
function fallToGround(): void {
  'main thread'
  lastTimeRef.current = 0
  const playH = dynamicPlayHeightRef.current

  const fallTick = (timestamp: number) => {
    // Stop if game was reset (e.g. user clicked Replay before bird landed)
    if (gameStateRef.current !== 'gameover') return

    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp
      requestAnimationFrame(fallTick)
      return
    }
    const dt = Math.min(timestamp - lastTimeRef.current, 33.33)
    const dtScale = dt / 16.67
    lastTimeRef.current = timestamp

    velocityRef.current += GRAVITY * dtScale
    if (velocityRef.current > TERMINAL_VELOCITY) {
      velocityRef.current = TERMINAL_VELOCITY
    }
    birdYRef.current += velocityRef.current * dtScale

    if (birdRef.current) {
      birdRef.current.setStyleProperty('top', `${birdYRef.current}px`)
      birdRef.current.setStyleProperty('transform', 'rotate(90deg)')
    }

    if (birdYRef.current + BIRD_HEIGHT >= playH) {
      birdYRef.current = playH - BIRD_HEIGHT
      if (birdRef.current) {
        birdRef.current.setStyleProperty('top', `${birdYRef.current}px`)
      }
      return
    }

    requestAnimationFrame(fallTick)
  }

  requestAnimationFrame(fallTick)
}

// Autopilot: keep the bird alive by targeting pipe gaps (independent toggle OR benchmark)
function autoPilot(): void {
  'main thread'
  if (!(autopilotRef.current || benchActiveRef.current)) return
  if (gameStateRef.current !== 'playing') return

  // Target: center of next pipe gap ahead, or 40% of play height if no pipes
  let targetY = dynamicPlayHeightRef.current * 0.4
  for (let i = 0; i < pipeCountRef.current; i++) {
    if (pipesXRef.current[i]! + PIPE_WIDTH > BIRD_START_X - 10) {
      targetY = pipesGapYRef.current[i]!
      break
    }
  }

  // Flap when below target and not already rising fast
  if (birdYRef.current > targetY && velocityRef.current > -2) {
    velocityRef.current = FLAP_IMPULSE
  }
}

function gameTick(timestamp: number): void {
  'main thread'
  if (gameStateRef.current !== 'playing') return

  if (lastTimeRef.current === 0) {
    lastTimeRef.current = timestamp
    requestAnimationFrame(gameTick)
    return
  }

  // Autopilot: auto-flap to keep bird alive (independent toggle or benchmark)
  autoPilot()

  const dt = Math.min(timestamp - lastTimeRef.current, 33.33)
  const dtScale = dt / 16.67
  lastTimeRef.current = timestamp

  // Bird physics
  velocityRef.current += GRAVITY * dtScale
  if (velocityRef.current > TERMINAL_VELOCITY) {
    velocityRef.current = TERMINAL_VELOCITY
  }
  birdYRef.current += velocityRef.current * dtScale
  birdRotationRef.current = mapVelocityToRotation(velocityRef.current)

  // Update bird visual
  if (birdRef.current) {
    birdRef.current.setStyleProperty('top', `${birdYRef.current}px`)
    birdRef.current.setStyleProperty(
      'transform',
      `rotate(${birdRotationRef.current}deg)`,
    )
  }

  // Wing animation
  wingTimerRef.current += dt
  if (wingTimerRef.current > 100) {
    wingTimerRef.current = 0
    wingFrameRef.current = (wingFrameRef.current + 1) % 4
    updateBirdSprite()
  }

  // Pipe movement
  for (let i = 0; i < pipeCountRef.current; i++) {
    pipesXRef.current[i]! -= PIPE_SPEED * dtScale
  }

  // Spawn new pipes
  const gameW = dynamicGameWidthRef.current
  if (pipeCountRef.current === 0) {
    spawnPipe(gameW)
  } else {
    const lastPipeX = pipesXRef.current[pipeCountRef.current - 1]!
    if (lastPipeX < gameW - PIPE_SPACING) {
      spawnPipe(gameW)
    }
  }

  // Remove pipes that are off screen
  while (pipeCountRef.current > 0 && pipesXRef.current[0]! < -PIPE_WIDTH) {
    pipesXRef.current.shift()
    pipesGapYRef.current.shift()
    pipesScoredRef.current.shift()
    pipeCountRef.current--
  }

  // Score check
  for (let i = 0; i < pipeCountRef.current; i++) {
    if (
      !pipesScoredRef.current[i]
      && pipesXRef.current[i]! + PIPE_WIDTH / 2 < BIRD_START_X
    ) {
      pipesScoredRef.current[i] = true
      scoreRef.current += debugModeRef.current ? 10 : 1
      // MTS → BTS: notify of score change
      flashMtsToBts()
      runOnBackground(setScore)(scoreRef.current)
    }
  }

  // Update pipe visuals
  updatePipeVisuals()

  // Ground scroll — single offset drives all three strips (no float drift between them)
  groundOffsetRef.current -= PIPE_SPEED * dtScale
  if (groundOffsetRef.current <= -GROUND_WIDTH) {
    groundOffsetRef.current += GROUND_WIDTH
  }
  const groundEls = [ground0Ref, ground1Ref, ground2Ref]
  for (let i = 0; i < 3; i++) {
    if (groundEls[i]!.current) {
      groundEls[i]!.current!.setStyleProperty('left', `${groundOffsetRef.current + i * GROUND_WIDTH}px`)
    }
  }

  // Collision check — skipped during autopilot or benchmark (bounds clamping)
  if (autopilotRef.current || benchActiveRef.current) {
    const playH = dynamicPlayHeightRef.current
    if (birdYRef.current + BIRD_HEIGHT >= playH) {
      birdYRef.current = playH - BIRD_HEIGHT
      velocityRef.current = FLAP_IMPULSE
    }
    if (birdYRef.current < 0) {
      birdYRef.current = 0
      velocityRef.current = 1
    }
  } else if (checkCollision(
    birdYRef.current,
    dynamicPlayHeightRef.current,
    pipeCountRef.current,
    pipesXRef.current,
    pipesGapYRef.current,
  )) {
    gameStateRef.current = 'gameover'
    // MTS → BTS: notify of game over
    if (scoreRef.current > bestScoreMTSRef.current) {
      bestScoreMTSRef.current = scoreRef.current
    }
    flashMtsToBts()
    runOnBackground(setGameState)('gameover')
    flashMtsToBts()
    runOnBackground(setBestScore)(bestScoreMTSRef.current)

    // Flash effect
    if (flashRef.current) {
      flashRef.current.setStyleProperty('opacity', '0.8')
      const ref = flashRef
      setTimeout(() => {
        if (ref.current) {
          ref.current.setStyleProperty('opacity', '0')
        }
      }, 150)
    }

    fallToGround()
    return
  }

  updateDebugText(timestamp, getDebugSnapshot())

  // Stress test
  updateShadowBirds(birdYRef.current, birdRotationRef.current, wingFrameRef.current, allBirdFrames)
  sendStressSnapshot({
    birdY: birdYRef.current,
    velocity: velocityRef.current,
    rotation: birdRotationRef.current,
    score: scoreRef.current,
    pipeCount: pipeCountRef.current,
    pipesX: pipesXRef.current.slice(),
    pipesGapY: pipesGapYRef.current.slice(),
    timestamp,
  })
  // Count flood messages in debug stats
  if (floodRef.current > 0) {
    mtsBtsCountRef.current += floodRef.current
  }

  tickBenchmark(timestamp)
  requestAnimationFrame(gameTick)
}

function idleBob(timestamp: number): void {
  'main thread'
  if (gameStateRef.current !== 'idle') return

  idleTimeRef.current += 16.67
  const bobOffset =
    Math.sin((idleTimeRef.current / 1000) * BOB_SPEED) * BOB_AMPLITUDE
  const y = dynamicBirdStartYRef.current + bobOffset

  if (birdRef.current) {
    birdRef.current.setStyleProperty('top', `${y}px`)
  }

  // Wing animation (slower in idle)
  wingTimerRef.current += 16.67
  if (wingTimerRef.current > 150) {
    wingTimerRef.current = 0
    wingFrameRef.current = (wingFrameRef.current + 1) % 4
    updateBirdSprite()
  }

  // Shadow birds follow idle bob
  updateShadowBirds(y, 0, wingFrameRef.current, allBirdFrames)
  sendStressSnapshot({ birdY: y, velocity: 0, rotation: 0, score: 0, pipeCount: 0, pipesX: [], pipesGapY: [], timestamp })
  if (floodRef.current > 0) {
    mtsBtsCountRef.current += floodRef.current
  }

  updateDebugText(timestamp, getDebugSnapshot())
  tickBenchmark(timestamp)
  requestAnimationFrame(idleBob)
}

function startIdleAnimation(): void {
  'main thread'
  idleTimeRef.current = 0
  wingTimerRef.current = 0
  requestAnimationFrame(idleBob)
}

// ===== Touch Handlers (MTS) =====

function onTouchStart(_e: any): void {
  'main thread'
  const isTouch = !!_e.touches
  if (isTouch) {
    hasTouchRef.current = true
  } else if (hasTouchRef.current) {
    return // Synthesized mouse on touch device — skip
  }
  lastPointerRef.current = isTouch ? 'touch' : 'mouse'
  startLongPress(toggleDebugMode)
  // Immediate flap during gameplay for responsiveness
  if (gameStateRef.current === 'playing') {
    velocityRef.current = FLAP_IMPULSE
  }
}

function onTouchEnd(_e: any): void {
  'main thread'
  const isTouch = !!_e.touches
  if (!isTouch && hasTouchRef.current) return
  // Long press already fired — no further action
  if (endLongPress()) return

  // Short tap in idle → start game
  if (gameStateRef.current === 'idle') {
    gameStateRef.current = 'playing'
    velocityRef.current = FLAP_IMPULSE
    lastTimeRef.current = 0
    // Debug mode starts with score 10
    if (debugModeRef.current) {
      scoreRef.current = 10
      flashMtsToBts()
      runOnBackground(setScore)(10)
    }
    // MTS → BTS: notify of game start
    flashMtsToBts()
    runOnBackground(setGameState)('playing')
    requestAnimationFrame(gameTick)
  }
}

// ===== BTS Handlers =====

function onReplay(): void {
  setScore(0)
  setGameState('idle')
  void runOnMainThread(() => {
    'main thread'
    flashBtsToMts()
    resetGame()
    gameStateRef.current = 'idle'
    startIdleAnimation()
  })()
}

function syncStressConfig(birds: number, heavy: number, flood: number): void {
  void runOnMainThread((b: number, h: number, f: number) => {
    'main thread'
    applyStressConfig(b, h, f)
  })(birds, heavy, flood)
}

function handleBirdsChange(n: number): void {
  setStressBirds(n)
  syncStressConfig(n, stressHeavy.value, stressFlood.value)
}

function handleHeavyToggle(): void {
  const next = stressHeavy.value ? 0 : 1
  setStressHeavy(next)
  syncStressConfig(stressBirds.value, next, stressFlood.value)
}

function handleFloodChange(n: number): void {
  setStressFlood(n)
  syncStressConfig(stressBirds.value, stressHeavy.value, n)
}

function handleAutopilotToggle(): void {
  if (benchActive.value) return
  const next = !autopilot.value
  setAutopilot(next)
  void runOnMainThread((v: number) => {
    'main thread'
    autopilotRef.current = !!v
  })(next ? 1 : 0)
}

function handleAutoRamp(): void {
  void runOnMainThread(() => {
    'main thread'
    // Starting a new benchmark: ensure game is playing
    if (!benchActiveRef.current && gameStateRef.current !== 'playing') {
      if (gameStateRef.current === 'gameover') {
        resetGame()
      }
      gameStateRef.current = 'playing'
      velocityRef.current = FLAP_IMPULSE
      lastTimeRef.current = 0
      scoreRef.current = debugModeRef.current ? 10 : 0
      flashMtsToBts()
      runOnBackground(setScore)(scoreRef.current)
      flashMtsToBts()
      runOnBackground(setGameState)('playing')
      requestAnimationFrame(gameTick)
    }
    startBenchmark()
  })()
}

// ===== Lifecycle =====

// Re-apply layout on screen rotation / resize (driven by the website's ResizeObserver)
function onWindowResize(width?: number, height?: number): void {
  console.log(`[FlappyBird] onWindowResize triggered: ${width}x${height}`)
  const w = width ?? 0
  const h = height ?? 0
  void runOnMainThread((ow: number, oh: number) => {
    'main thread'
    overrideWRef.current = ow
    overrideHRef.current = oh
    flashBtsToMts()
    applyLayout()
  })(w, h)
}

let globalEmitter: { addListener(name: string, cb: (...args: any[]) => void): void; removeListener(name: string, cb: (...args: any[]) => void): void } | null = null

onMounted(() => {
  // Initialize layout, randomize variants, and start idle animation on mount
  void runOnMainThread(() => {
    'main thread'
    flashBtsToMts()
    applyLayout()
    randomizeVariants()
    startIdleAnimation()
  })()

  // Subscribe to global resize events (e.g. from web host's ResizeObserver)
  globalEmitter = lynx.getJSModule('GlobalEventEmitter')
  globalEmitter?.addListener('onWindowResize', onWindowResize)
})

onUnmounted(() => {
  globalEmitter?.removeListener('onWindowResize', onWindowResize)
})
</script>

<template>
  <view class="game-container" :main-thread-ref="containerRef">
    <view class="game-scaler" :main-thread-ref="scalerRef">
      <!-- Background -->
      <view class="background" :main-thread-ref="bgRef">
        <view
          class="background-img"
          :main-thread-ref="bgImgRef"
          :style="{ backgroundImage: `url(${backgroundDay})` }"
        />
      </view>

      <!-- Pipes -->
      <view class="pipes-container" :main-thread-ref="pipesContainerRef">
        <PipePair :pipe-ref="pipe0Ref" :top-ref="pipe0TopRef" :bot-ref="pipe0BotRef" :gap-ref="gap0Ref" />
        <PipePair :pipe-ref="pipe1Ref" :top-ref="pipe1TopRef" :bot-ref="pipe1BotRef" :gap-ref="gap1Ref" />
        <PipePair :pipe-ref="pipe2Ref" :top-ref="pipe2TopRef" :bot-ref="pipe2BotRef" :gap-ref="gap2Ref" />
        <PipePair :pipe-ref="pipe3Ref" :top-ref="pipe3TopRef" :bot-ref="pipe3BotRef" :gap-ref="gap3Ref" />
      </view>

      <!-- Ground — three independent strips for seamless scrolling.
           `left` is owned entirely by MTS (applyLayout / resetGame / gameTick);
           no Vue :style binding here, or a BTS re-render would clobber the
           MTS-scrolled positions and leave part of the row bare. -->
      <view class="ground-strip" :main-thread-ref="ground0Ref">
        <image :src="base" class="ground-img" />
      </view>
      <view class="ground-strip" :main-thread-ref="ground1Ref">
        <image :src="base" class="ground-img" />
      </view>
      <view class="ground-strip" :main-thread-ref="ground2Ref">
        <image :src="base" class="ground-img" />
      </view>

      <!-- Shadow birds (stress test L1+) — count driven by SHADOW_BIRD_COUNT -->
      <view
        v-for="(_, i) in SHADOW_BIRD_COUNT"
        :key="`sb-${i}`"
        class="shadow-bird"
        :main-thread-ref="shadowRefs[i]"
        :style="{ display: 'none', left: `${SHADOW_X[i]}px` }"
      >
        <image
          :src="allBirdFrames[Math.floor(i / 2) % 3]![0]"
          class="bird-img"
          :main-thread-ref="shadowImgRefs[i]"
        />
      </view>

      <!-- Bird -->
      <view class="bird" :main-thread-ref="birdRef">
        <image :src="yellowBirdMid" class="bird-img" :main-thread-ref="birdImgRef" />
      </view>

      <!-- Score -->
      <ScoreDigits
        v-if="gameState === 'playing'"
        :value="score"
        container-class-name="score-container"
        digit-class-name="score-digit"
        key-prefix="score"
      />

      <!-- Flash overlay -->
      <view class="flash-overlay" :main-thread-ref="flashRef" />

      <!-- Start screen -->
      <view v-if="gameState === 'idle'" class="overlay">
        <image :src="messageImg" class="start-message" />
      </view>

      <!-- Debug hint — shown in idle when debug mode is off -->
      <text
        v-if="gameState === 'idle' && !debugMode"
        class="debug-hint"
        :style="{ bottom: `${groundHeight - 2}px` }"
      >long press for debug mode</text>

      <!-- Game over screen -->
      <GameOverScreen
        v-if="gameState === 'gameover'"
        :score="score"
        :best-score="bestScore"
        @replay="onReplay"
      />

      <!-- Touch area — sits on top of game overlays for tap/long-press.
           Bind both touch + mouse: touch for mobile, mouse for desktop.
           On mobile web, browser synthesizes mouse from touch causing double-fire;
           startLongPress has a re-entry guard to handle this. -->
      <view
        v-if="gameState !== 'gameover'"
        class="touch-area"
        :main-thread-bindtouchstart="onTouchStart"
        :main-thread-bindtouchend="onTouchEnd"
        :main-thread-bindtouchcancel="onTouchEnd"
        :main-thread-bindmousedown="onTouchStart"
        :main-thread-bindmouseup="onTouchEnd"
      />

      <!-- Unified Dev HUD — after touch area so inputs receive focus -->
      <DevPanel
        :visible="debugMode"
        :debug-text-ref="debugTextRef"
        :thread-text-ref="threadTextRef"
        :mts-bts-led-ref="mtsBtsLedRef"
        :bts-mts-led-ref="btsMtsLedRef"
        :boundary-top-ref="boundaryTopRef"
        :boundary-bottom-ref="boundaryBottomRef"
        :birds="stressBirds"
        :heavy="!!stressHeavy"
        :flood="stressFlood"
        :autopilot="autopilot"
        :bench-active="benchActive"
        :bench-result="benchResult"
        @birds-change="handleBirdsChange"
        @heavy-toggle="handleHeavyToggle"
        @flood-change="handleFloodChange"
        @autopilot-toggle="handleAutopilotToggle"
        @auto-ramp="handleAutoRamp"
      />
    </view>
  </view>
</template>
