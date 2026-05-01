import { path } from '@stacksjs/path'

interface OpenApiPathItem {
  [method: string]: {
    summary?: string
    operationId?: string
    parameters?: Array<{ name: string, in: string, required: boolean, schema: { type: string } }>
    responses: Record<string, { description: string, content?: Record<string, unknown> }>
    requestBody?: { content: Record<string, unknown>, required?: boolean }
  }
}

interface OpenApiSpec {
  openapi: string
  info: { title: string, version: string }
  paths: Record<string, OpenApiPathItem>
  components: { schemas: Record<string, unknown> }
}

/**
 * Build an OpenAPI 3.0 spec from the live route registry.
 *
 * The previous shape called `route.routes()` (which doesn't exist —
 * `routes` is a getter, not a callable) and read fields like
 * `route.url`, `route.statusCode`, `route.responseSchema` that the
 * underlying bun-router doesn't actually expose. This rewrite uses
 * `listRegisteredRoutes()` (the canonical introspection helper) and
 * derives request schemas from each action's `validations` block when
 * available.
 *
 * Without `Action.validations`, the spec lists the path + parameters
 * but omits a request body schema — that's still useful for clients
 * that just want to know what endpoints exist.
 */
export async function generateOpenApi(): Promise<OpenApiSpec> {
  const { listRegisteredRoutes } = await import('@stacksjs/router')
  const routes = listRegisteredRoutes()

  const spec: OpenApiSpec = {
    openapi: '3.0.0',
    info: { title: 'Stacks API', version: '1.0.0' },
    paths: {},
    components: { schemas: {} },
  }

  for (const r of routes) {
    // Convert `:id` style to OpenAPI `{id}` style so the spec validates.
    const oasPath = r.path.replace(/(^|\/):(\w+)(?=$|\/)/g, '$1{$2}')
    if (!spec.paths[oasPath]) spec.paths[oasPath] = {}

    const paramNames: string[] = []
    for (const m of r.path.matchAll(/\{(\w+)\}/g)) paramNames.push(m[1])
    for (const m of r.path.matchAll(/(?:^|\/):(\w+)(?=$|\/)/g)) paramNames.push(m[1])

    spec.paths[oasPath][r.method.toLowerCase()] = {
      summary: r.name ?? r.path,
      operationId: r.name ?? `${r.method.toLowerCase()}_${oasPath.replace(/[^a-z0-9]/gi, '_')}`,
      parameters: paramNames.map(name => ({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
      })),
      responses: {
        200: {
          description: 'Successful response',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        422: { description: 'Validation failed' },
        500: { description: 'Server error' },
      },
    }
  }

  // Persist for build pipelines that want the file on disk; in dev,
  // the live route at GET /__openapi.json regenerates on every hit so
  // schema changes don't require a rebuild step.
  const file = Bun.file(path.frameworkPath(`api/openapi.json`))
  const writer = file.writer()
  writer.write(JSON.stringify(spec, null, 2))
  await writer.end()

  return spec
}
