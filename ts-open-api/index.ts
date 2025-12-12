// ts-open-api stub - OpenAPI utilities
export interface OpenAPISpec {
  openapi: string
  info: { title: string; version: string }
  paths: Record<string, unknown>
}
export function generate(): OpenAPISpec {
  return { openapi: '3.0.0', info: { title: 'API', version: '1.0.0' }, paths: {} }
}
export default { generate }
