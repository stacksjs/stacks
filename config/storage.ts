import type { StorageConfig } from '@stacksjs/types'

/**
 * **Storage Options**
 *
 * This configuration defines all of your storage options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 *
 * @see https://stacksjs.org/docs/storage
 */
export default {
  /**
   * Storage driver to use
   *
   * Options: 'local', 'bun', 's3', 'memory'
   * - 'local': Node.js fs-based storage (compatible, slower)
   * - 'bun': Bun-native storage (fastest, recommended when using Bun)
   * - 's3': AWS S3 or S3-compatible storage
   * - 'memory': In-memory storage (for testing)
   */
  driver: process.env.STORAGE_DRIVER || 'bun',

  /**
   * Root directory for local/bun drivers
   *
   * @default process.cwd()
   */
  root: process.env.STORAGE_ROOT || process.cwd(),

  /**
   * S3 Configuration (when driver is 's3')
   */
  s3: {
    bucket: process.env.AWS_S3_BUCKET || '',
    region: process.env.AWS_REGION || 'us-east-1',
    prefix: process.env.AWS_S3_PREFIX || '',
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
    // endpoint: 'https://s3-compatible-service.com', // For S3-compatible services
  },

  /**
   * Public URL configuration
   */
  publicUrl: {
    domain: process.env.STORAGE_PUBLIC_URL || process.env.APP_URL || 'http://localhost',
  },

  /**
   * Default file visibility
   *
   * @default 'private'
   */
  defaultVisibility: 'private',
} satisfies StorageConfig
