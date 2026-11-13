// eslint-disable-next-line pickier/no-import-dist
import { schema } from '../../validation/dist'
// eslint-disable-next-line pickier/no-import-dist
import { defineModel } from '../dist/define-model'
// eslint-disable-next-line pickier/no-import-dist
import type { ModelWritesWait } from '../dist/define-model'

type Equal<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends
  (<T>() => T extends TRight ? 1 : 2)
    ? true
    : false
type Expect<T extends true> = T
type IsAny<T> = 0 extends (1 & T) ? true : false

const Article = defineModel({
  name: 'Article',
  table: 'articles',
  traits: { useTimestamps: true },
  attributes: {
    title: { fillable: true, validation: { rule: schema.string() } },
    views: { fillable: true, validation: { rule: schema.number() } },
    rating: { fillable: true, nullable: true, validation: { rule: schema.number() } },
    published: { fillable: true, validation: { rule: schema.boolean() } },
    status: { fillable: true, validation: { rule: schema.enum(['draft', 'published']) } },
  },
})

Article.where('title', 'Typed')
Article.where('views', '>=', 10)
Article.orWhere('published', true)
Article.whereIn('status', ['draft', 'published'])
Article.whereNotIn('views', [0, 1])
Article.whereBetween('views', [1, 10])
Article.whereNotBetween('rating', [1, null])
Article.whereNull('rating')
Article.whereNotNull('title')
Article.whereLike('title', '%typed%')
Article.whereTitle('Typed')
Article.whereViews(10)
Article.orderBy('views', 'desc')
Article.orderByDesc('created_at')
Article.latest('created_at')
Article.oldest('views')

Article.query()
  .where('status', 'published')
  .orWhere('views', '>', 100)
  .whereIn('views', [100, 200])
  .whereBetween('rating', [4, 5])
  .orderByAsc('title')
  .take(10)
  .skip(5)

// @ts-expect-error unknown columns never enter a query
Article.where('missing', 'value')
// @ts-expect-error operators are a closed literal union
Article.where('views', 'contains', 1)
// @ts-expect-error where values follow the selected column
Article.where('views', 'many')
// @ts-expect-error whereIn values follow the selected column
Article.whereIn('status', ['archived'])
// @ts-expect-error ranges follow the selected column
Article.whereBetween('views', [1, '10'])
// @ts-expect-error dynamic where methods retain value types
Article.wherePublished(1)
// @ts-expect-error ordering is constrained to model columns
Article.orderBy('missing')

async function queryResultContracts(): Promise<void> {
  const found = await Article.find(1)
  if (found) {
    const title: string = found.title
    const views: number = found.get('views')
    const rating: number | null = found.rating
    const id: number = found.id
    void [title, views, rating, id]

    found.set('status', 'published')
    found.set('rating', null)
    // @ts-expect-error instance setters retain enum literals
    found.set('status', 'archived')
    // @ts-expect-error instance getters reject unknown columns
    found.get('missing')
  }

  const required = await Article.findOrFail('article-id')
  const requiredTitle: string = required.title

  const many = await Article.findMany([1, '2'])
  const all = await Article.all()
  const first = await Article.first()
  const last = await Article.last()
  const sole = await Article.query().sole()
  const rows = await Article.where('published', true).get()

  const manyTitle: string = many[0]!.title
  const allViews: number = all[0]!.views
  const firstTitle: string | undefined = first?.title
  const lastTitle: string | undefined = last?.title
  const soleStatus: 'draft' | 'published' = sole.status
  const rowPublished: boolean = rows[0]!.published

  const projected = await Article.select('title', 'status').firstOrFail()
  const projectedTitle: string = projected.title
  const projectedStatus: 'draft' | 'published' = projected.get('status')
  // @ts-expect-error unselected proxy properties are absent
  projected.views
  // @ts-expect-error unselected columns cannot be read through get
  projected.get('published')

  const chainedProjection = await Article.where('published', true).select('views').first()
  const chainedViews: number | undefined = chainedProjection?.views
  // @ts-expect-error selected queries remain narrowed through chaining
  chainedProjection?.title

  const titles: string[] = await Article.pluck('title')
  const ratings: (number | null)[] = await Article.where('published', true).pluck('rating')
  const maxTitle: string | null = await Article.max('title')
  const minViews: number | null = await Article.min('views')
  const average: number = await Article.avg('views')
  const total: number = await Article.sum('rating')
  const count: number = await Article.count()
  const exists: boolean = await Article.exists()
  const doesntExist: boolean = await Article.where('views', 0).doesntExist()

  // @ts-expect-error avg only accepts numeric columns
  await Article.avg('title')
  // @ts-expect-error sum only accepts numeric columns
  await Article.sum('status')

  const page = await Article.paginate(25, 2)
  const pageTitle: string = page.data[0]!.title
  const totalRows: number = page.total
  const hasMore: boolean = page.has_more_pages

  const builderPage = await Article.where('status', 'draft').paginate(2, 25)
  const builderPageTitle: string = builderPage.data[0]!.get('title')

  const noAny = null as unknown as IsAny<typeof required.title>
  const noAnyCheck: false = noAny

  void [
    requiredTitle,
    manyTitle,
    allViews,
    firstTitle,
    lastTitle,
    soleStatus,
    rowPublished,
    projectedTitle,
    projectedStatus,
    chainedViews,
    titles,
    ratings,
    maxTitle,
    minViews,
    average,
    total,
    count,
    exists,
    doesntExist,
    pageTitle,
    totalRows,
    hasMore,
    builderPageTitle,
    noAnyCheck,
  ]
}

