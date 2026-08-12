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

const TypedRecord = defineModel({
  name: 'TypedRecord',
  table: 'typed_records',
  attributes: {
    explicitString: { type: 'string', fillable: true },
    explicitNumber: { type: 'number', fillable: true },
    explicitBoolean: { type: 'boolean', fillable: true },
    explicitDate: { type: 'date', fillable: true },
    explicitJson: { type: 'json', fillable: true },
    inferredString: {
      fillable: true,
      validation: { rule: schema.string() },
    },
    inferredNumber: {
      fillable: true,
      validation: { rule: schema.number() },
    },
    inferredBoolean: {
      fillable: true,
      validation: { rule: schema.boolean() },
    },
    inferredStatus: {
      fillable: true,
      validation: { rule: schema.enum(['draft', 'published', 'archived']) },
    },
    inferredTags: {
      fillable: true,
      validation: { rule: schema.array().each(schema.string()) },
    },
    defaultString: { fillable: true, default: 'pending' },
    defaultNumber: { fillable: true, default: 0 },
    defaultBoolean: { fillable: true, default: false },
    factoryString: { fillable: true, factory: () => 'generated' },
    factoryObject: { fillable: true, factory: () => ({ source: 'factory' }) },
    nullableText: {
      fillable: true,
      nullable: true,
      validation: { rule: schema.string() },
    },
    validationWithFactory: {
      fillable: true,
      validation: { rule: schema.string() },
      factory: () => 42,
    },
    unknownValue: { fillable: true },
  },
})

type Row = NonNullable<Awaited<ReturnType<typeof TypedRecord.find>>>

type ExplicitString = Expect<Equal<Row['explicitString'], string>>
type SnakeCaseAlias = Expect<Equal<Row['explicit_string'], string>>
type ExplicitNumber = Expect<Equal<Row['explicitNumber'], number>>
type ExplicitBoolean = Expect<Equal<Row['explicitBoolean'], boolean>>
type ExplicitDate = Expect<Equal<Row['explicitDate'], Date>>
type ExplicitJson = Expect<Equal<Row['explicitJson'], Record<string, unknown>>>
type InferredString = Expect<Equal<Row['inferredString'], string>>
type InferredNumber = Expect<Equal<Row['inferredNumber'], number>>
type InferredBoolean = Expect<Equal<Row['inferredBoolean'], boolean>>
type InferredEnum = Expect<Equal<Row['inferredStatus'], 'draft' | 'published' | 'archived'>>
type InferredArray = Expect<Equal<Row['inferredTags'], string[]>>
type DefaultString = Expect<Equal<Row['defaultString'], string>>
type DefaultNumber = Expect<Equal<Row['defaultNumber'], number>>
type DefaultBoolean = Expect<Equal<Row['defaultBoolean'], boolean>>
type FactoryString = Expect<Equal<Row['factoryString'], string>>
type FactoryObject = Expect<Equal<Row['factoryObject'], { source: string }>>
type NullableText = Expect<Equal<Row['nullableText'], string | null>>
type FactoryPrecedence = Expect<Equal<Row['validationWithFactory'], number>>
type UnknownStaysSafe = Expect<Equal<Row['unknownValue'], unknown>>

type NoAnyExplicit = Expect<Equal<IsAny<Row['explicitString']>, false>>
type NoAnyValidator = Expect<Equal<IsAny<Row['inferredStatus']>, false>>
type NoAnyFactory = Expect<Equal<IsAny<Row['factoryObject']>, false>>
type NoAnyUnknown = Expect<Equal<IsAny<Row['unknownValue']>, false>>

TypedRecord.where('explicitString', 'value')
TypedRecord.where('explicit_string', 'value')
TypedRecord.where('explicitNumber', 1)
TypedRecord.where('inferredBoolean', true)
TypedRecord.where('inferredStatus', 'published')
TypedRecord.where('inferredTags', ['typed'])
TypedRecord.where('nullableText', null)

// @ts-expect-error explicit model tokens control query values
TypedRecord.where('explicitNumber', '1')
// @ts-expect-error validator output controls query values
TypedRecord.where('inferredBoolean', 1)
// @ts-expect-error enum values remain literal through defineModel
TypedRecord.where('inferredStatus', 'deleted')
// @ts-expect-error array element types remain inferred
TypedRecord.where('inferredTags', [123])

void (0 as unknown as ExplicitString)
void (0 as unknown as SnakeCaseAlias)
void (0 as unknown as ExplicitNumber)
void (0 as unknown as ExplicitBoolean)
void (0 as unknown as ExplicitDate)
void (0 as unknown as ExplicitJson)
void (0 as unknown as InferredString)
void (0 as unknown as InferredNumber)
void (0 as unknown as InferredBoolean)
void (0 as unknown as InferredEnum)
void (0 as unknown as InferredArray)
void (0 as unknown as DefaultString)
void (0 as unknown as DefaultNumber)
void (0 as unknown as DefaultBoolean)
void (0 as unknown as FactoryString)
void (0 as unknown as FactoryObject)
void (0 as unknown as NullableText)
void (0 as unknown as FactoryPrecedence)
void (0 as unknown as UnknownStaysSafe)
void (0 as unknown as NoAnyExplicit)
void (0 as unknown as NoAnyValidator)
void (0 as unknown as NoAnyFactory)
void (0 as unknown as NoAnyUnknown)
