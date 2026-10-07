import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log, onUnknownSubcommand } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

/**
 * `buddy socials:authorize` and `buddy socials:identities`.
 *
 * X posts with a user-context OAuth 2.0 token, so unlike Bluesky's app
 * password its access and refresh tokens cannot be prepared by pasting a
 * value into `.env`: something has to run a consent flow and catch the
 * redirect (stacksjs/stacks#2873). This is that something, on a loopback
 * port, so authorizing an identity does not need a deployed dashboard.
 *
 * The tokens are printed to stdout and nowhere else. `log` writes to a file
 * in production, `.env` may be encrypted and `buddy env:set` owns writing to
 * it, and a token passed as a shell argument lands in shell history, which is
 * a worse home for it than a gitignored file.
 */

/**
 * The port the redirect comes back on.
 *
 * Fixed, not chosen at run time: the redirect URI has to match the one
 * registered with the platform character for character, so a random port
 * would mean re-registering before every run.
 */
const DEFAULT_PORT = 7731

/** How long to wait at the browser before giving the port back. */
const DEFAULT_TIMEOUT_SECONDS = 300

async function socialsModule(): Promise<typeof import('@stacksjs/socials')> {
  return import('@stacksjs/socials')
}

async function fail(message: string, hint?: string): Promise<never> {
  await log.error(message)
  if (hint) log.info(hint)
  await log.flush()
  process.exit(ExitCode.FatalError)
}

