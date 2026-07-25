---
name: stacks-new-feature
description: Use when adding a new feature end-to-end in a Stacks application — the complete workflow from model definition through migration, action, route, test, and deployment. Covers the recommended order of operations for building features.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Adding a New Feature to Stacks

Step-by-step guide for building features end-to-end.

## Workflow Overview

```
1. Model → 2. Migration → 3. Action → 4. Route → 5. Test → 6. Lint → 7. Deploy
```

## Step 1: Define the Model

```typescript
// Create or edit in storage/framework/models/
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
      validation: { rule: schema.string().maxLength(200) },
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

Or rely on auto-generated routes from `useApi` trait — they're created automatically.

## Step 5: Add Event Listeners (Optional)

```typescript
// app/Events.ts — add to existing
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
- Models work directly via the dynamic ORM — no generation step needed before migrations
- The `useApi` trait auto-generates both routes AND dashboard views
- Model events (observe: true) emit `article:created`, `article:updated`, `article:deleted`
- Factories in model attributes are used by `buddy seed`
- Always lint after code generation: `bunx --bun pickier . --fix`
- Use conventional commits: `feat: add article management`
