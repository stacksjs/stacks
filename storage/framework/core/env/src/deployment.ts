import process from 'node:process'

/**
 * Hosts where plain HTTP and an ungated dashboard are a development reality
 * rather than a misconfiguration.
 */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'localhost'
    || host.endsWith('.localhost')
    || host === '127.0.0.1'
    || host === '0.0.0.0'
    || host === '::1'
    || host === '[::1]'
}

/**
 * Whether this deployment is demonstrably local, decided from what the app
 * IS rather than what its environment is called.
 *
 * The environment name cannot carry this decision on its own: `.env.example`
 * ships `APP_ENV=development`, so an app whose env file descends from it -
 * which is every app that never edited that line - claims to be development
 * on the public internet. `@stacksjs/auth`'s cookie policy hit this exact
 * shape in stacksjs/stacks#2275 and moved to the URL for the same reason.
 *
 * - an explicit deployment name (`production`, `prod`, `staging`) is never
 *   local, whatever the URL says
 * - otherwise a configured `APP_URL` decides, by whether its host is
 *   loopback. A scheme-less value (`stacks.localhost`, which `buddy dev`
 *   writes) is still parsed for its host.
 * - with no URL at all, only the unambiguous names opt out. `development`
 *   is deliberately absent: it is the one that ships in a template.
 */
export function isLocalDeployment(): boolean {
  const name = (process.env.APP_ENV ?? process.env.NODE_ENV ?? '').toLowerCase()

  // An explicit deployment name is never local, whatever the URL says. A
  // developer running a production build against a loopback URL is asking to
  // be treated as production, and a gate that let the URL override this would
  // have re-opened what stacksjs/stacks#1955 closed.
  if (name === 'production' || name === 'prod' || name === 'staging')
    return false

  const url = (process.env.APP_URL ?? '').trim()
  if (url) {
    try {
      return isLoopbackHost(new URL(url.includes('://') ? url : `https://${url}`).hostname)
    }
    catch {
      // Unparseable: fall through to the name check rather than guessing.
    }
  }

  return name === '' || name === 'local' || name === 'dev' || name === 'test' || name === 'testing'
}
