import replayImg from '../assets/sprites/replay.png';
import medalBronze from '../assets/sprites/medal_bronze.png';
import medalSilver from '../assets/sprites/medal_silver.png';
import medalGold from '../assets/sprites/medal_gold.png';
import medalPlatinum from '../assets/sprites/medal_platinum.png';

import { ScoreDigits } from './ScoreDigits.js';

function getMedalSrc(score: number): string | null {
  if (score >= 40) return medalPlatinum;
  if (score >= 30) return medalGold;
  if (score >= 20) return medalSilver;
  if (score >= 10) return medalBronze;
  return null;
}

export function GameOverScreen({
  score,
  bestScore,
  onReplay,
}: {
  score: number;
  bestScore: number;
  onReplay: () => void;
}) {
  const medalSrc = getMedalSrc(score);

  return (
    <view className="overlay">
      <view className="gameover-panel">
        {medalSrc && (
          <image src={medalSrc} className="medal" />
        )}

        <ScoreDigits
          value={score}
          containerClassName="panel-score"
          digitClassName="panel-digit"
          keyPrefix="ps"
        />

        <ScoreDigits
          value={bestScore}
          containerClassName="panel-best"
          digitClassName="panel-digit"
          keyPrefix="pb"
        />

        <view className="replay-button" bindtap={onReplay}>
          <image src={replayImg} className="replay-img" />
        </view>
      </view>
    </view>
  );
}
