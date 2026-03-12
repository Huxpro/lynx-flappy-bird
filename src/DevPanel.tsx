import type { MainThread } from '@lynx-js/types';
import type { MainThreadRef } from '@lynx-js/react';

const MAX_STRESS_BIRDS = 400;
const MAX_STRESS_FLOOD = 100;

type ChipTone = {
  activeBg: string;
  activeBorder: string;
  inactiveText: string;
};

const neutralChipStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  borderColor: 'rgba(255, 255, 255, 0.12)',
};

const heavyTone: ChipTone = {
  activeBg: 'rgba(115, 191, 46, 0.6)',
  activeBorder: 'rgba(115, 191, 46, 0.4)',
  inactiveText: 'rgba(255, 255, 255, 0.4)',
};

const pilotTone: ChipTone = {
  activeBg: 'rgba(115, 191, 46, 0.6)',
  activeBorder: 'rgba(115, 191, 46, 0.4)',
  inactiveText: 'rgba(255, 255, 255, 0.4)',
};

const benchTone: ChipTone = {
  activeBg: 'rgba(232, 163, 58, 0.6)',
  activeBorder: 'rgba(232, 163, 58, 0.4)',
  inactiveText: 'rgba(232, 163, 58, 0.7)',
};

function getChipStyle(active: boolean, tone: ChipTone) {
  return active
    ? {
        backgroundColor: tone.activeBg,
        borderColor: tone.activeBorder,
      }
    : neutralChipStyle;
}

function getChipTextStyle(active: boolean, tone: ChipTone) {
  return {
    color: active ? '#FFFFFF' : tone.inactiveText,
  };
}

function readInputValue(event: any): string {
  return String(event?.detail?.value ?? event?.target?.value ?? '0');
}

function clampInteger(raw: string, max: number): number {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(max, parsed));
}

interface DevPanelProps {
  visible: boolean;

  // Debug overlay refs (passed through for MTS manipulation)
  debugTextRef: MainThreadRef<MainThread.Element>;
  mtsBtsLedRef: MainThreadRef<MainThread.Element>;
  btsMtsLedRef: MainThreadRef<MainThread.Element>;
  boundaryTopRef: MainThreadRef<MainThread.Element>;
  boundaryBottomRef: MainThreadRef<MainThread.Element>;

  // Config state (owned by Game.tsx)
  birds: number;
  heavy: boolean;
  flood: number;
  autopilot: boolean;
  benchActive: boolean;

  // Callbacks
  onBirdsChange: (n: number) => void;
  onHeavyToggle: () => void;
  onFloodChange: (n: number) => void;
  onAutopilotToggle: () => void;
  onAutoRamp: () => void;
}

export function DevPanel({
  visible,
  debugTextRef,
  mtsBtsLedRef,
  btsMtsLedRef,
  boundaryTopRef,
  boundaryBottomRef,
  birds,
  heavy,
  flood,
  autopilot,
  benchActive,
  onBirdsChange,
  onHeavyToggle,
  onFloodChange,
  onAutopilotToggle,
  onAutoRamp,
}: DevPanelProps) {
  const modeLabel = benchActive ? 'BENCH LIVE' : autopilot ? 'PILOT READY' : 'MANUAL';

  return (
    <>
      {/* Pipe spawn boundary lines */}
      <view className="debug-boundary" main-thread:ref={boundaryTopRef} style={{ display: 'none' }} />
      <view className="debug-boundary" main-thread:ref={boundaryBottomRef} style={{ display: 'none' }} />

      {/* Unified dev HUD: debug info + thread status + stress controls */}
      <view className="dev-hud" style={{ display: visible ? 'flex' : 'none' }}>
        <view className="dev-panel">
          <view className="dev-section">
            <view className="dev-header dev-header-split">
              <text className="dev-title">DEBUG INFO</text>
              <view className="dev-led-cluster">
                <view className="dev-led-group">
                  <text className="dev-led-label">M</text>
                  <view className="debug-led debug-led-mts" main-thread:ref={mtsBtsLedRef} />
                </view>
                <view className="dev-led-group">
                  <text className="dev-led-label">B</text>
                  <view className="debug-led debug-led-bts" main-thread:ref={btsMtsLedRef} />
                </view>
              </view>
            </view>
            <text className="dev-debug-text" main-thread:ref={debugTextRef}>
              {' '}
            </text>
          </view>

          <view className="dev-divider" />

          <view className="dev-section">
            <view className="dev-header dev-header-split">
              <text className="dev-title">STRESS LAB</text>
              <text className="dev-mode">{modeLabel}</text>
            </view>

            <view className="dev-row">
              <view className="dev-field dev-field-wide">
                <text className="dev-field-lbl">BIRDS</text>
                <view className="dev-input-wrap">
                  <input
                    className="dev-input"
                    type="number"
                    value={String(birds)}
                    bindinput={(e: any) => {
                      onBirdsChange(clampInteger(readInputValue(e), MAX_STRESS_BIRDS));
                    }}
                  />
                </view>
              </view>

              <view className="dev-field dev-field-wide dev-field-end">
                <text className="dev-field-lbl">FLOOD</text>
                <view className="dev-input-wrap">
                  <input
                    className="dev-input"
                    type="number"
                    value={String(flood)}
                    bindinput={(e: any) => {
                      onFloodChange(clampInteger(readInputValue(e), MAX_STRESS_FLOOD));
                    }}
                  />
                </view>
              </view>
            </view>

            <view className="dev-row dev-row-actions">
              <view
                className="dev-chip dev-chip-wide"
                style={getChipStyle(heavy, heavyTone)}
                bindtap={onHeavyToggle}
              >
                <text className="dev-chip-t" style={getChipTextStyle(heavy, heavyTone)}>
                  MUT
                </text>
              </view>

              <view
                className="dev-chip dev-chip-wide"
                style={getChipStyle(autopilot, pilotTone)}
                bindtap={onAutopilotToggle}
              >
                <text className="dev-chip-t" style={getChipTextStyle(autopilot, pilotTone)}>
                  PILOT
                </text>
              </view>

              <view
                className="dev-chip dev-chip-wide dev-chip-end"
                style={getChipStyle(benchActive, benchTone)}
                bindtap={onAutoRamp}
              >
                <text className="dev-chip-t" style={getChipTextStyle(benchActive, benchTone)}>
                  {benchActive ? 'STOP' : 'BENCH'}
                </text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </>
  );
}
