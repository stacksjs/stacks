import process from 'node:process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { bold, cyan, dim, green } from '@stacksjs/cli'
import { projectPath, storagePath } from '@stacksjs/path'
import { buildDashboardUrl, buildManifest, buildSidebarConfig, discoverModels, findAvailablePort, waitForServer } from './dashboard-utils'

// buddyOptions serializes `verbose: false` as `--verbose false`, so
// process.argv.includes('--verbose') would always match. Check the value too.
const verboseIdx = process.argv.indexOf('--verbose')
const verbose = verboseIdx !== -1 && process.argv[verboseIdx + 1] !== 'false'
const startTime = Bun.nanoseconds()

// Buffer all dependency console output (STX serve, Crosswind, bun-router)
// so we can display it cleanly after our banner (verbose) or discard it (normal).
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn
const bufferedLogs: string[] = []

console.log = (...args: unknown[]) => {
  bufferedLogs.push(args.map(String).join(' '))
}
console.warn = (...args: unknown[]) => {
  bufferedLogs.push(args.map(String).join(' '))
}

// Dashboard pages live directly under views/dashboard/. The earlier `pages/`
// subdir layout was removed in #1838 — see the per-feature dirs (analytics/,
// commerce/, content/, …) plus index.stx for the canonical structure.
const dashboardPath = storagePath('framework/defaults/views/dashboard')
const userDashboardPath = projectPath('resources/views/dashboard')
const preferredPort = Number(process.env.PORT_ADMIN) || 3002
// eslint-disable-next-line ts/no-top-level-await
const dashboardPort = await findAvailablePort(preferredPort)

// Determine if we have a custom domain (like stacks.localhost)
const appUrl = process.env.APP_URL || ''
const hasCustomDomain = appUrl !== '' && appUrl !== 'localhost' && !appUrl.includes('localhost:')
const domain = hasCustomDomain ? appUrl.replace(/^https?:\/\//, '') : null
const dashboardDomain = domain ? `dashboard.${domain}` : null
const sslBasePath = `${process.env.HOME}/.stacks/ssl`

function restoreConsole(): void {
  console.log = originalConsoleLog
  // Filter STX DOM API violation warnings — server-side only, code runs fine in browser
  console.warn = (...args: unknown[]) => {
    const msg = args.map(String).join(' ')
    if (msg.includes('[STX] DOM API violation') || msg.includes('unsafe expression'))
      return
    originalConsoleWarn(...args)
  }
}

function cmsJson(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')

  return new Response(JSON.stringify(data), { ...init, headers })
}

function cmsSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function cmsBody(req: Request): Promise<Record<string, any>> {
  if (req.method === 'GET' || req.method === 'HEAD')
    return {}

  const type = req.headers.get('content-type') || ''
  if (type.includes('application/json'))
    return await req.json().catch(() => ({}))

  if (type.includes('form')) {
    const form = await req.formData()
    return Object.fromEntries(form.entries())
  }

  return {}
}

const cmsTableColumns: Record<string, string[]> = {
  posts: ['title', 'poster', 'content', 'excerpt', 'views', 'published_at', 'status', 'is_featured', 'author_id', 'created_at', 'updated_at'],
  pages: ['title', 'template', 'views', 'published_at', 'conversions', 'author_id', 'created_at', 'updated_at'],
  authors: ['name', 'email', 'user_id', 'created_at', 'updated_at'],
  categories: ['name', 'description', 'slug', 'image_url', 'is_active', 'parent_category_id', 'display_order', 'created_at', 'updated_at'],
  tags: ['name', 'slug', 'description', 'post_count', 'color', 'created_at', 'updated_at'],
  comments: ['title', 'body', 'content', 'status', 'author_name', 'author_email', 'post_title', 'is_approved', 'approved_at', 'rejected_at', 'updated_at'],
}

interface CmsStore {
  all: (table: string, orderBy?: string) => Promise<any[]>
  insert: (table: string, values: Record<string, any>) => Promise<any | undefined>
  update: (table: string, id: number, values: Record<string, any>) => Promise<any | undefined>
  delete: (table: string, id: number) => Promise<void>
  find: (table: string, id: number) => Promise<any | undefined>
  close?: () => void
}

function cmsDatabasePath(): string {
  const configuredPath = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  return configuredPath.startsWith('/') ? configuredPath : projectPath(configuredPath)
}

function cmsQuoteIdentifier(_value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(_value))
    throw new Error(`Invalid CMS database identifier: ${_value}`)

  return `"${_value.replace(/"/g, '""')}"`
}

function cmsValuesForTable(table: string, values: Record<string, any>): Record<string, any> {
  const columns = cmsTableColumns[table]
  if (!columns)
    throw new Error(`Unsupported CMS table: ${table}`)

  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => columns.includes(key) && value !== undefined),
  )
}

