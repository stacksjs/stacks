interface CraftApplication {
  show: () => Promise<void>
  close: () => void
}

interface CraftModule {
  createApp: (options: Record<string, unknown>) => CraftApplication
}

declare module 'craft-native' {
  export const createApp: CraftModule['createApp']
}

declare module '@craft-native/craft' {
  export const createApp: CraftModule['createApp']
}

declare module '@stacksjs/ts-craft' {
  export const createApp: CraftModule['createApp']
}

declare module '@ts-analytics/tracking/analytics' {
  export const AnalyticsQueryAPI: any
  export const AnalyticsStore: any
}
