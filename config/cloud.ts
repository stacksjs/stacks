import type { CloudConfig } from '@stacksjs/types'
import type { CloudConfig as TsCloudConfig } from '@stacksjs/ts-cloud'
import { servers } from '~/cloud/servers'
import { env } from '@stacksjs/env'

/**
 * Stacks Cloud Configuration
 *
 * This file defines your cloud infrastructure configuration for Stacks.
 * Supports both server mode (Forge-style) and serverless mode (Vapor-style).
 *
 * Environment variables:
 * - CLOUD_ENV: Set the active environment (production, staging, development)
 * - NODE_ENV: Fallback for CLOUD_ENV
 *
 * @see https://github.com/stacksjs/ts-cloud
 */

// ts-cloud configuration for deployment
export const tsCloud: TsCloudConfig = {
  /**
   * Project configuration
   */
  project: {
    name: 'stacks',
    slug: 'stacks',
    region: 'us-east-1', // Default AWS region
  },

  // Deploy compute to Hetzner Cloud (apiToken falls back to HCLOUD_TOKEN env).
  cloud: {
    provider: 'hetzner',
  },

  /**
   * Deployment Mode
   *
   * - 'server': Traditional EC2-based deployment (Forge-style)
   * - 'serverless': Container + static site deployment (Vapor-style)
   */
  mode: 'server',

  /**
   * Environment configurations
   * Each environment can have its own settings
   *
   * Note: Deployment mode is automatically determined by your infrastructure configuration.
   * Simply define the resources you need below (functions, servers, storage, etc.) and
   * ts-cloud will deploy them accordingly. You can mix and match any resources.
   */
  environments: {
    production: {
      type: 'production',
      region: 'us-east-1',
      variables: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },

      /**
       * Serverless Application (Vapor-style) — optional
       *
       * Deploy one codebase as three AWS Lambda functions sharing one artifact:
       * HTTP (API Gateway v2), a queue worker (SQS, one job per invocation), and
       * a CLI function (EventBridge scheduler + on-demand commands / migrations).
       *
       * Defining `app` opts this environment into the serverless deploy pipeline
       * (`buddy deploy --serverless`). Leave it commented to keep the default
       * server/container deployment. Every option is shown below.
       *
       * @see https://ts-cloud.stacksjs.com/features/serverless
       */
      // app: {
      //   // Runtime + application kind. Common Node versions use the AWS managed
      //   // runtime; Bun and newer Node (e.g. 24) run on a ts-cloud-built
      //   // provided.al2023 custom layer (built once via `buddy cloud` / the
      //   // `serverless:build-{node,bun,php}-layer` ts-cloud CLI commands).
      //   kind: 'node', // 'node' | 'bun' | 'php'
      //   runtimeVersion: '22', // node: 18/20/22 (managed) or 24+ (custom layer); bun: a release
      //   // runtime: 'provided.al2023', // override (usually derived from kind + runtimeVersion)
      //   entry: 'server.ts', // entry exporting { fetch, queue, cli } (node/bun)
      //
      //   // HTTP function.
      //   memory: 1024, // MB
      //   timeout: 28, // seconds (API Gateway v2 caps at 29)
      //   concurrency: undefined, // reserved concurrency, optional
      //   gatewayVersion: 2, // 2 = HTTP API (default), 1 = REST API
      //   warm: 2, // keep N containers warm via scheduled pings
      //
      //   // CLI function (scheduler + commands/migrations).
      //   cliMemory: 1024,
      //   cliTimeout: 900,
      //
      //   // Queue worker.
      //   queues: true, // true = single default queue; or ['emails', { invoices: 10 }]; false = disabled
      //   queueConcurrency: 1000,
      //   queueTimeout: 120,
      //   queueMemory: 1024,
      //   queueTries: 3, // max receives before DLQ
      //
      //   // Scheduler: 'on' | 'off' | 'sub-minute'.
      //   scheduler: 'on',
      //
      //   // Build hooks (local, before packaging) + deploy hooks (remote, via CLI fn).
      //   build: ['bun install', 'bun run build'],
      //   deploy: ['migrate'],
      //
      //   // Persistent mode (Laravel Octane / long-lived server). Lower latency.
      //   octane: false,
      //
      //   // Packaging: 'zip' (default) or 'image' (ECR container, for >250MB apps).
      //   packaging: 'zip',
      //
      //   // Static assets → S3 + CloudFront, exposed as ASSET_URL.
      //   assets: 'public',
      //
      //   // Custom domain + ACM certificate.
      //   domain: 'app.stacksjs.com',
      //   // certificateArn: 'arn:aws:acm:us-east-1:...:certificate/...',
      //
      //   // Managed data (require vpc.subnets — private subnets):
      //   // vpc: { subnets: ['subnet-aaa', 'subnet-bbb'], securityGroups: [] },
      //   // database: { connection: 'aurora-serverless' },
      //   // rdsProxy: true,
      //   cache: { driver: 'dynamodb' }, // 'dynamodb' (zero-NAT default) | 'elasticache'
      //   // storage: { bucket: 'stacks-production-app' },
      //
      //   // Managed WAF in front of the HTTP API.
      //   // firewall: { enabled: true, rateLimit: 2000, rules: ['common', 'sqlInjection'] },
      //
      //   // Env vars + secrets (secrets resolved from Secrets Manager / SSM at deploy).
      //   env: { APP_ENV: 'production' },
      //   // secrets: ['APP_KEY', 'DB_PASSWORD'],
      //
      //   // Ephemeral /tmp size in MB (512–10240).
      //   tmpStorage: 512,
      //
      //   // PHP-only (kind: 'php'):
      //   // phpVersion: '8.3',
      //   // architecture: 'x86_64', // or 'arm64'
      //   // layers: ['arn:aws:lambda:us-east-1:...:layer:tscloud-php-83-x86_64:1'],
      // },
    },
    staging: {
      type: 'staging',
      region: 'us-east-1',
      variables: {
        NODE_ENV: 'staging',
        LOG_LEVEL: 'debug',
      },
    },
    development: {
      type: 'development',
      region: 'us-east-1',
      variables: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
      },
    },
  },

  /**
   * Infrastructure configuration
   * Define your cloud resources here
   */
  infrastructure: {
    /**
     * Compute Configuration
     *
     * For mode: 'server'
     * Defines the EC2 instances running your Stacks/Bun application.
     * When instances > 1, load balancer is automatically enabled.
     *
     * For mode: 'serverless'
     * These settings are not used. See 'containers' configuration instead.
     *
     * @example Single instance (development/staging)
     * compute: { instances: 1, size: 'micro' }
     *
     * @example Multiple instances with auto-scaling (production)
     * compute: {
     *   instances: 3,
     *   size: 'small',
     *   autoScaling: { min: 2, max: 10, scaleUpThreshold: 70 },
     * }
     *
     * @example Mixed instance fleet for cost optimization
     * compute: {
     *   instances: 3,
     *   fleet: [
     *     { size: 'small', weight: 1 },
     *     { size: 'medium', weight: 2 },
     *     { size: 'small', weight: 1, spot: true },
     *   ],
     *   spotConfig: {
     *     baseCapacity: 1,           // Always keep 1 on-demand
     *     onDemandPercentage: 50,    // 50% on-demand, 50% spot
     *     strategy: 'capacity-optimized',
     *   },
     * }
     */
    compute: {
      instances: 1,
      size: 'small', // Provider-agnostic: 'nano', 'micro', 'small', 'medium', 'large', 'xlarge', '2xlarge' (small = 2GB RAM, needed for bun install)
      disk: {
        size: 20,
        type: 'ssd', // Provider-agnostic: 'standard', 'ssd', 'premium'
        encrypted: true,
      },
      webServer: 'rpx',
      proxy: {
        engine: 'rpx',
        onDemandTls: true,
        onDemandTlsEmail: 'hello@stacksjs.com',
      },
      // Uncomment for auto-scaling:
      // autoScaling: {
      //   min: 1,
      //   max: 5,
      //   scaleUpThreshold: 70,
      //   scaleDownThreshold: 30,
      // },
      // Uncomment for mixed instance fleet:
      // fleet: [
      //   { size: 'micro', weight: 1 },
      //   { size: 'small', weight: 2 },
      //   { size: 'micro', weight: 1, spot: true },
      // ],
      // spotConfig: {
      //   baseCapacity: 1,
      //   onDemandPercentage: 50,
      //   strategy: 'capacity-optimized',
      // },
    },

    /**
     * Server Definitions
     * EC2 instances for server mode deployment
     */
    servers: {
      app: servers.app,
      // app2: servers.app2,
      // web: servers.web,
      // cache: servers.cache,
    } as NonNullable<TsCloudConfig['infrastructure']>['servers'],

    /**
     * Jump Box / Bastion Host
     *
     * Provides SSH access to your private cloud resources.
     * Set to `true` for a default t3.micro jump box, or configure options.
     *
     * Connect via: buddy cloud:ssh
     * Or via SSM: aws ssm start-session --target <instance-id>
     */
    // jumpBox: true,
    // jumpBox: {
    //   enabled: true,
    //   size: 'micro',
    //   keyName: 'stacks-production',
    //   allowedCidrs: ['0.0.0.0/0'],
    //   databaseTools: true,
    //   mountEfs: true,
    // },

    /**
     * Container Configuration (for serverless mode only)
     *
     * Defines ECS Fargate containers running your Bun API.
     * Only used when mode: 'serverless'.
     *
     * @example Basic API container
     * containers: {
     *   api: {
     *     cpu: 256,    // 0.25 vCPU
     *     memory: 512, // 512 MB
     *     port: 3000,
     *     healthCheck: '/health',
     *   }
     * }
     *
     * @example Production API with auto-scaling
     * containers: {
     *   api: {
     *     cpu: 512,
     *     memory: 1024,
     *     port: 3000,
     *     desiredCount: 2,
     *     autoScaling: {
     *       min: 2,
     *       max: 10,
     *       targetCpuUtilization: 70,
     *     },
     *   }
     * }
     */
    containers: {
      api: {
        cpu: 512, // 256, 512, 1024, 2048, 4096
        memory: 1024, // Must be compatible with CPU (512 MB - 16 GB)
        port: 3000,
        healthCheck: '/health',
        desiredCount: 2,
        autoScaling: {
          min: 1,
          max: 10,
          targetCpuUtilization: 70,
          targetMemoryUtilization: 80,
        },
      },
    },

    /**
     * Load Balancer Configuration
     *
     * Controls whether to use an Application Load Balancer (ALB) for traffic distribution.
     * Automatically enabled when compute.instances > 1.
     *
     * Benefits of ALB:
     * - SSL termination with ACM certificates (free)
     * - Health checks and automatic failover
     * - HTTP to HTTPS redirect
     * - Multiple target support
     *
     * When to disable:
     * - Cost optimization (ALB costs ~$16/month minimum)
     * - Simple single-instance deployments
     * - Using Let's Encrypt for SSL instead of ACM
     */
    loadBalancer: {
      enabled: true,
      type: 'application',
      healthCheck: {
        path: '/health',
        interval: 30,
        healthyThreshold: 2,
        unhealthyThreshold: 5,
      },
    },

    /**
     * SSL/TLS Configuration
     *
     * Supports two providers:
     * - 'acm': AWS Certificate Manager (free, requires ALB or CloudFront)
     * - 'letsencrypt': Free certificates (works without ALB, runs on EC2)
     *
     * When loadBalancer.enabled = true:
     *   - Uses ACM by default (recommended)
     *   - Certificates are automatically requested and validated via DNS
     *   - HTTP to HTTPS redirect handled by ALB
     *
     * When loadBalancer.enabled = false:
     *   - Uses Let's Encrypt by default
     *   - Certificates are obtained and renewed automatically on EC2
     *   - Requires port 80 for HTTP-01 challenge or DNS for DNS-01
     */
    ssl: {
      enabled: true,
      provider: 'acm', // 'acm' | 'letsencrypt'
      domains: env.SSL_DOMAINS?.split(',') || ['stacksjs.com', 'www.stacksjs.com'],
      redirectHttp: true,
      // Let's Encrypt configuration (used when provider: 'letsencrypt' or loadBalancer.enabled: false)
      letsEncrypt: {
        email: env.LETSENCRYPT_EMAIL || 'admin@stacksjs.com',
        staging: false, // Set to true for testing
        autoRenew: true,
      },
    },

    /**
     * DNS Configuration
     */
    dns: {
      domain: env.APP_DOMAIN || 'stacksjs.com',
      hostedZoneId: env.AWS_HOSTED_ZONE_ID || 'Z01455702Q7952O6RCY37', // Route53 hosted zone ID
    },

    /**
     * Storage Configuration
     * S3 buckets for frontend, assets, uploads, etc.
     *
     * Mirrors the old CDK StorageStack defaults:
     * - public: website-hosting bucket for frontend (index.html)
     * - private: locked-down bucket for uploads, secrets, etc.
     * - docs: website-hosting bucket for documentation (conditional)
     * - logs: access-log bucket (retained on delete for audit)
     *
     * NOTE: The `public`, `docs`, and `blog` website-hosting buckets below are
     * being SUPERSEDED by the server-static `sites` entries (see `sites` at the
     * bottom of this file), which build each static site locally and ship it to
     * `/var/www/<site>` on the Hetzner box (served by the reverse proxy's
     * `file_server`). They are intentionally LEFT IN PLACE as the rollback path
     * and to keep their existing CloudFront distributions alive during the
     * migration. Once the Hetzner server-static sites are verified in
     * production, these three website-hosting buckets (and their CloudFront)
     * can be decommissioned.
     */
    storage: {
      'public': {
        public: true,
        encryption: true,
        versioning: true,
        website: {
          indexDocument: 'index.html',
          errorDocument: 'index.html',
        },
      },
      'private': {
        encryption: true,
        versioning: true,
      },
      'docs': {
        public: true,
        encryption: true,
        versioning: true,
        path: '/docs',
        pathRewriteStyle: 'flat',
        website: {
          indexDocument: 'index.html',
          errorDocument: '404.html',
        },
      },
      'blog': {
        public: true,
        encryption: true,
        versioning: true,
        path: '/blog',
        website: {
          indexDocument: 'index.html',
          errorDocument: '404.html',
        },
      },
      'logs': {
        encryption: true,
        versioning: false,
      },
      'backups': {
        encryption: true,
        versioning: true,
      },
      'email': {
        public: false,
        encryption: true,
        versioning: false,
      },
    },

    /**
     * Functions Configuration (optional)
     * Lambda functions for specific serverless workloads
     *
     * Note: Stacks uses Bun-based routing (./routes) for APIs, not Lambda functions.
     * Only add functions here for specific use cases like:
     * - Background job processing
     * - Event-driven tasks
     * - Image processing
     * - Scheduled tasks
     */
    functions: {
      // Example background worker (optional)
      // 'background-worker': {
      //   handler: 'worker.handler',
      //   runtime: 'nodejs20.x',
      //   timeout: 300,
      //   memorySize: 1024,
      // },
    },

    /**
     * Queue Configuration (SQS)
     * Background job processing, event-driven tasks, and scheduled work.
     *
     * Jobs defined in app/Jobs/*.ts are auto-discovered at deploy time
     * and scheduled via EventBridge rules targeting these queues.
     */
    queues: {
      jobs: {
        visibilityTimeout: 120,
        deadLetterQueue: true,
        maxReceiveCount: 3,
      },
      // Uncomment for ordered processing:
      // orders: {
      //   fifo: true,
      //   contentBasedDeduplication: true,
      // },
    },

    /**
     * Database Configuration (optional)
     */
    databases: {
      // Uncomment to add a database
      // 'main': {
      //   engine: 'postgres',
      //   instanceClass: 'db.t3.micro',
      //   storage: 20,
      //   username: 'admin',
      //   password: 'changeme123', // Use AWS Secrets Manager in production
      // },
    },

    /**
     * CDN Configuration
     * CloudFront distribution for global content delivery
     */
    cdn: {
      // Uncomment to enable CloudFront CDN
      // 'frontend': {
      //   origin: 'stacks-production-frontend.s3.us-east-1.amazonaws.com',
      //   customDomain: 'cdn.stacks-js.org',
      // },
    },

    /**
     * Redirects Configuration
     * Domain-level and path-level URL redirects.
     *
     * Domain redirects create S3 redirect buckets.
     * Path redirects create CloudFront Functions.
     */
    // redirects: {
    //   // Redirect these domains to your primary domain
    //   // domains: ['www.stacksjs.com', 'stacks.dev'],
    //   // target: 'stacksjs.com',
    //
    //   // Path-level redirects (source -> target)
    //   // paths: {
    //   //   '/old-page': '/new-page',
    //   //   '/blog/old-post': '/blog/new-post',
    //   // },
    // },

    /**
     * Cache Configuration (ElastiCache)
     * Redis or Memcached for in-memory caching
     */
    // Cache temporarily disabled for initial deployment - enable after stack is stable
    // cache: {
    //   type: 'redis',
    //   nodeType: 'cache.t3.micro',
    //   redis: {
    //     engineVersion: '7.1',
    //     numCacheNodes: 2,
    //     automaticFailoverEnabled: true,
    //     snapshotRetentionLimit: 7,
    //   },
    // },

    /**
     * Email Configuration (SES)
     * Amazon SES for transactional email sending
     *
     * Domain is auto-detected from dns.domain if not specified.
     * DNS records (SPF, DKIM, DMARC) are auto-created when hostedZoneId is available.
     *
     * Note: 'email' is not a valid property on InfrastructureConfig.
     * Uncomment and move to a supported config section when the type supports it.
     */
    // email: {
    //   domain: 'stacksjs.com',
    //   configurationSet: true,
    //   enableDkim: true,
    //   server: {
    //     enabled: true,
    //   },
    // },

    /**
     * Search Configuration (OpenSearch)
     * Full-text search engine powered by OpenSearch
     */
    // search: {
    //   instanceType: 't3.small.search',
    //   instanceCount: 1,
    //   volumeSize: 10,
    //   volumeType: 'gp3',
    //   encryption: {
    //     atRest: true,
    //     nodeToNode: true,
    //   },
    //   autoTune: true,
    // },

    /**
     * File System Configuration (EFS)
     * Elastic File System for shared storage across instances
     */
    // fileSystem: {
    //   shared: {
    //     encrypted: true,
    //     performanceMode: 'generalPurpose',
    //     throughputMode: 'bursting',
    //   },
    // },

    /**
     * AI Configuration (Bedrock)
     * Amazon Bedrock for AI/ML model access
     */
    // ai: {
    //   models: ['anthropic.claude-3-5-sonnet-20241022-v2:0'],
    //   allowStreaming: true,
    //   service: 'ecs', // 'ecs' | 'ec2' | 'lambda'
    // },

    /**
     * Tunnel Configuration
     *
     * Deploy a custom tunnel server for `buddy share`.
     * Only needed if you want your own tunnel domain — localtunnel.dev
     * is the shared Stacks default and requires no deployment.
     *
     * Set enabled: true and provide a custom domain to deploy a
     * dedicated tunnel server via `buddy deploy:tunnel`.
     */
    // tunnel: {
    //   enabled: false,
    //   // domain: 'tunnel.mycompany.com',  // must NOT be localtunnel.dev
    //   // region: 'us-east-1',
    //   // ssl: { enabled: true },
    // },

    /**
     * Monitoring Configuration (optional)
     */
    monitoring: {
      // Uncomment to add alarms
      // alarms: {
      //   'high-cpu': {
      //     metricName: 'CPUUtilization',
      //     namespace: 'AWS/EC2',
      //     threshold: 80,
      //     comparisonOperator: 'GreaterThanThreshold',
      //   },
      // },
    },
  },

  /**
   * Sites Configuration (optional)
   * For multi-site deployments
   *
   * Site kinds (resolved by ts-cloud's `resolveSiteKind`):
   *  - `server` + `start`  → server-app  (systemd service behind the reverse proxy)
   *  - `server` + no `start` (has `root`) → server-static (built locally, shipped
   *    to `/var/www/<siteName>`, served by the reverse proxy's `file_server`)
   *  - `bucket`            → upload built `root` to object storage + CDN
   *
   * The static sites below (`docs`, `blog`, and external marketing sites) are the Hetzner
   * server-static replacement for the AWS website-hosting buckets in
   * `infrastructure.storage` (see the supersede note there). `buddy deploy`'s
   * Hetzner path (`deployAllComputeSites`) builds each site's `root`, tars it,
   * and ships it to `/var/www/<siteName>` on the box. No new Hetzner buckets are
   * created. Each site's key maps 1:1 to `/var/www/<key>`:
   *   - `docs`   → /var/www/docs   → served at /docs   on stacksjs.com
   *   - `blog`   → /var/www/blog   → served at /blog   on stacksjs.com
   *
   * The Stacks root is served by the `main` server app; do not add a second
   * static `/` site for stacksjs.com or it will compete with the app route.
   */
  sites: {
    main: {
      // Ship the repo (source only; node_modules/.git excluded by the packager)
      // and install on the server via preStart, matching the Forge-style deploy.
      // server-app: has `start` + `port` (systemd service on :3000).
      root: '.',
      path: '/',
      domain: env.APP_DOMAIN || 'stacksjs.com',
      start: 'bun storage/framework/core/buddy/src/cli.ts serve',
      port: 3000,
      preStart: ['bun install'],
    },

    // API (bun-router) behind `buddy serve`'s same-origin /api proxy.
    // server-app: has `start` + `port` → systemd service on :3008.
    // Intentionally NO `domain`/`path`: ts-cloud's rpx gateway skips
    // domain-less sites, so the service stays loopback-only and is
    // reached exclusively via the :3000 proxy (stacksjs/stacks#1950).
    // Loopback isolation is enforced at the firewall too: the Hetzner
    // deploy strips this port from the provision config
    // (scrubLoopbackSitePortsForFirewall in buddy's deploy command), so
    // ts-cloud never opens :3008 to 0.0.0.0/0 — without that, the
    // HOST=127.0.0.1 bind below would be the only thing keeping the full
    // API off the public internet.
    api: {
      root: '.',
      start: 'bun storage/framework/core/actions/src/serve/api.ts',
      port: 3008,
      preStart: ['bun install'],
      env: { HOST: '127.0.0.1', APP_ENV: 'production' },
    },

    // ---- server-static sites (migrated off AWS S3 + CloudFront) ----
    // NO `start`/`port` ⇒ resolveSiteKind() === 'server-static'. The built
    // `root` dir is shipped to /var/www/<key> and served by the reverse proxy's
    // `file_server`. `build` runs locally before packaging to produce `root`.

    // Documentation (BunPress). ~82 MB.
    // BunPress writes the rendered site into the `.bunpress` subdir of --outdir,
    // so the SERVED root is `dist/docs/.bunpress`.
    docs: {
      deploy: 'server',
      root: 'dist/docs/.bunpress',
      path: '/docs',
      domain: env.APP_DOMAIN || 'stacksjs.com',
      build: 'bunx @stacksjs/bunpress build --dir ./docs --outdir ./dist/docs',
      // Extensionless docs URLs resolve to <path>/index.html (BunPress default).
      pathRewriteStyle: 'directory',
    },

    // Blog (BunPress static build of content/blog/, same engine as /docs).
    // `buildBlog` renders the markdown posts with the custom Stacks theme into
    // clean-URL pages (`<slug>/index.html`) plus the listing, feed.xml, and
    // sitemap.xml — the static twin of the dev-server's onRequest renderer.
    blog: {
      deploy: 'server',
      root: 'dist/blog',
      path: '/blog',
      domain: env.APP_DOMAIN || 'stacksjs.com',
      build: 'bun -e "const {buildBlog}=await import(\'./storage/framework/core/actions/src/blog\'); await buildBlog({outDir:\'./dist/blog\', baseUrl: (process.env.APP_URL?(/^https?:/.test(process.env.APP_URL)?process.env.APP_URL:\'https://\'+process.env.APP_URL):\'https://stacksjs.com\')})"',
      // Extensionless blog URLs resolve to <path>/index.html.
      pathRewriteStyle: 'directory',
    },

    verygoodadblock: {
      deploy: 'server',
      root: '../adblock/dist/site',
      path: '/',
      domain: 'verygoodadblock.org',
      build: 'cd ../adblock && bun run site:build',
      pathRewriteStyle: 'directory',
    },

    verygoodadblockWww: {
      deploy: 'server',
      root: '../adblock/dist/site',
      path: '/',
      domain: 'www.verygoodadblock.org',
      build: 'cd ../adblock && bun run site:build',
      pathRewriteStyle: 'directory',
    },

    // Redirect-only sites (gateway answers with a 301; nothing is shipped).
    // The alternate adblock domain → canonical, and www → apex for stacksjs.com.
    veryGoodAdblock: { domain: 'very-good-adblock.org', redirect: 'https://verygoodadblock.org' },
    veryGoodAdblockWww: { domain: 'www.very-good-adblock.org', redirect: 'https://verygoodadblock.org' },
    wwwStacksjs: { domain: 'www.stacksjs.com', redirect: 'https://stacksjs.com' },
  },
}

// Stacks cloud configuration (for existing Stacks cloud features)
const config: CloudConfig = {
  // Add Stacks-specific cloud config here if needed
}

export default config
