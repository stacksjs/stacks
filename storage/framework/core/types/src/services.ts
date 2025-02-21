export interface ServicesOptions {
  algolia?: {
    appId: string
    apiKey: string
  }

  aws?: {
    accountId: string
    appId: string
    apiKey: string
    region: string
  }

  godaddy?: {
    apiKey: string
    apiSecret: string
  }

  hetzner: {
    appId: string
    apiKey: string
  }

  // lemonSqueezy?: {
  //   appId: string
  //   apiKey: string
  // }

  mailgun?: {
    apiKey?: string
    domain?: string
    endpoint?: string
    maxRetries?: number
    retryTimeout?: number
  }

  mailtrap?: {
    token?: string
    inboxId?: string | number
    maxRetries?: number
    retryTimeout?: number
  }

  meilisearch?: {
    appId: string
    apiKey: string
  }

  sendgrid?: {
    apiKey?: string
    maxRetries?: number
    retryTimeout?: number
  }

  ses?: {
    region: string
    credentials: {
      accessKeyId?: string
      secretAccessKey?: string
    }
    maxRetries?: number
    retryTimeout?: number
  }

  stripe?: {
    appId: string
    apiKey: string
  }

  // supabase?: {
  //   appId: string
  //   apiKey: string
  // }
}

export type ServicesConfig = Partial<ServicesOptions>
