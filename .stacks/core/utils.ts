import { _dirname, copyFolder, deleteFolder, hasComponents, hasFiles, hasFunctions, isFile, isFolder, readJsonFile, readTextFile, writeJsonFile, writeTextFile } from './utils/fs'
import { generateLibEntry, generatePackageJson, generateVueCompat } from './utils/generate'
import { isInitialized } from './utils/helpers'
import { camelCase, capitalCase, constantCase, dotCase, headerCase, kebabCase, noCase, paramCase, pascalCase, pathCase, sentenceCase, snakeCase } from './utils/string'
import { contains } from './utils/array'
import { isManifest } from './utils/manifest'

export { hasFiles, isFile, isFolder, readJsonFile, readTextFile, writeJsonFile, writeTextFile, _dirname, isInitialized, isManifest, copyFolder, deleteFolder, hasComponents, hasFunctions, generateLibEntry, generateVueCompat, generatePackageJson, camelCase, capitalCase, constantCase, dotCase, headerCase, noCase, paramCase, pascalCase, pathCase, kebabCase, sentenceCase, snakeCase, contains }
