---
name: stacks-new-feature
description: Use when adding a new feature end-to-end in a Stacks application - slicing the work into tracer bullets, then building each slice from model through migration, action, route, test and deploy. Covers the recommended order of operations, the blocking edges between slices, and the expand-contract sequence for a wide refactor.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Adding a New Feature to Stacks

Step-by-step guide for building features end-to-end.

## Slice it first

Before any code, break the work into **tracer bullets**: vertical slices, each
cutting a narrow but complete path through every layer.

- Each slice cuts through model, migration, action, route and test. Vertical, not
  a horizontal slice of one layer.
- A finished slice is demoable or verifiable on its own.
- Each slice fits in one fresh context window.
- Any prefactoring goes first. Make the change easy, then make the easy change.

Give each slice its **blocking edges**: the slices that must land before it can
start. A slice with no blockers can start immediately, and the set of slices
whose blockers are all done is the **frontier** you work from.

Present the breakdown as a numbered list before building anything. For each
slice: the title, what it delivers end to end, and what blocks it. Then ask
whether the granularity is right, whether the edges are real, and whether
anything should be merged or split. Iterate until the user approves.

Where the project tracks work on a real tracker, publish the slices in
dependency order so the edges can reference real identifiers. Where it does not,
one file per slice under `.scratch/<feature>/issues/<NN>-<slug>.md`, numbered
blockers-first, is enough. Avoid file paths and code snippets in either form,
because they go stale faster than the ticket does.

### The exception: a wide refactor

A **wide refactor** is one mechanical change whose blast radius fans across the
codebase, so a single edit breaks hundreds of call sites at once and no vertical
slice can land green. Renaming a model column, retyping a shared symbol, and
changing an exported signature in `storage/framework/core/` are all this shape.

Do not force it into a tracer bullet. Sequence it as **expand and contract**:

1. **Expand.** Add the new form beside the old so nothing breaks. A new column
   alongside the old one, a new export alongside the old one.
2. **Migrate** the call sites in batches sized by blast radius, one per package or
   directory, each batch its own slice blocked by the expand. CI stays green
   batch to batch because the old form still exists.
3. **Contract.** Delete the old form once no caller remains, in a slice blocked by
   every migrate batch.

When even the batches cannot stay green alone, keep the sequence but let them
share an integration branch that all block a final integrate-and-verify slice.
Green is promised only there.

Credit: the tracer-bullet and expand-contract framing is adapted from Matt
Pocock's `to-tickets` skill (MIT), <https://github.com/mattpocock/skills>.

## Workflow Overview

```
1. Model → 2. Migration → 3. Action → 4. Route → 5. Test → 6. Lint → 7. Deploy
```

Run this once per slice, not once per feature. Within a slice, `stacks-tdd`
owns the red-green loop: the migration lands, then the failing test, then the
code that passes it.

## Step 1: Define the Model

```typescript
// Create or edit in storage/framework/defaults/app/Models/
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Article',
  table: 'articles',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSearch: {
      searchable: ['title', 'content'],
      sortable: ['title', 'created_at'],
      filterable: ['status']
    },
    useApi: {
      uri: 'articles',
      routes: ['index', 'store', 'show', 'update', 'destroy']
    },
    useSeeder: { count: 10 },
    observe: true
  },

  belongsTo: ['User'],

  attributes: {
    title: {
      fillable: true,
      required: true,
      validation: { rule: schema.string().max(200) },
      factory: (faker) => faker.lorem.sentence()
    },
    content: {
      fillable: true,
      required: true,
      validation: { rule: schema.string() },
      factory: (faker) => faker.lorem.paragraphs(3)
    },
    status: {
      fillable: true,
      default: 'draft',
      validation: { rule: schema.enum(['draft', 'published', 'archived']) },
      factory: () => 'draft'
    }
  },

  get: {
    excerpt: (attrs) => attrs.content?.substring(0, 150) + '...'
  }
} as const)
```

## Step 2: Generate & Run Migration

```bash
buddy generate:migrations      # generate migration SQL from model diffs
buddy migrate                  # apply migration
buddy seed                     # seed with factory data
```

## Step 3: Create Actions

