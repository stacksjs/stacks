#!/usr/bin/env node
import { hasComponents, hasFunctions } from '@stacksjs/fs'
import { generatePackageJson } from './generate/package-json'

async function generate() {
  if (hasComponents()) {
    await generatePackageJson('vue-components')
    await generatePackageJson('web-components')
  }

  if (hasFunctions())
    await generatePackageJson('functions')
}

generate()
