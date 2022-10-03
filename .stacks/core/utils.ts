import { _dirname, copyFiles, deleteFolder, hasComponents, hasFiles, hasFunctions, isFile, isFolder, readJsonFile, readTextFile, writeJsonFile, writeTextFile } from './utils/fs'
import { generateLibEntry, generatePackageJson, generateVueCompat } from './utils/generate'
import { isInitialized } from './utils/helpers'
import { kebabCase } from './utils/string'
import { contains } from './utils/array'
import { isManifest } from './utils/manifest'

export { hasFiles, isFile, isFolder, readJsonFile, readTextFile, writeJsonFile, writeTextFile, _dirname, isInitialized, isManifest, copyFiles, deleteFolder, hasComponents, hasFunctions, generateLibEntry, generateVueCompat, generatePackageJson, kebabCase, contains }
