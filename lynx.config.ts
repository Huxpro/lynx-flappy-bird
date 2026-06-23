import { defineConfig } from '@lynx-js/rspeedy'

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginVueLynx } from 'vue-lynx/plugin'

export default defineConfig({
  plugins: [
    pluginQRCode({
      schema(url) {
        // Open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`
      },
    }),
    pluginVueLynx({
      optionsApi: false,
      enableCSSInlineVariables: true,
      enableCSSInheritance: true,
    }),
  ],
  output: {
    assetPrefix: process.env.VERCEL ? '/' : 'https://huangxuan.me/lynx-flappy-bird/',
  },
  environments: {
    web: {},
    lynx: {},
  },
})