async function createSqliteCmsStore(): Promise<CmsStore | undefined> {
  if ((process.env.DB_CONNECTION || 'sqlite') !== 'sqlite' || !existsSync(cmsDatabasePath()))
    return undefined

  const { Database } = await import('bun:sqlite')
  const sqlite = new Database(cmsDatabasePath())

  async function find(table: string, id: number): Promise<any | undefined> {
    return sqlite.query(`select * from ${cmsQuoteIdentifier(table)} where id = ? limit 1`).get(id) as any
  }

  return {
    async all(table, orderBy = 'created_at') {
      return sqlite.query(`select * from ${cmsQuoteIdentifier(table)} order by ${cmsQuoteIdentifier(orderBy)} desc`).all() as any[]
    },
    async insert(table, values) {
      const safeValues = cmsValuesForTable(table, values)
      const columns = Object.keys(safeValues)
      const placeholders = columns.map(() => '?').join(', ')
      const sql = `insert into ${cmsQuoteIdentifier(table)} (${columns.map(cmsQuoteIdentifier).join(', ')}) values (${placeholders})`
      const result = sqlite.query(sql).run(...columns.map(column => safeValues[column])) as { lastInsertRowid?: number | bigint }
      return await find(table, Number(result.lastInsertRowid))
    },
    async update(table, id, values) {
      const safeValues = cmsValuesForTable(table, values)
      const columns = Object.keys(safeValues)
      if (columns.length) {
        const assignments = columns.map(column => `${cmsQuoteIdentifier(column)} = ?`).join(', ')
        sqlite.query(`update ${cmsQuoteIdentifier(table)} set ${assignments} where id = ?`).run(...columns.map(column => safeValues[column]), id)
      }
      return await find(table, id)
    },
    async delete(table, id) {
      sqlite.query(`delete from ${cmsQuoteIdentifier(table)} where id = ?`).run(id)
    },
    find,
    close() {
      sqlite.close()
    },
  }
}

async function createCmsStore(): Promise<CmsStore> {
  const sqliteStore = await createSqliteCmsStore()
  if (sqliteStore)
    return sqliteStore

  const { db } = await import('@stacksjs/database')
  return {
    async all(table, orderBy = 'created_at') {
      let query = db.selectFrom(table).selectAll()
      if (orderBy)
        query = query.orderBy(orderBy, 'desc')
      return await query.execute()
    },
    async insert(table, values) {
      let row = await db.insertInto(table).values(values).returningAll().executeTakeFirst()
      if (!row || row.id == null) {
        const lookup = values.email ? ['email', values.email] : values.name ? ['name', values.name] : ['title', values.title]
        row = await db.selectFrom(table).selectAll().where(lookup[0], '=', lookup[1]).orderBy('id', 'desc').executeTakeFirst()
      }
      return row
    },
    async update(table, id, values) {
      await db.updateTable(table).set(values).where('id', '=', id).execute()
      return await db.selectFrom(table).selectAll().where('id', '=', id).executeTakeFirst()
    },
    async delete(table, id) {
      await db.deleteFrom(table).where('id', '=', id).execute()
    },
    async find(table, id) {
      return await db.selectFrom(table).selectAll().where('id', '=', id).executeTakeFirst()
    },
  }
}

async function safeCmsAll(store: CmsStore, table: string, orderBy = 'created_at'): Promise<any[]> {
  try {
    return await store.all(table, orderBy)
  }
  catch {
    return []
  }
}

