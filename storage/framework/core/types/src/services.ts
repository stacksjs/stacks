/**
 * The HQ services an application can connect to.
 *
 * They are separate products. Each keeps its own account, keys, plan and
 * subscription, so every service carries its own credentials and nothing is
 * shared between them.
 */
export type HqServiceName = 'bughq' | 'loghq' | 'analyticshq' | 'statushq' | 'commshq' | 'reportshq' | 'supporthq'

/** One HQ service's entry in `config/services.ts`, written by `buddy hq:connect`. */
export interface HqServiceOptions {
  /** The service's origin, e.g. `https://loghq.org`. */
  url: string
  /** The key the app's SDK writes with. SupportHQ keys are server-side only. */
  key?: string
  /** The key the app's own dashboard and `buddy hq:status` read with. Server-side only. */
  readKey?: string
  /** The id of the project (or site) the keys were issued for. */
  project?: string
  /**
   * ReportsHQ only. It runs inside the app against the app's own database, so
   * it has no ingest or read key: its one credential is a licence key, checked
   * offline and never sent anywhere.
   */
  license?: string
}

/** The HQ entries of `config/services.ts`, on their own. */
export type HqServicesConfig = Partial<Record<HqServiceName, HqServiceOptions>>

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
    /** Meta Graph API version, e.g. `v24.0`. Defaults to META_GRAPH_VERSION. */
    graphVersion?: string
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
  apns?: {
    teamId?: string
    keyId?: string
    privateKey?: string
    topic?: string
    sandbox?: boolean
  }
  expo?: {
    accessToken?: string
  }

  fcm?: {
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
    /** Stripe app id, which `config/services.ts` sets. */
    appId?: string
    /** Stripe API key, which `config/services.ts` sets. */
    apiKey?: string
    /**
     * Pinned Stripe API version. Defaults to whatever the bundled SDK
     * was compiled against; override here when rolling forward without
     * a code change. Format: 'YYYY-MM-DD' or 'YYYY-MM-DD.preview'.
     */
    apiVersion?: string
  }

  /**
   * HQ services. Each is its own account with its own keys, which
   * `buddy hq:connect` writes to `.env` and `buddy hq:status` reads usage with.
   * `config/logging.ts` and `config/monitoring.ts` take their LogHQ and BugHQ
   * settings from these entries, and the dashboard's `hq` provider reads with
   * their read keys.
   */
  bughq?: HqServiceOptions
  loghq?: HqServiceOptions
  analyticshq?: HqServiceOptions
  statushq?: HqServiceOptions
  commshq?: HqServiceOptions
  supporthq?: HqServiceOptions
  reportshq?: HqServiceOptions

  // supabase?: {
  //   appId: string
  //   apiKey: string
  // }
}

export type ServicesConfig = Partial<ServicesOptions>
