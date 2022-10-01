#!/usr/bin/env node

import { generateLibEntry, hasComponents, hasFunctions } from '..'

async function generate() {
  if (hasComponents())
    await generateLibEntry('components')

  if (hasFunctions())
    await generateLibEntry('functions')
}

generate()
