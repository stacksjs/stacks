/**
 * Native environment detection utilities
 * Replaces std-env with native implementations
 */

import process from 'node:process'
import { platform as osPlatform } from 'node:os'

// Runtime detection
export const isBun: boolean = typeof Bun !== 'undefined'
export const isNode: boolean = typeof process !== 'undefined' && process.versions?.node !== undefined
export const runtime: 'bun' | 'node' | 'unknown' = isBun ? 'bun' : isNode ? 'node' : 'unknown'
export const runtimeInfo: { name: 'bun' | 'node' | 'unknown', version: string | undefined } = {
  name: runtime,
  version: isBun ? Bun.version : isNode ? process.version : undefined,
}

// Platform detection
export const platform: NodeJS.Platform = osPlatform()
export const isWindows: boolean = platform === 'win32'
export const isMacOS: boolean = platform === 'darwin'
export const isLinux: boolean = platform === 'linux'

// TTY detection
export const hasTTY: boolean = Boolean(process.stdout?.isTTY)

// Window detection (browser environment)
export const hasWindow: boolean = typeof globalThis.window !== 'undefined'

// CI detection
export const isCI: boolean = Boolean(
  process.env.CI
  || process.env.CONTINUOUS_INTEGRATION
  || process.env.BUILD_NUMBER
  || process.env.RUN_ID,
)

// Debug mode detection
export const isDebug: boolean = Boolean(
  process.env.DEBUG
  || process.env.VERBOSE
  || process.argv.includes('--debug')
  || process.argv.includes('--verbose'),
)

// Minimal mode detection (CI or non-interactive)
export const isMinimal: boolean = isCI || !hasTTY

// Color support detection
export const isColorSupported: boolean = Boolean(
  !isMinimal
  && (
    hasTTY
    || process.env.COLORTERM
    || process.env.FORCE_COLOR
    || (process.env.TERM && process.env.TERM !== 'dumb')
  ),
)

// Provider detection (CI/CD platform)
const providers: Record<string, { name: string, detected: boolean }> = {
  github: {
    name: 'GitHub Actions',
    detected: Boolean(process.env.GITHUB_ACTIONS),
  },
  gitlab: {
    name: 'GitLab CI',
    detected: Boolean(process.env.GITLAB_CI),
  },
  circle: {
    name: 'CircleCI',
    detected: Boolean(process.env.CIRCLECI),
  },
  travis: {
    name: 'Travis CI',
    detected: Boolean(process.env.TRAVIS),
  },
  jenkins: {
    name: 'Jenkins',
    detected: Boolean(process.env.JENKINS_URL),
  },
  vercel: {
    name: 'Vercel',
    detected: Boolean(process.env.VERCEL),
  },
  netlify: {
    name: 'Netlify',
    detected: Boolean(process.env.NETLIFY),
  },
  heroku: {
    name: 'Heroku',
    detected: Boolean(process.env.DYNO),
  },
  aws: {
    name: 'AWS',
    detected: Boolean(process.env.AWS_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME),
  },
  azure: {
    name: 'Azure',
    detected: Boolean(process.env.AZURE_HTTP_USER_AGENT),
  },
  cloudflare: {
    name: 'Cloudflare',
    detected: Boolean(process.env.CF_PAGES),
  },
  railway: {
    name: 'Railway',
    detected: Boolean(process.env.RAILWAY_ENVIRONMENT),
  },
  render: {
    name: 'Render',
    detected: Boolean(process.env.RENDER),
  },
}

export const provider: string = Object.keys(providers).find(key => providers[key].detected) || 'unknown'
export const providerInfo: { name: string, detected: boolean } = providers[provider] || { name: 'Unknown', detected: false }