async function dashboardCmsApi(req: Request): Promise<Response | null> {
  const url = new URL(req.url)
  if (!url.pathname.startsWith('/api/dashboard/cms'))
    return null

  let store: CmsStore | undefined
  try {
    store = await createCmsStore()
    const path = url.pathname.replace(/^\/api\/dashboard\/cms\/?/, '')
    const parts = path.split('/').filter(Boolean)
    const resource = parts[0] || ''
    const id = parts[1] ? Number(parts[1]) : undefined
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

    if (req.method === 'GET' && !resource) {
      const [posts, pages, authors, categories, tags, comments] = await Promise.all([
        safeCmsAll(store, 'posts'),
        safeCmsAll(store, 'pages'),
        safeCmsAll(store, 'authors'),
        safeCmsAll(store, 'categories'),
        safeCmsAll(store, 'tags'),
        safeCmsAll(store, 'comments'),
      ])

      return cmsJson({
        ok: true,
        posts,
        pages,
        authors,
        categories,
        tags,
        comments,
        stats: {
          posts: posts.length,
          publishedPosts: posts.filter((p: any) => p.status === 'published').length,
          draftPosts: posts.filter((p: any) => p.status === 'draft').length,
          pages: pages.length,
          categories: categories.length,
          tags: tags.length,
          comments: comments.length,
        },
      })
    }

    if (resource === 'posts') {
      if (req.method === 'POST') {
        const body = await cmsBody(req)
        const title = String(body.title || '').trim()
        if (!title)
          return cmsJson({ ok: false, error: 'Title is required' }, { status: 422 })

        const post = await store.insert('posts', {
          title,
          poster: String(body.poster || ''),
          content: String(body.content || body.body || ''),
          excerpt: String(body.excerpt || ''),
          views: Number(body.views || 0),
          published_at: body.status === 'published' ? now : (body.published_at || null),
          status: String(body.status || 'draft').toLowerCase(),
          is_featured: body.is_featured ? 1 : 0,
          author_id: body.author_id ? Number(body.author_id) : null,
          created_at: now,
          updated_at: now,
        })

        return cmsJson({ ok: true, post }, { status: 201 })
      }

      if (req.method === 'PATCH' && id) {
        const body = await cmsBody(req)
        const data: Record<string, any> = { updated_at: now }
        for (const key of ['title', 'poster', 'content', 'excerpt', 'status', 'published_at']) {
          if (body[key] !== undefined)
            data[key] = key === 'status' ? String(body[key]).toLowerCase() : body[key]
        }
        if (body.views !== undefined) data.views = Number(body.views)
        if (body.is_featured !== undefined) data.is_featured = body.is_featured ? 1 : 0

        const post = await store.update('posts', id, data)
        if (!post)
          return cmsJson({ ok: false, error: 'Post not found' }, { status: 404 })

        return cmsJson({ ok: true, post })
      }

      if (req.method === 'DELETE' && id) {
        await store.delete('posts', id)
        return cmsJson({ ok: true })
      }
    }

    if (resource === 'tags' || resource === 'categories') {
      const table = resource

      if (req.method === 'POST') {
        const body = await cmsBody(req)
        const name = String(body.name || '').trim()
        if (!name)
          return cmsJson({ ok: false, error: 'Name is required' }, { status: 422 })

        const values: Record<string, any> = {
          name,
          slug: String(body.slug || cmsSlug(name)),
          description: String(body.description || ''),
          created_at: now,
          updated_at: now,
        }
        if (resource === 'categories')
          values.is_active = body.is_active === undefined ? true : Boolean(body.is_active)
        if (resource === 'tags') {
          values.post_count = Number(body.post_count || 0)
          values.color = String(body.color || '')
        }

        const row = await store.insert(table, values)

        return cmsJson({ ok: true, [resource === 'categories' ? 'category' : 'tag']: row }, { status: 201 })
      }

      if (req.method === 'PATCH' && id) {
        const body = await cmsBody(req)
        const data: Record<string, any> = { updated_at: now }
        for (const key of ['name', 'slug', 'description', 'color', 'image_url', 'parent_category_id']) {
          if (body[key] !== undefined)
            data[key] = body[key]
        }
        if (body.post_count !== undefined) data.post_count = Number(body.post_count)
        if (body.display_order !== undefined) data.display_order = Number(body.display_order)
        if (body.is_active !== undefined) data.is_active = body.is_active ? 1 : 0

        const row = await store.update(table, id, data)
        if (!row)
          return cmsJson({ ok: false, error: `${resource === 'categories' ? 'Category' : 'Tag'} not found` }, { status: 404 })

        return cmsJson({ ok: true, [resource === 'categories' ? 'category' : 'tag']: row })
      }

      if (req.method === 'DELETE' && id) {
        await store.delete(table, id)
        return cmsJson({ ok: true })
      }
    }

    if (resource === 'pages') {
      if (req.method === 'POST') {
        const body = await cmsBody(req)
        const title = String(body.title || '').trim()
        if (!title)
          return cmsJson({ ok: false, error: 'Title is required' }, { status: 422 })

        const page = await store.insert('pages', {
          title,
          template: String(body.template || 'default'),
          views: 0,
          conversions: 0,
          published_at: body.status === 'published' ? now : null,
          author_id: body.author_id ? Number(body.author_id) : null,
          created_at: now,
          updated_at: now,
        })

        return cmsJson({ ok: true, page }, { status: 201 })
      }

      if (req.method === 'PATCH' && id) {
        const body = await cmsBody(req)
        const data: Record<string, any> = { updated_at: now }
        for (const key of ['title', 'template', 'published_at']) {
          if (body[key] !== undefined)
            data[key] = body[key]
        }
        if (body.views !== undefined) data.views = Number(body.views)
        if (body.conversions !== undefined) data.conversions = Number(body.conversions)
        if (body.author_id !== undefined) data.author_id = body.author_id ? Number(body.author_id) : null

        const page = await store.update('pages', id, data)
        if (!page)
          return cmsJson({ ok: false, error: 'Page not found' }, { status: 404 })

        return cmsJson({ ok: true, page })
      }

      if (req.method === 'DELETE' && id) {
        await store.delete('pages', id)
        return cmsJson({ ok: true })
      }
    }

    if (resource === 'authors') {
      if (req.method === 'POST') {
        const body = await cmsBody(req)
        const name = String(body.name || '').trim()
        const email = String(body.email || '').trim()
        if (!name || !email)
          return cmsJson({ ok: false, error: 'Name and email are required' }, { status: 422 })

        const author = await store.insert('authors', {
          name,
          email,
          created_at: now,
          updated_at: now,
        })

        return cmsJson({ ok: true, author }, { status: 201 })
      }

      if (req.method === 'PATCH' && id) {
        const body = await cmsBody(req)
        const data: Record<string, any> = { updated_at: now }
        for (const key of ['name', 'email']) {
          if (body[key] !== undefined)
            data[key] = body[key]
        }
        if (body.user_id !== undefined) data.user_id = body.user_id ? Number(body.user_id) : null

        const author = await store.update('authors', id, data)
        if (!author)
          return cmsJson({ ok: false, error: 'Author not found' }, { status: 404 })

        return cmsJson({ ok: true, author })
      }

      if (req.method === 'DELETE' && id) {
        await store.delete('authors', id)
        return cmsJson({ ok: true })
      }
    }

    if (resource === 'comments') {
      if (req.method === 'PATCH' && id) {
        const body = await cmsBody(req)
        const data: Record<string, any> = { updated_at: now }
        if (body.content !== undefined) {
          data.content = body.content
          data.body = body.content
        }
        if (body.body !== undefined) {
          data.content = body.body
          data.body = body.body
        }
        for (const key of ['status', 'author_name', 'author_email', 'post_title']) {
          if (body[key] !== undefined)
            data[key] = body[key]
        }
        if (data.status === 'approved')
          data.is_approved = 1
        if (data.status && data.status !== 'approved')
          data.is_approved = 0
        const comment = await store.update('comments', id, data)
        if (!comment)
          return cmsJson({ ok: false, error: 'Comment not found' }, { status: 404 })

        return cmsJson({ ok: true, comment })
      }

      if (req.method === 'DELETE' && id) {
        await store.delete('comments', id)
        return cmsJson({ ok: true })
      }
    }

    return cmsJson({ ok: false, error: 'CMS endpoint not found' }, { status: 404 })
  }
  catch (error) {
    return cmsJson({ ok: false, error: (error as Error)?.message || String(error) }, { status: 500 })
  } finally {
    store?.close?.()
  }
}

