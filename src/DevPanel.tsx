import type { MainThread } from '@lynx-js/types';
import type { MainThreadRef } from '@lynx-js/react';

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
  return (
    <>
      {/* Debug info overlay — MTS-controlled text */}
      <text className="debug-text" main-thread:ref={debugTextRef} style={{ display: 'none' }}>
        {' '}
      </text>
      {/* MTS↔BTS communication LEDs */}
      <view className="debug-led debug-led-mts" main-thread:ref={mtsBtsLedRef} style={{ display: 'none' }} />
      <view className="debug-led debug-led-bts" main-thread:ref={btsMtsLedRef} style={{ display: 'none' }} />
      {/* Pipe spawn boundary lines */}
      <view className="debug-boundary" main-thread:ref={boundaryTopRef} style={{ display: 'none' }} />
      <view className="debug-boundary" main-thread:ref={boundaryBottomRef} style={{ display: 'none' }} />

      {/* Dev controls — compact HUD at bottom-right */}
      {visible && (
        <view className="dev-panel">
          {/* Row 1: BIRDS input + MUT toggle + FLOOD input */}
          <view className="dev-row">
            <view className="dev-field">
              <text className="dev-field-lbl">BIRDS</text>
              <view className="dev-input-wrap">
                <input
                  className="dev-input"
                  type="number"
                  value={String(birds)}
                  bindinput={(e: any) => {
                    const v = Math.max(0, Math.min(400, parseInt(e.detail?.value ?? e.target?.value ?? '0', 10) || 0));
                    onBirdsChange(v);
                  }}
                />
              </view>
            </view>
            <view
              className="dev-chip"
              style={{
                backgroundColor: heavy ? 'rgba(115, 191, 46, 0.6)' : 'rgba(255, 255, 255, 0.08)',
                borderColor: heavy ? 'rgba(115, 191, 46, 0.4)' : 'rgba(255, 255, 255, 0.12)',
              }}
              bindtap={onHeavyToggle}
            >
              <text
                className="dev-chip-t"
                style={{ color: heavy ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)' }}
              >
                MUT
              </text>
            </view>
            <view className="dev-field">
              <text className="dev-field-lbl">FLOOD</text>
              <view className="dev-input-wrap">
                <input
                  className="dev-input"
                  type="number"
                  value={String(flood)}
                  bindinput={(e: any) => {
                    const v = Math.max(0, Math.min(100, parseInt(e.detail?.value ?? e.target?.value ?? '0', 10) || 0));
                    onFloodChange(v);
                  }}
                />
              </view>
            </view>
          </view>

          {/* Row 2: PILOT toggle + BENCH action */}
          <view className="dev-row">
            <view
              className="dev-chip"
              style={{
                backgroundColor: autopilot ? 'rgba(115, 191, 46, 0.6)' : 'rgba(255, 255, 255, 0.08)',
                borderColor: autopilot ? 'rgba(115, 191, 46, 0.4)' : 'rgba(255, 255, 255, 0.12)',
              }}
              bindtap={onAutopilotToggle}
            >
              <text
                className="dev-chip-t"
                style={{ color: autopilot ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)' }}
              >
                PILOT
              </text>
            </view>
            <view className="dev-spacer" />
            <view
              className="dev-chip"
              style={{
                backgroundColor: benchActive ? 'rgba(232, 163, 58, 0.6)' : 'rgba(255, 255, 255, 0.08)',
                borderColor: benchActive ? 'rgba(232, 163, 58, 0.4)' : 'rgba(255, 255, 255, 0.12)',
              }}
              bindtap={onAutoRamp}
            >
              <text
                className="dev-chip-t"
                style={{ color: benchActive ? '#FFFFFF' : 'rgba(232, 163, 58, 0.7)' }}
              >
                {benchActive ? 'STOP' : 'BENCH'}
              </text>
            </view>
          </view>
        </view>
      )}
    </>
  );
}
