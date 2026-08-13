import type { MobileConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

export default {
  ios: {
    appName: env.APP_NAME ?? 'Stacks',
    bundleId: 'com.stacksjs.app',
    version: '1.0.0',
    buildNumber: '1',
    deploymentTarget: '16.0',
    url: env.APP_URL,
    darkMode: true,
    backgroundColor: '#0b1712',
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
