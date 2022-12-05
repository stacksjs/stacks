#!/usr/bin/env node
import { runAction } from '@stacksjs/actions'
import { log } from '@stacksjs/logging'

export async function invoke() {
  // need to translate this to a function call
  await runAction('generate-package-json')
  // esno ./core/actions/src/generate-package-json.ts to function call
  // pnpm lint:fix to function call
  // bumpp ../package.json ./package.json ./core/**/package.json ../package.json --execute 'pnpm run changelog' --all to function call

  log.info('Release')
}
