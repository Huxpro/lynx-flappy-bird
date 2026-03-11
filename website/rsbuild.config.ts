import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginWebPlatform } from '@lynx-js/web-platform-rsbuild-plugin';

export default defineConfig({
  plugins: [pluginReact(), pluginWebPlatform()],

  source: {
    entry: {
      index: './src/index.tsx',
    },
  },

  html: {
    title: 'Lynx Flappy Bird',
    favicon: '../public/favicon.png',
    meta: {
      description:
        'A cross-platform Flappy Bird vibe-coded with ReactLynx. Play in the browser or natively on mobile — same codebase, same feel.',
      'og:title': 'Lynx Flappy Bird',
      'og:description':
        'A cross-platform Flappy Bird built with ReactLynx. Play it in a web browser or render it natively on mobile.',
      'og:type': 'website',
      'twitter:card': 'summary',
      'twitter:title': 'Lynx Flappy Bird',
      'twitter:description':
        'Flappy Bird vibe-coded with ReactLynx — cross-platform, native-grade performance.',
    },
    tags: [
      { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
      {
        tag: 'link',
        attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      },
      {
        tag: 'link',
        attrs: {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Outfit:wght@300;400;500;600&display=swap',
        },
      },
    ],
  },

  server: {
    publicDir: [{ name: '../dist', watch: true }],
  },

  output: {
    assetPrefix: '/lynx-flappy-bird/',
    copy: [
      { from: '../dist/main.web.bundle', to: '.', noErrorOnMissing: true },
      { from: '../dist/main.lynx.bundle', to: '.', noErrorOnMissing: true },
      { from: '../dist/static', to: 'static', noErrorOnMissing: true },
    ],
  },
});
