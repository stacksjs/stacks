#!/usr/bin/env node
import { generatePackageJson, hasComponents, hasFunctions } from '..'

async function generate() {
  if (hasComponents()) {
    await generatePackageJson('vue-components')
    await generatePackageJson('web-components')
  }

  if (hasFunctions())
    await generatePackageJson('functions')
}

generate()
