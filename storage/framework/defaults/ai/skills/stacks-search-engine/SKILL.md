---
name: stacks-search-engine
description: Use when implementing search in Stacks — full-text search with Meilisearch or Algolia backends, document indexing, search settings management, the useSearch model trait for automatic indexing, or search driver configuration. Covers @stacksjs/search-engine and config/search-engine.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Search Engine

Full-text search integration with Meilisearch, Algolia, Typesense, and
OpenSearch drivers.

## Key Paths
- Core package: `storage/framework/core/search-engine/src/`
- Configuration: `config/search-engine.ts`

## Search Driver Factory

```typescript
import {
  flushModelDocuments,
  useAlgolia,
  useMeilisearch,
  useOpensearch,
  useSearchEngine,
  useTypesense,
} from '@stacksjs/search-engine'

const search = useSearchEngine()       // default driver
const algolia = useAlgolia()            // Algolia client
const meili = useMeilisearch()          // Meilisearch client
const openSearch = useOpensearch()       // OpenSearch driver
const typesense = useTypesense()         // Typesense driver
```

## Document Operations

```typescript
// Index documents
await search.addDocuments('products', [
  { id: 1, name: 'Widget', description: 'A useful widget', price: 29.99 },
  { id: 2, name: 'Gadget', description: 'A cool gadget', price: 49.99 }
])

// Search
const results = await search.search('products', 'widget')

// List indexes
const indexes = await search.listAllIndexes()

// Get/update settings
const settings = await search.getSettings('products')
await search.updateSettings('products', {
  searchableAttributes: ['name', 'description'],
  filterableAttributes: ['price', 'category'],
  sortableAttributes: ['price', 'created_at']
})

// Flush all documents
await flushModelDocuments('Product')
```

## Model Integration (useSearch Trait)

Models with `useSearch` trait are automatically indexed:

```typescript
defineModel({
  name: 'Product',
  traits: {
    useSearch: {
      displayable: ['name', 'description', 'price'],
      searchable: ['name', 'description'],
      sortable: ['name', 'price', 'created_at'],
      filterable: ['category', 'status', 'price']
    }
  }
})
```

## CLI Commands

```bash
buddy search-engine:update                    # index all searchable models
buddy search-engine:update --model Product    # index specific model
buddy search-engine:update --flush            # flush before re-indexing
buddy search-engine:update --settings         # update search settings only
buddy search-engine:settings                  # list current settings
buddy search-engine:settings --model Product  # settings for specific model
```

## Driver Comparison

| Feature | Meilisearch | Algolia | Typesense | OpenSearch |
|---------|-------------|---------|-----------|------------|
| Self-hosted | Yes | No | Yes | Yes |
| Managed option | Yes | Yes | Yes | Yes |
| Model lifecycle indexing | Yes | Yes | Yes | Driver must implement the full contract |

## config/search-engine.ts

```typescript
{ driver: 'opensearch' }  // 'meilisearch' | 'algolia' | 'opensearch' | 'typesense'
```

Environment variables: `MEILISEARCH_HOST`, `MEILISEARCH_KEY`, `SEARCH_ENGINE_DRIVER`

## Gotchas
- Default driver is `opensearch` — configure in config or env
- A selected driver must implement the complete `SearchEngineDriver` surface; never satisfy the type with an empty cast
- `useSearch` trait determines which model fields are indexed
- `displayable` controls which fields appear in search results
- `searchable` controls which fields are queried during search
- `filterable` enables faceted filtering on those fields
- `sortable` enables sorting by those fields
- Use `buddy search-engine:update --flush` for full re-index
- Meilisearch requires a running Meilisearch server
- Algolia requires API keys from your Algolia dashboard
- Settings updates don't re-index — run `search-engine:update` after changes
