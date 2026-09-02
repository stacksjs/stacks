# @stacksjs/pagination

The paginator shapes the ORM produces and the router serializes.

It has no dependencies, and that is the point. Both `@stacksjs/orm` and
`@stacksjs/router` need to agree on what a page of rows looks like: the ORM
builds one from a query, the router recognises one in a handler's return value
and serializes it. When the shape lived in the ORM, the router had to depend on
the ORM to recognise it, while the ORM depends on the router to register the
routes its models generate - so the two packages depended on each other, and no
publish order could put one before the other.

Nothing here knows about queries or requests. It is the contract, three
duck-typed predicates for recognising it, and the adapters that convert the
shapes the underlying drivers return.

```ts
import { isPaginator, toPaginator } from '@stacksjs/pagination'

const page = toPaginator(rows, { page: 2, perPage: 25, total: 413 })

if (isPaginator(value))
  return Response.json(value)
```

## Shapes

- `Paginator` — knows `total`, so it can offer "jump to page N". Costs a `COUNT(*)`.
- `SimplePaginator` — knows only whether another page exists.
- `CursorPaginator` — opaque cursors, for tables too large to offset into.

All three are snake_case, matching Laravel's serialized paginator and the REST
convention across the Stacks API.
