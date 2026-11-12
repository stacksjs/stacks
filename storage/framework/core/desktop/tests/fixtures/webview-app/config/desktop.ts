import type { DesktopConfig } from '@stacksjs/types'

/** The web view desktop app `tests/webview-build.test.ts` builds and launches. */
export default {
  webview: {
    appName: 'Webview Fixture',
    appId: 'org.stacksjs.webview-fixture',
    description: 'A window on a local agent',
    publisher: 'Stacks.js',
    window: { width: 640, height: 420 },
    agent: { entry: 'app/Desktop/Agent.ts', views: 'resources/desktop' },
    urlSchemes: ['webview-fixture'],
  },
} satisfies DesktopConfig
