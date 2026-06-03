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
   * The three static sites below (`docs`, `blog`, `public`) are the Hetzner
   * server-static replacement for the AWS website-hosting buckets in
   * `infrastructure.storage` (see the supersede note there). `buddy deploy`'s
   * Hetzner path (`deployAllComputeSites`) builds each site's `root`, tars it,
   * and ships it to `/var/www/<siteName>` on the box. No new Hetzner buckets are
   * created. Each site's key maps 1:1 to `/var/www/<key>`:
   *   - `docs`   → /var/www/docs   → served at /docs   on stacksjs.com
   *   - `blog`   → /var/www/blog   → served at /blog   on stacksjs.com
   *   - `public` → /var/www/public → served at /        on stacksjs.com
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

    // Blog (Stacks CMS builder). ~0.4 MB.
    // There is no `buddy build:blog` command — the blog is produced by the
    // `buildBlogSite` CMS builder (the same one the AWS deploy action calls).
    // Invoke it directly so the per-site build is self-contained and produces
    // `dist/blog` before packaging.
    blog: {
      deploy: 'server',
      root: 'dist/blog',
      path: '/blog',
      domain: env.APP_DOMAIN || 'stacksjs.com',
      build: 'bun -e "const c=(await import(\'./config/blog\')).default; const {buildBlogSite}=await import(\'./storage/framework/core/cms/src/build\'); await buildBlogSite({config:c,outDir:\'./dist/blog\'})"',
    },

    // Marketing / public site (prerendered resources/views/index.stx + public/
    // assets). ~6.6 MB. The built static dir is storage/framework/frontend-dist.
    // WARNING: there is currently NO standalone build command that emits this
    // directory — the prerender + asset-copy logic lives INLINE in the AWS
    // deploy action (storage/framework/core/actions/src/deploy/index.ts, the
    // "Deploy frontend to S3" block). That logic must be extracted into a real
    // command (e.g. `buddy build:frontend-static`) before this site can deploy
    // to Hetzner. Until then, pre-build storage/framework/frontend-dist by hand
    // or this site's `build` is a no-op placeholder. See the report.
    public: {
      deploy: 'server',
      root: 'storage/framework/frontend-dist',
      path: '/',
      domain: env.APP_DOMAIN || 'stacksjs.com',
      // TODO(operator): replace with the extracted static-frontend build command.
      build: 'bun storage/framework/core/buddy/src/cli.ts build:frontend-static',
    },
  },
}

// Stacks cloud configuration (for existing Stacks cloud features)
const config: CloudConfig = {
  // Add Stacks-specific cloud config here if needed
}

export default config
