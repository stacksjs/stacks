/**
 * Filesystem Configuration Types
 *
 * Laravel-style filesystem configuration with clean, typed interfaces.
 * Supports local, public, S3 (and every S3-compatible provider) and Azure
 * Blob Storage disk drivers.
 */

export type FilesystemDriver = 'local' | 's3' | 'azure'
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
 * Azure Blob Storage disk configuration (stacksjs/stacks#1896).
 *
 * Its own driver rather than an `s3` disk with an endpoint, because Azure is
 * the one provider in that issue with no S3-compatible API - R2, GCS, Filebase,
 * Backblaze, Hetzner and MinIO all reuse `s3`.
 */
export interface AzureDiskConfig extends BaseDiskConfig {
  driver: 'azure'
  /** Storage account name, e.g. `mystorageaccount`. */
  account: string
  /** Blob container this disk is rooted at. */
  container: string
  /** Account key, base64 as the portal presents it. One of this or `sasToken`. */
  accountKey?: string
  /**
   * A pre-minted SAS token, with or without its leading `?`, instead of the
   * account key. Signed URLs are unavailable on this path - minting one needs
   * the key - so the adapter refuses rather than re-serving this token.
   */
  sasToken?: string
  /** Name prefix applied to every path, so one container can hold several disks. */
  prefix?: string
  /** Public base URL: a CDN or a custom domain mapped to the container. */
  url?: string
  /** Blob service endpoint, for Azurite or a sovereign cloud. */
  endpoint?: string
}

/**
 * Union type for all disk configurations
 */
export type DiskConfig = LocalDiskConfig | S3DiskConfig | AzureDiskConfig

/**
 * Userland-augmentable disk-name registry (stacksjs/stacks#1924).
 *
 * Empty by default — the framework can't know an app's configured
 * disks at its own build time. Apps declare their disks once and get
 * autocomplete on `Storage.disk('…')` everywhere:
 *
 * ```ts
 * // types/storage.d.ts
 * declare module '@stacksjs/storage' {
 *   interface KnownDisks {
 *     local: true
 *     public: true
 *     s3: true
 *   }
 * }
 * ```
 *
 * Mirrors the `DatabaseSchema` pattern from stacksjs/stacks#1923.
 */
// eslint-disable-next-line ts/no-empty-object-type
export interface KnownDisks {}

/**
 * A configured disk name (autocompletes to the keys of an augmented
 * {@link KnownDisks}) or any other string. The `(string & {})` branch
 * keeps the union from collapsing back to `string`, so known disks
 * surface in autocomplete while arbitrary names still type-check —
 * apps that haven't augmented `KnownDisks` keep compiling unchanged.
 */
// eslint-disable-next-line ts/no-empty-object-type
export type DiskName = (keyof KnownDisks & string) | (string & {})

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
 * Helper to create a Filebase disk config (stacksjs/stacks#938).
 *
 * Filebase (https://filebase.com) is an S3-compatible, IPFS-backed object
 * store, so it reuses the `s3` adapter with the endpoint pinned to
 * `https://s3.filebase.com` and the region to `us-east-1` (Filebase's single
 * S3 region). Pass a Filebase bucket; supply Filebase credentials via
 * `options.credentials` or the standard `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`
 * env vars. Any field (prefix, visibility, credentials, ...) can be overridden.
 */
export function filebaseDisk(bucket: string, options?: Partial<Omit<S3DiskConfig, 'driver' | 'bucket'>>): S3DiskConfig {
  return {
    driver: 's3',
    bucket,
    region: 'us-east-1',
    endpoint: 'https://s3.filebase.com',
    visibility: 'private',
    ...options,
  }
}

/**
 * Helper to create a Backblaze B2 disk config (stacksjs/stacks#1897).
 *
 * Backblaze B2 exposes an S3-compatible API, so it reuses the `s3` adapter.
 * `region` is the B2 region embedded in the endpoint (e.g. `us-west-004`,
 * `eu-central-003`); the endpoint resolves to `https://s3.<region>.backblazeb2.com`.
 * Supply B2 application key credentials via `options.credentials` or the AWS_* env vars.
 */
export function backblazeDisk(bucket: string, region: string, options?: Partial<Omit<S3DiskConfig, 'driver' | 'bucket'>>): S3DiskConfig {
  return {
    driver: 's3',
    bucket,
    region,
    endpoint: `https://s3.${region}.backblazeb2.com`,
    visibility: 'private',
    ...options,
  }
}

/**
 * Helper to create a Cloudflare R2 disk config (stacksjs/stacks#1896).
 *
 * R2 exposes an S3-compatible API, so it reuses the `s3` adapter. R2 has a
 * single logical region (`auto`) and a per-account endpoint
 * `https://<accountId>.r2.cloudflarestorage.com`. Supply R2 token credentials
 * via `options.credentials` or the AWS_* env vars.
 */
export function r2Disk(bucket: string, accountId: string, options?: Partial<Omit<S3DiskConfig, 'driver' | 'bucket'>>): S3DiskConfig {
  return {
    driver: 's3',
    bucket,
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    visibility: 'private',
    ...options,
  }
}

/**
 * Helper to create a Google Cloud Storage disk config (stacksjs/stacks#1896).
 *
 * GCS publishes an S3-compatible XML API at `storage.googleapis.com`, which
 * Google calls interoperability mode, so this reuses the `s3` adapter rather
 * than pulling in `@google-cloud/storage`. That SDK is heavy, it brings its own
 * auth-flow surface, and - the reason it never landed - there is no way to
 * exercise it without a real Google account, which is a poor trade for the
 * common case of reading and writing objects.
 *
 * Two things to know, because they are the ways this differs from a bucket you
 * would drive with the official SDK:
 *
 * - **Credentials are HMAC keys, not a service account.** Create them under
 *   Cloud Storage > Settings > Interoperability; a service-account JSON file
 *   will not authenticate here. Supply them via `options.credentials` or the
 *   AWS_* env vars, like every other S3-compatible disk.
 * - **The interop API is a subset.** Object CRUD, listing and signed URLs work;
 *   GCS-only features - resumable-upload sessions, object lifecycle management,
 *   customer-managed encryption keys - do not, because they have no S3 verb. A
 *   project needing those wants the official SDK and a dedicated adapter.
 *
 * `region` defaults to `auto`, which the interop endpoint accepts for a
 * single-region or multi-region bucket alike. Pass the bucket's real location
 * (`us-east1`, `europe-west4`) when you have configured one that requires it.
 */
export function gcsDisk(bucket: string, options?: Partial<Omit<S3DiskConfig, 'driver' | 'bucket'>>): S3DiskConfig {
  return {
    driver: 's3',
    bucket,
    region: 'auto',
    endpoint: 'https://storage.googleapis.com',
    visibility: 'private',
    ...options,
  }
}

/**
 * Hetzner's object-storage locations, which double as the S3 region name.
 * Kept a union rather than `string` so a typo is a compile error instead of a
 * request to a host that does not resolve.
 */
export type HetznerLocation = 'fsn1' | 'nbg1' | 'hel1'

/**
 * Helper to create a Hetzner Object Storage disk config (stacksjs/stacks#1897).
 *
 * Hetzner Object Storage exposes an S3-compatible API, so it reuses the `s3`
 * adapter. `location` is the datacenter, used as both the region and the
 * endpoint host `https://<location>.your-objectstorage.com`. Supply Hetzner S3
 * credentials via `options.credentials` or the AWS_* env vars.
 *
 * Path-style addressing is on by default. Virtual-hosted-style puts the bucket
 * in the hostname, and Hetzner's wildcard certificate covers only one label, so
 * a bucket name containing a dot fails TLS verification. Pass
 * `usePathStyleEndpoint: false` to opt out.
 */
export function hetznerDisk(bucket: string, location: HetznerLocation = 'fsn1', options?: Partial<Omit<S3DiskConfig, 'driver' | 'bucket'>>): S3DiskConfig {
  return {
    driver: 's3',
    bucket,
    region: location,
    endpoint: `https://${location}.your-objectstorage.com`,
    usePathStyleEndpoint: true,
    visibility: 'private',
    ...options,
  }
}

/**
 * Helper to create an Azure Blob Storage disk config (stacksjs/stacks#1896).
 *
 * The one provider here that is not S3-compatible, so it uses the `azure`
 * driver rather than an endpoint on the `s3` one. Supply the account key via
 * `options.accountKey` or `AZURE_STORAGE_ACCOUNT_KEY`.
 *
 * Two things behave differently from every S3 disk above, and neither can be
 * emulated:
 *
 * - **Visibility is a container property.** Azure has no per-blob ACL, so
 *   `changeVisibility()` refuses instead of silently doing nothing; a
 *   per-object grant on Azure is a SAS, which is what `signedUrl()` mints.
 * - **`endpoint` carries the account for Azurite.** The local emulator serves
 *   `http://127.0.0.1:10000/devstoreaccount1`, path-scoped rather than
 *   subdomain-scoped, which is exactly what that option is for.
 */
export function azureDisk(
  container: string,
  account: string,
  options?: Partial<Omit<AzureDiskConfig, 'driver' | 'container' | 'account'>>,
): AzureDiskConfig {
  return {
    driver: 'azure',
    account,
    container,
    accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
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
