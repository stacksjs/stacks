/**
 * Three places auth ignored what it was told, checked against a real SQLite
 * database. For auth-config-respected.test.ts.
 */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const database = process.env.STACKS_AUTH_CONFIG_FIXTURE_DB
const project = process.env.STACKS_AUTH_CONFIG_FIXTURE_PROJECT
assert(database && project, 'Only run with an isolated fixture database and project')

const { config, overridesReady } = await import('@stacksjs/config')
const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
await overridesReady
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })
const { configureOrm } = await import('bun-query-builder')
configureOrm({ database })
const { ormReady } = await import('@stacksjs/orm')
await ormReady

const auth = await import('../../src')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')

await db.unsafe(`CREATE TABLE users (
  id INTEGER PRIMARY KEY, name TEXT, email TEXT NOT NULL, password TEXT NOT NULL,
  password_changed_at TIMESTAMP, two_factor_secret TEXT, two_factor_enabled BOOLEAN NOT NULL DEFAULT 0,
  two_factor_last_used_step BIGINT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP
)`).execute()
await db.insertInto('users').values({ id: 1, name: 'Ada', email: 'ada@example.test', password: 'x' }).execute()
await ensureFrameworkAuthTables()

const out: Record<string, unknown> = {}

// 1. The code that enabled 2FA cannot be replayed at login.
const secret = auth.generateTwoFactorSecret()
const code = await auth.generateTwoFactorToken(secret)
out.enabled = await auth.enableTwoFactor(1, secret, code)
out.replayAccepted = await auth.verifyTwoFactorLoginCode(1, code)

// 2. A refresh keeps the lifetimes config/auth.ts sets.
;(config as any).auth = { ...config.auth, tokenExpiry: 2 * 60 * 60 * 1000, refreshTokenExpiry: 7 * 24 * 60 * 60 * 1000 }
const issued = await auth.createToken(1, 'session', ['*'], { withRefreshToken: true })
const refreshed = await auth.refreshToken(issued.refreshToken!)
out.refreshedExpiresIn = refreshed.expiresIn
const refreshRow = await db.unsafe(`SELECT expires_at FROM oauth_refresh_tokens ORDER BY id DESC LIMIT 1`).execute() as Array<{ expires_at: string }>
out.refreshDaysLeft = Math.round((new Date(refreshRow[0]!.expires_at).getTime() - Date.now()) / 86_400_000)

// 3. PolicyHolderPolicy is the policy for PolicyHolder.
mkdirSync(join(project, 'app/Policies'), { recursive: true })
writeFileSync(join(project, 'app/Policies/PolicyHolderPolicy.ts'), `export default class PolicyHolderPolicy { view() { return true } }\n`)
process.chdir(project)
await auth.discoverPolicies()
out.policyForPolicyHolder = auth.hasPolicy('PolicyHolder')
out.policyForHolderPolicy = auth.hasPolicy('HolderPolicy')

console.log(JSON.stringify(out))
process.exit(0)
