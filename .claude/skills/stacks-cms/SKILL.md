---
name: stacks-cms
description: Use when working with the CMS in a Stacks application — posts, authors, pages, categories, tags, comments, blog configuration, RSS feeds, or sitemaps. Covers @stacksjs/cms, CMS models, routes, and actions.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks CMS

## Key Paths
- Core package: `storage/framework/core/cms/src/`
- Models: `storage/framework/defaults/models/Content/` (Post, Author, Page)
- Models: `storage/framework/defaults/models/` (Comment, Tag)
- Actions: `storage/framework/defaults/app/Actions/Cms/`
- Routes: `routes/api.ts` (CMS and blog endpoints)
- Config: `config/blog.ts`

## Source Files
```
cms/src/
├── index.ts              # CmsNamespace — top-level API
├── posts/
│   ├── fetch.ts          # fetchById, fetchAll, fetchByStatus, fetchByCategory, fetchByAuthor
│   ├── store.ts          # store, attach, detach, sync (pivot tables)
│   ├── update.ts         # update
│   └── destroy.ts        # destroy, bulkDestroy
├── authors/
│   ├── fetch.ts          # fetchAll, fetchById, findByEmail, findByName, findByUserId
│   ├── store.ts          # store, findOrCreate
│   ├── update.ts         # update
│   └── destroy.ts        # destroy
├── pages/
│   ├── fetch.ts          # fetchById, fetchAll, fetchByTemplate, fetchByAuthor
│   └── store.ts          # store
├── categorizables/       # Categories with polymorphic pivot
├── taggables/            # Tags with polymorphic pivot
├── commentables/         # Comments with polymorphic support
└── build.ts              # Blog static site generation
```

## CMS Namespace

```typescript
interface CmsNamespace {
  posts: PostsModule
  postCategories: PostCategoriesModule
  tags: TagsModule
  comments: CommentsModule
  authors: AuthorsModule
  pages: PagesModule
}
```

## Models

### Post
- **Table**: `posts`
- **Relationships**: `belongsTo(['Author'])`
- **Traits**: UUID, Timestamps, Search, Seeder (20), Categorizable, Taggable, Commentable, API routes

| Field | Type | Validation | Default |
|-------|------|------------|---------|
| title | string | required, 3-255 chars | — |
| content | string | required, 10-1000 chars | — |
| excerpt | string | optional, 10-500 chars | — |
| poster | string | optional, valid URL | — |
| views | number | — | 0 |
| publishedAt | timestamp | optional | — |
| status | enum | published/draft/archived | draft |
| isFeatured | number | 0 or 1 | — |

### Author
- **Table**: `authors`, **Relationships**: `hasMany(['Post'])`, `belongsTo(['User'])`
- **Attributes**: `name` (5-255), `email` (unique, valid email)
- **Indexes**: Composite on `(email, name)`

### Page
- **Table**: `pages`, **Relationships**: `belongsTo(['Author'])`
- **Attributes**: `title`, `template` (enum: default/landing/blog/contact), `views`, `conversions`, `publishedAt`

### Comment
- **Table**: `comments`, **Relationships**: `belongsTo(['Post', 'User'])`
- **Attributes**: `authorName`, `authorEmail`, `content` (1-2000), `status` (pending/approved/spam/trash), `ipAddress`, `userAgent`, `isApproved`

### Tag
- **Table**: `tags`
- **Attributes**: `name` (unique, 2-50), `slug` (unique), `description`, `postCount`, `color`

## Posts API

```typescript
// Fetch
cms.posts.fetchById(id: number): Promise<PostJsonResponse | undefined>
cms.posts.fetchAll(): Promise<PostJsonResponse[]>
cms.posts.fetchByStatus(status: 'published' | 'draft' | 'archived'): Promise<PostJsonResponse[]>
cms.posts.fetchByCategory(category: string): Promise<PostJsonResponse[]>
cms.posts.fetchByAuthor(author: string): Promise<PostJsonResponse[]>
cms.posts.fetchByMinViews(minViews: number): Promise<PostJsonResponse[]>
cms.posts.fetchPublishedAfter(timestamp: number): Promise<PostJsonResponse[]>

// Store with pivot auto-attach
cms.posts.store(data: NewPost & { body?: string, category?: string }): Promise<PostJsonResponse>
cms.posts.attach(postId, tableName: 'categorizable_models' | 'taggable_models', ids: number[]): Promise<void>
cms.posts.detach(postId, tableName, ids?: number[]): Promise<void>
cms.posts.sync(postId, tableName, ids: number[]): Promise<void>

// Update & Destroy
cms.posts.update(id: number, data: Partial<PostUpdate>): Promise<PostJsonResponse>
cms.posts.destroy(id: number): Promise<boolean>
cms.posts.bulkDestroy(ids: number[]): Promise<number>
```

