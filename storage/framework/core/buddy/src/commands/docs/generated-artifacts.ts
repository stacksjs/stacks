import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertFrameworkRepo } from './framework-repo'
// Type-only: erased at compile time, so it costs nothing at runtime.
import type { OpenApiDocument } from '../../../../api/src/generate-types'

/**
 * The generators live in a sibling package, reached by a relative path that
 * only exists inside a framework checkout. That is fine for a command which
 * refuses to run anywhere else (see `assertFrameworkRepo` below) — but as
 * static imports they were resolved when the MODULE loaded, not when the
 * command ran, and this module is reachable from the package root.
 *
 * So importing `@stacksjs/buddy` from an installed copy threw
 * `Cannot find module '../../../../api/src/generate-client'` before any guard
 * could explain itself. Resolving them on use puts the failure back where the
 * guard already handles it: an application gets the message about running from
 * a framework checkout, and a framework checkout gets the generators.
 */
async function generators(): Promise<{
  renderApiClient: typeof import('../../../../api/src/generate-client').renderApiClient
  generateOpenApi: typeof import('../../../../api/src/generate-openapi').generateOpenApi
  renderOpenApiTypes: typeof import('../../../../api/src/generate-types').renderOpenApiTypes
}> {
  const [client, openapi, types] = await Promise.all([
    import('../../../../api/src/generate-client'),
    import('../../../../api/src/generate-openapi'),
    import('../../../../api/src/generate-types'),
  ])
  return {
    renderApiClient: client.renderApiClient,
    generateOpenApi: openapi.generateOpenApi,
    renderOpenApiTypes: types.renderOpenApiTypes,
  }
}

const root = resolve(import.meta.dir, '../../../../../../..')
const openApiPath = resolve(root, 'storage/framework/api/openapi.json')
const apiTypesPath = resolve(root, 'storage/framework/api/api-types.ts')
const clientPath = resolve(root, 'storage/framework/api/client.ts')

export function validateOpenApi(document: OpenApiDocument): string[] {
  const errors: string[] = []
  const paths = Object.entries(document.paths || {})
  if (paths.length < 10) errors.push('OpenAPI document has fewer than 10 registered paths')
  const operationIds = new Set<string>()
  for (const [route, item] of paths) {
    for (const [method, operation] of Object.entries(item)) {
      if (!operation.operationId) errors.push(`${method.toUpperCase()} ${route}: operationId is missing`)
      else if (operationIds.has(operation.operationId)) errors.push(`${method.toUpperCase()} ${route}: duplicate operationId ${operation.operationId}`)
      else operationIds.add(operation.operationId)
      for (const parameter of operation.parameters || []) {
        if (parameter.in === 'path' && !parameter.required) errors.push(`${method.toUpperCase()} ${route}: path parameter ${parameter.name} must be required`)
      }
    }
  }
  return errors
}

async function expectedArtifacts(): Promise<{ openApi: string, apiTypes: string, client: string }> {
  const { renderApiClient, generateOpenApi, renderOpenApiTypes } = await generators()
  const document = await generateOpenApi({ write: false })
  const errors = validateOpenApi(document)
  if (errors.length) throw new Error(errors.join('\n'))
  return {
    openApi: JSON.stringify(document, null, 2),
    apiTypes: renderOpenApiTypes(document),
    // Checked for staleness alongside the other two. A generated client that
    // nothing verifies is a hand-maintained client with extra steps: it stops
    // matching the document the first time somebody regenerates only the
    // document, and the mismatch surfaces as a missing method rather than an
    // error.
    client: renderApiClient(document, { name: (document as { info?: { title?: string } }).info?.title }),
  }
}

async function write(): Promise<void> {
  const expected = await expectedArtifacts()
  writeFileSync(openApiPath, expected.openApi)
  writeFileSync(apiTypesPath, expected.apiTypes)
  writeFileSync(clientPath, expected.client)
  console.log('Generated OpenAPI, API type and client artifacts')
}

async function check(): Promise<void> {
  const expected = await expectedArtifacts()
  const errors: string[] = []
  if (readFileSync(openApiPath, 'utf8') !== expected.openApi) errors.push('storage/framework/api/openapi.json is stale')
  if (readFileSync(apiTypesPath, 'utf8') !== expected.apiTypes) errors.push('storage/framework/api/api-types.ts is stale')
  if (readFileSync(clientPath, 'utf8') !== expected.client) errors.push('storage/framework/api/client.ts is stale')
  if (errors.length) throw new Error(`${errors.join('\n')}\nRun bun run docs:artifacts and review the generated diff.`)
  console.log(`Generated API artifacts are current (${Object.keys(JSON.parse(expected.openApi).paths).length} paths)`)
}

export async function run(): Promise<void> {
  // This tool writes into the framework repository. See framework-repo.ts:
  // run from an application it would edit another project's files.
  assertFrameworkRepo(root, 'docs:artifacts')

  try {
    if (process.argv.includes('--write')) await write()
    else if (process.argv.includes('--check')) await check()
    else {
      console.error('usage: bun storage/framework/core/buddy/src/commands/docs/generated-artifacts.ts --write | --check')
      process.exit(2)
    }
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

if (import.meta.main)
  await run()
