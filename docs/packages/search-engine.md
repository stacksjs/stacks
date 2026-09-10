---
title: Search Engine Package
description: "A powerful search integration supporting Meilisearch and Algolia, providing full-text search, indexing, faceted search, and real-time updates for your appl..."
---
# Search Engine Package

A powerful search integration supporting Meilisearch and Algolia, providing full-text search, indexing, faceted search, and real-time updates for your application.

## Installation

```bash
bun add @stacksjs/search-engine
```

## Basic Usage

```typescript
import { useSearchEngine, useMeilisearch, useAlgolia } from '@stacksjs/search-engine'

// Use configured search engine
const search = useSearchEngine()

// Search documents
const results = await search.search('products', 'wireless headphones')

// Add documents to index
await search.addDocuments('products', [
  { id: 1, name: 'Wireless Headphones', price: 99.99 }
])
```

## Configuration

### Environment Variables

```env
# Search engine driver
SEARCH_ENGINE_DRIVER=meilisearch

# Meilisearch configuration
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_KEY=your-master-key

# Algolia configuration
ALGOLIA_APP_ID=your-app-id
ALGOLIA_API_KEY=your-api-key
ALGOLIA_SEARCH_KEY=your-search-key
```

### Configuration File

```typescript
// config/search-engine.ts
export default {
  // Default driver
  driver: 'meilisearch',

  // Meilisearch settings
  meilisearch: {
    host: 'http://localhost:7700',
    apiKey: 'masterKey',
    indexPrefix: 'myapp_'
  },

  // Algolia settings
  algolia: {
    appId: 'your-app-id',
    apiKey: 'your-api-key',
    searchKey: 'your-search-key',
    indexPrefix: 'myapp_'
  }
}
```

## Meilisearch

### Basic Search

```typescript
import { useMeilisearch } from '@stacksjs/search-engine'

const meilisearch = useMeilisearch()

// Simple search
const results = await meilisearch.search('products', 'headphones')

// Search with options
const results = await meilisearch.search('products', 'headphones', {
  limit: 20,
  offset: 0,
  filter: 'category = "electronics" AND price < 200',
  sort: ['price:asc'],
  attributesToRetrieve: ['id', 'name', 'price', 'description'],
  attributesToHighlight: ['name', 'description'],
  attributesToCrop: ['description'],
  cropLength: 50
})

console.log(results.hits)        // Search results
console.log(results.query)       // Original query
console.log(results.processingTimeMs) // Search time
console.log(results.estimatedTotalHits) // Total matches
```

### Faceted Search

```typescript
// Search with facets
const results = await meilisearch.search('products', 'laptop', {
  facets: ['category', 'brand', 'color'],
  filter: 'price >= 500 AND price <= 1500'
})

console.log(results.facetDistribution)
// {
//   category: { 'laptops': 45, 'accessories': 12 },
//   brand: { 'Apple': 15, 'Dell': 20, 'HP': 22 },
//   color: { 'black': 30, 'silver': 25, 'white': 7 }
// }
```

### Indexing Documents

```typescript
import { useSearchEngine } from '@stacksjs/search-engine'

// Index operations live on the driver, not as free functions - the driver is
// resolved from `config/search-engine.ts` so the same code works on
// Meilisearch, Algolia, OpenSearch or Typesense.
const search = useSearchEngine()

// Add documents
await search.addDocuments('products', [
  {
    id: 1,
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse with long battery life',
    category: 'electronics',
    brand: 'Logitech',
    price: 49.99,
    inStock: true,
    rating: 4.5
  },
  {
    id: 2,
    name: 'Mechanical Keyboard',
    description: 'RGB mechanical keyboard with cherry switches',
    category: 'electronics',
    brand: 'Corsair',
    price: 129.99,
    inStock: true,
    rating: 4.8
  }
])

// Update documents (merges with existing)
await search.updateDocuments('products', [
  { id: 1, price: 44.99 } // Only updates price
])

// Delete documents
await search.deleteDocuments('products', [1, 2])

// Delete all documents
await flushDocuments('products')
```

### Index Management

```typescript
import { useSearchEngine } from '@stacksjs/search-engine'

const search = useSearchEngine()

// List all indexes
const indexes = await search.listAllIndexes()

// Create index with primary key
await search.createIndex('products', { primaryKey: 'id' })

// Delete index
await search.deleteIndex('products')
```

### Index Settings

