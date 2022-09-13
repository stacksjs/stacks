#!/usr/bin/env node
import { resolve } from 'pathe'
import consola from 'consola'
import { author, componentLibraryDescription, componentLibraryKeywords, componentLibraryName, contributors, functionLibraryDescription, functionLibraryKeywords, functionLibraryName, repository, webComponentLibraryDescription, webComponentLibraryName } from '../../../config/library'
import { hasFiles, writeTextFile } from '../core/fs'

export async function generatePackageJson(type: string) {
  consola.info(`Creating the corresponding package.json file needed to publish the ${type} package...`)

  let name, description, directory, keywords

  if (type === 'components') {
    name = componentLibraryName
    description = componentLibraryDescription
    directory = 'components'
    keywords = componentLibraryKeywords
  }

  else if (type === 'elements') {
    name = webComponentLibraryName
    description = webComponentLibraryDescription
    directory = 'components'
    keywords = componentLibraryKeywords
  }

  else if (type === 'functions') {
    name = functionLibraryName
    description = functionLibraryDescription
    directory = 'functions'
    keywords = functionLibraryKeywords
  }

  const path = resolve(process.cwd(), `./${type}/package.json`)

  try {
    // the version does not have to be set here,
    // it will be set automatically by the release script
    await writeTextFile({
      path,
      data: `{
  "name": "${name}",
  "version": "",
  "description": "${description}",
  "author": "${author}",
  "license": "MIT",
  "homepage": "https://github.com/${repository}/tree/main/${directory}#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/${repository}.git",
    "directory": "${directory}"
  },
  "bugs": {
    "url": "https://github.com/${repository}/issues"
  },
  "keywords": ${JSON.stringify(keywords)},
  "contributors": ${JSON.stringify(contributors)},
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.cjs",
      "import": "./dist/index.js"
    }
  },
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist"
  ]
}
`,
    })

    consola.success(`Created the ${type} package.json file.`)
  }
  catch (err) {
    consola.error(err)
  }
}

export async function generate() {
  if (hasFiles(resolve(process.cwd(), './components'))) {
    await generatePackageJson('components')
    await generatePackageJson('elements')
  }

  if (hasFiles(resolve(process.cwd(), './functions')))
    await generatePackageJson('functions')
}

generate()
