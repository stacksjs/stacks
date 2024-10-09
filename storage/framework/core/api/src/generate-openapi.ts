import { path } from '@stacksjs/path'
import { route } from '@stacksjs/router'

export async function generateOpenApi(): Promise<void> {
  const routeLists: any[] = await route.getRoutes()

  const openAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'Generated API',
      version: '1.0.0',
    },
    paths: {} as Record<string, any>,
    components: {
      schemas: {} as Record<string, any>,
    },
  }
  routeLists.forEach((route) => {
    const path = route.url.replace(/\{([^}]+)\}/g, '{$1}')
    if (!openAPISpec.paths[path]) {
      openAPISpec.paths[path] = {}
    }
    openAPISpec.paths[path][route.method.toLowerCase()] = {
      summary: route.name,
      operationId: route.callback,
      parameters: route.paramNames.map((param: string) => ({
        name: param,
        in: 'path',
        required: true,
        schema: {
          type: 'string',
        },
      })),
      responses: {
        [route.statusCode]: {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
      },
    }
    // Add schemas to components if they are not already defined
    if (route.responseSchema) {
      const schemaName = `${route.name.replace(/\./g, '')}Response`
      openAPISpec.components.schemas[schemaName] = route.responseSchema
      openAPISpec.paths[path][route.method.toLowerCase()].responses[route.statusCode].content[
        'application/json'
      ].schema = {
        $ref: `#/components/schemas/${schemaName}`,
      }
    }
    if (route.requestSchema) {
      const schemaName = `${route.name.replace(/\./g, '')}Request`
      openAPISpec.components.schemas[schemaName] = route.requestSchema
      openAPISpec.paths[path][route.method.toLowerCase()].requestBody.content['application/json'].schema = {
        $ref: `#/components/schemas/${schemaName}`,
      }
    }
  })

  const file = Bun.file(path.frameworkPath(`api/openapi.json`))
  const writer = file.writer()

  writer.write(JSON.stringify(openAPISpec))

  await writer.end()
}