export function socials(buddy: CLI): void {
  buddy
    .command('socials:identities', 'List the social identities and whether each platform is ready to post')
    .example('buddy socials:identities')
    .action(async () => {
      const {
        pickIdentity,
        readCredentials,
        REQUIRED_SOCIAL_CREDENTIALS,
        socialsConfig,
      } = await socialsModule()

      const config = await socialsConfig()
      const names = Object.keys(config.identities ?? {})

      if (names.length === 0) {
        log.info('config/socials.ts declares no identities, so there is no account to post as.')
        await log.flush()
        process.exit(ExitCode.Success)
      }

      // Resolved once so the listing agrees with what a post would do: if the
      // default is set to something that is not an identity, say so here
      // rather than at the first post.
      let fallback = ''
      try {
        fallback = pickIdentity(config)
      }
      catch { /* reported per identity below; a listing must still list. */ }

      const out: string[] = ['']
      for (const name of names) {
        const declared = config.identities?.[name] ?? {}
        const platforms = declared.platforms ?? []
        const marker = name === fallback ? '*' : ' '
        out.push(`  ${marker} ${name}${declared.handle ? `  (${declared.handle})` : ''}`)

        if (platforms.length === 0) {
          out.push('      no platforms declared')
          continue
        }

        for (const platform of platforms) {
          const resolved = readCredentials(config, platform, name) as Record<string, string | undefined>
          const missing = REQUIRED_SOCIAL_CREDENTIALS[platform].filter(field => !resolved[field])
          out.push(missing.length === 0
            ? `      ok      ${platform}`
            : `      MISSING ${platform}  ${missing.join(', ')}`)
        }
      }

      if (fallback)
        out.push('', `  * is the identity a call with no name uses.`)
      else if (names.length > 1)
        out.push('', '  No default, so a call has to name its identity.')

      // eslint-disable-next-line no-console
      console.log(out.join('\n'))
      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('socials:authorize [identity]', 'Run a platform consent flow and print the tokens for .env')
    .option('--platform <platform>', 'Which platform to authorize. Only `twitter` needs a consent flow today.', { default: 'twitter' })
    .option('--port <port>', `Loopback port the redirect comes back on. Must match the registered redirect URI.`, { default: String(DEFAULT_PORT) })
    .option('--timeout <seconds>', 'How long to wait at the browser', { default: String(DEFAULT_TIMEOUT_SECONDS) })
    .example('buddy socials:authorize home-lang')
    .example('buddy socials:authorize stacks --platform twitter --port 7731')
    .action(async (identity: string | undefined, options: { platform?: string, port?: string, timeout?: string }) => {
      const {
        callbackPage,
        callbackUri,
        completeTwitterAuthorization,
        envLines,
        isAuthorizablePlatform,
        newState,
        readCallback,
        readCredentials,
        resolveIdentityName,
        socialsConfig,
        startTwitterAuthorization,
        TWITTER_PUBLISH_SCOPES,
      } = await socialsModule()

      const platform = String(options.platform || 'twitter').toLowerCase()
      if (!isAuthorizablePlatform(platform as never)) {
        return fail(
          `There is no consent flow for '${platform}'.`,
          'Bluesky uses an app password and Mastodon a manually generated token, so both go straight into .env. Only `twitter` needs this.',
        )
      }

      const port = Number(options.port)
      const timeoutMs = Math.max(10, Number(options.timeout) || DEFAULT_TIMEOUT_SECONDS) * 1000

      let name: string
      let redirectUrl: string
      try {
        name = await resolveIdentityName(identity)
        redirectUrl = callbackUri(port)
      }
      catch (error) {
        return fail(error instanceof Error ? error.message : String(error))
      }

      const config = await socialsConfig()
      const credentials = readCredentials(config, 'twitter', name) as Record<string, string | undefined>
      if (!credentials.clientId) {
        return fail(
          `Identity '${name}' has no X client id, so there is nothing to start a consent flow with.`,
          'Set SOCIALS_' + name.toUpperCase().replace(/[^A-Z0-9]/g, '') + '_TWITTER_CLIENT_ID (and _CLIENT_SECRET for a confidential app) first.',
        )
      }

      const state = newState()
      const { url, codeVerifier } = await startTwitterAuthorization({ clientId: credentials.clientId, redirectUrl, state })

      log.info(`Authorizing '${name}' on X, asking for: ${TWITTER_PUBLISH_SCOPES.join(' ')}`)
      log.info(`The app's registered redirect URI must be exactly ${redirectUrl}`)
      await log.flush()

      // Straight to stdout: a URL this long is going to be copied, and
      // `log`'s prefixes make it harder to select cleanly.
      process.stdout.write(`\n  Open this and approve:\n\n  ${url}\n\n  Waiting for the redirect...\n`)

      const outcome = await new Promise<{ ok: true, code: string } | { ok: false, message: string }>((resolve) => {
        const timer = setTimeout(() => {
          resolve({ ok: false, message: `Nothing came back within ${Math.round(timeoutMs / 1000)}s.` })
        }, timeoutMs)

        let server: { stop: (closeActive?: boolean) => void } | undefined
        const settle = (value: { ok: true, code: string } | { ok: false, message: string }) => {
          clearTimeout(timer)
          resolve(value)

          // NOT stopped inline. `stop(true)` closes the connection the
          // response is still travelling on, so the browser got a connection
          // reset instead of the page this command goes to the trouble of
          // rendering - measured with curl, which reported no status at all.
          // A short unref'd delay lets the bytes out, releases the port, and
          // cannot hold the process open by itself.
          setTimeout(() => server?.stop(true), 500).unref()
        }

        try {
          server = Bun.serve({
            port,
            hostname: '127.0.0.1',
            fetch(request) {
              const reading = readCallback(request.url, state)

              if (!reading.ok && reading.reason === 'not-the-callback') {
                // A browser asks for /favicon.ico unprompted. Answering 404
                // and staying up is the difference between a flow that works
                // and one that ends before the redirect arrives.
                return new Response('Not found', { status: 404 })
              }

              if (!reading.ok) {
                settle({ ok: false, message: reading.message })
                return new Response(callbackPage('Could not authorize', reading.message), {
                  status: 400,
                  headers: { 'content-type': 'text/html; charset=utf-8' },
                })
              }

              settle({ ok: true, code: reading.code })
              return new Response(callbackPage('Authorized', 'You can close this tab and go back to the terminal.'), {
                headers: { 'content-type': 'text/html; charset=utf-8' },
              })
            },
          })
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          clearTimeout(timer)
          resolve({ ok: false, message: `Could not listen on ${port}: ${message}` })
        }
      })

      if (!outcome.ok)
        return fail(outcome.message, `Run it again when you are ready; nothing was changed.`)

      let authorized: Awaited<ReturnType<typeof completeTwitterAuthorization>>
      try {
        authorized = await completeTwitterAuthorization({
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          redirectUrl,
          code: outcome.code,
          codeVerifier,
        })
      }
      catch (error) {
        // The code is single-use and spent by now, so this is a re-run rather
        // than a retry.
        return fail(
          `X refused the exchange: ${error instanceof Error ? error.message : String(error)}`,
          'The authorization code is single-use, so start over rather than retrying.',
        )
      }

      log.success(`Authorized @${authorized.handle} (${authorized.accountId}) for identity '${name}'`)

      if (!authorized.renewable) {
        log.warn('X returned no refresh token, so this access token cannot be renewed.')
        log.info('Add `offline.access` to the app\'s scopes and run this again, or the identity stops posting in a couple of hours.')
      }

      await log.flush()

      const lines = envLines(name, 'twitter', {
        accessToken: authorized.accessToken,
        refreshToken: authorized.refreshToken,
      })

      process.stdout.write(`\n${lines.map(line => `  ${line}`).join('\n')}\n\n`)
      log.info('Put those in .env. They are shown once and are not stored anywhere by this command.')
      if (authorized.expiresIn)
        log.info(`The access token expires in ${authorized.expiresIn}s; the refresh token is what renews it.`)

      await log.flush()
      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, 'socials')
}
