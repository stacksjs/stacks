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

const Mission = defineModel({
  name: 'Mission',
  table: 'missions',
  dashboard: { access: false, enabled: true },
  belongsTo: [
    'Farm',
    'TreatmentMap',
    { model: 'User', foreignKey: 'owner_id' },
  ],
  hasMany: { observations: 'Observation' },
  hasOne: ['Report'],
  belongsToMany: { assignees: { model: 'User' } },
  hasManyThrough: { events: { through: 'Observation', target: 'Event' } },
  hasOneThrough: { summary: { through: 'Report', target: 'Summary' } },
  attributes: {
    name: { fillable: true, validation: { rule: schema.string() } },
  },
})

const RecordRelations = defineModel({
  name: 'RecordRelations',
  table: 'record_relations',
  belongsTo: {
    farm: 'Farm',
    owner: { model: 'User', foreignKey: 'created_by' },
  },
  attributes: {
    label: { fillable: true, validation: { rule: schema.string() } },
  },
})

const TraitModel = defineModel({
  name: 'TraitModel',
  table: 'trait_models',
  primaryKey: 'record_id',
  traits: {
    useUuid: true,
    useTimestamps: true,
    useSoftDeletes: true,
    useAuth: true,
    billable: true,
  },
  attributes: {
    label: { fillable: true, validation: { rule: schema.string() } },
  },
})

const AliasTraitModel = defineModel({
  name: 'AliasTraitModel',
  table: 'alias_trait_models',
  traits: {
    timestampable: { createdAt: 'created_at', updatedAt: 'updated_at' },
    softDeletable: {},
  },
  attributes: {
    label: { fillable: true, validation: { rule: schema.string() } },
  },
})

const ExplicitTraitCollision = defineModel({
  name: 'ExplicitTraitCollision',
  table: 'explicit_trait_collisions',
  traits: { useTimestamps: true },
  attributes: {
    created_at: { type: 'date', fillable: true },
    updated_at: { type: 'date', fillable: true, nullable: true },
  },
})

const Minimal = defineModel({
  name: 'Minimal',
  table: 'minimals',
  attributes: {
    value: { fillable: true, validation: { rule: schema.string() } },
  },
})

const Polymorphic = defineModel({
  name: 'Polymorphic',
  table: 'polymorphics',
  morphOne: { heroImage: 'Image' },
  morphMany: { attachments: 'Attachment' },
  morphToMany: ['Tag'],
  morphedByMany: ['Post'],
  attributes: {
    label: { fillable: true, validation: { rule: schema.string() } },
  },
})

type MissionRow = NonNullable<Awaited<ReturnType<typeof Mission.find>>>
type FarmFk = Expect<Equal<MissionRow['farm_id'], number>>
type MultiwordFk = Expect<Equal<MissionRow['treatment_map_id'], number>>
type CustomFk = Expect<Equal<MissionRow['owner_id'], number>>

type RecordRow = NonNullable<Awaited<ReturnType<typeof RecordRelations.find>>>
type RecordFarmFk = Expect<Equal<RecordRow['farm_id'], number>>
type RecordCustomFk = Expect<Equal<RecordRow['created_by'], number>>

type TraitRow = NonNullable<Awaited<ReturnType<typeof TraitModel.find>>>
type CustomPrimaryKey = Expect<Equal<TraitRow['record_id'], number>>
type Uuid = Expect<Equal<TraitRow['uuid'], string>>
type CreatedAt = Expect<Equal<TraitRow['created_at'], string>>
type UpdatedAt = Expect<Equal<TraitRow['updated_at'], string | null>>
type DeletedAt = Expect<Equal<TraitRow['deleted_at'], string | null>>
type TwoFactorSecret = Expect<Equal<TraitRow['two_factor_secret'], string | null>>
type PublicKey = Expect<Equal<TraitRow['public_key'], string | null>>
type StripeId = Expect<Equal<TraitRow['stripe_id'], string | null>>

type AliasRow = NonNullable<Awaited<ReturnType<typeof AliasTraitModel.find>>>
type AliasCreatedAt = Expect<Equal<AliasRow['created_at'], string>>
type AliasUpdatedAt = Expect<Equal<AliasRow['updated_at'], string | null>>
type AliasDeletedAt = Expect<Equal<AliasRow['deleted_at'], string | null>>

type CollisionRow = NonNullable<Awaited<ReturnType<typeof ExplicitTraitCollision.find>>>
type ExplicitCreatedAtWins = Expect<Equal<CollisionRow['created_at'], Date>>
type ExplicitUpdatedAtWins = Expect<Equal<CollisionRow['updated_at'], Date | null>>

Mission.where('farm_id', 1)
Mission.where('treatment_map_id', 2)
Mission.where('owner_id', 3)
RecordRelations.where('created_by', 4)
TraitModel.where('record_id', 1)
TraitModel.where('uuid', 'uuid')
TraitModel.whereNull('deleted_at')
AliasTraitModel.whereNotNull('created_at')

Mission.with(
  'farm',
  'treatmentmap',
  'user',
  'observations',
  'report',
  'assignees',
  'events',
  'summary',
)

Polymorphic.with('heroImage', 'attachments', 'tag', 'post')

