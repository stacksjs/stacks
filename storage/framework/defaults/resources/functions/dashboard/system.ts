/**
 * System-level dashboard helpers — service health probes, env / config
 * snapshots. Read-only; safe to call on every page render.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

import { loadModel, safeAll } from './data'

export interface ServiceStatus {
  name: string
  status: 'healthy' | 'degraded' | 'offline' | 'unknown'
  detail: string
}

let projectRootCache: string | null = null
function projectRoot(): string {
  if (projectRootCache) return projectRootCache
  let dir = process.cwd()
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'storage/framework/defaults'))) {
      projectRootCache = dir
      return dir
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  projectRootCache = process.cwd()
  return projectRootCache
}

/**
 * Probe each core service's status. The "probe" for the database is
 * just a User.count() — if it resolves we know the connection works and
 * the schema migrated. The other services don't have a cheap dev-time
 * probe yet, so they report "unknown" with a hint about how to test.
 */
export async function getServiceHealth(): Promise<ServiceStatus[]> {
  const out: ServiceStatus[] = []

  // Database
  try {
    const User = await loadModel('User')
    if (User?._isStub) {
      out.push({ name: 'Database', status: 'unknown', detail: 'Model not loaded' })
    }
    else {
      const count = typeof User.count === 'function' ? await User.count() : (await safeAll(User)).length
      out.push({
        name: 'Database',
        status: count > 0 ? 'healthy' : 'degraded',
        detail: count > 0 ? `${count} users` : 'Schema reachable, no rows — run buddy seed',
      })
    }
  }
  catch (e: any) {
    out.push({ name: 'Database', status: 'offline', detail: e?.message || 'Connection failed' })
  }

  // Cache — read driver from env, no live ping yet
  const cacheDriver = process.env.CACHE_DRIVER || 'memory'
  out.push({ name: 'Cache', status: 'healthy', detail: `${cacheDriver} driver` })

  // Queue
  const queueDriver = process.env.QUEUE_CONNECTION || 'sync'
  try {
    const Job = await loadModel('Job')
    const FailedJob = await loadModel('FailedJob')
    const pending = await safeAll(Job)
    const failed = await safeAll(FailedJob)
    out.push({
      name: 'Queue',
      status: failed.length > 0 ? 'degraded' : 'healthy',
      detail: `${queueDriver} · ${pending.length} pending, ${failed.length} failed`,
    })
  }
  catch {
    out.push({ name: 'Queue', status: 'unknown', detail: `${queueDriver} driver` })
  }

  // Storage
  const storageDriver = process.env.FILESYSTEM_DISK || 'local'
  const publicDir = resolve(projectRoot(), 'storage/app/public')
  out.push({
    name: 'Storage',
    status: existsSync(publicDir) ? 'healthy' : 'degraded',
    detail: `${storageDriver} disk`,
  })

  return out
}

export interface EnvSummary {
  appEnv: string
  appUrl: string
  nodeVersion: string
  bunVersion: string
  dbDriver: string
  dbPath: string
  cacheDriver: string
  queueDriver: string
  mailDriver: string
  storageDriver: string
}

/**
 * Snapshot env-driven configuration for the Environment / Settings pages.
 * Strips secrets — only driver names and non-sensitive paths are exposed.
 */
export function getEnvSummary(): EnvSummary {
  return {
    appEnv: process.env.NODE_ENV || process.env.APP_ENV || 'development',
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    nodeVersion: process.version,
    bunVersion: typeof Bun !== 'undefined' ? Bun.version : 'n/a',
    dbDriver: process.env.DB_CONNECTION || 'sqlite',
    dbPath: process.env.DB_DATABASE_PATH || 'database/stacks.sqlite',
    cacheDriver: process.env.CACHE_DRIVER || 'memory',
    queueDriver: process.env.QUEUE_CONNECTION || 'sync',
    mailDriver: process.env.MAIL_MAILER || 'log',
    storageDriver: process.env.FILESYSTEM_DISK || 'local',
  }
}

/**
 * Read the project's root package.json. Used by the Library / Home
 * pages to display project metadata.
 */
export function readPackageJson(): { name: string, version: string, dependencies: Record<string, string>, devDependencies: Record<string, string> } {
  const root = projectRoot()
  const file = resolve(root, 'package.json')
  if (!existsSync(file)) {
    return { name: 'unknown', version: '0.0.0', dependencies: {}, devDependencies: {} }
  }
  try {
    const json = JSON.parse(readFileSync(file, 'utf8'))
    return {
      name: json.name || 'unknown',
      version: json.version || '0.0.0',
      dependencies: json.dependencies || {},
      devDependencies: json.devDependencies || {},
    }
  }
  catch {
    return { name: 'unknown', version: '0.0.0', dependencies: {}, devDependencies: {} }
  }
}
