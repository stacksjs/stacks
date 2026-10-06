/**
 * Generates the OpenAPI document for whatever project the working directory
 * is, without writing it, and prints its model schemas and paths. Used by
 * `openapi-model-selection.test.ts`, which runs it against a throwaway project.
 */
import process from 'node:process'
import { generateOpenApi } from '../../src/generate-openapi'

const spec = await generateOpenApi({ write: false, portable: false })

console.log(JSON.stringify({
  schemas: Object.keys(spec.components.schemas).sort(),
  paths: Object.keys(spec.paths).filter(path => path.startsWith('/api/')).sort(),
}))
process.exit(0)
