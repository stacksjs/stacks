import type {
  InferColumnNames,
  InferFillableAttributes,
  InferNumericColumns,
  ModelCreateData,
  ModelRow,
  ModelRowLoose,
  NewModelData,
  UpdateModelData,
// eslint-disable-next-line pickier/no-import-dist
} from '../dist/model-types'
// eslint-disable-next-line pickier/no-import-dist
import { schema } from '../../validation/dist'
// eslint-disable-next-line pickier/no-import-dist
import { defineModel } from '../dist/define-model'

type Equal<TLeft, TRight> = [TLeft] extends [TRight]
  ? [TRight] extends [TLeft] ? true : false
  : false
type Expect<T extends true> = T
type IsAny<T> = 0 extends (1 & T) ? true : false

const Account = defineModel({
  name: 'Account',
  table: 'accounts',
  traits: { useTimestamps: true },
  belongsTo: [
    'Team',
    { model: 'User', foreignKey: 'invited_by' },
  ],
  attributes: {
    email: {
      fillable: true,
      validation: { rule: schema.string() },
    },
    role: {
      fillable: true,
      default: 'member',
      validation: { rule: schema.enum(['member', 'admin']) },
    },
    nickname: {
      fillable: true,
      nullable: true,
      validation: { rule: schema.string() },
    },
    score: {
      fillable: true,
      validation: { rule: schema.number() },
    },
    secret: {
      guarded: true,
      validation: { rule: schema.string() },
    },
    computedLabel: {
      validation: { rule: schema.string() },
    },
  },
})

type Row = ModelRow<typeof Account>
type LooseRow = ModelRowLoose<typeof Account>
type NewData = NewModelData<typeof Account>
type CreateData = ModelCreateData<typeof Account>
type UpdateData = UpdateModelData<typeof Account>
type Fillable = InferFillableAttributes<typeof Account>
type Columns = InferColumnNames<typeof Account>
type NumericColumns = InferNumericColumns<typeof Account>

type RowEmail = Expect<Equal<Row['email'], string>>
type RowRole = Expect<Equal<Row['role'], 'member' | 'admin'>>
type RowNickname = Expect<Equal<Row['nickname'], string | null>>
type RowTeamFk = Expect<Equal<Row['team_id'], number>>
type RowCustomFk = Expect<Equal<Row['invited_by'], number>>
type RowIsNotAny = Expect<Equal<IsAny<Row>, false>>
type LooseFieldsOptional = Expect<Equal<LooseRow['email'], string | undefined>>
type NewFieldsOptional = Expect<Equal<NewData['email'], string | undefined>>
type UpdateFieldsOptional = Expect<Equal<UpdateData['score'], number | undefined>>
type CreateEmail = Expect<Equal<CreateData['email'], string | undefined>>
type CreateRole = Expect<Equal<CreateData['role'], 'member' | 'admin' | undefined>>
type CreateTeamFk = Expect<Equal<CreateData['team_id'], number | undefined>>
type CreateCustomFk = Expect<Equal<CreateData['invited_by'], number | undefined>>
type FillableKeys = Expect<Equal<keyof Fillable, 'email' | 'role' | 'nickname' | 'score'>>
type FillableEmail = Expect<Equal<Fillable['email'], string>>
type FillableRole = Expect<Equal<Fillable['role'], 'member' | 'admin' | undefined>>
type FillableNickname = Expect<Equal<Fillable['nickname'], string | null | undefined>>
type FillableScore = Expect<Equal<Fillable['score'], number>>
type ColumnUnion = Expect<Equal<
  Columns,
  'id' | 'email' | 'role' | 'nickname' | 'score' | 'secret' | 'computedLabel' | 'computed_label'
  | 'team_id' | 'invited_by' | 'created_at' | 'updated_at'
>>
type NumericColumnUnion = Expect<Equal<NumericColumns, 'score'>>

const row: Row = {
  id: 1,
  email: 'typed@example.com',
  role: 'member',
  nickname: null,
  score: 10,
  secret: 'protected',
  computedLabel: 'Typed',
  computed_label: 'Typed',
  team_id: 1,
  invited_by: 2,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: null,
}

const rowEmail: string = row.email
const rowRole: 'member' | 'admin' = row.role
const rowNickname: string | null = row.nickname