```typescript
import { useSearchEngine } from '@stacksjs/search-engine'

const search = useSearchEngine()

// Get current settings
const settings = await search.getSettings('products')

// Update settings
await search.updateSettings('products', {
  // Searchable attributes (in priority order)
  searchableAttributes: [
    'name',
    'description',
    'category',
    'brand'
  ],

  // Filterable attributes (for filtering and facets)
  filterableAttributes: [
    'category',
    'brand',
    'price',
    'inStock',
    'rating'
  ],

  // Sortable attributes
  sortableAttributes: [
    'price',
    'rating',
    'createdAt'
  ],

  // Ranking rules (order matters)
  rankingRules: [
    'words',
    'typo',
    'proximity',
    'attribute',
    'sort',
    'exactness',
    'rating:desc' // Custom ranking by rating
  ],

  // Stop words (ignored in search)
  stopWords: ['the', 'a', 'an', 'is', 'are'],

  // Synonyms
  synonyms: {
    'phone': ['smartphone', 'mobile', 'cell'],
    'laptop': ['notebook', 'computer']
  },

  // Displayed attributes (returned in results)
  displayedAttributes: ['*'], // All attributes

  // Distinct attribute (for deduplication)
  distinctAttribute: 'productGroup',

  // Typo tolerance
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: {
      oneTypo: 5,
      twoTypos: 9
    },
    disableOnWords: ['exact-match'],
    disableOnAttributes: ['sku']
  },

  // Pagination limits
  pagination: {
    maxTotalHits: 10000
  }
})
```

## Algolia

### Basic Search

```typescript
import { useAlgolia } from '@stacksjs/search-engine'

const algolia = useAlgolia()

// Simple search
const results = await algolia.search('products', 'headphones')

// Search with parameters
const results = await algolia.search('products', 'headphones', {
  hitsPerPage: 20,
  page: 0,
  filters: 'category:electronics AND price < 200',
  facets: ['category', 'brand'],
  attributesToRetrieve: ['name', 'price', 'description'],
  attributesToHighlight: ['name', 'description'],
  highlightPreTag: '<mark>',
  highlightPostTag: '</mark>'
})
```

### Multi-Index Search

```typescript
// Search across multiple indexes
const results = await algolia.multiSearch([
  { indexName: 'products', query: 'laptop' },
  { indexName: 'categories', query: 'laptop' },
  { indexName: 'brands', query: 'laptop' }
])
```

### Indexing with Algolia

```typescript
// Add or update records
await algolia.saveObjects('products', [
  { objectID: '1', name: 'Product 1', price: 99.99 },
  { objectID: '2', name: 'Product 2', price: 149.99 }
])

// Partial update
await algolia.partialUpdateObjects('products', [
  { objectID: '1', price: 89.99 }
])

// Delete records
await algolia.deleteObjects('products', ['1', '2'])

// Clear index
await algolia.clearObjects('products')
```

## Model Integration

### Searchable Models

```typescript
// app/Models/Product.ts
export default {
  name: 'Product',
  table: 'products',

  searchable: true,
  searchIndex: 'products',

  // Attributes to index
  searchableAttributes: [
    'name',
    'description',
    'category',
    'brand',
    'sku'
  ],

  // Transform data for search
  toSearchableArray() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category?.name,
      brand: this.brand?.name,
      price: this.price,
      inStock: this.inventory > 0,
      rating: this.averageRating,
      createdAt: this.createdAt.getTime()
    }
  }
}
```

### Auto-Sync

```typescript
// Models automatically sync on create/update/delete
const product = await Product.create({
  name: 'New Product',
  price: 99.99
})
// Automatically indexed in search engine

await product.update({ price: 89.99 })
// Automatically updated in search index

await product.delete()
// Automatically removed from search index
```

### Manual Sync

```typescript
// Sync single model
await product.searchable()

// Remove from search
await product.unsearchable()

// Bulk sync
await Product.where('category', 'electronics').searchable()

// Rebuild entire index
await Product.reindex()
```

## Search Features

### Highlighting

```typescript
const results = await search.search('products', 'wireless mouse', {
  attributesToHighlight: ['name', 'description'],
  highlightPreTag: '<em>',
  highlightPostTag: '</em>'
})

results.hits.forEach(hit => {
  console.log(hit._formatted.name) // <em>Wireless</em> <em>Mouse</em>
})
```

### Typo Tolerance

```typescript
// Search with typos
const results = await search.search('products', 'wireles headphnes')
// Still matches "wireless headphones"
```

### Geo Search