async function startStxServer(): Promise<void> {
  // Preload @stacksjs/orm before the STX server starts. The orm package's
  // top-level evaluation walks every framework default model file, exports
  // each class, and assigns it onto globalThis so dashboard `<script server>`
  // blocks can reference models as bare names (`await Order.all()`) without
  // an explicit import. Loading it here means the first page render no
  // longer pays the cold-start cost of resolving 50+ model files.
  try {
    await import('@stacksjs/orm')
  }
  catch (err) {
    if (verbose) console.warn('[dashboard] orm preload failed:', (err as Error)?.message || err)
  }

  // Preload every helper module under `storage/framework/defaults/resources/functions/`
  // and the user's `resources/functions/` and `app/` trees, then hoist each
  // named export onto globalThis. This lets `<script server>` blocks call
  // `safeAll(Order)`, `formatRelative(date)`, `listPackages()`, etc. without
  // importing — same model-as-globals ergonomics as the orm preload.
  try {
    const { hoistDashboardGlobals } = await import('./dashboard-globals')
    await hoistDashboardGlobals({ verbose })
  }
  catch (err) {
    if (verbose) console.warn('[dashboard] globals preload failed:', (err as Error)?.message || err)
  }

  let serve: typeof import('bun-plugin-stx/serve').serve
  try {
    const mod = await import('bun-plugin-stx/serve')
    serve = mod.serve
  }
  catch {
    const mod = await import(projectPath('pantry/bun-plugin-stx/dist/serve.js'))
    serve = mod.serve
  }

  // Pre-resolve stx from pantry. Bun's bare-specifier resolver finds the
  // stale `node_modules/@stacksjs/stx` first when serve.js does
  // `import('@stacksjs/stx')`, which breaks @extends/layoutsDir. Pass the
  // pantry copy via the `stxModule` option (see ServeOptions) so the
  // dashboard's layout resolution stays consistent with the other dev
  // servers.
  let stxModule: any
  try {
    const vendoredStx = projectPath('pantry/@stacksjs/stx/dist/index.js')
    if (await Bun.file(vendoredStx).exists())
      stxModule = await import(vendoredStx)
  }
  catch { /* fall through */ }

  // Mount the config-editor API routes. The settings UI talks to these
  // to list config files, read their resolved values, and write edits
  // back to disk. They run in the dashboard server's process so they
  // share the same fs cwd and don't need a second port to be open.
  const { listConfigFiles, readConfig, updateConfigKey } = await import(
    storagePath('framework/defaults/resources/functions/dashboard/config-io.ts')
  )
  // Map a runtime bare specifier (used by client-side `await import('@stacksjs/...')`
  // in dashboard pages) to the on-disk dist file we serve. The matching import
  // map is injected by the dashboard layout — see
  // `storage/framework/defaults/views/dashboard/layouts/default.stx`
  // (`<script type="importmap">` near the top). The dashboard's own
  // `stx.config.ts` would be the natural home for this, but `bun-plugin-stx`'s
  // `serve()` autoloads config from `process.cwd()` (the project root), not
  // the layouts dir, so the layout-level injection is what actually reaches
  // the browser.
  const depRoutes: Record<string, string> = {
    '/__deps/charts.js': storagePath('framework/core/charts/dist/index.js'),
  }
  const configRoutes: Record<string, (req: Request) => Response | Promise<Response>> = {
    ...Object.fromEntries(
      Object.entries(depRoutes).map(([url, file]) => [
        url,
        async () => {
          const f = Bun.file(file)
          if (!(await f.exists())) {
            return new Response(
              `// dependency dist missing: ${file}\n// rebuild with: cd ${file.replace(/\/dist\/[^/]+$/, '')} && bun build.ts`,
              { status: 500, headers: { 'content-type': 'text/javascript; charset=utf-8' } },
            )
          }
          return new Response(f, {
            headers: {
              'content-type': 'text/javascript; charset=utf-8',
              'cache-control': 'no-cache',
            },
          })
        },
      ]),
    ),
    '/api/config/list': async () => {
      try {
        return Response.json({ ok: true, files: listConfigFiles() })
      }
      catch (e) {
        return Response.json({ ok: false, error: (e as Error)?.message }, { status: 500 })
      }
    },
    '/api/config/read': async (req: Request) => {
      try {
        const url = new URL(req.url)
        const name = url.searchParams.get('name') || ''
        if (!/^[\w-]+$/.test(name))
          return Response.json({ ok: false, error: 'Invalid config name' }, { status: 400 })
        const result = await readConfig(name)
        if (!result)
          return Response.json({ ok: false, error: 'Not found' }, { status: 404 })
        // Strip the raw source from the response — the UI only needs
        // values + field metadata. Source ships with the read for the
        // monaco viewer (see /api/config/source).
        return Response.json({ ok: true, name, fields: result.fields, values: result.values })
      }
      catch (e) {
        return Response.json({ ok: false, error: (e as Error)?.message }, { status: 500 })
      }
    },
    '/api/config/source': async (req: Request) => {
      try {
        const url = new URL(req.url)
        const name = url.searchParams.get('name') || ''
        if (!/^[\w-]+$/.test(name))
          return Response.json({ ok: false, error: 'Invalid config name' }, { status: 400 })
        const result = await readConfig(name)
        if (!result)
          return Response.json({ ok: false, error: 'Not found' }, { status: 404 })
        return new Response(result.source, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
      }
      catch (e) {
        return Response.json({ ok: false, error: (e as Error)?.message }, { status: 500 })
      }
    },
    '/api/config/update': async (req: Request) => {
      if (req.method !== 'POST')
        return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 })
      try {
        const body = (await req.json()) as { file?: string, key?: string, value?: any, updates?: Array<{ path?: string, key?: string, value?: any }> }
        // Accept two shapes:
        //   1) { file, key, value }                 — single key edit
        //   2) { file, updates: [{ path|key, value }] } — batch (used by services.stx)
        const file = body.file?.replace(/\.ts$/, '')
        if (!file || !/^[\w-]+$/.test(file))
          return Response.json({ ok: false, error: 'Invalid file' }, { status: 400 })

        const updates: Array<{ key: string, value: any }> = []
        if (Array.isArray(body.updates)) {
          for (const u of body.updates) {
            const k = u.key ?? u.path
            if (typeof k === 'string') updates.push({ key: k, value: u.value })
          }
        }
        else if (body.key) {
          updates.push({ key: body.key, value: body.value })
        }
        if (updates.length === 0)
          return Response.json({ ok: false, error: 'No updates supplied' }, { status: 400 })

        const results: Array<{ key: string, ok: boolean, error?: string, newValue?: any }> = []
        for (const u of updates) {
          try {
            const r = await updateConfigKey(file, u.key, coerce(u.value))
            results.push({ key: u.key, ok: true, newValue: r.newValue })
          }
          catch (err) {
            results.push({ key: u.key, ok: false, error: (err as Error)?.message })
          }
        }
        const allOk = results.every(r => r.ok)
        // Always return HTTP 200 so the response is well-formed; the
        // caller checks `body.ok` to know whether anything failed.
        // Returning 207 here triggers a Bun internal RangeError under
        // the bun-router fallback path used by the dashboard server.
        return Response.json({ ok: allOk, file, results })
      }
      catch (e) {
        return Response.json({ ok: false, error: (e as Error)?.message }, { status: 500 })
      }
    },
  }

  // Coerce string-encoded form values back to the shape we want to
  // serialize. The HTML form posts everything as strings, but the writer
  // needs real booleans / numbers so the .ts file gets `true` instead
  // of `'true'`.
  function coerce(v: any): string | number | boolean {
    if (typeof v === 'boolean' || typeof v === 'number') return v
    if (v === 'true') return true
    if (v === 'false') return false
    if (v === '' || v == null) return ''
    if (typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v)) return Number(v)
    return String(v)
  }

  // serve() starts a long-lived server — do NOT await it.
  // It resolves only when the server stops, which is never during dev.
  //
  // `auth: false` disables stx-bun-plugin's bundled auth middleware so
  // pages declaring `definePageMeta({ middleware: ['auth'] })` aren't
  // gated against an `auth-token` cookie that doesn't exist in the
  // local dashboard. The dashboard runs entirely on the developer's
  // machine and is not meant to be authenticated; without this flag
  // every page silently 302'd to /login.
  const serverPromise = serve({
    patterns: [userDashboardPath, dashboardPath],
    port: dashboardPort,
    componentsDir: storagePath('framework/defaults/resources/components/Dashboard'),
    layoutsDir: dashboardPath,
    partialsDir: dashboardPath,
    quiet: true,
    routes: configRoutes,
    onRequest: dashboardCmsApi,
    auth: false,
    ...(stxModule && { stxModule }),
  } as any)

  serverPromise.catch((err: Error) => {
    restoreConsole()
    console.error(`\n  Failed to start dashboard server: ${err?.message || err}\n`)
    process.exit(1)
  })
}

