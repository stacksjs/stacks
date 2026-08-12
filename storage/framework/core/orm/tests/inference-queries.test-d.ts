// eslint-disable-next-line pickier/no-import-dist
import { schema } from '../../validation/dist'
// eslint-disable-next-line pickier/no-import-dist
import { defineModel } from '../dist/define-model'

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

  const page = await Article.paginate(2, 25)
  const pageTitle: string = page.data[0]!.title
  const totalRows: number = page.total
  const hasMore: boolean = page.hasMorePages

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
void (0 as unknown as QueryContractReturnsVoid)
