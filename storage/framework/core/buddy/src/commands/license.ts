import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { onUnknownSubcommand } from '@stacksjs/cli'

interface LicenseKeygenOptions {
  keyId?: string
  json?: boolean
}

/**
 * `buddy license:keygen`
 *
 * Generates the Ed25519 keypair that signs offline license tokens
 * (`@stacksjs/commerce` `licensing`). The private half goes in the server's
 * environment; the public half is embedded in the app, which verifies tokens
 * with it and never needs the private one.
 *
 * Prints and writes nothing to disk: the private key is a secret, and where it
 * lives (an encrypted `.env`, a CI secret, a vault) is the operator's call.
 */
export function license(buddy: CLI): void {
  buddy
    .command('license:keygen', 'Generate the Ed25519 keypair that signs software license tokens')
    .option('--key-id <id>', 'The id apps look the public key up by (defaults to license-<today>)')
    .option('--json', 'Print the keypair as JSON', { default: false })
    .example('buddy license:keygen')
    .example('buddy license:keygen --key-id license-2026')
    .action(async (options: LicenseKeygenOptions) => {
      // The token module alone: it imports node:crypto and nothing else.
      const { generateLicenseSigningKeypair } = await import('@stacksjs/commerce/licensing/token')
      let keypair
      try {
        keypair = generateLicenseSigningKeypair(typeof options.keyId === 'string' && options.keyId ? options.keyId : undefined)
      }
      catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }

      if (options.json) {
        console.log(JSON.stringify(keypair, null, 2))
        return
      }

      console.log([
        '',
        'Server environment (secret, shown once; store it encrypted with `buddy env:set`):',
        '',
        `  LICENSE_SIGNING_KEY=${keypair.privateKey}`,
        `  LICENSE_SIGNING_KEY_ID=${keypair.keyId}`,
        '',
        'App (public, safe to commit; pass as `publicKeys` to createLicenseClient):',
        '',
        `  { '${keypair.keyId}': '${keypair.publicKey}' }`,
        '',
        'To rotate later, generate a new pair, ship an app build that trusts both',
        'key ids, then switch the server to the new private key.',
        '',
      ].join('\n'))
    })

  onUnknownSubcommand(buddy, 'license')
}