// @ts-expect-error belongsTo foreign keys are numeric
Mission.where('owner_id', '3')
// @ts-expect-error a custom primary key replaces id in the column union
TraitModel.where('id', 1)
// @ts-expect-error no undeclared relation names
Mission.with('comments')
// @ts-expect-error array relation names are lowercased
Mission.with('Farm')
// @ts-expect-error models without UUID traits do not expose uuid
Minimal.where('uuid', 'uuid')
// @ts-expect-error models without timestamp traits do not expose created_at
Minimal.where('created_at', 'now')
// @ts-expect-error models without soft deletes do not expose deleted_at
Minimal.whereNull('deleted_at')
// @ts-expect-error polymorphic relation names are derived from declarations
Polymorphic.with('image')

async function polymorphicCardinalityContracts(): Promise<void> {
  const model = await Polymorphic.with('heroImage', 'attachments', 'tag', 'post').firstOrFail()

  const heroImage = model.getRelation('heroImage')
  if (heroImage) {
    // @ts-expect-error morphOne is to-one
    heroImage.length
  }

  const attachments = model.getRelation('attachments')
  if (attachments) {
    const count: number = attachments.length
    void count
  }

  const tags = model.getRelation('tag')
  if (tags) {
    const count: number = tags.length
    void count
  }

  const posts = model.getRelation('post')
  if (posts) {
    const count: number = posts.length
    void count
  }
}

async function relationCardinalityContracts(): Promise<void> {
  const mission = await Mission.with(
    'farm',
    'observations',
    'report',
    'assignees',
    'events',
    'summary',
  ).firstOrFail()

  const farm = mission.getRelation('farm')
  if (farm) {
    // @ts-expect-error belongsTo is to-one
    farm.length
  }

  const observations = mission.getRelation('observations')
  if (observations) {
    const count: number = observations.length
    void count
  }

  const report = mission.getRelation('report')
  if (report) {
    // @ts-expect-error hasOne is to-one
    report.length
  }

  const assignees = mission.getRelation('assignees')
  if (assignees) {
    const count: number = assignees.length
    void count
  }

  const events = mission.getRelation('events')
  if (events) {
    const count: number = events.length
    void count
  }

  const summary = mission.getRelation('summary')
  if (summary) {
    // @ts-expect-error hasOneThrough is to-one
    summary.length
  }

  // @ts-expect-error only declared relations can be accessed
  mission.getRelation('missing')
}

void (0 as unknown as FarmFk)
void (0 as unknown as MultiwordFk)
void (0 as unknown as CustomFk)
void (0 as unknown as RecordFarmFk)
void (0 as unknown as RecordCustomFk)
void (0 as unknown as CustomPrimaryKey)
void (0 as unknown as Uuid)
void (0 as unknown as CreatedAt)
void (0 as unknown as UpdatedAt)
void (0 as unknown as DeletedAt)
void (0 as unknown as TwoFactorSecret)
void (0 as unknown as PublicKey)
void (0 as unknown as StripeId)
void (0 as unknown as AliasCreatedAt)
void (0 as unknown as AliasUpdatedAt)
void (0 as unknown as AliasDeletedAt)
void (0 as unknown as ExplicitCreatedAtWins)
void (0 as unknown as ExplicitUpdatedAtWins)
void relationCardinalityContracts
void polymorphicCardinalityContracts

const DisabledSoftDelete = defineModel({
  name: 'DisabledSoftDelete',
  table: 'disabled_soft_deletes',
  traits: { useSoftDeletes: false, softDeletable: false },
  attributes: { label: { type: 'string', fillable: true } },
})
const ObjectSoftDelete = defineModel({
  name: 'ObjectSoftDelete',
  table: 'object_soft_deletes',
  traits: { useSoftDeletes: { cascade: [] } },
  attributes: { label: { type: 'string', fillable: true } },
})
const FallbackSoftDeleteAlias = defineModel({
  name: 'FallbackSoftDeleteAlias',
  table: 'fallback_soft_delete_aliases',
  traits: { useSoftDeletes: false, softDeletable: true },
  attributes: { label: { type: 'string', fillable: true } },
})

function softDeleteStaticContracts() {
  const ordinaryPurge = Minimal.forceDelete(1)
  const deleted: Promise<boolean> = TraitModel.softDelete(1)
  const restored: Promise<boolean> = TraitModel.restore('1')
  const purged: Promise<boolean> = TraitModel.forceDelete(1)
  const objectRestored: Promise<boolean> = ObjectSoftDelete.restore(1)
  const aliasRestored: Promise<boolean> = AliasTraitModel.restore(1)
  const fallbackRestored: Promise<boolean> = FallbackSoftDeleteAlias.restore(1)
  // @ts-expect-error static restore accepts an ID, not a row object
  TraitModel.restore({ id: 1 })
  // @ts-expect-error static force-delete requires an ID
  TraitModel.forceDelete()
  // @ts-expect-error a disabled trait supplies no restore static
  DisabledSoftDelete.restore(1)
  // @ts-expect-error a model without the trait supplies no restore static
  Minimal.restore(1)
  void [ordinaryPurge, deleted, restored, purged, objectRestored, aliasRestored, fallbackRestored]
}
void softDeleteStaticContracts

type RestoreReturnIsBoolean = Expect<Equal<ReturnType<typeof TraitModel.restore>, Promise<boolean>>>
type RestoreIdIsScalar = Expect<Equal<Parameters<typeof TraitModel.restore>[0], number | string>>
type AliasRestoreReturnIsBoolean = Expect<Equal<ReturnType<typeof AliasTraitModel.restore>, Promise<boolean>>>
void (0 as unknown as RestoreReturnIsBoolean)
void (0 as unknown as RestoreIdIsScalar)
void (0 as unknown as AliasRestoreReturnIsBoolean)
