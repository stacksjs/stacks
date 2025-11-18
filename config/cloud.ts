import type { CloudConfig } from '@stacksjs/types'
import type { CloudConfig as TsCloudConfig } from '@ts-cloud/types'

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
     * Storage Configuration
     * S3 buckets for frontend, assets, uploads, etc.
     */
    storage: {
      'frontend': {
        public: true,
        website: true,
        encryption: true,
        versioning: false,
      },
      'assets': {
        public: true,
        website: false,
        encryption: true,
        versioning: false,
      },
      'uploads': {
        public: false,
        website: false,
        encryption: true,
        versioning: true,
      },
      'backups': {
        public: false,
        website: false,
        encryption: true,
        versioning: true,
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
      'frontend': {
        origin: 'stacks-production-frontend.s3.us-east-1.amazonaws.com',
        customDomain: 'stacks.example.com', // Update with your domain
      },
    },

    /**
     * API Gateway Configuration (optional)
     *
     * Note: Stacks handles APIs through Bun serve with ./routes
     * API Gateway is only needed if you're using Lambda functions for your API.
     * For most Stacks apps, you don't need this.
     */
    // api: {
    //   type: 'rest',
    //   cors: true,
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
   */
  sites: {
    main: {
      root: '/var/www/main',
      path: '/',
      domain: 'stacks.example.com',
    },
    // api: {
    //   root: '/var/www/api',
    //   path: '/api',
    //   domain: 'api.stacks.example.com',
    // },
  },
}

// Stacks cloud configuration (for existing Stacks cloud features)
const config: CloudConfig = {
  // Add Stacks-specific cloud config here if needed
}

export default config