```typescript
// Search near a location
const results = await search.search('stores', '', {
  filter: '_geoRadius(48.8566, 2.3522, 1000)', // 1km radius around Paris
  sort: ['_geoPoint(48.8566, 2.3522):asc']
})
```

### Filtering

```typescript
// Complex filters
const results = await search.search('products', 'laptop', {
  filter: [
    'category = "electronics"',
    'brand IN ["Apple", "Dell", "HP"]',
    'price >= 500',
    'price <= 2000',
    'inStock = true',
    'rating >= 4'
  ].join(' AND ')
})
```

### Sorting

```typescript
// Sort by multiple attributes
const results = await search.search('products', 'laptop', {
  sort: [
    'featured:desc',
    'price:asc',
    'rating:desc'
  ]
})
```

## Keeping the index in step

Indexing is driven from the model rather than called by hand. A model with the
`useSearch` trait writes to the index on create, update and delete, so there is
nothing to remember at each call site:

```ts
// app/Models/Product.ts
export default defineModel({
  name: 'Product',
  traits: {
    useSearch: {
      searchable: ['name', 'description'],
      filterable: ['status'],
      // Dispatch to the queue instead of writing inline. Worth turning on
      // whenever the search backend is on another host: a slow upsert or a
      // transient outage then costs a retry rather than the user's write.
      queueable: true,
    },
  },
  // ...
})
```

With `queueable: true` the model's hooks dispatch `SyncSearchIndexJob`, which
retries with backoff. Without it the write happens inline, which is fine for a
local Meilisearch and not for a managed one across a network.

To reindex on demand - after changing `searchable`, or to backfill - go through
the driver:

```ts
import { useSearchEngine } from '@stacksjs/search-engine'

const search = useSearchEngine()
const products = await Product.all()

await search.addDocuments('products', products.map(p => p.toSearchableArray()))
```

## Edge Cases

### Handling Large Datasets

```typescript
// Batch indexing for large datasets
const products = await Product.all()
const batches = chunk(products, 500)

for (const batch of batches) {
  await search.addDocuments('products', batch.map(p => p.toSearchableArray()))
  // Optional: Add delay to avoid rate limiting
  await sleep(100)
}
```

### Handling Connection Failures

```typescript
try {
  const results = await search.search('products', 'query')
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    // Search engine unavailable, fallback to database
    const results = await Product.whereLike('name', `%query%`).get()
    return results
  }
  throw error
}
```

### Index Versioning

```typescript
// Create new index version
const newIndex = 'products_v2'
await search.createIndex(newIndex)

// Populate new index
await search.addDocuments(newIndex, documents)

// Swap indexes atomically
await swapIndexes('products', newIndex)
```

### Empty Results Handling

```typescript
const results = await search.search('products', 'nonexistent')

if (results.hits.length === 0) {
  // Show suggestions
  const suggestions = await search.search('products', '', {
    limit: 5,
    sort: ['rating:desc']
  })
  return { hits: [], suggestions: suggestions.hits }
}
```

## API Reference

### Driver Functions

| Function | Description |
|----------|-------------|
| `useSearchEngine()` | Get configured search driver |
| `useMeilisearch()` | Get Meilisearch client |
| `useAlgolia()` | Get Algolia client |

### Document Operations

| Function | Description |
|----------|-------------|
| `search.addDocuments(index, docs)` | Add documents to index |
| `search.updateDocuments(index, docs)` | Update existing documents |
| `search.deleteDocuments(index, ids)` | Delete documents by ID |
| `flushDocuments(index)` | Delete all documents |

### Index Operations

| Function | Description |
|----------|-------------|
| `search.listAllIndexes()` | List all indexes |
| `search.createIndex(name, key?)` | Create new index |
| `search.deleteIndex(name)` | Delete index |
| `search.getSettings(index)` | Get index settings |
| `search.updateSettings(index, settings)` | Update settings |

### Search Methods

| Method | Description |
|--------|-------------|
| `search(index, query, options?)` | Perform search |
| `multiSearch(queries)` | Search multiple indexes |

### Search Options

| Option | Description |
|--------|-------------|
| `limit` / `hitsPerPage` | Results per page |
| `offset` / `page` | Pagination |
| `filter` / `filters` | Filter expression |
| `sort` | Sort order |
| `facets` | Facet attributes |
| `attributesToRetrieve` | Fields to return |
| `attributesToHighlight` | Fields to highlight |
| `attributesToCrop` | Fields to crop |
| `cropLength` | Crop length |