async function startReverseProxy(): Promise<boolean> {
  if (!dashboardDomain) return false

  // When running as part of `buddy dev`, the main dev server handles the
  // reverse proxy for all subdomains. Starting a second proxy here would
  // race for port 443 and break routing for other subdomains (docs, api, etc.).
  if (process.env.STACKS_PROXY_MANAGED) return false

  try {
    const { startProxies } = await import('@stacksjs/rpx')

    await startProxies({
      proxies: [
        { from: `localhost:${dashboardPort}`, to: dashboardDomain, cleanUrls: false },
      ],
      https: {
        basePath: sslBasePath,
        validityDays: 825,
      },
      regenerateUntrustedCerts: false,
      verbose,
    })

    return true
  }
  catch (error) {
    if (verbose) originalConsoleLog(`  ${dim(`Proxy: ${error}`)}`)
    return false
  }
}

// Config API server for dashboard editing
const configApiPort = dashboardPort + 1
function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...extraHeaders,
    },
  })
}

function startConfigApi(): void {
  Bun.serve({
    port: configApiPort,
    fetch: async (req: Request) => {
      if (req.method === 'OPTIONS')
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        })

      const url = new URL(req.url)

      if (url.pathname === '/api/config/update' && req.method === 'POST') {
        try {
          const { file, updates } = await req.json() as {
            file: string
            updates: Array<{ path: string, value: string }>
          }

          if (!file || file.includes('..') || !file.match(/^[\w.-]+\.ts$/))
            return jsonResponse({ error: 'Invalid file name' }, 400)

          const filePath = projectPath(`config/${file}`)
          let content = readFileSync(filePath, 'utf-8')

          for (const { path: keyPath, value } of updates) {
            const lastKey = keyPath.split('.').pop()!
            const escapedKey = lastKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const pattern = new RegExp(
              `(${escapedKey}\\s*:\\s*)(?:'[^']*'|"[^"]*"|\\d+(?:\\.\\d+)?|true|false)`,
            )
            if (pattern.test(content)) {
              const isNum = /^\d+(?:\.\d+)?$/.test(value)
              const isBool = value === 'true' || value === 'false'
              const sanitizedValue = value.replace(/'/g, '\\\'').replace(/\$/g, '$$$$')
              const replacement = isNum || isBool ? value : `'${sanitizedValue}'`
              content = content.replace(pattern, `$1${replacement}`)
            }
          }

          writeFileSync(filePath, content, 'utf-8')
          return jsonResponse({ success: true })
        }
        catch (err: any) {
          return jsonResponse({ error: err.message }, 500)
        }
      }

      return jsonResponse({ error: 'Not found' }, 404)
    },
  })
}