type QueryContractReturnsVoid = Expect<Equal<ReturnType<typeof queryResultContracts>, Promise<void>>>

// A read answers where it is written, so the un-awaited form is typed as the
// awaited one is.
function readsAnswerInPlace(): void {
  const user = Article.where('title', 'like', '%typed%').orderByDesc('created_at').first()
  const title: string | undefined = user?.title
  const required: string = Article.findOrFail(1).title
  const count: number = Article.count()
  const exists: boolean = Article.where('published', true).exists()
  const titles: string[] = Article.all().map(article => article.title)
  const page = Article.paginate(10)
  const firstOnPage: string | undefined = page.data[0]?.title
  const total: number = page.total
  // @ts-expect-error a read is the value, not a promise of it
  Article.count().then(() => {})
  void [title, required, count, exists, titles, firstOnPage, total]
}

type ReadsAnswerInPlaceReturnsVoid = Expect<Equal<ReturnType<typeof readsAnswerInPlace>, void>>
type CountIsANumber = Expect<Equal<ReturnType<typeof Article.count>, number>>

// A write answers in place as well, on a model that declares nothing to wait
// for. `Article` declares timestamps only.
function writesAnswerInPlace(): void {
  const created = Article.create({ title: 'Typed', views: 1, published: true, status: 'draft' })
  const createdTitle: string = created.title
  const updated = Article.update(1, { views: 2 })
  const updatedViews: number | undefined = updated?.views
  const deleted: boolean = Article.delete(1)
  const saved = created.save()
  const savedTitle: string = saved.title
  // @ts-expect-error a write on this model is the row, not a promise of it
  Article.create({ title: 'Typed', views: 1, published: true, status: 'draft' }).then(() => {})
  void [createdTitle, updatedViews, deleted, savedTitle]
}

type WritesAnswerInPlaceReturnsVoid = Expect<Equal<ReturnType<typeof writesAnswerInPlace>, void>>
type ArticleWritesDoNotWait = Expect<Equal<ModelWritesWait<typeof Article>, false>>

// A model that declares work its writes have to wait for returns a promise
// from every one of them: a soft delete, an audit or activity trail, a setter
// or a hook that is `async`.
const Archived = defineModel({
  name: 'ArchivedArticle',
  table: 'archived_articles',
  traits: { useSoftDeletes: true },
  attributes: { title: { fillable: true, validation: { rule: schema.string() } } },
})
const Hashed = defineModel({
  name: 'HashedArticle',
  table: 'hashed_articles',
  attributes: { title: { fillable: true, validation: { rule: schema.string() } } },
  set: { title: async (attributes: Record<string, unknown>) => String(attributes.title).trim() },
})
// Lifecycle events, the search index and a setter that answers in place are
// not that: the events are heard in place and the index is updated after.
const Observed = defineModel({
  name: 'ObservedArticle',
  table: 'observed_articles',
  traits: { observe: true, useSearch: { searchable: ['title'] } },
  attributes: { title: { fillable: true, validation: { rule: schema.string() } } },
  set: { title: (attributes: Record<string, unknown>) => String(attributes.title).trim() },
})

async function writesThatWait(): Promise<void> {
  const created = await Archived.create({ title: 'Typed' })
  const title: string = created.title
  const found = Archived.find(1)
  const readTitle: string | undefined = found?.title
  // @ts-expect-error a write on a model with soft deletes is a promise: the row is not here yet
  Archived.create({ title: 'Typed' }).title
  void [title, readTitle]
}

function observedWritesAnswerInPlace(): void {
  const title: string = Observed.create({ title: 'Typed' }).title
  void title
}

type WritesThatWaitReturnsPromise = Expect<Equal<ReturnType<typeof writesThatWait>, Promise<void>>>
type ObservedWritesAnswerInPlaceReturnsVoid = Expect<Equal<ReturnType<typeof observedWritesAnswerInPlace>, void>>
type SoftDeleteWritesWait = Expect<Equal<ModelWritesWait<typeof Archived>, true>>
type SetterWritesWait = Expect<Equal<ModelWritesWait<typeof Hashed>, true>>
type ObservedWritesDoNotWait = Expect<Equal<ModelWritesWait<typeof Observed>, false>>
type SoftDeleteCreateIsAPromise = Expect<ReturnType<typeof Archived.create> extends Promise<unknown> ? true : false>
type SoftDeleteUpdateIsAPromise = Expect<ReturnType<typeof Archived.update> extends Promise<unknown> ? true : false>
type SoftDeleteDeleteIsAPromise = Expect<Equal<ReturnType<typeof Archived.delete>, Promise<boolean>>>
type SoftDeleteSaveIsAPromise = Expect<ReturnType<NonNullable<ReturnType<typeof Archived.find>>['save']> extends Promise<unknown> ? true : false>
type SetterCreateIsAPromise = Expect<ReturnType<typeof Hashed.create> extends Promise<unknown> ? true : false>
type ObservedDeleteIsABoolean = Expect<Equal<ReturnType<typeof Observed.delete>, boolean>>
// Reads never wait, whatever the model declares.
type SoftDeleteCountIsANumber = Expect<Equal<ReturnType<typeof Archived.count>, number>>

void (0 as unknown as QueryContractReturnsVoid)
