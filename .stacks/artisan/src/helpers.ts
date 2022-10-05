import { join, resolve } from 'pathe'
import ezSpawn from '@jsdevtools/ez-spawn'
import { copyFileSync, existsSync, mkdirSync, readFile, readdirSync, rmSync, statSync, writeFile } from 'fs-extra'
import consola from 'consola'
import detectIndent from 'detect-indent'
import { detectNewline } from 'detect-newline'
import { paramCase as kebabCase } from 'change-case'
import { components, functions } from '../../../config/library'
import { reset } from '../../../config/ui'

/**
 * Describes a plain-text file.
 */
export interface TextFile {
  path: string
  data: string
}

/**
 * Determine whether a path is a file.
 */
export function isFile(path: string): boolean {
  return existsSync(path)
}

/**
 * Reads a text file and returns its contents.
 */
export function readTextFile(name: string, cwd: string): Promise<TextFile> {
  return new Promise((resolve, reject) => {
    const filePath = join(cwd, name)

    readFile(filePath, 'utf8', (err, text) => {
      if (err) {
        reject(err)
      }
      else {
        resolve({
          path: filePath,
          data: text,
        })
      }
    })
  })
}

export async function isInitialized(path: string) {
  if (isFile('.env'))
    return await checkIfAppKeyIsSet(path)

  if (isFile('.env.example')) {
    await ezSpawn.async('cp .env.example .env', { stdio: 'inherit', cwd: path })
    return await checkIfAppKeyIsSet(path)
  }

  return false
}

export async function checkIfAppKeyIsSet(path?: string) {
  if (!path)
    path = process.cwd()

  const env = await readTextFile('.env', path)
  const lines = env.data.split('\n')
  const appKey = lines.find(line => line.startsWith('APP_KEY='))

  if (appKey && appKey.length > 16)
    return true

  return false
}

/**
 * Based on the config values, this method
 * will generate the library entry points.
 * @param type
 */
export async function generateLibEntry(type: 'vue-components' | 'web-components' | 'functions') {
  if (type === 'vue-components')
    consola.info('Creating the Vue component library entry point...')
  else if (type === 'web-components')
    consola.info('Creating the Web Component library entry point...')
  else
    consola.info('Creating the function library entry point...')

  let path = process.cwd()
  if (path.includes('.stacks'))
    path = resolve(path, `./core/build/entries/${type}.ts`)
  else
    path = resolve(path, `./.stacks/core/build/entries/${type}.ts`)

  const data = generateEntryPointData(type)

  try {
    await writeTextFile({
      path,
      data,
    })

    if (type === 'vue-components')
      consola.success('Created the Vue component library entry point.')
    else if (type === 'web-components')
      consola.success('Created the Web Component library entry point.')
    else
      consola.success('Created the function library entry point.')
  }
  catch (err) {
    consola.error(err)
  }
}

/**
 * Writes the given text to the specified file.
 */
export function writeTextFile(file: TextFile): Promise<void> {
  return new Promise((resolve, reject) => {
    writeFile(file.path, file.data, (err: any) => {
      if (err)
        reject(err)

      else
        resolve()
    })
  })
}

function generateEntryPointData(type: 'vue-components' | 'web-components' | 'functions'): string {
  let arr = []

  if (type === 'functions') {
    for (const fx of functions) {
      if (Array.isArray(fx))
        arr.push(`export * as ${fx[1]} from '../../../../functions/${fx[0]}'`)
      else
        arr.push(`export * from '../../../../functions/${fx}'`)
    }

    // join the array into a string with each element being on a new line
    return arr.join('\r\n')
  }

  if (type === 'vue-components') {
    arr = determineResetPreset()

    for (const component of components) {
      if (Array.isArray(component))
        arr.push(`export { default as ${component[1]} } from '../../../../components/${component[0]}.vue'`)
      else
        arr.push(`export { default as ${component} } from '../../../../components/${component}.vue'`)
    }

    // join the array into a string with each element being on a new line
    return arr.join('\r\n')
  }

  // at this point, we know it is a Web Component we are building
  arr = determineResetPreset()
  const imports = [...arr, 'import { defineCustomElement } from \'vue\'']
  const declarations = []
  const definitions = []

  for (const component of components) {
    if (Array.isArray(component)) {
      imports.push(`import ${component[1]} from '../../../../components/${component[0]}.vue'`)
      declarations.push(`const ${component[1]}CustomElement = defineCustomElement(${component[1]})`)
      definitions.push(`customElements.define('${kebabCase(component[1])}', ${component[1]}CustomElement)`)
    }
    else {
      imports.push(`import ${component} from '../../../../components/${component}.vue'`)
      declarations.push(`const ${component}CustomElement = defineCustomElement(${component})`)
      definitions.push(`customElements.define('${kebabCase(component)}', ${component}CustomElement)`)
    }
  }

  // join the array into a string with each element being on a new line
  return [...imports, ...declarations, ...definitions].join('\r\n')
}

