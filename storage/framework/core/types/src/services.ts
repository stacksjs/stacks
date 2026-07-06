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

  github?: {
    clientId: string
    clientSecret: string
    redirectUrl: string
    scopes?: string[]
  }

  google?: {
    clientId: string
    clientSecret: string
    redirectUrl: string
    scopes?: string[]
  }

  /**
   * Sign in with Apple. Apple has no static client secret — the driver
   * signs a short-lived ES256 JWT from teamId + keyId + privateKey
   * (the .p8 file's contents) instead.
   */
  apple?: {
    /** The Services ID identifier, e.g. `org.example.web` */
    clientId: string
    /** Apple Developer Team ID (10 chars) */
    teamId: string
    /** Key ID of the "Sign in with Apple" key */
    keyId: string
    /** Contents of the downloaded .p8 private key */
    privateKey: string
    redirectUrl: string
    scopes?: string[]
  }

  facebook?: {
    clientId: string
    clientSecret: string
    redirectUrl: string
    scopes?: string[]
  }

  twitter?: {
    clientId: string
    clientSecret: string
    redirectUrl: string
    scopes?: string[]
  }

  godaddy?: {
    apiKey: string
    apiSecret: string
  }

  hetzner: {
    appId: string
    apiKey: string
  }

  digitalOcean: {
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
    token: string
    host: string
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

  /**
   * SMTP Configuration for local development
   * Works with HELO, Mailtrap Desktop, Mailhog, etc.
   */
  smtp?: {
    host: string
    port: number
    username?: string
    password?: string
    encryption?: 'tls' | 'ssl' | null
    maxRetries?: number
    retryTimeout?: number
  }

  slack?: {
    appId?: string
    clientId?: string
    secretKey?: string
    webhookUrl?: string
    botToken?: string
    maxRetries?: number
    retryTimeout?: number
  }

  discord?: {
    webhookUrl?: string
    botToken?: string
    maxRetries?: number
    retryTimeout?: number
  }

  teams?: {
    webhookUrl?: string
    maxRetries?: number
    retryTimeout?: number
  }

  // Push Notification Services
  expo?: {
    accessToken?: string
  }

  fcm?: {
    serverKey?: string
    projectId?: string
    clientEmail?: string
    privateKey?: string
  }

  // AI Services
  openai?: {
    apiKey?: string
    model?: string
    embeddingModel?: string
    baseUrl?: string
  }

  anthropic?: {
    apiKey?: string
    model?: string
    maxTokens?: number
  }

  ollama?: {
    host?: string
    model?: string
    embeddingModel?: string
  }

  stripe?: {
    secretKey?: string
    publicKey?: string
    /**
     * Signing secret for verifying inbound Stripe webhook requests
     * (`whsec_...`, from the Stripe dashboard's webhook endpoint
     * config). Required by any app receiving Stripe webhooks —
     * without it, `stripe.webhooks.constructEvent` has nothing to
     * verify the `stripe-signature` header against.
     */
    webhookSecret?: string
    /**
     * Pinned Stripe API version. Defaults to whatever the bundled SDK
     * was compiled against; override here when rolling forward without
     * a code change. Format: 'YYYY-MM-DD' or 'YYYY-MM-DD.preview'.
     */
    apiVersion?: string
  }

  // supabase?: {
  //   appId: string
  //   apiKey: string
  // }
}

export type ServicesConfig = Partial<ServicesOptions>
