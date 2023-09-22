import type { FileSystemConfig } from '@stacksjs/types'

/**
 * **File System Configuration**
 *
 * This configuration defines all of your File System options. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  default: 'local',

  disks: {
    local: {
      driver: 'local',
      root: 'storage',
    },

    public: {
      driver: 'public',
      root: 'storage/public',
    },

    private: {
      driver: 'private',
      root: 'storage/private',
      visibility: 'private',
    },

    efs: {
      driver: 'local',
      root: '/mnt/efs',
    },

    s3: {
      driver: 's3',
      root: 's3',
    },
  },
} satisfies FileSystemConfig
