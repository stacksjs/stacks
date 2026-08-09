import type { CloudConfig } from '@stacksjs/types'
import type { CloudConfig as TsCloudConfig } from '@stacksjs/ts-cloud'
import { env } from '@stacksjs/env'

const APP_SLUG = '__APP_SLUG__'
const APP_DOMAIN = env.APP_DOMAIN || undefined

/**
 * Safe application cloud defaults.
 *
 * Set APP_DOMAIN and provider credentials before the first deploy. Use
 * `cloud.attachTo` only when this app is intentionally joining a server owned
 * by another ts-cloud project.
 */
export const tsCloud: TsCloudConfig = {
  project: {
    name: APP_SLUG,
    slug: APP_SLUG,
    region: 'us-east-1',
  },

  stateDir: 'storage/cloud',

  cloud: {
    provider: 'hetzner',
  },

  mode: 'server',

  environments: {
    production: {
      type: 'production',
      deployBranch: 'main',
      region: 'us-east-1',
      variables: {
        APP_ENV: 'production',
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
    },
  },

  infrastructure: {
    compute: {
      instances: 1,
      size: 'small',
      disk: {
        size: 20,
        type: 'ssd',
        encrypted: true,
      },
      webServer: 'rpx',
      proxy: {
        engine: 'rpx',
        onDemandTls: true,
      },
    },
  },

  sites: {
    main: {
      root: '.',
      path: '/',
      domain: APP_DOMAIN,
      start: 'bun node_modules/@stacksjs/buddy/dist/serve-entry.js',
      port: 3000,
      preStart: [
        'bun install --frozen-lockfile',
        'bun node_modules/@stacksjs/buddy/dist/cli.js migrate',
      ],
      env: {
        APP_ENV: 'production',
        NODE_ENV: 'production',
        PORT_API: '3008',
        API_URL: 'http://127.0.0.1:3008',
      },
    },

    api: {
      root: '.',
      start: 'bun node_modules/@stacksjs/actions/dist/serve/api.js',
      port: 3008,
      preStart: ['bun install --frozen-lockfile'],
      env: {
        HOST: '127.0.0.1',
        APP_ENV: 'production',
        NODE_ENV: 'production',
      },
    },
  },
}

const config: CloudConfig = {}

export default config
