#!/usr/bin/env node
import { hasComponents, hasFunctions } from '@stacksjs/storage'
import { generatePackageJson } from '../helpers/package-json'

if (hasComponents()) {
  await generatePackageJson('vue-components')
  await generatePackageJson('web-components')
}

if (hasFunctions())
  await generatePackageJson('functions')
