import { useEffect, useRef, useState } from 'react';
import QrCreator from 'qr-creator';
import type { LynxViewElement } from './env.js';

export function App() {
  const qrRef = useRef<HTMLDivElement>(null);
  const modalQrRef = useRef<HTMLDivElement>(null);
  const lynxViewRef = useRef<LynxViewElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!qrRef.current) return;
    const base = window.location.href.replace(/\/[^/]*$/, '/');
    const bundleUrl = base + 'main.lynx.bundle?fullscreen=true';
    QrCreator.render(
      {
        text: bundleUrl,
        radius: 0.0,
        ecLevel: 'M',
        fill: '#c4c9d4',
        background: '#1a1e28',
        size: 140,
      },
      qrRef.current,
    );
  }, []);

  // Render QR into the modal once it mounts
  useEffect(() => {
    if (!drawerOpen || !modalQrRef.current) return;
    // Don't re-render if already has a canvas
    if (modalQrRef.current.querySelector('canvas')) return;
    const base = window.location.href.replace(/\/[^/]*$/, '/');
    const bundleUrl = base + 'main.lynx.bundle?fullscreen=true';
    QrCreator.render(
      {
        text: bundleUrl,
        radius: 0.0,
        ecLevel: 'M',
        fill: '#c4c9d4',
        background: '#1a1e28',
        size: 160,
      },
      modalQrRef.current,
    );
  }, [drawerOpen]);

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
        <div className="qr-card">
          <div ref={qrRef} className="qr-canvas" />
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
        <p className="source-link">
          <a
            href="https://github.com/Huxpro/lynx-flappy-bird"
            target="_blank"
            rel="noreferrer"
          >
            View source on GitHub &rarr;
          </a>
        </p>
      </div>

      {/* Mobile: floating info button + drawer */}
      <button
        className="mobile-info-btn"
        onClick={() => setDrawerOpen(true)}
        aria-label="Project info"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 8v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="9" cy="5.5" r="1" fill="currentColor" />
        </svg>
      </button>

      {drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <h2 className="drawer-title">Lynx Flappy Bird</h2>
            <div className="drawer-qr-card">
              <div ref={modalQrRef} className="qr-canvas" />
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
            <div className="drawer-divider" />
            <p className="drawer-desc">
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
              manages the UI shell on the background thread.
            </p>
            <a
              className="drawer-source"
              href="https://github.com/Huxpro/lynx-flappy-bird"
              target="_blank"
              rel="noreferrer"
            >
              View source on GitHub &rarr;
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
