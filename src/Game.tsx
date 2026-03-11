import {
  useCallback,
  useEffect,
  useLynxGlobalEventListener,
  useMainThreadRef,
  useState,
} from '@lynx-js/react';
import { runOnBackground, runOnMainThread } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import './Game.css';
import type { GameState } from './types.js';
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
} from './mts/constants.js';
import { mapVelocityToRotation } from './mts/physics.js';
import { checkCollision } from './mts/collision.js';
import { computeLayout } from './mts/layout.js';
import backgroundDay from '../assets/sprites/background-day.png';
import backgroundNight from '../assets/sprites/background-night.png';
import base from '../assets/sprites/base.png';
import messageImg from '../assets/sprites/message.png';
import yellowBirdDown from '../assets/sprites/yellowbird-downflap.png';
import yellowBirdMid from '../assets/sprites/yellowbird-midflap.png';
import yellowBirdUp from '../assets/sprites/yellowbird-upflap.png';
import blueBirdDown from '../assets/sprites/bluebird-downflap.png';
import blueBirdMid from '../assets/sprites/bluebird-midflap.png';
import blueBirdUp from '../assets/sprites/bluebird-upflap.png';
import redBirdDown from '../assets/sprites/redbird-downflap.png';
import redBirdMid from '../assets/sprites/redbird-midflap.png';
import redBirdUp from '../assets/sprites/redbird-upflap.png';
import lynxBirdDown from '../assets/sprites/lynxbird-downflap.png';
import lynxBirdMid from '../assets/sprites/lynxbird-midflap.png';
import lynxBirdUp from '../assets/sprites/lynxbird-upflap.png';

import { ScoreDigits } from './ScoreDigits.js';
import { GameOverScreen } from './GameOverScreen.js';
import { PipePair } from './PipePair.js';
import { useDebugMode } from './useDebugMode.js';
import type { DebugSnapshot } from './useDebugMode.js';

const allBirdFrames = [
  [yellowBirdMid, yellowBirdDown, yellowBirdMid, yellowBirdUp],
  [blueBirdMid, blueBirdDown, blueBirdMid, blueBirdUp],
  [redBirdMid, redBirdDown, redBirdMid, redBirdUp],
  [lynxBirdMid, lynxBirdDown, lynxBirdMid, lynxBirdUp],
];
const backgrounds = [backgroundDay, backgroundNight];
// Sky colors matching the top of each background image (for the gap above the sprite)
const bgSkyColors = ['#4ec0ca', '#008793'];

const isWeb = SystemInfo.platform === 'web';
const isDesktopWeb = isWeb && !('ontouchstart' in globalThis);
const pointerMode = isDesktopWeb ? 'mouse' : isWeb ? 'touch(web)' : 'touch(native)';

