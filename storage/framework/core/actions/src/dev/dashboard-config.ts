import { createHash, randomUUID } from 'node:crypto'
import { chmodSync, lstatSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parse } from '@babel/parser'

type Statement = ReturnType<typeof parse>['program']['body'][number]
type Declaration = Extract<Statement, { type: 'VariableDeclaration' }>
type Expression = NonNullable<Declaration['declarations'][number]['init']>
type Scalar = string | number | boolean | null

interface ConfigField {
  key: string
  value: Scalar
  type: 'string' | 'number' | 'boolean' | 'null'
  path: Array<string | number>
  description?: string
}

interface ConfigEdit extends ConfigField {
  start: number
  end: number
}

interface ConfigUpdate {
  key: string
  value: Scalar
}

class ConfigError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function isConfigSegment(segment: string): boolean {
  return Boolean(segment) && !segment.startsWith('.') && !/[\u0000-\u001f\u007f:/\\]/.test(segment)
}

function fileTitle(name: string): string {
  const acronyms = new Set(['ai', 'cli', 'cms', 'cors', 'css', 'dns', 'qb', 'ui'])
  return name.split(/[-_.]/).map(part => acronyms.has(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

export function listConfigFiles(directory: string) {
  if (!lstatSync(directory, { throwIfNoEntry: false })?.isDirectory())
    return []

  function list(parent: string, prefix: string): Array<{ name: string, title: string }> {
    return readdirSync(parent, { withFileTypes: true }).flatMap((entry) => {
      if (!isConfigSegment(entry.name))
        return []
      if (entry.isDirectory())
        return list(join(parent, entry.name), `${prefix}${entry.name}/`)
      if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts'))
        return []
      const stem = entry.name.slice(0, -3)
      return [{ name: prefix + stem, title: fileTitle(stem) }]
    })
  }

  return list(directory, '').sort((a, b) => a.name.localeCompare(b.name))
}

function locateConfig(directory: string, name: string): string {
  const segments = name.split('/')
  if (!segments.every(isConfigSegment) || name.endsWith('.d'))
    throw new ConfigError('Invalid configuration file.', 400)

  let path = directory
  if (!lstatSync(path, { throwIfNoEntry: false })?.isDirectory())
    throw new ConfigError('Configuration file not found.', 404)
  const filename = `${segments.pop()}.ts`
  for (const segment of segments) {
    path = join(path, segment)
    if (!lstatSync(path, { throwIfNoEntry: false })?.isDirectory())
      throw new ConfigError('Configuration file not found.', 404)
  }
  path = join(path, filename)
  if (!lstatSync(path, { throwIfNoEntry: false })?.isFile())
    throw new ConfigError('Configuration file not found.', 404)
  return path
}

function statements(source: string): Statement[] {
  try {
    return parse(source, { sourceType: 'unambiguous', plugins: ['typescript', 'decorators-legacy'] }).program.body
  }
  catch (error) {
    const position = (error as { loc?: { line: number, column: number } }).loc
    const location = position ? ` at line ${position.line}, column ${position.column + 1}` : ''
    throw new ConfigError(`Invalid TypeScript${location}. Check the source and try again.`, 422)
  }
}

function fieldDescription(node: Pick<Expression, 'leadingComments' | 'loc'>): string | undefined {
  const comment = node.leadingComments?.at(-1)
  if (!comment?.loc || !node.loc || node.loc.start.line - comment.loc.end.line !== 1
    || comment.loc.start.column !== node.loc.start.column)
    return
  const paragraph = comment.value.split(/\r?\n/)
    .map(line => line.trim().replace(/^\*+\s*/, ''))
    .join('\n').trim().split(/\n(?:\s*\n|@)/, 1)[0]?.replace(/\s+/g, ' ')
  if (paragraph && paragraph.length <= 240 && !/^[@`#]/.test(paragraph))
    return paragraph
}

function configFieldKey(path: Array<string | number>): string {
  return path.reduce<string>((key, part) => {
    if (typeof part === 'number')
      return `${key}[${part}]`
    if (/^[A-Za-z_$][\w$]*$/.test(part))
      return key ? `${key}.${part}` : part
    return `${key}[${JSON.stringify(part)}]`
  }, '') || 'default'
}

function configEdits(source: string): ConfigEdit[] {
  const body = statements(source)
  const bindings = new Map<string, Expression>()
  for (const statement of body) {
    const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement
    if (declaration?.type !== 'VariableDeclaration')
      continue
    for (const { id, init } of declaration.declarations) {
      if (id.type === 'Identifier' && init)
        bindings.set(id.name, init)
    }
  }

  const edits: ConfigEdit[] = []
  const ranges = new Set<number>()
  function walk(node: Expression, path: Array<string | number>, description?: string, root = false): void {
    if (node.type === 'TSSatisfiesExpression' || node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion' || node.type === 'TSNonNullExpression') {
      walk(node.expression, path, description, root)
      return
    }

    if (node.type === 'ObjectExpression') {
      const seen = new Set<string>()
      for (let index = node.properties.length - 1; index >= 0; index--) {
        const property = node.properties[index]
        if (!property || property.type === 'SpreadElement')
          break
        const member = property.key
        const name = member.type === 'StringLiteral' || member.type === 'NumericLiteral'
          ? String(member.value)
          : !property.computed && member.type === 'Identifier' ? member.name : undefined
        if (name === undefined)
          break
        if (seen.has(name))
          continue
        seen.add(name)
        if (property.type !== 'ObjectProperty' || property.shorthand || name === '__proto__')
          continue
        walk(property.value as Expression, [...path, name], fieldDescription(property))
      }
      return
    }

    if (node.type === 'ArrayExpression') {
      node.elements.forEach((element, index) => {
        if (element && element.type !== 'SpreadElement')
          walk(element, [...path, index], fieldDescription(element))
      })
      return
    }

    if (node.type === 'Identifier' && root) {
      const bound = bindings.get(node.name)
      if (bound)
        walk(bound, path, description)
      return
    }

    let value: Scalar
    if (node.type === 'StringLiteral' || node.type === 'BooleanLiteral' || node.type === 'NumericLiteral')
      value = node.value
    else if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'NumericLiteral')
      value = -node.argument.value
    else if (node.type === 'NullLiteral')
      value = null
    else
      return
    if (node.start == null || node.end == null || ranges.has(node.start) || (typeof value === 'number' && !Number.isFinite(value)))
      return
    ranges.add(node.start)
    edits.push({ key: configFieldKey(path), value, type: value === null ? 'null' : typeof value as ConfigField['type'], path, description, start: node.start, end: node.end })
  }

  for (const statement of body) {
    if (statement.type === 'ExportDefaultDeclaration')
      walk(statement.declaration as Expression, [], undefined, true)
  }
  for (const statement of body) {
    if (statement.type !== 'ExportNamedDeclaration' || statement.source)
      continue
    if (statement.declaration?.type === 'VariableDeclaration') {
      for (const { id, init } of statement.declaration.declarations) {
        if (id.type === 'Identifier' && init)
          walk(init, [id.name], fieldDescription(statement))
      }
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type !== 'ExportSpecifier')
        continue
      const localName = specifier.local.type === 'Identifier' ? specifier.local.name : specifier.local.value
      const bound = bindings.get(localName)
      const name = specifier.exported.type === 'Identifier' ? specifier.exported.name : specifier.exported.value
      if (bound)
        walk(bound, name === 'default' ? [] : [name])
    }
  }

  // A later duplicate key wins in JavaScript. Ambiguous paths are left to the
  // source editor so a form edit can never silently change the wrong value.
  const counts = new Map<string, number>()
  for (const { key } of edits)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  return edits.filter(({ key }) => counts.get(key) === 1).sort((a, b) => a.start - b.start)
}

function scalarSource(value: Scalar, original: string): string {
  if (typeof value !== 'string')
    return Object.is(value, -0) ? '-0' : JSON.stringify(value)
  const json = JSON.stringify(value)
  return original.startsWith("'") ? `'${json.slice(1, -1).replaceAll('\\"', '"').replaceAll("'", "\\'")}'` : json
}

export function rewriteConfigFields(source: string, updates: ConfigUpdate[]): string {
  const fields = new Map(configEdits(source).map(field => [field.key, field]))
  const replacements = updates.map(({ key, value }) => {
    const field = fields.get(key)
    if (!field || field.type !== (value === null ? 'null' : typeof value) || field.type === 'null' || (typeof value === 'number' && !Number.isFinite(value)))
      throw new ConfigError(`Cannot edit "${key}" as a form value.`, 422)
    fields.delete(key)
    return { ...field, text: scalarSource(value, source.slice(field.start, field.end)) }
  })
  return replacements.sort((a, b) => b.start - a.start).reduce(
    (text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end),
    source,
  )
}

function revision(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

function document(source: string, allowInvalid = false) {
  let fields: ConfigField[] = []
  let diagnostic: string | undefined
  try {
    fields = configEdits(source).map(({ key, value, type, path, description }) => ({ key, value, type, path, description }))
  }
  catch (error) {
    if (!allowInvalid || !(error instanceof ConfigError))
      throw error
    diagnostic = error.message
  }
  return { source, revision: revision(source), fields, diagnostic }
}

function atomicWrite(path: string, source: string): void {
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
  try {
    const mode = lstatSync(path).mode & 0o777
    writeFileSync(temporary, source, { encoding: 'utf8', mode, flag: 'wx' })
    chmodSync(temporary, mode)
    renameSync(temporary, path)
  }
  finally {
    rmSync(temporary, { force: true })
  }
}

function isUpdate(value: unknown): value is ConfigUpdate {
  if (!value || typeof value !== 'object' || !('key' in value) || !('value' in value))
    return false
  return typeof value.key === 'string' && (
    typeof value.value === 'string' || typeof value.value === 'boolean' || (typeof value.value === 'number' && Number.isFinite(value.value))
  )
}

interface ConfigRoutesOptions {
  directory: string
  hosts: () => readonly string[]
  validateWrite: (request: Request) => Promise<void>
}

export function dashboardConfigRoutes({ directory, hosts, validateWrite }: ConfigRoutesOptions): Record<string, (request: Request) => Promise<Response>> {
  function route(method: 'GET' | 'POST', handle: (request: Request) => unknown | Promise<unknown>) {
    return async (request: Request) => {
      const reply = (body: unknown, status = 200) => Response.json(body, {
        status,
        headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
      })
      if (request.method !== method)
        return reply({ message: 'Method not allowed.' }, 405)

      const host = request.headers.get('host') ?? new URL(request.url).host
      const site = request.headers.get('sec-fetch-site')
      if (!hosts().includes(host) || request.headers.get('x-stacks-config') !== '1' || (site && site !== 'same-origin'))
        return reply({ message: 'Open Project Configuration from this dashboard.' }, 403)

      try {
        return reply(await handle(request))
      }
      catch (error) {
        if (error instanceof ConfigError)
          return reply({ message: error.message }, error.status)
        if ((error as { status?: number }).status === 403)
          return reply({ message: 'Refresh Settings before trying again.' }, 403)
        return reply({ message: 'The configuration file could not be accessed.' }, 500)
      }
    }
  }

  return {
    '/api/config/list': route('GET', () => ({ files: listConfigFiles(directory) })),
    '/api/config/read': route('GET', (request) => {
      const name = new URL(request.url).searchParams.get('name') ?? ''
      return document(readFileSync(locateConfig(directory, name), 'utf8'), true)
    }),
    '/api/config/update': route('POST', async (request) => {
      await validateWrite(request)
      const body = await request.json().catch(() => null)
      if (typeof body?.file !== 'string' || typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision))
        throw new ConfigError('A configuration file and its revision are required.', 400)
      const sourceEdit = typeof body.source === 'string' && body.updates === undefined
      const fieldEdit = body.source === undefined && Array.isArray(body.updates) && body.updates.length > 0 && body.updates.every(isUpdate)
      if (!sourceEdit && !fieldEdit)
        throw new ConfigError('Supply either TypeScript source or changed form values.', 400)
      const path = locateConfig(directory, body.file)
      // No await between the revision check and rename. Concurrent dashboard
      // requests cannot both save against the same revision.
      const current = readFileSync(path, 'utf8')
      if (revision(current) !== body.revision)
        throw new ConfigError('The file changed on disk. Reopen it to load the latest version before saving.', 409)
      const next = typeof body.source === 'string' ? body.source : rewriteConfigFields(current, body.updates)
      const result = document(next)
      if (next !== current)
        atomicWrite(path, next)
      return result
    }),
  }
}
