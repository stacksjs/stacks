import type { MobileConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

export default {
  ios: {
    appName: env.APP_NAME ?? '__APP_NAME__',
    // A placeholder the App Store rejects on purpose: replace it with your own
    // reverse-DNS id before the first build you mean to ship.
    bundleId: '__APP_BUNDLE_ID__',
    version: '1.0.0',
    buildNumber: '1',
    deploymentTarget: '16.0',
    url: env.APP_URL,
    darkMode: true,
    backgroundColor: '#0a0a0a',
    orientations: ['portrait'],
    capabilities: {
      haptics: true,
      share: true,
      secureStorage: true,
      clipboard: true,
      localDatabase: true,
      screenCapture: true,
      pdfViewer: true,
    },
  },
} satisfies MobileConfig
