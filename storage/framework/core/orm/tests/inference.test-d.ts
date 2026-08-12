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

const Post = defineModel({
  name: 'Post',
  table: 'posts',
  traits: {
    useTimestamps: true,
    useUuid: true,
  },
  attributes: {
    title: {
      fillable: true,
      validation: { rule: schema.string() },
    },
    status: {
      fillable: true,
      validation: { rule: schema.enum(['draft', 'published']) },
    },
    views: {
      fillable: true,
      default: 0,
    },
    featured: {
      fillable: true,
      factory: faker => faker.datatype.boolean(),
    },
  },
})

type PostResult = NonNullable<Awaited<ReturnType<typeof Post.find>>>
type TitleIsString = Expect<Equal<PostResult['title'], string>>
type StatusIsLiteralUnion = Expect<Equal<PostResult['status'], 'draft' | 'published'>>
type ViewsAreNumeric = Expect<Equal<PostResult['views'], number>>
type FeaturedIsBoolean = Expect<Equal<PostResult['featured'], boolean>>
type CreatedAtIsString = Expect<Equal<PostResult['created_at'], string>>
type UpdatedAtIsNullableString = Expect<Equal<PostResult['updated_at'], string | null>>
type UuidIsString = Expect<Equal<PostResult['uuid'], string>>

declare const result: PostResult
const inferredTitle: string = result.title
const inferredStatus: 'draft' | 'published' = result.status
const inferredViews: number = result.views
const inferredFeatured: boolean = result.featured
const inferredCreatedAt: string = result.created_at
const inferredUpdatedAt: string | null = result.updated_at
const inferredUuid: string = result.uuid

Post.where('title', 'Typed')
Post.where('status', 'published')
Post.where('views', '>=', 1)
Post.create({ title: 'Typed', status: 'draft', views: 1, featured: true })

// @ts-expect-error query values follow the inferred validator output
Post.where('title', 123)
// @ts-expect-error enum values remain a literal union through the ORM
Post.where('status', 'deleted')
// @ts-expect-error create data follows inferred numeric defaults
Post.create({ title: 'Typed', status: 'draft', views: '1', featured: true })

void (0 as unknown as TitleIsString)
void (0 as unknown as StatusIsLiteralUnion)
void (0 as unknown as ViewsAreNumeric)
void (0 as unknown as FeaturedIsBoolean)
void (0 as unknown as CreatedAtIsString)
void (0 as unknown as UpdatedAtIsNullableString)
void (0 as unknown as UuidIsString)
void inferredTitle
void inferredStatus
void inferredViews
void inferredFeatured
void inferredCreatedAt
void inferredUpdatedAt
void inferredUuid
