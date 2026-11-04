---
name: stacks-pagination
description: Use when returning database pages, simple or cursor feeds, building pagination links, or adapting upstream paginator results. Covers @stacksjs/pagination, ORM pagination and the native UI helper contract.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Canonical pagination

Use the shape the native ORM/router actually produces, not a handwritten
{ paging, next_cursor } envelope. Import paginator types and guards from
@stacksjs/pagination or their ORM re-exports.

## Shapes

Paginator<T> has data, current_page, per_page, total, last_page, from, to and
has_more_pages. Full pagination needs a count query. An out-of-range requested
page remains the requested current_page with empty data; it is not clamped.

SimplePaginator<T> omits total/last_page and uses a cheap has_more_pages result.
CursorPaginator<T> has opaque next_cursor/prev_cursor and no random page jump.
Keep cursor tokens unchanged at the client and validate them through the
native parser. Do not treat a cursor as a trusted SQL fragment.

toPaginator, toSimplePaginator and toCursorPaginator adapt source results.
isPaginator/isSimplePaginator/isCursorPaginator identify the canonical shapes;
they require every mandatory metadata field, safe positive page integers,
non-negative integer totals and correctly typed optional links. They do not
authenticate a source or validate rows. Empty out-of-range pages remain valid.

BigInt cursors serialize as exact decimal strings. Composite cursors encode
BigInts as decimal string entries inside a JSON array. Keep those tokens intact
through query parameters; the ORM parser restores tuples and SQL bindings
accept decimal strings without a lossy Number conversion.

## Call order

Stacks model pagination takes `(perPage, page)`, the reverse of upstream
bun-query-builder: `Post.where('status', 'published').paginate(20, 2)`. With
no arguments it reads `?page` and `?per_page` from the request, defaults to 15
per page, and caps a query-string `per_page` at 100 (an explicit perPage is not
capped). `simplePaginate(perPage, page)` and
`cursorPaginate(perPage, cursor, columns, direction)` follow the same order.
The ORM paginator does not read the query builder's `pagination.defaultPerPage`.

## HTTP and UI

ORM request-aware pagination can derive page/limit and attach URLs from the
current request. CLI/queue callers provide explicit values. The router
serializes the canonical object. UI helpers buildPageSequence, paginatorVariant
and urlForPage live at @stacksjs/ui; the native Pagination component consumes
the view contract. Search-engine hits pagination remains a separate shape.

Evidence: core/orm/tests/{paginator,paginator-request,cursor-roundtrip}.test.ts,
core/router/tests/paginator-serialize.test.ts, and UI pagination helpers/tests.
Source: core/pagination/src/index.ts and orm paginator request adapters.
