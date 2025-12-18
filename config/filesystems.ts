import type { FilesystemConfig } from '@stacksjs/storage'

/**
 * Filesystem Configuration
 *
 * Here you may configure as many filesystem "disks" as you wish, and you
 * may even configure multiple disks of the same driver. Defaults have
 * been set up for each driver as an example of the required values.
 *
 * Supported Drivers: "local", "s3"
 *
 * @see https://stacksjs.org/docs/filesystems
 */
export default {
  /**
   * Default Filesystem Disk
   *
   * Here you may specify the default filesystem disk that should be used
   * by the framework. The "local" disk, as well as a variety of cloud
   * based disks are available to your application for file storage.
   */
  default: process.env.FILESYSTEM_DISK || 'local',

  /**
   * Filesystem Disks
   *
   * Below you may configure as many filesystem disks as necessary, and you
   * may even configure multiple disks for the same driver. Examples for
   * most supported storage drivers are configured here for reference.
   */
  disks: {
    /**
     * Local Disk
     *
     * The local disk is used for storing files on the local filesystem.
     * Files stored here are private by default.
     */
    local: {
      driver: 'local',
      root: `${process.cwd()}/storage/app`,
      visibility: 'private',
    },

    /**
     * Public Disk
     *
     * The public disk is used for storing publicly accessible files.
     * These files are accessible via the web server.
     */
    public: {
      driver: 'local',
      root: `${process.cwd()}/public`,
      url: process.env.APP_URL ? `${process.env.APP_URL}/storage` : '/storage',
      visibility: 'public',
    },

    /**
     * S3 Disk
     *
     * Amazon S3 compatible storage. Works with AWS S3, DigitalOcean Spaces,
     * MinIO, and other S3-compatible services.
     */
    s3: {
      driver: 's3',
      bucket: process.env.AWS_BUCKET || '',
      region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
      endpoint: process.env.AWS_ENDPOINT,
      url: process.env.AWS_URL,
      usePathStyleEndpoint: process.env.AWS_USE_PATH_STYLE_ENDPOINT === 'true',
      visibility: 'private',
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            key: process.env.AWS_ACCESS_KEY_ID,
            secret: process.env.AWS_SECRET_ACCESS_KEY || '',
          }
        : undefined,
    },
  },
} satisfies FilesystemConfig
