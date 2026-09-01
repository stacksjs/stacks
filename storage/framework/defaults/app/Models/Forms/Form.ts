import { defineModel, siteOwnership } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A user-defined form: inquiry, permission slip, event registration,
 * donation. Fields are FormField rows; submissions are FormSubmission rows.
 *
 * The `useApi` surface is the ADMIN builder surface. The public render and
 * submit endpoints live in `@stacksjs/forms` routes, keyed by uuid, and only
 * ever serve `status: 'active'` forms.
 */
export default defineModel({
  name: 'Form',
  table: 'forms',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'forms_site_handle_unique',
      columns: ['site_id', 'handle'],
      unique: true,
    },
  ],

  // Owned through the site, which belongs to a team, so the owner is the set of
  // site ids the caller's team owns rather than a single id (stacksjs/stacks#2375).
  ownership: siteOwnership(),

  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: {
      middleware: ['auth'],
      uri: 'forms',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
    useSearch: {
      displayable: ['id', 'name', 'handle', 'status'],
      searchable: ['name', 'handle'],
      filterable: ['status'],
    },
  },

  belongsTo: ['Site'],
  hasMany: ['FormField', 'FormSubmission'],

  attributes: {
    name: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().min(2).max(255),
      },
      factory: faker => `${faker.lorem.words(2)} form`,
    },

    handle: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().min(2).max(64).matches(/^[a-z0-9-]+$/),
      },
      factory: faker => faker.lorem.slug(),
    },

    status: {
      required: false,
      order: 3,
      fillable: true,
      default: 'draft',
      validation: {
        rule: schema.enum(['draft', 'active', 'closed'] as const),
      },
      factory: () => 'active',
    },

    /**
     * JSON settings: { submitLabel?, confirmation: { type: 'message'|'redirect',
     * value }, notifyEmails: string[], emailField?, nameField?,
     * payment?: { mode: 'fixed'|'user_amount'|'field_sum', amountCents?, currency? } }
     */
    settings: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.json(),
      },
      factory: () => JSON.stringify({}),
    },
  },
} as const)
