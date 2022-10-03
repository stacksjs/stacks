#!/usr/bin/env node
import { resolve } from 'pathe'
import { generatePackageJson, hasFiles } from '..'

async function generate() {
  let componentsPath = process.cwd()
  let functionsPath

  if (componentsPath.includes('.stacks')) {
    componentsPath = resolve(componentsPath, '../components')
    functionsPath = resolve(componentsPath, '../functions')
  }
  else {
    componentsPath = resolve(componentsPath, './components')
    functionsPath = resolve(componentsPath, './functions')
  }

  if (hasFiles(componentsPath)) {
    await generatePackageJson('vue-components')
    await generatePackageJson('web-components')
  }

  if (hasFiles(functionsPath))
    await generatePackageJson('functions')
}

generate()
