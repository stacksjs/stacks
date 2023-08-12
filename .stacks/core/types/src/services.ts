export interface ServicesOptions {
  algolia?: {
    appId: string
    apiKey: string
  }

  meilisearch?: {
    appId: string
    apiKey: string
  }

  stripe?: {
    appId: string
    apiKey: string
  }

  planetscale?: {
    appId: string
    apiKey: string
  }

  supabase?: {
    appId: string
    apiKey: string
  }

  aws?: {
    appId: string
    apiKey: string
  }

  novu?: {
    key: string
  }
}

export type ServicesConfig = ServicesOptions
