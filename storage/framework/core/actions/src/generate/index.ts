import type { GeneratorOptions } from '@stacksjs/types'
import process from 'node:process'
import { generateOpenApi } from '@stacksjs/api'
import { runCommand } from '@stacksjs/cli'
import { Action, NpmScript } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { generateModelFiles } from '@stacksjs/orm'
import { frameworkPath, projectPath } from '@stacksjs/path'
import { runNpmScript } from '@stacksjs/utils'
import { runAction } from '../helpers'
import { generateVsCodeCustomData as genVsCodeCustomData } from '../helpers/vscode-custom-data'

// import { files } from '@stacksjs/storage'

export async function invoke(options?: GeneratorOptions): Promise<void> {
  if (options?.types)
    await generateTypes(options)
  else if (options?.entries)
    await generateLibEntries(options)
  else if (options?.webTypes)
    await generateWebTypes(options)
  else if (options?.customData)
    await generateVsCodeCustomData()
  else if (options?.ideHelpers)
    await generateIdeHelpers(options)
  else if (options?.componentMeta)
    await generateComponentMeta()
  else if (options?.coreSymlink)
    await generateCoreSymlink()
  else if (options?.modelFiles)
    await generateModelFiles()
  else if (options?.openApiSpec)
    await generateOpenApiSpec()
}

export function generate(options: GeneratorOptions): Promise<void> {
  return invoke(options)
}

export async function generateLibEntries(options: GeneratorOptions): Promise<void> {
  const result = await runAction(Action.GenerateLibraryEntries, {
    ...options,
    cwd: projectPath(),
  })

  if (result.isErr()) {
    log.error('There was an error generating your library entry points', result.error)
    process.exit()
  }

  log.success('Library entry points generated successfully')
}

export async function generateWebTypes(options?: GeneratorOptions): Promise<void> {
  const result = await runNpmScript(NpmScript.GenerateWebTypes, options)

  if (result.isErr()) {
    log.error('There was an error generating the web-types.json file.', result.error)
    process.exit()
  }

  log.success('Successfully generated the web-types.json file')
}

export async function generateVsCodeCustomData(): Promise<void> {
  const result = await genVsCodeCustomData()

  if (result.isErr()) {
    log.error('There was an error generating the custom-elements.json file.', result.error)
    process.exit()
  }

  await runAction(Action.LintFix, { verbose: true, cwd: projectPath() }) // because the generated json file needs to be linted

  log.success('Successfully generated the custom-elements.json file')
}

export async function generateIdeHelpers(options?: GeneratorOptions): Promise<void> {
  const result = await runNpmScript(NpmScript.GenerateIdeHelpers, options)

  if (result.isErr()) {
    log.error('There was an error generating IDE helpers.', result.error)
    process.exit()
  }

  await runAction(Action.LintFix, { verbose: true, cwd: projectPath() }) // because the generated json file needs to be linted
  log.success('Successfully generated IDE helpers')
}

export async function generateComponentMeta(): Promise<void> {
  const result = await genVsCodeCustomData()

  if (result.isErr()) {
    log.error('There was an error generating your component meta information.', result.error)
    process.exit()
  }

  await runAction(Action.LintFix, { verbose: true, cwd: projectPath() }) // because the generated json file needs to be linted
  log.success('Successfully generated component meta information')
}

export async function generateTypes(options?: GeneratorOptions): Promise<void> {
  const result = await runNpmScript(NpmScript.GenerateTypes, {
    cwd: frameworkPath(),
    ...options,
  })

  if (result.isErr()) {
    log.error('There was an error generating your types.', result.error)
    process.exit()
  }

  log.success('Types were generated successfully')
}

export function generatePkgxConfig(): void {
  // write the yaml string to a file in your project root
  // files.put(projectPath('./pkgx.yaml'), yamlStr)

  log.success('Successfully generated `./pkgx.yaml` based on your config')
}

export async function generateSeeder(): Promise<void> {
  // await seed()
}

export async function generateCoreSymlink(): Promise<void> {
  await runCommand(`ln -s ${frameworkPath()} ${projectPath('.stacks')}`)
}

export async function generateOpenApiSpec(): Promise<void> {
  await generateOpenApi()

  log.success('Successfully generated Open API Spec')
}