startConfigApi()

// Phase 1: Start STX server and discover models in parallel
// eslint-disable-next-line ts/no-top-level-await
const [, discoveredModels] = await Promise.all([
  startStxServer(),
  discoverModels(projectPath('app/Models'), storagePath('framework/defaults/app/Models')),
])

// Load dashboard section toggles from `config/dashboard.ts` if present.
// Falls back to "everything enabled" when the file is missing or fails to
// parse, so a fresh project (no dashboard config) still gets the full
// sidebar. Shape mirrors `DashboardSectionToggles` in dashboard-utils.ts.
type DataRowToggles = {
  dashboard: boolean
  activity: boolean
  users: boolean
  teams: boolean
  subscribers: boolean
  allModels: boolean
}
async function loadDashboardToggles(): Promise<{
  library: boolean
  content: boolean
  commerce: boolean
  marketing: boolean
  analytics: boolean
  management: boolean
  utilities: boolean
  data: DataRowToggles
}> {
  const fallback = {
    library: true,
    content: true,
    commerce: true,
    marketing: true,
    analytics: true,
    management: true,
    utilities: true,
    data: { dashboard: true, activity: true, users: true, teams: true, subscribers: true, allModels: true } satisfies DataRowToggles,
  }
  try {
    type SectionMap = Record<string, { enabled?: boolean }> & { data?: Record<string, { enabled?: boolean }> }
    const mod = await import(projectPath('config/dashboard.ts')) as { default?: { sections?: SectionMap } }
    const sections = mod.default?.sections ?? {}
    const data = sections.data ?? {}
    return {
      library: sections.library?.enabled ?? true,
      content: sections.content?.enabled ?? true,
      commerce: sections.commerce?.enabled ?? true,
      marketing: sections.marketing?.enabled ?? true,
      analytics: sections.analytics?.enabled ?? true,
      management: sections.management?.enabled ?? true,
      utilities: sections.utilities?.enabled ?? true,
      data: {
        dashboard: data.dashboard?.enabled ?? true,
        activity: data.activity?.enabled ?? true,
        users: data.users?.enabled ?? true,
        teams: data.teams?.enabled ?? true,
        subscribers: data.subscribers?.enabled ?? true,
        allModels: data.allModels?.enabled ?? true,
      },
    }
  }
  catch {
    return fallback
  }
}