/**
 * @url https://www.npmjs.com/package/@unocss/reset
 * @param preset
 */
export function determineResetPreset(preset?: string) {
  if (reset)
    preset = reset

  if (preset === 'tailwind')
    return ['import \'@unocss/reset/tailwind.css\'']
  else if (preset === 'normalize')
    return ['import \'@unocss/reset/normalize.css\'']
  else if (preset === 'sanitize')
    return ['import \'@unocss/reset/sanitize/sanitize.css\'', 'import \'@unocss/reset/sanitize/assets.css']
  else if (preset === 'eric-meyer')
    return ['import \'@unocss/reset/eric-meyer.css\'']
  else if (preset === 'antfu')
    return ['import \'@unocss/reset/antfu.css\'']
  else return []
}

export const enum NpmScript {
  Build = 'build',
  BuildComponents = 'build:components',
  BuildWebComponents = 'build:web-components',
  BuildFunctions = 'build:functions',
  BuildDocs = 'build:docs',
  BuildStacks = 'build:stacks',
  Dev = 'dev',
  DevComponents = 'dev:components',
  DevDocs = 'dev:docs',
  Fresh = 'fresh',
  Update = 'update',
  Lint = 'lint',
  LintFix = 'lint:fix',
  MakeStack = 'make:stack',
  Test = 'test',
  TestTypes = 'test:types',
  TestCoverage = 'test:coverage',
  GenerateTypes = 'generate:types',
  generateEntries = 'generate:entries',
  generateVueCompat = 'generate:vue-compatibility',
  Release = 'release',
  Commit = 'commit',
  ExampleVue = 'example:vue',
  ExampleWebComponents = 'example:web-components',
  KeyGenerate = 'key:generate',
}

/**
 * Determine whether a folder has any files in it.
 */
export function hasFiles(folder: string): boolean {
  return readdirSync(folder).length > 0
}

/**
 * Describes a JSON file.
 */
interface JsonFile {
  path: string
  data: unknown
  indent: string
  newline: string | undefined
}

/**
 * Reads a JSON file and returns the parsed data.
 */
export async function readJsonFile(name: string, cwd: string): Promise<JsonFile> {
  const file = await readTextFile(name, cwd)
  const data = JSON.parse(file.data) as unknown
  const indent = detectIndent(file.data).indent
  const newline = detectNewline(file.data)

  return { ...file, data, indent, newline }
}

/**
 * The npm package manifest (package.json)
 */
export interface Manifest {
  name: string
  version: string
  description: string
  [key: string]: unknown
}

/**
 * Determines whether the specified value is a package manifest.
 */
export function isManifest(obj: any): obj is Manifest {
  return obj
    && typeof obj === 'object'
    && isOptionalString(obj.name)
    && isOptionalString(obj.version)
    && isOptionalString(obj.description)
}

/**
 * Determines whether the specified value is a string, null, or undefined.
 */
function isOptionalString(value: any): value is string | undefined {
  const type = typeof value
  return value === null
    || type === 'undefined'
    || type === 'string'
}

export const copyFiles = async (src: string, dest: string) => {
  if (!existsSync(src))
    return

  if (statSync(src).isDirectory()) {
    if (!existsSync(dest))
      mkdirSync(dest, { recursive: true })

    const pathsToExclude = ['node_modules', 'functions/package.json', 'components/package.json', 'web-components/package.json', 'auto-imports.d.ts', 'components.d.ts']

    readdirSync(src).forEach((file) => {
      if (contains(file, pathsToExclude)) // no need to copy node_modules & package.json
        copyFiles(join(src, file), join(dest, file))
    })

    return
  }

  copyFileSync(src, dest)
}

export const deleteFolder = async (path: string) => {
  await rmSync(path, { recursive: true, force: true })
}

/**
 * Determine whether a path is a folder.
 */
export function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  }
  catch {
    return false
  }
}
