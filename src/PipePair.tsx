import type { MainThread } from '@lynx-js/types';
import type { MainThreadRef } from '@lynx-js/react';

import pipeGreen from '../assets/sprites/pipe-green.png';
import { GAME_WIDTH } from './mts/constants.js';

interface PipePairProps {
  pipeRef: MainThreadRef<MainThread.Element>;
  topRef: MainThreadRef<MainThread.Element>;
  botRef: MainThreadRef<MainThread.Element>;
  gapRef: MainThreadRef<MainThread.Element>;
}

export function PipePair({ pipeRef, topRef, botRef, gapRef }: PipePairProps) {
  return (
    <view
      className="pipe-pair"
      main-thread:ref={pipeRef}
      style={{ left: `${GAME_WIDTH + 100}px` }}
    >
      <view className="pipe-top" main-thread:ref={topRef}>
        <image src={pipeGreen} className="pipe-top-img" />
      </view>
      <view className="pipe-bottom" main-thread:ref={botRef}>
        <image src={pipeGreen} className="pipe-bottom-img" />
      </view>
      <view className="pipe-gap-zone" main-thread:ref={gapRef} style={{ display: 'none' }} />
    </view>
  );
}
