import type { FilesystemsConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **Filesystem Configuration**
 *
 * This configuration defines all of your filesystem/storage options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 *
 * @see https://stacksjs.com/docs/filesystems
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
  driver: (env.STORAGE_DRIVER || 'bun') as any,

  /**
   * Root directory for local/bun drivers
   *
   * @default process.cwd()
   */
  root: env.STORAGE_ROOT || process.cwd(),

  /**
   * S3 Configuration (when driver is 's3')
   */
  s3: {
    bucket: env.AWS_S3_BUCKET || '',
    region: env.AWS_REGION || 'us-east-1',
    prefix: env.AWS_S3_PREFIX || '',
    credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
    // endpoint: 'https://s3-compatible-service.com', // For S3-compatible services
  },

  /**
   * Public URL configuration
   */
  publicUrl: {
    domain: env.STORAGE_PUBLIC_URL || env.APP_URL || 'http://localhost',
  },

  /**
   * Default file visibility
   *
   * @default 'private'
   */
  defaultVisibility: 'private',
} satisfies FilesystemsConfig