// eslint-disable-next-line ts/no-top-level-await
const dashboardToggles = await loadDashboardToggles()

// Write manifest. The envelope format includes the section toggles so the
// web sidebar (which runs in STX server-script context and can't easily do
// async config loading) can read them synchronously alongside the model
// list. Older readers that expect a bare array are handled in the loader.
const manifestPath = storagePath('framework/defaults/views/dashboard/.discovered-models.json')
const manifestPayload = {
  models: buildManifest(discoveredModels),
  sections: dashboardToggles,
}
writeFileSync(manifestPath, JSON.stringify(manifestPayload, null, 2))

// Wait briefly for STX server (it's usually ready by now)
// eslint-disable-next-line ts/no-top-level-await
const serverReady = await waitForServer(dashboardPort)

// Restore console before our output
restoreConsole()

// Start reverse proxy in the background (not needed for Craft window, only for browser access)
let proxyStarted = false
startReverseProxy().then(ok => { proxyStarted = ok }).catch((err) => {
  if (verbose) console.warn('[Dashboard] Reverse proxy failed:', err)
})

const dashboardHttpsUrl = dashboardDomain ? `https://${dashboardDomain}` : null
const dashboardLocalUrl = `http://localhost:${dashboardPort}`

// Use local HTTP URL — Craft webview loads directly, no proxy needed
const baseRoute = dashboardLocalUrl
const sidebarConfig = buildSidebarConfig(baseRoute, discoveredModels, dashboardToggles)
const initialUrl = `http://localhost:${dashboardPort}/?native-sidebar=1`

// Print vite-style output
const elapsedMs = (Bun.nanoseconds() - startTime) / 1_000_000

/* eslint-disable no-console */
console.log()
console.log(`  ${bold(cyan('stacks dashboard'))}`)
console.log()
if (dashboardHttpsUrl) {
  console.log(`  ${green('➜')}  ${bold('Local')}:   ${cyan(dashboardHttpsUrl)}`)
  console.log(`  ${dim('➜')}  ${dim('Origin')}:  ${dim(dashboardLocalUrl)}`)
}
else {
  console.log(`  ${green('➜')}  ${bold('Local')}:   ${cyan(dashboardLocalUrl)}`)
}
console.log(`  ${green('➜')}  ${bold('Window')}:  ${dim('Stacks Dashboard')} ${dim('1400×900')}`)
console.log(`  ${green('➜')}  ${bold('Models')}:  ${dim(`${discoveredModels.length} discovered`)}`)
if (dashboardPort !== preferredPort) {
  console.log(`  ${dim('➜')}  ${dim(`Port ${preferredPort} in use, using ${dashboardPort}`)}`)
}
if (!serverReady) {
  console.log(`  ${dim('⚠')}  ${dim('Dev server may not be ready yet')}`)
}
console.log()
console.log(`  ${dim(`ready in ${elapsedMs.toFixed(0)} ms`)}`)

