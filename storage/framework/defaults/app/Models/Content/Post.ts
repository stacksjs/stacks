import { defineModel, siteOwnership } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Post',
  table: 'posts',
  primaryKey: 'id',
  autoIncrement: true,

  // Owned through the site, which belongs to a team, so the owner is the set of
  // site ids the caller's team owns rather than a single id (stacksjs/stacks#2375).
  ownership: siteOwnership(),

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'title', 'slug', 'author', 'views', 'status', 'poster', 'focusKeyword', 'metaDescription', 'canonicalUrl'],
      // `content`, not `body` - the column is `content`, and the old spelling
      // silently indexed nothing. `comments` likewise was never a column.
      searchable: ['title', 'slug', 'author', 'content', 'excerpt', 'focusKeyword', 'metaDescription'],
      sortable: ['published_at', 'views'],
      filterable: ['status'],
    },

    // No faker seeding. The public blog is markdown-based (content/blog/*.md)
    // rendered by BunPress; this model backs the CMS dashboard only.
    // `commentable`, not `commentables`: define-model checks the singular key,
    // so the plural spelling left the trait inert. Now that the commentable
    // trait targets the real `commentables` table, activating it is correct.
    commentable: true,
    useApi: {
      // Admin surface now: the table carries drafts, and a public read route
      // is how drafts leak. Public visitors get published posts through the
      // site's own routes/pages, which filter by status themselves.
      middleware: ['auth'],
      uri: 'posts',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['Author', 'Site'],
  belongsToMany: {
    categories: {
      model: 'Category',
      table: 'categorizable_models',
      foreignKey: 'categorizable_id',
      relatedKey: 'category_id',
      pivot: {
        columns: {
          categorizable_type: { default: 'posts' },
        },
        timestamps: true,
        uniques: [['category_id', 'categorizable_id', 'categorizable_type']],
      },
    },
    tags: {
      model: 'Tag',
      table: 'taggable_models',
      foreignKey: 'taggable_id',
      relatedKey: 'tag_id',
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
    title: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().min(3).max(255),
        message: {
          min: 'Title must have a minimum of 3 characters',
          max: 'Title must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.lorem.sentence(),
    },

    /**
     * URL identity: `/news/{slug}` beats `/blog/{id}` for a public site.
     * Nullable for pre-slug rows; the RSS/sitemap actions fall back to id.
     */
    slug: {
      required: false,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.lorem.slug(),
    },
    poster: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().url(),
        message: {
          url: 'Poster must be a valid URL',
        },
      },
      factory: faker => faker.image.url().substring(0, 255),
    },

    content: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().min(10).max(100000),
        message: {
          min: 'Post body must have a minimum of 10 characters',
          max: 'Post body must have a maximum of 100000 characters',
        },
      },
      factory: faker => faker.lorem.paragraphs(1),
    },

    excerpt: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string().min(10).max(500),
        message: {
          min: 'Excerpt must have a minimum of 10 characters',
          max: 'Excerpt must have a maximum of 500 characters',
        },
      },
      factory: faker => faker.lorem.paragraph(),
    },

    focusKeyword: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
        message: {
          max: 'Focus keyword must have a maximum of 100 characters',
        },
      },
    },

    metaDescription: {
      required: false,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string().max(160),
        message: {
          max: 'Meta description must have a maximum of 160 characters',
        },
      },
    },

    canonicalUrl: {
      required: false,
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string().url(),
        message: {
          url: 'Canonical URL must be a valid URL',
        },
      },
    },

    views: {
      required: false,
      order: 10,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Views count cannot be negative',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 1000 }),
    },

    publishedAt: {
      required: false,
      order: 11,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
        message: {
          timestamp: 'Published timestamp must be a valid timestamp',
        },
      },
      factory: (faker) => {
        const date = faker.date.past()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    status: {
      required: true,
      order: 12,
      fillable: true,
      default: 'draft',
      validation: {
        rule: schema.enum(['published', 'draft', 'archived']),
        message: {
          oneOf: 'Status must be either published, draft, or archived',
        },
      },
      factory: faker => faker.helpers.arrayElement(['published', 'draft', 'archived']),
    },

    isFeatured: {
      required: false,
      order: 13,
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          number: 'Featured must be a number value',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 1 }),
    },
  },
} as const)
