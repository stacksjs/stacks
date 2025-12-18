/**
 * Filesystem Configuration Types
 *
 * Laravel-style filesystem configuration with clean, typed interfaces.
 * Supports local, public, and S3 disk drivers.
 */

export type FilesystemDriver = 'local' | 's3'
export type Visibility = 'public' | 'private'

/**
 * Base disk configuration shared by all drivers
 */
interface BaseDiskConfig {
  /** Display name for the disk */
  name?: string
  /** Whether files are public or private by default */
  visibility?: Visibility
  /** Whether to throw on errors or return null/false */
  throw?: boolean
}

/**
 * Local filesystem disk configuration
 */
export interface LocalDiskConfig extends BaseDiskConfig {
  driver: 'local'
  /** Absolute path to the root directory */
  root: string
  /** Base URL for generating public URLs (optional) */
  url?: string
}

/**
 * S3 disk configuration
 */
export interface S3DiskConfig extends BaseDiskConfig {
  driver: 's3'
  /** S3 bucket name */
  bucket: string
  /** AWS region */
  region?: string
  /** Key prefix for all objects */
  prefix?: string
  /** Custom endpoint for S3-compatible services (MinIO, DigitalOcean Spaces, etc.) */
  endpoint?: string
  /** Use path-style URLs instead of virtual-hosted-style */
  usePathStyleEndpoint?: boolean
  /** Base URL for public files */
  url?: string
  /** AWS credentials (falls back to env vars if not provided) */
  credentials?: {
    key: string
    secret: string
  }
}

/**
 * Union type for all disk configurations
 */
export type DiskConfig = LocalDiskConfig | S3DiskConfig

/**
 * Main filesystem configuration
 *
 * @example
 * ```ts
 * const config: FilesystemConfig = {
 *   default: 'local',
 *   disks: {
 *     local: {
 *       driver: 'local',
 *       root: '/storage/app',
 *     },
 *     public: {
 *       driver: 'local',
 *       root: '/public',
 *       url: '/storage',
 *       visibility: 'public',
 *     },
 *     s3: {
 *       driver: 's3',
 *       bucket: 'my-bucket',
 *       region: 'us-east-1',
 *     },
 *   },
 * }
 * ```
 */
export interface FilesystemConfig {
  /** Default disk to use when none is specified */
  default: string
  /** Disk configurations */
  disks: Record<string, DiskConfig>
}

/**
 * Environment variable mappings for filesystem configuration
 */
export interface FilesystemEnv {
  // Default disk
  FILESYSTEM_DISK?: string

  // AWS S3
  AWS_ACCESS_KEY_ID?: string
  AWS_SECRET_ACCESS_KEY?: string
  AWS_DEFAULT_REGION?: string
  AWS_BUCKET?: string
  AWS_ENDPOINT?: string
  AWS_URL?: string
  AWS_USE_PATH_STYLE_ENDPOINT?: string
}

/**
 * Helper to create a local disk config
 */
export function localDisk(root: string, options?: Partial<Omit<LocalDiskConfig, 'driver' | 'root'>>): LocalDiskConfig {
  return {
    driver: 'local',
    root,
    visibility: 'private',
    ...options,
  }
}

/**
 * Helper to create an S3 disk config
 */
export function s3Disk(bucket: string, options?: Partial<Omit<S3DiskConfig, 'driver' | 'bucket'>>): S3DiskConfig {
  return {
    driver: 's3',
    bucket,
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    visibility: 'private',
    ...options,
  }
}

/**
 * Create filesystem config from environment variables
 */
export function configFromEnv(base: Partial<FilesystemConfig> = {}): FilesystemConfig {
  const env = process.env as FilesystemEnv

  return {
    default: env.FILESYSTEM_DISK || base.default || 'local',
    disks: {
      ...base.disks,
      // S3 disk from env vars (if AWS credentials are set)
      ...(env.AWS_ACCESS_KEY_ID && env.AWS_BUCKET ? {
        s3: {
          driver: 's3' as const,
          bucket: env.AWS_BUCKET,
          region: env.AWS_DEFAULT_REGION || 'us-east-1',
          endpoint: env.AWS_ENDPOINT,
          url: env.AWS_URL,
          usePathStyleEndpoint: env.AWS_USE_PATH_STYLE_ENDPOINT === 'true',
          credentials: {
            key: env.AWS_ACCESS_KEY_ID,
            secret: env.AWS_SECRET_ACCESS_KEY || '',
          },
        },
      } : {}),
    },
  }
}