if (verbose) {
  console.log()
  console.log(`  ${dim('➜')}  ${dim('Sidebar')}:  ${dim(`${sidebarConfig.sections.length} sections, 240px`)}`)
  console.log(`  ${dim('➜')}  ${dim('URL')}:      ${dim(initialUrl)}`)
  if (dashboardDomain) {
    console.log(`  ${dim('➜')}  ${dim('SSL')}:      ${dim(sslBasePath)}`)
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:    ${dim(`localhost:${dashboardPort} → ${dashboardDomain}`)}`)
  }

  if (bufferedLogs.length > 0) {
    console.log()
    for (const line of bufferedLogs) {
      console.log(`  ${dim(line)}`)
    }
  }
}
console.log()
/* eslint-enable no-console */

// Import Craft dynamically. Its static import triggers bun-router
// config loading which prints warnings before our console.log override is
// active. We also let it be missing — the native window is a nicety, not a
// requirement; the dashboard runs fine as a plain web server in that case.
let createApp: ((_opts: any) => { show: () => Promise<void>, close: () => void }) | null = null
try {
  const localCraftSdk = process.env.HOME
    ? `${process.env.HOME}/Code/Tools/craft/packages/typescript/src/index.ts`
    : undefined

  ;({ createApp } = localCraftSdk && existsSync(localCraftSdk)
    ? await import(localCraftSdk)
    : await import('craft-native'))
}
catch {
  try {
    ;({ createApp } = await import('@craft-native/craft'))
  }
  catch {
    try {
      ;({ createApp } = await import('@stacksjs/ts-craft'))
    }
    catch {
      // The Craft SDK isn't installed (or its native bindings failed to
      // load on this platform). Fall through to web-only mode below.
    }
  }
}

if (createApp) {
  // Resolve the dock icon. Userland gets first crack at customizing via
  // `resources/assets/images/app-icon.png` in the project; if absent, fall
  // back to the framework's bundled placeholder so the dock never shows the
  // generic "no icon" silhouette. PNG is fine — NSImage decodes it directly.
  const userIconPath = projectPath('resources/assets/images/app-icon.png')
  const defaultIconPath = storagePath('framework/defaults/resources/assets/images/app-icon.png')
  // eslint-disable-next-line ts/no-top-level-await
  const appIconPath = (await Bun.file(userIconPath).exists())
    ? userIconPath
    : (await Bun.file(defaultIconPath).exists()) ? defaultIconPath : undefined

  // Native sidebar mode: Craft renders a real NSOutlineView populated
  // from `sidebarConfig`. The web sidebar self-hides via the layout's
  // `?native-sidebar=1` URL signal, so users only ever see one nav.
  //
  // If `sidebarConfig` round-tripping ever breaks again (Craft fell back
  // to its Finder placeholder before because the config didn't survive
  // argv/file passing), set `nativeSidebar: false` and the web sidebar
  // stays visible — see the layout for the matching detection logic.
  // ts-craft@0.0.2's `findCraftBinary()` only looks at a few cwd-relative
  // paths (packages/zig/zig-out/bin/craft etc.) and then falls back to
  // `'craft'` from PATH. The fallback resolves to the ts-craft CLI shim,
  // not the actual native binary, so spawn never produces a window.
  //
  // Honour `CRAFT_BIN` (matching the newer craft-native contract)
  // and probe a couple of known monorepo locations relative to this
  // checkout so the local `~/Documents/Projects/craft` clone Just Works
  // without requiring an env var.
  const craftBinaryPath = (() => {
    const explicit = process.env.CRAFT_BIN
    if (explicit && existsSync(explicit))
      return explicit
    const codeTools = `${process.env.HOME}/Code/Tools/craft/craft`
    if (existsSync(codeTools))
      return codeTools
    const codeToolsBin = `${process.env.HOME}/Code/Tools/craft/bin/craft`
    if (existsSync(codeToolsBin))
      return codeToolsBin
    const codeToolsZig = `${process.env.HOME}/Code/Tools/craft/packages/zig/zig-out/bin/craft`
    if (existsSync(codeToolsZig))
      return codeToolsZig
    const homeRel = `${process.env.HOME}/Documents/Projects/craft/packages/zig/zig-out/bin/craft`
    if (existsSync(homeRel))
      return homeRel
    return undefined
  })()

  // If we couldn't locate a real native binary, don't even attempt to spawn
  // — old SDK `findCraftBinary()` PATH fallbacks can resolve to their own
  // CLI shim. That shim then re-receives our
  // native-style flags (`--url ...`), clapp rejects them as unknown, and the
  // user sees a noisy "ClappError: Unknown option --url" before the process
  // exits. Skip native-window mode entirely instead and let the web fallback
  // below handle it.
  if (!craftBinaryPath) {
    createApp = null
  }

  if (!createApp) {
    // eslint-disable-next-line no-console
    console.log(`  ${dim('Native window unavailable. Set CRAFT_BIN to a craft binary, or open the URL above in a browser.')}\n`)
    await new Promise(() => {})
  }

  const app = createApp({
    url: initialUrl,
    quiet: !verbose,
    ...(craftBinaryPath && { craftPath: craftBinaryPath }),
    window: {
      title: 'Stacks Dashboard',
      width: 1400,
      height: 900,
      titlebarHidden: true,
      nativeSidebar: true,
      sidebarWidth: 240,
      sidebarConfig,
      ...(appIconPath && { icon: appIconPath }),
    },
  })

  // Clean up on exit
  process.on('SIGINT', () => {
    app.close()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    app.close()
    process.exit(0)
  })

  try {
    await app.show()
    process.exit(0)
  }
  catch {
    const fallbackUrl = dashboardHttpsUrl || dashboardLocalUrl
    // eslint-disable-next-line no-console
    console.log(`  ${dim('Dashboard available at:')} ${cyan(fallbackUrl)}\n`)

    // Keep the process running since we're serving via STX
    await new Promise(() => {})
  }
}
else {
  // No native window — keep the HTTP server alive so the dashboard is
  // reachable via the URLs printed in the banner above. SIGINT/SIGTERM
  // exit cleanly without a window to close.
  //
  // We get here in two cases:
  //   1. The Craft SDK failed to import (catch above set createApp = null)
  //   2. We couldn't find a real native craft binary (CRAFT_BIN unset and the
  //      `~/Documents/Projects/craft` checkout isn't present). In that case
  //      we deliberately skipped native mode to avoid spawning the ts-craft
  //      CLI shim with native-style flags (which would error on `--url`).
  // eslint-disable-next-line no-console
  console.log(`  ${dim('Native window unavailable. Set CRAFT_BIN to a craft binary, or open the URL above in a browser.')}\n`)
  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))
  await new Promise(() => {})
}
