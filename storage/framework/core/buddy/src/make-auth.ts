/**
 * `buddy make:auth`: copy the sign-in flow into the app, so it can be changed.
 *
 * Auth already runs without this. The default routes in
 * `defaults/routes/auth.ts` serve `/login`, `/register`, password reset and
 * the rest, and the pages and actions they use resolve from the defaults
 * tree. What an app cannot do without a copy is change them: the wording of
 * the login page, what registration asks for, what happens after sign-in.
 *
 * So this copies the files a person edits to change that flow, to the paths
 * the framework reads before its own:
 *
 * - pages to `resources/views/<path>.stx` and the components they render to
 *   `resources/components/<path>.stx`, with their imports of the framework's
 *   own files pointed at `@stacksjs/defaults` (see publish-stx);
 * - actions to `app/Actions/<folder>/<name>.ts`, the path the default routes
 *   name, with the helper modules they import by relative path copied along.
 *
 * The routes are not copied. User routes load first and the router reads an
 * action from `app/Actions` before the default, so the default routes already
 * run the copies, and a copied routes file would register every route twice.
 *
 * A file the app already has is kept unless `force` is set, so running it
 * again only fills in what is missing.
 */

import { existsSync, mkdirSync, realpathSync } from 'node:fs'
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { carryRelativeImports } from './commands/publish'
import { locateDefaultStx, pointImportsAtDefaults } from './publish-stx'

/** The sign-in pages, by their path under `resources/views`. */
export const AUTH_PAGES = ['login', 'register', 'forgot-password', 'password/reset/[token]'] as const

/**
 * The components those pages render, by their path under
 * `resources/components`. Each page is a thin wrapper: `login.stx` renders
 * `LoginDashboard`, which signs in and redirects, around `Login`, the form
 * itself, inside the shared `AuthCard`. Copying the pages alone would leave
 * nothing that changes the form.
 */
export const AUTH_COMPONENTS = [
  'Dashboard/Auth/AuthCard',
  'Dashboard/Auth/Login',
  'Dashboard/Auth/TwoFactorLogin',
  'Dashboard/Auth/LoginDashboard',
  'Dashboard/Auth/Register',
  'Dashboard/Auth/RegisterDashboard',
  'Dashboard/Auth/ForgotPassword',
  'Dashboard/Auth/ForgotPasswordDashboard',
  'Dashboard/Auth/ResetPassword',
  'Dashboard/Auth/ResetPasswordDashboard',
] as const

/** The actions those pages post to, by the path the default routes name. */
export const AUTH_ACTIONS = [
  'Auth/LoginAction',
  'Auth/VerifyTwoFactorLoginAction',
  'Auth/RegisterAction',
  'Auth/LogoutAction',
  'Password/SendPasswordResetEmailAction',
  'Password/VerifyResetTokenAction',
  'Password/PasswordResetAction',
] as const

export interface MakeAuthOptions {
  projectRoot: string
  /** The framework defaults tree, `path.frameworkPath('defaults')`. */
  defaultsRoot: string
  /** Copy the actions only, for an app that has its own front end. */
  api?: boolean
  /** Overwrite files the app already has. */
  force?: boolean
  /** Say what would be written, and write nothing. */
  dryRun?: boolean
}

export interface MakeAuthResult {
  /** Files written (or, in a dry run, that would be), relative to the project. */
  written: string[]
  /** Files the app already had, left as they are. */
  kept: string[]
  /** Helper modules copied because a written action imports them. */
  carried: string[]
  /** Files the set names that this version of the framework does not ship. */
  missing: string[]
}

export async function makeAuth(options: MakeAuthOptions): Promise<MakeAuthResult> {
  // Resolved once, so the paths this reports agree with the ones
  // carryRelativeImports returns, which are real paths: on macOS a project
  // under /var or /tmp is really under /private.
  const projectRoot = realpathSync(options.projectRoot)
  const { defaultsRoot } = options
  const result: MakeAuthResult = { written: [], kept: [], carried: [], missing: [] }
  const rel = (file: string): string => relative(projectRoot, file)
  const seen = new Set<string>()

  if (!options.api) {
    const templates = [
      ...AUTH_PAGES.map(name => ({ kind: 'view' as const, name, expected: `resources/views/${name}.stx` })),
      ...AUTH_COMPONENTS.map(name => ({ kind: 'component' as const, name, expected: `resources/components/${name}.stx` })),
    ]
    for (const { kind, name, expected } of templates) {
      const found = locateDefaultStx(kind, name, defaultsRoot, projectRoot)
      if (!found.ok) {
        result.missing.push(expected)
        continue
      }
      if (existsSync(found.target) && !options.force) {
        result.kept.push(rel(found.target))
        continue
      }
      result.written.push(rel(found.target))
      if (options.dryRun)
        continue

      const { code } = pointImportsAtDefaults(await readFile(found.source, 'utf-8'), found.source, defaultsRoot)
      mkdirSync(dirname(found.target), { recursive: true })
      await writeFile(found.target, code)
    }
  }

  for (const action of AUTH_ACTIONS) {
    const source = join(defaultsRoot, 'app/Actions', `${action}.ts`)
    const target = join(projectRoot, 'app/Actions', `${action}.ts`)
    if (!existsSync(source)) {
      result.missing.push(rel(target))
      continue
    }
    if (existsSync(target) && !options.force) {
      result.kept.push(rel(target))
      continue
    }
    result.written.push(rel(target))
    if (options.dryRun)
      continue

    mkdirSync(dirname(target), { recursive: true })
    await copyFile(source, target)
    for (const file of await carryRelativeImports(source, target, seen, projectRoot)) {
      if (!result.carried.includes(rel(file)))
        result.carried.push(rel(file))
    }
  }

  return result
}