```typescript
// app/Actions/CreateArticle.ts
export default {
  name: 'CreateArticle',
  description: 'Create a new article',

  async handle(request: any) {
    const title = request.get('title')
    const content = request.get('content')
    const user = await request.user()

    const article = await Article.create({
      title,
      content,
      user_id: user.id,
      status: 'draft'
    })

    return { success: true, data: article }
  }
}
```

## Step 4: Define Routes

```typescript
// routes/api.ts (add to existing)
route.group({ prefix: '/articles', middleware: ['auth'] }, () => {
  route.get('/', 'Actions/ListArticles')
  route.post('/', 'Actions/CreateArticle')
  route.get('/{id}', 'Actions/ShowArticle')
  route.put('/{id}', 'Actions/UpdateArticle')
  route.delete('/{id}', 'Actions/DeleteArticle')
})
```

Or rely on auto-generated routes from `useApi` trait - they're created automatically.

### When a TypeScript client will call these

Register through `createTypedRouter()` instead, and the client gets full
input/output inference with no `buddy generate:openapi` step in between:

```typescript
// routes/api.ts
import CreateArticle from '../app/Actions/CreateArticle'
import ListArticles from '../app/Actions/ListArticles'
import { createTypedRouter } from '@stacksjs/router'

export const api = createTypedRouter()
  .get('/articles', ListArticles, { middleware: 'auth' })
  .post('/articles', CreateArticle, { middleware: 'auth' })

export type AppRoutes = typeof api
```

```typescript
const client = createTypedClient<AppRoutes>({ baseUrl })
const created = await client.post('/articles', { title: 'x', content: 'y' })
```

Same runtime path, same middleware, same OpenAPI document - the difference is
entirely at compile time. Keep the string form for routes no TypeScript consumer
calls; it stays lazily imported. See the `stacks-api` and `stacks-router` skills.

## Step 5: Add Event Listeners (Optional)

```typescript
// app/Events.ts - add to existing
{
  'article:created': ['NotifySubscribers'],
  'article:published': ['SendNewsletter', 'IndexInSearchEngine']
}
```

## Step 6: Write Tests

```typescript
// tests/feature/articles.test.ts
import { describe, test, expect, beforeAll } from 'bun:test'
import { setupDatabase, refreshDatabase } from '@stacksjs/testing'

describe('Articles', () => {
  beforeAll(async () => {
    await setupDatabase()
  })

  test('can create an article', async () => {
    const article = await Article.create({
      title: 'Test Article',
      content: 'Test content',
      status: 'draft'
    })
    expect(article.title).toBe('Test Article')
  })

  test('can list articles', async () => {
    const articles = await Article.all()
    expect(articles.length).toBeGreaterThan(0)
  })
})
```

## Step 7: Lint & Deploy

```bash
bunx --bun pickier . --fix    # lint and auto-fix
buddy test                     # run tests
buddy deploy                   # deploy to cloud
```

## Common Patterns

### Adding a Dashboard View
Models with `useApi` + `dashboard: { highlight: true }` auto-appear in the admin dashboard.

### Adding Email Notifications
```typescript
// app/Mail/ArticlePublished.ts
export async function sendArticlePublished({ to, article }) {
  const { html, text } = await template('article-published', {
    variables: { title: article.title, url: `${config.app.url}/articles/${article.id}` }
  })
  await mail.send({ to, subject: `New: ${article.title}`, html, text })
}
```

### Adding Background Processing
```typescript
// app/Jobs/IndexArticle.ts
export default new Job({
  name: 'IndexArticle',
  queue: 'search',
  tries: 3,
  async handle(payload: { articleId: number }) {
    const article = await Article.find(payload.articleId)
    await search.addDocuments('articles', [article])
  }
})
```

## Gotchas
- Models work directly via the dynamic ORM - no generation step needed before migrations
- The `useApi` trait auto-generates both routes AND dashboard views
- Model events (observe: true) emit `article:created`, `article:updated`, `article:deleted`
- Factories in model attributes are used by `buddy seed`
- Always lint after code generation: `bunx --bun pickier . --fix`
- Use conventional commits: `feat: add article management`

## Downstream

> **Slice green?** Run `/stacks-review` before merging it, then take the next
> slice off the frontier. `/stacks-tdd` is the loop inside each one, and
> `/stacks-plan-review` is where to go back to if the slices stop making sense.
