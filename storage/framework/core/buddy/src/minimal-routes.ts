/**
 * Keep sign-in working in a `--minimal` app.
 *
 * The `auth` default route bundle (login, register, tokens, 2FA, passkeys) is
 * gated on the `dashboard` feature unless the app names its bundles, and
 * `--minimal` turns the dashboard off. Without this, a minimal app boots with
 * no `/login` and no `/register`, and every authenticated route answers 401 to
 * everyone with no hint why. Naming `auth` mounts it without the dashboard
 * surface, which is what a minimal app that has users wants.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const COMMENT = '# Mount the login/register/token routes without the admin dashboard.'

/** Returns the env files that were changed. An app that already names its bundles is left alone. */
export function ensureAuthRoutesEnv(root: string): string[] {
  const changed: string[] = []

  for (const name of ['.env.example', '.env']) {
    const file = join(root, name)

    if (!existsSync(file))
      continue

    const contents = readFileSync(file, 'utf8')

    if (/^\s*STACKS_DEFAULT_ROUTES\s*=/m.test(contents))
      continue

    writeFileSync(file, `${contents.replace(/\n*$/, '\n')}\n${COMMENT}\nSTACKS_DEFAULT_ROUTES=auth\n`)
    changed.push(name)
  }

  return changed
}
