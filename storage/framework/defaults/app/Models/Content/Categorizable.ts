import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

// The CMS catalogue already exists in categorizables. Commerce's Category
// model owns a different table and its IDs cannot be used by this pivot.
export default defineModel({
  name: 'Categorizable',
  table: 'categorizables',
  primaryKey: 'id',
  autoIncrement: true,
  ownership: false,
  traits: { useTimestamps: true },
  indexes: [
    { name: 'categorizables_type_slug_unique', columns: ['categorizable_type', 'slug'], unique: true },
    { name: 'categorizables_owner_slug_unique', columns: ['categorizable_type', 'categorizable_id', 'slug'], unique: true },
  ],
  // The inverse of Post.belongsToMany.categories, mirroring Tag.belongsToMany.posts.
  // It lives here because this model owns the ids `category_id` stores, and the
  // declaring model's table is what the generator references for `foreignKey`.
  belongsToMany: {
    posts: {
      model: 'Post',
      table: 'categorizable_models',
      foreignKey: 'category_id',
      relatedKey: 'categorizable_id',
      pivot: {
        columns: {
          categorizable_type: { default: 'posts' },
        },
        timestamps: true,
        uniques: [['category_id', 'categorizable_id', 'categorizable_type']],
      },
    },
  },
  attributes: {
    name: {
      required: true,
      fillable: true,
      validation: { rule: schema.string() },
    },
    slug: {
      required: true,
      fillable: true,
      validation: { rule: schema.string() },
    },
    description: {
      required: false,
      nullable: true,
      fillable: true,
      validation: { rule: schema.string() },
    },
    isActive: {
      required: true,
      fillable: true,
      default: true,
      validation: { rule: schema.boolean() },
    },
    categorizableId: {
      // Runtime trait-table setup adds this column to older catalogues.
      // Zero denotes a catalogue entry with no individual owner.
      type: 'integer',
      required: true,
      fillable: true,
      default: 0,
      validation: { rule: schema.number().integer().min(0) },
    },
    categorizableType: {
      required: true,
      fillable: true,
      validation: { rule: schema.string() },
    },
  },
} as const)
