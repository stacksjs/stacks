export interface ServicesOptions {
  algolia?: {
    appId: string
    apiKey: string
  }

  godaddy?: {
    apiKey: string
    apiSecret: string
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
    accountId: string
    appId: string
    apiKey: string
    region: string
  }
}

export type ServicesConfig = Partial<ServicesOptions>
