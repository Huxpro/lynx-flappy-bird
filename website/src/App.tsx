import { useEffect, useRef } from 'react';
import QrCreator from 'qr-creator';
import type { LynxViewElement } from './env.js';

export function App() {
  const qrRef = useRef<HTMLDivElement>(null);
  const lynxViewRef = useRef<LynxViewElement>(null);

  useEffect(() => {
    if (!qrRef.current) return;
    const base = window.location.href.replace(/\/[^/]*$/, '/');
    const bundleUrl = base + 'main.lynx.bundle';
    QrCreator.render(
      {
        text: bundleUrl,
        radius: 0.0,
        ecLevel: 'M',
        fill: '#c4c9d4',
        background: '#1a1e28',
        size: 120,
      },
      qrRef.current,
    );
  }, []);

  useEffect(() => {
    const el = lynxViewRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        el.sendGlobalEvent('onWindowResize', [width, height]);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="container">
      <div className="game-panel">
        <div className="phone-frame">
          <lynx-view
            ref={lynxViewRef}
            style={{ display: 'block', width: '100%', height: '100%' }}
            url="./main.web.bundle"
          />
        </div>
      </div>
      <div className="info-panel">
        <h1>Lynx Flappy Bird</h1>
        <p className="desc">
          A cross-platform Flappy Bird vibe-coded with{' '}
          <a href="https://lynxjs.org/" target="_blank" rel="noreferrer">
            Lynx
          </a>
          . Touch handling, physics, and the game loop run on the{' '}
          <a
            href="https://lynxjs.org/react/main-thread-script.html"
            target="_blank"
            rel="noreferrer"
          >
            main thread
          </a>{' '}
          for zero-latency input;{' '}
          <a href="https://lynxjs.org/react" target="_blank" rel="noreferrer">
            ReactLynx
          </a>{' '}
          manages the UI shell — score, menus, and state transitions — on the background thread.
        </p>
        <div className="qr-section">
          <div ref={qrRef} />
          <div className="qr-text">
            <span className="qr-label">Play natively on mobile</span>
            <span className="qr-hint">
              Scan with{' '}
              <a
                href="https://lynxjs.org/guide/start/quick-start.html#prepare-lynx-explorer"
                target="_blank"
                rel="noreferrer"
              >
                Lynx Explorer
              </a>
            </span>
          </div>
        </div>
        <p className="source-link">
          <a
            href="https://github.com/anthropics/anthropic-cookbook/tree/main/anthropic_tools/flappy-bird-lynx"
            target="_blank"
            rel="noreferrer"
          >
            View source on GitHub &rarr;
          </a>
        </p>
      </div>
    </div>
  );
}
