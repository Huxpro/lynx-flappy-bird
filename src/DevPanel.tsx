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

const greenTone: ChipTone = {
  activeBg: 'rgba(115, 191, 46, 0.6)',
  activeBorder: 'rgba(115, 191, 46, 0.4)',
  inactiveText: 'rgba(245, 255, 248, 0.88)',
};

const benchTone: ChipTone = {
  activeBg: 'rgba(232, 163, 58, 0.6)',
  activeBorder: 'rgba(232, 163, 58, 0.4)',
  inactiveText: 'rgba(255, 244, 222, 0.92)',
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
  threadTextRef: MainThreadRef<MainThread.Element>;
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
  benchResult: string;

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
  threadTextRef,
  mtsBtsLedRef,
  btsMtsLedRef,
  boundaryTopRef,
  boundaryBottomRef,
  birds,
  heavy,
  flood,
  autopilot,
  benchActive,
  benchResult,
  onBirdsChange,
  onHeavyToggle,
  onFloodChange,
  onAutopilotToggle,
  onAutoRamp,
}: DevPanelProps) {
  const pilotActive = autopilot || benchActive;
  const modeLabel = benchActive ? 'BENCH -> PILOT' : autopilot ? 'PILOT ON' : 'MANUAL';
  const pilotTone = benchActive ? benchTone : greenTone;
  const inputWrapStyle = benchActive
    ? { opacity: '0.35' }
    : { opacity: '1' };

  return (
    <>
      {/* Pipe spawn boundary lines */}
      <view className="debug-boundary" main-thread:ref={boundaryTopRef} style={{ display: 'none' }} />
      <view className="debug-boundary" main-thread:ref={boundaryBottomRef} style={{ display: 'none' }} />

      {/* Unified dev HUD: debug info + thread status + stress controls */}
      <view className="dev-hud" style={{ display: visible ? 'flex' : 'none' }}>
        <view className="dev-panel">
          <view className="dev-top-row">
            <view className="dev-section dev-section-debug">
              <view className="dev-header">
                <text className="dev-title">DEBUG</text>
              </view>
              <text className="dev-debug-text" main-thread:ref={debugTextRef}>
                {' '}
              </text>
            </view>

            <view className="dev-section dev-section-thread">
              <view className="dev-header">
                <text className="dev-title">THREAD</text>
              </view>
              <view className="dev-led-row">
                <view className="dev-led-group">
                  <text className="dev-led-label">M</text>
                  <view className="debug-led debug-led-mts" main-thread:ref={mtsBtsLedRef} />
                </view>
                <view className="dev-led-group">
                  <text className="dev-led-label">B</text>
                  <view className="debug-led debug-led-bts" main-thread:ref={btsMtsLedRef} />
                </view>
              </view>
              <text className="dev-thread-text" main-thread:ref={threadTextRef}>
                {' '}
              </text>
              <view className="dev-field dev-field-thread">
                <text className="dev-field-lbl">FLOOD</text>
                <view className="dev-input-wrap dev-input-wrap-thread" style={inputWrapStyle}>
                  <input
                    className="dev-input"
                    type="number"
                    disabled={benchActive}
                    value={String(flood)}
                    bindinput={(e: any) => {
                      onFloodChange(clampInteger(readInputValue(e), MAX_STRESS_FLOOD));
                    }}
                  />
                </view>
              </view>
            </view>
          </view>

          <view className="dev-divider" />

          <view className="dev-section">
            <view className="dev-header dev-header-split">
              <text className="dev-title">STRESS LAB</text>
              <text className="dev-mode">{modeLabel}</text>
            </view>
            {benchResult && (
              <text className="dev-result-text">{benchResult}</text>
            )}

            <view className="dev-bottom-row">
              <view className="dev-field dev-field-birds">
                <text className="dev-field-lbl">BIRDS</text>
                <view className="dev-input-wrap dev-input-wrap-birds" style={inputWrapStyle}>
                  <input
                    className="dev-input"
                    type="number"
                    disabled={benchActive}
                    value={String(birds)}
                    bindinput={(e: any) => {
                      onBirdsChange(clampInteger(readInputValue(e), MAX_STRESS_BIRDS));
                    }}
                  />
                </view>
              </view>

              <view className="dev-field dev-field-actions">
                <text className="dev-field-lbl">MODES</text>
                <view className="dev-action-row">
                  <view
                    className="dev-chip dev-chip-wide"
                    style={getChipStyle(heavy, greenTone)}
                    bindtap={onHeavyToggle}
                  >
                    <text className="dev-chip-t" style={getChipTextStyle(heavy, greenTone)}>
                      MUT
                    </text>
                  </view>

                  <view
                    className="dev-chip dev-chip-wide"
                    style={getChipStyle(pilotActive, pilotTone)}
                    bindtap={benchActive ? undefined : onAutopilotToggle}
                  >
                    <text className="dev-chip-t" style={getChipTextStyle(pilotActive, pilotTone)}>
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
        </view>
      </view>
    </>
  );
}