const createData: CreateData = {
  email: 'typed@example.com',
  role: 'admin',
  nickname: null,
  score: 10,
  team_id: 1,
  invited_by: 2,
}

const newData: NewData = { secret: 'allowed in loose data' }
const updateData: UpdateData = { computedLabel: 'updated' }

Account.create({ email: 'typed@example.com', score: 10, team_id: 1, invited_by: 2 })
Account.createMany([{ email: 'one@example.com', score: 1 }])
Account.firstOrCreate({ email: 'typed@example.com' }, { score: 10 })
Account.updateOrCreate({ email: 'typed@example.com' }, { role: 'admin' })
Account.update(1, { email: 'updated@example.com' })
Account.forceCreate({ email: 'forced@example.com', score: 1 })
Account.forceUpdate(1, { score: 2 })
Account.forceCreate({ secret: 'allowed', team_id: 1, invited_by: 2 })
Account.forceUpdate(1, { secret: 'allowed', team_id: 1, invited_by: 2 })
Account.forceCreate({ secret: 'allowed', computedLabel: 'forced' })
Account.forceUpdate(1, { secret: 'allowed', computedLabel: 'forced' })

// @ts-expect-error create values follow validator output
Account.create({ email: 'typed@example.com', score: '10' })
// @ts-expect-error enum defaults do not widen the validator literal union
Account.create({ email: 'typed@example.com', score: 10, role: 'owner' })
// @ts-expect-error nullable fields admit null, not unrelated values
Account.create({ email: 'typed@example.com', score: 10, nickname: 123 })
// @ts-expect-error guarded fields are not mass assignable
Account.create({ email: 'typed@example.com', score: 10, secret: 'nope' })
// @ts-expect-error non-fillable fields are not mass assignable
Account.create({ email: 'typed@example.com', score: 10, computedLabel: 'nope' })
// @ts-expect-error update values follow validator output
Account.update(1, { score: '2' })
// @ts-expect-error utility create data excludes guarded fields
const invalidCreateData: CreateData = { secret: 'nope' }
// @ts-expect-error row types reject missing system and model fields
const incompleteRow: Row = { id: 1, email: 'missing fields' }

void row
void rowEmail
void rowRole
void rowNickname
void createData
void newData
void updateData
void invalidCreateData
void incompleteRow
void (0 as unknown as RowEmail)
void (0 as unknown as RowRole)
void (0 as unknown as RowNickname)
void (0 as unknown as RowTeamFk)
void (0 as unknown as RowCustomFk)
void (0 as unknown as RowIsNotAny)
void (0 as unknown as LooseFieldsOptional)
void (0 as unknown as NewFieldsOptional)
void (0 as unknown as UpdateFieldsOptional)
void (0 as unknown as CreateEmail)
void (0 as unknown as CreateRole)
void (0 as unknown as CreateTeamFk)
void (0 as unknown as CreateCustomFk)
void (0 as unknown as FillableKeys)
void (0 as unknown as FillableEmail)
void (0 as unknown as FillableRole)
void (0 as unknown as FillableNickname)
void (0 as unknown as FillableScore)
void (0 as unknown as ColumnUnion)
void (0 as unknown as NumericColumnUnion)

/**
 * `required: false` is the flag that emits a nullable column, so the inferred
 * value type has to admit null as well. Declared `as const`, the way generated
 * and hand-written app models are, so `required` stays the literal `false`.
 */
const Reading = defineModel({
  name: 'Reading',
  table: 'readings',
  attributes: {
    label: { fillable: true, required: true, validation: { rule: schema.string() } },
    // A seed factory returns a real timestamp; the column is still nullable.
    observedAt: { fillable: true, required: false, validation: { rule: schema.timestamp() }, factory: () => new Date().toISOString() },
  },
} as const)

type ReadingRow = ModelRow<typeof Reading>
type OptionalIsNullable = Expect<Equal<ReadingRow['observedAt'], string | null>>
type RequiredStaysNonNull = Expect<Equal<ReadingRow['label'], string>>

Reading.create({ label: 'ph', observedAt: null })
Reading.update(1, { observedAt: null })
Reading.forceUpdate(1, { observedAt: null })
Reading.update(1, { observedAt: '2026-01-01T00:00:00.000Z' })

// @ts-expect-error a required column still rejects null
Reading.update(1, { label: null })

void (0 as unknown as OptionalIsNullable)
void (0 as unknown as RequiredStaysNonNull)
