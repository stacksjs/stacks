import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateOpenApi } from '../../../storage/framework/core/api/src/generate-openapi'
import { type OpenApiDocument, renderOpenApiTypes } from '../../../storage/framework/core/api/src/generate-types'

const root = resolve(import.meta.dir, '../../..')
const openApiPath = resolve(root, 'storage/framework/api/openapi.json')
const apiTypesPath = resolve(root, 'storage/framework/api/api-types.ts')

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

async function expectedArtifacts(): Promise<{ openApi: string, apiTypes: string }> {
  const document = await generateOpenApi({ write: false })
  const errors = validateOpenApi(document)
  if (errors.length) throw new Error(errors.join('\n'))
  return {
    openApi: JSON.stringify(document, null, 2),
    apiTypes: renderOpenApiTypes(document),
  }
}

async function write(): Promise<void> {
  const expected = await expectedArtifacts()
  writeFileSync(openApiPath, expected.openApi)
  writeFileSync(apiTypesPath, expected.apiTypes)
  console.log('Generated OpenAPI and API type artifacts')
}

async function check(): Promise<void> {
  const expected = await expectedArtifacts()
  const errors: string[] = []
  if (readFileSync(openApiPath, 'utf8') !== expected.openApi) errors.push('storage/framework/api/openapi.json is stale')
  if (readFileSync(apiTypesPath, 'utf8') !== expected.apiTypes) errors.push('storage/framework/api/api-types.ts is stale')
  if (errors.length) throw new Error(`${errors.join('\n')}\nRun bun run docs:artifacts and review the generated diff.`)
  console.log(`Generated API artifacts are current (${Object.keys(JSON.parse(expected.openApi).paths).length} paths)`)
}

export async function run(): Promise<void> {
  try {
    if (process.argv.includes('--write')) await write()
    else if (process.argv.includes('--check')) await check()
    else {
      console.error('usage: bun app/Commands/docs/generated-artifacts.ts --write | --check')
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
