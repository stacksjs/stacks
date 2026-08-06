import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

const tagNames = [
  'javascript',
  'typescript',
  'stx',
  'react',
  'nodejs',
  'database',
  'performance',
  'security',
  'api',
  'testing',
  'devops',
  'cloud',
  'frontend',
  'backend',
  'mobile',
]

export default defineModel({
  name: 'Tag',
  table: 'tags',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: tagNames.length,
      fixtures: tagNames.map(name => ({ name, slug: name })),
    },
    useApi: {
      // Public catalog: anyone may browse, only authenticated callers may
      // write. Declared explicitly because the trait now defaults BOTH sides to
      // `auth` — an undeclared read route is how a customer list leaks
      // (stacksjs/stacks#2224). Behaviour here is unchanged.
      middleware: { read: [], write: ['auth'] },
      uri: 'tags',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsToMany: {
    posts: {
      model: 'Post',
      table: 'taggable_models',
      foreignKey: 'tag_id',
      relatedKey: 'taggable_id',
      pivot: {
        columns: {
          taggable_type: { default: 'posts' },
        },
        timestamps: true,
        uniques: [['tag_id', 'taggable_id', 'taggable_type']],
      },
    },
  },

  attributes: {
    name: {
      required: true,
      unique: true,
      fillable: true,
      validation: {
        rule: schema.string().min(2).max(50),
        message: {
          min: 'Tag name must have at least 2 characters',
          max: 'Tag name must have at most 50 characters',
        },
      },
      factory: faker => `tag-${faker.string.alphanumeric(12).toLowerCase()}`,
    },

    slug: {
      required: true,
      unique: true,
      fillable: true,
      validation: {
        rule: schema.string().min(2).max(50),
      },
      factory: faker => `tag-${faker.string.alphanumeric(12).toLowerCase()}`,
    },

    description: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.lorem.sentence(),
    },

    color: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(20),
      },
      factory: faker => faker.helpers.arrayElement(['blue', 'green', 'red', 'purple', 'yellow', 'orange', 'pink', 'gray']),
    },
  },
} as const)