## Authors API

```typescript
cms.authors.findOrCreate(data: AuthorData): Promise<AuthorJsonResponse>
cms.authors.store(data: NewAuthor): Promise<AuthorJsonResponse>
cms.authors.findByEmail(email: string): Promise<AuthorJsonResponse | undefined>
cms.authors.findByName(name: string): Promise<AuthorJsonResponse | undefined>
cms.authors.findByUserId(userId: number): Promise<AuthorJsonResponse | undefined>
cms.authors.fetchAll(): Promise<AuthorJsonResponse[]>
cms.authors.fetchById(id: number): Promise<AuthorJsonResponse | undefined>
cms.authors.update(id, data): Promise<AuthorJsonResponse>
cms.authors.destroy(id): Promise<boolean>
```

## Tags API

```typescript
cms.tags.findOrCreateMany(names: string[], taggableType: string): Promise<number[]>
cms.tags.firstOrCreate(name: string, taggableType: string): Promise<TaggableTable>
cms.tags.fetchTags(): Promise<TaggableTable[]>
cms.tags.fetchTagById(id: number): Promise<TaggableTable | undefined>
cms.tags.countTaggedPosts(taggableType: string): Promise<number>
cms.tags.findMostUsedTag(taggableType?: string): Promise<{ name: string, count: number } | null>
cms.tags.fetchTagsWithPostCounts(): Promise<Array<{ name: string, postCount: number }>>
cms.tags.fetchTagDistribution(): Promise<Array<{ name: string, count: number, percentage: number }>>
```

## Comments API

```typescript
cms.comments.createComment(data: CreateCommentInput): Promise<CommentablesTable>
cms.comments.updateComment(id: number, input: UpdateCommentInput): Promise<CommentablesTable>
cms.comments.approveComment(id: number): Promise<CommentablesTable>
cms.comments.rejectComment(id: number): Promise<CommentablesTable>
cms.comments.deleteComment(id: number): Promise<void>
```

## Routes

### CMS Admin Routes
| Method | Path | Action |
|--------|------|--------|
| GET | `/cms/posts` | PostIndexAction |
| GET | `/cms/posts/{id}` | PostShowAction |
| POST | `/cms/posts` | PostStoreAction |
| PATCH | `/cms/posts/{id}` | PostUpdateAction |
| DELETE | `/cms/posts/{id}` | PostDestroyAction |
| PATCH | `/cms/posts/{id}/views` | PostViewsUpdateAction |
| CRUD | `/cms/authors/*` | Author CRUD |
| CRUD | `/cms/categories/*` | Categorizable CRUD |
| CRUD | `/cms/tags/*` | Taggable CRUD |
| CRUD | `/cms/comments/*` | Comment CRUD |
| CRUD | `/cms/pages/*` | Page CRUD |

### Public Blog Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/blog/posts` | Public post listing |
| GET | `/blog/posts/{id}` | Public post detail |
| GET | `/blog/categories` | Public categories |
| GET | `/blog/tags` | Public tags |
| GET | `/blog/feed.xml` | RSS 2.0 feed (20 recent) |
| GET | `/blog/sitemap.xml` | XML sitemap for SEO |

## Blog Configuration (config/blog.ts)

```typescript
{
  subdomain: 'blog',
  title: 'Stacks Blog',
  description: 'The official Stacks.js blog',
  postsPerPage: 10,
  enableComments: true,
  enableRss: true,
  enableSitemap: true,
  enableSearch: true,
  social: { twitter: '@stacksjs', github: 'stacksjs/stacks' },
  theme: { primaryColor: '#3451b2', logo: '/images/logos/logo-transparent.svg' },
}
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `posts` | Blog posts |
| `authors` | Content creators |
| `pages` | Static pages |
| `comments` | Comments (polymorphic) |
| `tags` | Tag definitions |
| `taggable_models` | Polymorphic pivot: tag ↔ model |
| `categorizables` | Category definitions |
| `categorizable_models` | Polymorphic pivot: category ↔ model |

## Gotchas
- **Polymorphic relations** — categories, tags, and comments use `*_type` fields to support multiple model types
- **Post `content` maps from `body`** — the model attribute is `content` but the DB column mapping comes from `body`
- **Author uses findOrCreate** — `PostStoreAction` auto-creates authors if they don't exist
- **Post store auto-attaches** — creating a post with category/tag data automatically calls `attach()` on pivot tables
- **Post update uses sync** — updating categories/tags uses `sync()` (detaches removed, attaches new)
- **Views increment is atomic** — `PATCH /cms/posts/{id}/views` increments by 1
- **RSS returns 20 items** — hardcoded to 20 most recent published posts
- **Sitemap priorities** — posts 0.8, categories 0.6, blog homepage 0.9
- **Comment status flow** — starts `pending`, can be approved, rejected (→ spam), or trashed
