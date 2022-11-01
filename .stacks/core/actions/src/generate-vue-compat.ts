#!/usr/bin/env node

/**
 * Thanks for inspiration:
 * https://github.com/vueuse/vueuse/blob/main/scripts/fix-types.ts
 */

import { generateVueCompat } from './helpers/vue-compat'

async function invoke() {
  await generateVueCompat(['wip'])
}

invoke()
