import type { CliOptions } from './cli'

/**
 * **Deploy Options**
 *
 * This configuration defines all of your deployment options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface DeployOptions extends CliOptions {
  domain?: string
  deploy?: boolean
  prod?: boolean
  dev?: boolean
  staging?: boolean
  yes?: boolean
  site?: string
  docker?: boolean
  dryRun?: boolean
  json?: boolean
}

export type DeploymentSiteKind = 'bucket' | 'server-app' | 'server-static' | 'server-php' | 'redirect'

export interface DeploymentPreviewSite {
  name: string
  kind: DeploymentSiteKind
  domains: string[]
  path: string
  root: string | null
  port: number | null
  build: string | null
  preStart: string[]
}

export interface DeploymentPreviewOperation {
  phase: 'validate' | 'infrastructure' | 'build' | 'package' | 'release' | 'runtime' | 'gateway' | 'dns' | 'tls' | 'container'
  label: string
  detail: string
  sites: string[]
}

export interface DeploymentPreview {
  version: 1
  dryRun: true
  project: {
    name: string
    slug: string
  }
  provider: string
  mode: string
  environment: string
  region: string
  target: {
    site: string | null
    domain: string | null
    attachTo: string | null
  }
  sites: DeploymentPreviewSite[]
  operations: DeploymentPreviewOperation[]
  warnings: string[]
}
