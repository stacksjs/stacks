import type { Infer } from '@stacksjs/ts-validation'
import { schema } from '../src'

type Equal<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends
  (<T>() => T extends TRight ? 1 : 2)
    ? true
    : false
type Expect<T extends true> = T

const status = schema.enum(['draft', 'published', 'archived'])
type Status = Infer<typeof status>
type StatusIsLiteralUnion = Expect<Equal<Status, 'draft' | 'published' | 'archived'>>

const tags = schema.array().each(schema.string())
type Tags = Infer<typeof tags>
type TagsAreStrings = Expect<Equal<Tags, string[]>>

const post = schema.object({
  title: schema.string(),
  views: schema.number(),
  published: schema.boolean(),
  status,
  tags,
})
type Post = Infer<typeof post>
type PostIsInferred = Expect<Equal<Post, {
  title: string
  views: number
  published: boolean
  status: 'draft' | 'published' | 'archived'
  tags: string[]
}>>

status.test('draft')
tags.test(['typed'])
post.test({ title: 'Typed', views: 1, published: true, status: 'published', tags: [] })

// @ts-expect-error enum validators reject values outside their literal list
status.test('deleted')
// @ts-expect-error array element types are inferred from each()
tags.test([123])
// @ts-expect-error object properties retain their validator output types
post.test({ title: 'Typed', views: '1', published: true, status: 'draft', tags: [] })

void (0 as unknown as StatusIsLiteralUnion)
void (0 as unknown as TagsAreStrings)
void (0 as unknown as PostIsInferred)