export function Game() {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(10); // TODO: reset to 0 after testing
  const [bestScore, setBestScore] = useState(10); // TODO: reset to 0 after testing
  const [groundHeight, setGroundHeight] = useState(112);

  // Current variant index (randomized on each game start)
  const birdVariantRef = useMainThreadRef(0);
  const bgVariantRef = useMainThreadRef(0);

  // MTS refs for direct element manipulation
  const containerRef = useMainThreadRef<MainThread.Element>(null);
  const bgRef = useMainThreadRef<MainThread.Element>(null);
  const bgImgRef = useMainThreadRef<MainThread.Element>(null);
  const scalerRef = useMainThreadRef<MainThread.Element>(null);
  const birdRef = useMainThreadRef<MainThread.Element>(null);
  const birdImgRef = useMainThreadRef<MainThread.Element>(null);
  const ground0Ref = useMainThreadRef<MainThread.Element>(null);
  const ground1Ref = useMainThreadRef<MainThread.Element>(null);
  const ground2Ref = useMainThreadRef<MainThread.Element>(null);
  const flashRef = useMainThreadRef<MainThread.Element>(null);
  const pipesContainerRef = useMainThreadRef<MainThread.Element>(null);

  // Pipe refs: each pipe pair has a container, top pipe, and bottom pipe
  const pipe0Ref = useMainThreadRef<MainThread.Element>(null);
  const pipe0TopRef = useMainThreadRef<MainThread.Element>(null);
  const pipe0BotRef = useMainThreadRef<MainThread.Element>(null);
  const pipe1Ref = useMainThreadRef<MainThread.Element>(null);
  const pipe1TopRef = useMainThreadRef<MainThread.Element>(null);
  const pipe1BotRef = useMainThreadRef<MainThread.Element>(null);
  const pipe2Ref = useMainThreadRef<MainThread.Element>(null);
  const pipe2TopRef = useMainThreadRef<MainThread.Element>(null);
  const pipe2BotRef = useMainThreadRef<MainThread.Element>(null);
  const pipe3Ref = useMainThreadRef<MainThread.Element>(null);
  const pipe3TopRef = useMainThreadRef<MainThread.Element>(null);
  const pipe3BotRef = useMainThreadRef<MainThread.Element>(null);

  // Debug mode
  const {
    debugMode, setDebugMode, debugModeRef,
    debugTextRef, mtsBtsLedRef, btsMtsLedRef,
    gap0Ref, gap1Ref, gap2Ref, gap3Ref,
    boundaryTopRef, boundaryBottomRef,
    applyDebugOverlay, updateBoundaryLines, flashMtsToBts, flashBtsToMts,
    updateDebugText, updateGapZone,
    startLongPress, endLongPress,
  } = useDebugMode();

  // MTS game state (not React state — these live on main thread)
  const velocityRef = useMainThreadRef(0);
  const birdYRef = useMainThreadRef(200);
  const birdRotationRef = useMainThreadRef(0);
  const ground0XRef = useMainThreadRef(0);
  const ground1XRef = useMainThreadRef(GROUND_WIDTH);
  const ground2XRef = useMainThreadRef(GROUND_WIDTH * 2);
  const gameStateRef = useMainThreadRef<'idle' | 'playing' | 'gameover'>('idle');
  const scoreRef = useMainThreadRef(10); // TODO: reset to 0 after testing
  const lastTimeRef = useMainThreadRef(0);
  const wingFrameRef = useMainThreadRef(0);
  const wingTimerRef = useMainThreadRef(0);
  const idleTimeRef = useMainThreadRef(0);

  // Override dimensions sent from the website's ResizeObserver
  const overrideWRef = useMainThreadRef(0);
  const overrideHRef = useMainThreadRef(0);

  // Dynamic dimensions (computed once at init from screen size)
  const dynamicGameWidthRef = useMainThreadRef(GAME_WIDTH);
  const dynamicGroundHeightRef = useMainThreadRef(112);
  const dynamicPlayHeightRef = useMainThreadRef(400);
  const dynamicBirdStartYRef = useMainThreadRef(200);

  // Pipe state on main thread
  const pipesXRef = useMainThreadRef<number[]>([]);
  const pipesGapYRef = useMainThreadRef<number[]>([]);
  const pipesScoredRef = useMainThreadRef<boolean[]>([]);
  const pipeCountRef = useMainThreadRef(0);

  // MTS-side best score tracking (avoids needing updater function across threads)
  const bestScoreMTSRef = useMainThreadRef(0);

  // ===== MTS Helper: get pipe refs by index =====

  function getPipeRef(idx: number) {
    'main thread';
    if (idx === 0) return pipe0Ref.current;
    if (idx === 1) return pipe1Ref.current;
    if (idx === 2) return pipe2Ref.current;
    if (idx === 3) return pipe3Ref.current;
    return null;
  }

  function getPipeTopRef(idx: number) {
    'main thread';
    if (idx === 0) return pipe0TopRef.current;
    if (idx === 1) return pipe1TopRef.current;
    if (idx === 2) return pipe2TopRef.current;
    if (idx === 3) return pipe3TopRef.current;
    return null;
  }

  function getPipeBotRef(idx: number) {
    'main thread';
    if (idx === 0) return pipe0BotRef.current;
    if (idx === 1) return pipe1BotRef.current;
    if (idx === 2) return pipe2BotRef.current;
    if (idx === 3) return pipe3BotRef.current;
    return null;
  }

  // ===== MTS: Responsive layout (contain / fit-inside strategy) =====

  function applyLayout(): void {
    'main thread';
    // Try reading the actual container element dimensions (works on web all-on-ui
    // where MTS elements are real HTMLElements). This makes the game adapt to the
    // lynx-view container instead of the browser viewport.
    // On native, clientWidth/clientHeight aren't available, so fall back to SystemInfo
    // (which correctly reflects the LynxView dimensions on native).
    const overW = overrideWRef.current;
    const overH = overrideHRef.current;
    const el = containerRef.current as any;
    const elW = el?.clientWidth;
    const elH = el?.clientHeight;
    const sysW = SystemInfo.pixelWidth / SystemInfo.pixelRatio;
    const sysH = SystemInfo.pixelHeight / SystemInfo.pixelRatio;
    const cssWidth = (overW > 0) ? overW : (elW > 0) ? elW : sysW;
    const cssHeight = (overH > 0) ? overH : (elH > 0) ? elH : sysH;
    console.log(
      `[applyLayout] override=${overW}x${overH} el=${elW}x${elH} sys=${sysW}x${sysH} → used=${cssWidth}x${cssHeight}`,
    );
    const layout = computeLayout(cssWidth, cssHeight);
    console.log(
      `[applyLayout] scale=${layout.scale.toFixed(3)} offset=(${layout.offsetX.toFixed(1)},${layout.offsetY.toFixed(1)}) game=${layout.gameWidth}x${layout.gameHeight} play=${layout.playHeight}`,
    );

    dynamicGameWidthRef.current = layout.gameWidth;
    dynamicGroundHeightRef.current = layout.groundHeight;
    dynamicPlayHeightRef.current = layout.playHeight;
    dynamicBirdStartYRef.current = layout.birdStartY;

    // Apply scale + center (pillarbox / letterbox) to the inner wrapper
    if (scalerRef.current) {
      scalerRef.current.setStyleProperty('width', `${layout.gameWidth}px`);
      scalerRef.current.setStyleProperty('height', `${layout.gameHeight}px`);
      scalerRef.current.setStyleProperty(
        'transform',
        `translate(${layout.offsetX}px, ${layout.offsetY}px) scale(${layout.scale})`,
      );
    }

    // Set dynamic pipe container dimensions
    if (pipesContainerRef.current) {
      pipesContainerRef.current.setStyleProperty('width', `${layout.gameWidth}px`);
      pipesContainerRef.current.setStyleProperty('height', `${layout.playHeight}px`);
    }
    for (let i = 0; i < MAX_PIPES; i++) {
      const ref = getPipeRef(i);
      if (ref) {
        ref.setStyleProperty('height', `${layout.playHeight}px`);
      }
    }

    // Set dynamic ground height on strips and background offset
    const gH = layout.groundHeight;
    const groundEls = [ground0Ref, ground1Ref, ground2Ref];
    for (let i = 0; i < 3; i++) {
      if (groundEls[i]!.current) {
        groundEls[i]!.current!.setStyleProperty('height', `${gH}px`);
      }
    }
    if (bgImgRef.current) {
      bgImgRef.current.setStyleProperty('bottom', `${gH}px`);
    }

    // Sync ground height to BTS for conditional UI positioning
    runOnBackground(setGroundHeight)(gH);

    // Align debug overlays to dynamic ground height
    if (debugTextRef.current) {
      debugTextRef.current.setStyleProperty('bottom', `${gH + 4}px`);
    }
    if (mtsBtsLedRef.current) {
      mtsBtsLedRef.current.setStyleProperty('bottom', `${gH + 6}px`);
    }
    if (btsMtsLedRef.current) {
      btsMtsLedRef.current.setStyleProperty('bottom', `${gH + 6}px`);
    }

    // Update debug boundary lines
    updateBoundaryLines(layout.playHeight, PIPE_GAP);

    // Set bird start position
    birdYRef.current = dynamicBirdStartYRef.current;
    if (birdRef.current) {
      birdRef.current.setStyleProperty('top', `${dynamicBirdStartYRef.current}px`);
    }
  }

  // ===== Main Thread Game Loop =====

  function updateBirdSprite(): void {
    'main thread';
    if (birdImgRef.current) {
      const frames = allBirdFrames[birdVariantRef.current]!;
      birdImgRef.current.setAttribute('src', frames[wingFrameRef.current]!);
    }
  }

  function applyBirdScale(): void {
    'main thread';
    if (birdImgRef.current) {
      const isLynx = birdVariantRef.current === 3;
      birdImgRef.current.setStyleProperty('width', isLynx ? '51px' : '34px');
      birdImgRef.current.setStyleProperty('height', isLynx ? '36px' : '24px');
      birdImgRef.current.setStyleProperty('margin-left', isLynx ? '-8.5px' : '0px');
      birdImgRef.current.setStyleProperty('margin-top', isLynx ? '-6px' : '0px');
    }
  }

  function getDebugSnapshot(): DebugSnapshot {
    'main thread';
    return {
      birdY: birdYRef.current,
      velocity: velocityRef.current,
      rotation: birdRotationRef.current,
      birdVariant: birdVariantRef.current,
      pipeCount: pipeCountRef.current,
      pipesX: pipesXRef.current,
      pipesGapY: pipesGapYRef.current,
      score: scoreRef.current,
      pointerMode,
    };
  }

  function randomizeVariants(): void {
    'main thread';
    if (debugModeRef.current) {
      // Debug mode always uses lynxbird
      birdVariantRef.current = 3;
    } else {
      // 50% chance for lynxbird, 50% for a random classic bird
      if (Math.random() < 0.5) {
        birdVariantRef.current = 3; // lynxbird
      } else {
        birdVariantRef.current = Math.floor(Math.random() * 3); // classic birds (0-2)
      }
    }
    bgVariantRef.current = Math.floor(Math.random() * backgrounds.length);

    // Update background image + sky color
    if (bgImgRef.current) {
      bgImgRef.current.setStyleProperty('background-image', `url(${backgrounds[bgVariantRef.current]!})`);
    }
    if (bgRef.current) {
      bgRef.current.setStyleProperty('background-color', bgSkyColors[bgVariantRef.current]!);
    }
    applyBirdScale();
    // Update bird sprite to current variant
    updateBirdSprite();
  }

  function toggleDebugMode(): void {
    'main thread';
    debugModeRef.current = !debugModeRef.current;
    if (debugModeRef.current) {
      // Force lynxbird in debug mode
      birdVariantRef.current = 3;
      applyBirdScale();
      updateBirdSprite();
    } else {
      // Re-randomize when leaving debug mode
      randomizeVariants();
    }
    applyDebugOverlay(birdRef);
    flashMtsToBts();
    runOnBackground(setDebugMode)(debugModeRef.current);
  }

  function spawnPipe(startX: number): void {
    'main thread';
    const playH = dynamicPlayHeightRef.current;
    // Fixed 260px gap Y range, centered in play area
    const GAP_RANGE = 260;
    const minGapY = Math.round((playH - GAP_RANGE) / 2);
    const maxGapY = Math.round((playH + GAP_RANGE) / 2);
    const gapY = minGapY + Math.random() * (maxGapY - minGapY);

    const idx = pipeCountRef.current;
    if (idx < MAX_PIPES) {
      pipesXRef.current[idx] = startX;
      pipesGapYRef.current[idx] = gapY;
      pipesScoredRef.current[idx] = false;
      pipeCountRef.current = idx + 1;
    }
  }

  function resetGame(): void {
    'main thread';
    const birdStartY = dynamicBirdStartYRef.current;
    velocityRef.current = 0;
    birdYRef.current = birdStartY;
    birdRotationRef.current = 0;
    ground0XRef.current = 0;
    ground1XRef.current = GROUND_WIDTH;
    ground2XRef.current = GROUND_WIDTH * 2;
    scoreRef.current = 0;
    pipeCountRef.current = 0;
    pipesXRef.current = [];
    pipesGapYRef.current = [];
    pipesScoredRef.current = [];
    wingFrameRef.current = 0;
    idleTimeRef.current = 0;
    lastTimeRef.current = 0;

    // Reset bird position
    if (birdRef.current) {
      birdRef.current.setStyleProperty('top', `${birdStartY}px`);
      birdRef.current.setStyleProperty('transform', 'rotate(0deg)');
    }

    // Hide all pipes off screen
    for (let i = 0; i < MAX_PIPES; i++) {
      const ref = getPipeRef(i);
      if (ref) {
        ref.setStyleProperty('left', `${dynamicGameWidthRef.current + 100}px`);
      }
    }

    // Reset ground
    if (ground0Ref.current) {
      ground0Ref.current.setStyleProperty('left', '0px');
    }
    if (ground1Ref.current) {
      ground1Ref.current.setStyleProperty('left', `${GROUND_WIDTH}px`);
    }
    if (ground2Ref.current) {
      ground2Ref.current.setStyleProperty('left', `${GROUND_WIDTH * 2}px`);
    }

    // Randomize bird color and background on each restart
    randomizeVariants();
  }

  function updatePipeVisuals(): void {
    'main thread';
    const playH = dynamicPlayHeightRef.current;
    for (let i = 0; i < pipeCountRef.current; i++) {
      const pipeRef = getPipeRef(i);
      const topRef = getPipeTopRef(i);
      const botRef = getPipeBotRef(i);

      if (pipeRef) {
        pipeRef.setStyleProperty('left', `${pipesXRef.current[i]}px`);
      }

      const gapY = pipesGapYRef.current[i]!;
      const topPipeHeight = gapY - PIPE_GAP / 2;
      const bottomPipeTop = gapY + PIPE_GAP / 2;

      if (topRef) {
        topRef.setStyleProperty('height', `${topPipeHeight}px`);
      }
      if (botRef) {
        botRef.setStyleProperty('top', `${bottomPipeTop}px`);
        botRef.setStyleProperty('height', `${playH - bottomPipeTop}px`);
      }

      // Debug: gap safe zone
      updateGapZone(i, topPipeHeight, PIPE_GAP);
    }

    // Hide unused pipe slots
    for (let i = pipeCountRef.current; i < MAX_PIPES; i++) {
      const ref = getPipeRef(i);
      if (ref) {
        ref.setStyleProperty('left', `${dynamicGameWidthRef.current + 100}px`);
      }
    }
  }

  // fallToGround must be declared before gameTick (SWC transforms function
  // declarations to let bindings — order matters for TDZ).
  function fallToGround(): void {
    'main thread';
    lastTimeRef.current = 0;
    const playH = dynamicPlayHeightRef.current;

    const fallTick = (timestamp: number) => {
      // Stop if game was reset (e.g. user clicked Replay before bird landed)
      if (gameStateRef.current !== 'gameover') return;

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
        requestAnimationFrame(fallTick);
        return;
      }
      const dt = Math.min(timestamp - lastTimeRef.current, 33.33);
      const dtScale = dt / 16.67;
      lastTimeRef.current = timestamp;

      velocityRef.current += GRAVITY * dtScale;
      if (velocityRef.current > TERMINAL_VELOCITY) {
        velocityRef.current = TERMINAL_VELOCITY;
      }
      birdYRef.current += velocityRef.current * dtScale;

      if (birdRef.current) {
        birdRef.current.setStyleProperty('top', `${birdYRef.current}px`);
        birdRef.current.setStyleProperty('transform', 'rotate(90deg)');
      }

      if (birdYRef.current + BIRD_HEIGHT >= playH) {
        birdYRef.current = playH - BIRD_HEIGHT;
        if (birdRef.current) {
          birdRef.current.setStyleProperty('top', `${birdYRef.current}px`);
        }
        return;
      }

      requestAnimationFrame(fallTick);
    };

    requestAnimationFrame(fallTick);
  }

  function gameTick(timestamp: number): void {
    'main thread';
    if (gameStateRef.current !== 'playing') return;

    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
      requestAnimationFrame(gameTick);
      return;
    }

    const dt = Math.min(timestamp - lastTimeRef.current, 33.33);
    const dtScale = dt / 16.67;
    lastTimeRef.current = timestamp;

    // Bird physics
    velocityRef.current += GRAVITY * dtScale;
    if (velocityRef.current > TERMINAL_VELOCITY) {
      velocityRef.current = TERMINAL_VELOCITY;
    }
    birdYRef.current += velocityRef.current * dtScale;
    birdRotationRef.current = mapVelocityToRotation(velocityRef.current);

    // Update bird visual
    if (birdRef.current) {
      birdRef.current.setStyleProperty('top', `${birdYRef.current}px`);
      birdRef.current.setStyleProperty(
        'transform',
        `rotate(${birdRotationRef.current}deg)`,
      );
    }

    // Wing animation
    wingTimerRef.current += dt;
    if (wingTimerRef.current > 100) {
      wingTimerRef.current = 0;
      wingFrameRef.current = (wingFrameRef.current + 1) % 4;
      updateBirdSprite();
    }

    // Pipe movement
    for (let i = 0; i < pipeCountRef.current; i++) {
      pipesXRef.current[i]! -= PIPE_SPEED * dtScale;
    }

    // Spawn new pipes
    const gameW = dynamicGameWidthRef.current;
    if (pipeCountRef.current === 0) {
      spawnPipe(gameW);
    } else {
      const lastPipeX = pipesXRef.current[pipeCountRef.current - 1]!;
      if (lastPipeX < gameW - PIPE_SPACING) {
        spawnPipe(gameW);
      }
    }

    // Remove pipes that are off screen
    while (pipeCountRef.current > 0 && pipesXRef.current[0]! < -PIPE_WIDTH) {
      pipesXRef.current.shift();
      pipesGapYRef.current.shift();
      pipesScoredRef.current.shift();
      pipeCountRef.current--;
    }

    // Score check
    for (let i = 0; i < pipeCountRef.current; i++) {
      if (
        !pipesScoredRef.current[i]
        && pipesXRef.current[i]! + PIPE_WIDTH / 2 < BIRD_START_X
      ) {
        pipesScoredRef.current[i] = true;
        scoreRef.current += debugModeRef.current ? 10 : 1;
        // MTS → BTS: notify React of score change
        flashMtsToBts();
        runOnBackground(setScore)(scoreRef.current);
      }
    }

    // Update pipe visuals
    updatePipeVisuals();

    // Ground scroll — three strips that wrap around (3 needed for wider screens)
    const groundRefs = [ground0XRef, ground1XRef, ground2XRef];
    const groundEls = [ground0Ref, ground1Ref, ground2Ref];
    for (let i = 0; i < 3; i++) {
      groundRefs[i]!.current -= PIPE_SPEED * dtScale;
      if (groundRefs[i]!.current <= -GROUND_WIDTH) {
        // Find the rightmost strip and place after it
        let maxX = -Infinity;
        for (let j = 0; j < 3; j++) {
          if (j !== i && groundRefs[j]!.current > maxX) maxX = groundRefs[j]!.current;
        }
        groundRefs[i]!.current = maxX + GROUND_WIDTH;
      }
      if (groundEls[i]!.current) {
        groundEls[i]!.current!.setStyleProperty('left', `${groundRefs[i]!.current}px`);
      }
    }

    // Collision check
    if (checkCollision(
      birdYRef.current,
      dynamicPlayHeightRef.current,
      pipeCountRef.current,
      pipesXRef.current,
      pipesGapYRef.current,
    )) {
      gameStateRef.current = 'gameover';
      // MTS → BTS: notify React of game over
      if (scoreRef.current > bestScoreMTSRef.current) {
        bestScoreMTSRef.current = scoreRef.current;
      }
      flashMtsToBts();
      runOnBackground(setGameState)('gameover');
      flashMtsToBts();
      runOnBackground(setBestScore)(bestScoreMTSRef.current);

      // Flash effect
      if (flashRef.current) {
        flashRef.current.setStyleProperty('opacity', '0.8');
        const ref = flashRef;
        setTimeout(() => {
          if (ref.current) {
            ref.current.setStyleProperty('opacity', '0');
          }
        }, 150);
      }

      fallToGround();
      return;
    }

    updateDebugText(timestamp, getDebugSnapshot());
    requestAnimationFrame(gameTick);
  }

  function idleBob(timestamp: number): void {
    'main thread';
    if (gameStateRef.current !== 'idle') return;

    idleTimeRef.current += 16.67;
    const bobOffset =
      Math.sin((idleTimeRef.current / 1000) * BOB_SPEED) * BOB_AMPLITUDE;
    const y = dynamicBirdStartYRef.current + bobOffset;

    if (birdRef.current) {
      birdRef.current.setStyleProperty('top', `${y}px`);
    }

    // Wing animation (slower in idle)
    wingTimerRef.current += 16.67;
    if (wingTimerRef.current > 150) {
      wingTimerRef.current = 0;
      wingFrameRef.current = (wingFrameRef.current + 1) % 4;
      updateBirdSprite();
    }

    updateDebugText(timestamp, getDebugSnapshot());
    requestAnimationFrame(idleBob);
  }

  function startIdleAnimation(): void {
    'main thread';
    idleTimeRef.current = 0;
    wingTimerRef.current = 0;
    requestAnimationFrame(idleBob);
  }

  // ===== Touch Handler (MTS) =====

  function onTouchStart(_e: MainThread.TouchEvent): void {
    'main thread';
    startLongPress(toggleDebugMode);
    // Immediate flap during gameplay for responsiveness
    if (gameStateRef.current === 'playing') {
      velocityRef.current = FLAP_IMPULSE;
    }
  }

  function onTouchEnd(_e: MainThread.TouchEvent): void {
    'main thread';
    // Long press already fired — no further action
    if (endLongPress()) return;

    // Short tap in idle → start game
    if (gameStateRef.current === 'idle') {
      gameStateRef.current = 'playing';
      velocityRef.current = FLAP_IMPULSE;
      lastTimeRef.current = 0;
      // Debug mode starts with score 10
      if (debugModeRef.current) {
        scoreRef.current = 10;
        flashMtsToBts();
        runOnBackground(setScore)(10);
      }
      // MTS → BTS: notify React of game start
      flashMtsToBts();
      runOnBackground(setGameState)('playing');
      requestAnimationFrame(gameTick);
    }
  }

  // ===== BTS Handlers =====

  const onReplay = useCallback(() => {
    'background-only';
    setScore(0);
    setGameState('idle');
    void runOnMainThread(() => {
      'main thread';
      flashBtsToMts();
      resetGame();
      gameStateRef.current = 'idle';
      startIdleAnimation();
    })();
  }, []);

  // Initialize layout, randomize variants, and start idle animation on mount
  useEffect(() => {
    void runOnMainThread(() => {
      'main thread';
      flashBtsToMts();
      applyLayout();
      randomizeVariants();
      startIdleAnimation();
    })();
  }, []);

  // Re-apply layout on screen rotation / resize
  useLynxGlobalEventListener('onWindowResize', (width?: number, height?: number) => {
    console.log(`[FlappyBird] onWindowResize triggered: ${width}x${height}`);
    const w = width ?? 0;
    const h = height ?? 0;
    void runOnMainThread((ow: number, oh: number) => {
      'main thread';
      overrideWRef.current = ow;
      overrideHRef.current = oh;
      flashBtsToMts();
      applyLayout();
    })(w, h);
  });

  // ===== Render =====

  return (
    <view className="game-container" main-thread:ref={containerRef}>
      <view className="game-scaler" main-thread:ref={scalerRef}>
        {/* Background */}
        <view className="background" main-thread:ref={bgRef}>
          <view
            className="background-img"
            main-thread:ref={bgImgRef}
            style={{ backgroundImage: `url(${backgroundDay})` }}
          />
        </view>

        {/* Pipes */}
        <view className="pipes-container" main-thread:ref={pipesContainerRef}>
          <PipePair pipeRef={pipe0Ref} topRef={pipe0TopRef} botRef={pipe0BotRef} gapRef={gap0Ref} />
          <PipePair pipeRef={pipe1Ref} topRef={pipe1TopRef} botRef={pipe1BotRef} gapRef={gap1Ref} />
          <PipePair pipeRef={pipe2Ref} topRef={pipe2TopRef} botRef={pipe2BotRef} gapRef={gap2Ref} />
          <PipePair pipeRef={pipe3Ref} topRef={pipe3TopRef} botRef={pipe3BotRef} gapRef={gap3Ref} />
        </view>

        {/* Ground — two independent strips for seamless scrolling */}
        <view className="ground-strip" main-thread:ref={ground0Ref} style={{ left: '0px' }}>
          <image src={base} className="ground-img" />
        </view>
        <view className="ground-strip" main-thread:ref={ground1Ref} style={{ left: `${GROUND_WIDTH}px` }}>
          <image src={base} className="ground-img" />
        </view>
        <view className="ground-strip" main-thread:ref={ground2Ref} style={{ left: `${GROUND_WIDTH * 2}px` }}>
          <image src={base} className="ground-img" />
        </view>

        {/* Bird */}
        <view className="bird" main-thread:ref={birdRef}>
          <image src={yellowBirdMid} className="bird-img" main-thread:ref={birdImgRef} />
        </view>

        {/* Score */}
        {gameState === 'playing' && (
          <ScoreDigits
            value={score}
            containerClassName="score-container"
            digitClassName="score-digit"
            keyPrefix="score"
          />
        )}

        {/* Flash overlay */}
        <view className="flash-overlay" main-thread:ref={flashRef} />

        {/* Start screen */}
        {gameState === 'idle' && (
          <view className="overlay">
            <image src={messageImg} className="start-message" />
          </view>
        )}

        {/* Debug hint — shown in idle when debug mode is off */}
        {gameState === 'idle' && !debugMode && (
          <text className="debug-text" style={{ bottom: `${groundHeight + 4}px` }}>long press for debug mode</text>
        )}

        {/* Game over screen */}
        {gameState === 'gameover' && (
          <GameOverScreen
            score={score}
            bestScore={bestScore}
            onReplay={onReplay}
          />
        )}

        {/* Debug info overlay */}
        <text className="debug-text" main-thread:ref={debugTextRef} style={{ display: 'none' }}>
          {' '}
        </text>
        {/* MTS↔BTS communication LEDs */}
        <view className="debug-led debug-led-mts" main-thread:ref={mtsBtsLedRef} style={{ display: 'none' }} />
        <view className="debug-led debug-led-bts" main-thread:ref={btsMtsLedRef} style={{ display: 'none' }} />
        {/* Pipe spawn boundary lines */}
        <view className="debug-boundary" main-thread:ref={boundaryTopRef} style={{ display: 'none' }} />
        <view className="debug-boundary" main-thread:ref={boundaryBottomRef} style={{ display: 'none' }} />

        {/* Touch area — must be last to sit on top of overlays */}
        {/* Desktop web (no touch): mouse only.
            Touch web + Native: touch only (mouse events have ~300ms delay on iOS Safari). */}
        {gameState !== 'gameover' && (
          isDesktopWeb
            ? <view
                className="touch-area"
                main-thread:bindmousedown={onTouchStart as any}
                main-thread:bindmouseup={onTouchEnd as any}
              />
            : <view
                className="touch-area"
                main-thread:bindtouchstart={onTouchStart}
                main-thread:bindtouchend={onTouchEnd}
              />
        )}
      </view>
    </view>
  );
}
