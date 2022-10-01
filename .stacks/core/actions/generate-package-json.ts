#!/usr/bin/env node
import { resolve } from 'pathe'
import { generatePackageJson, hasFiles } from '..'

async function generate() {
  if (hasFiles(resolve(process.cwd(), './components'))) {
    await generatePackageJson('components')
    await generatePackageJson('web-components')
  }

  if (hasFiles(resolve(process.cwd(), './functions')))
    await generatePackageJson('functions')
}

generate()
