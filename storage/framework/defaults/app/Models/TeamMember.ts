import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A user's membership in one team.
 *
 * The auth package already resolves active-team context from this table.
 * Keeping the pivot as a model gives applications a typed, model-driven
 * schema and an authenticated REST surface instead of relying on an
 * undocumented table that may not exist.
 */
export default defineModel({
  name: 'TeamMember',
  table: 'team_members',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'team_members_team_user_unique',
      columns: ['team_id', 'user_id'],
      unique: true,
    },
    {
      name: 'team_members_user_status_index',
      columns: ['user_id', 'status'],
    },
  ],

  belongsTo: ['Team', 'User'],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: { count: 0 },
    useSearch: {
      displayable: ['id', 'teamId', 'userId', 'role', 'status', 'createdAt'],
      searchable: [],
      sortable: ['role', 'status', 'createdAt', 'updatedAt'],
      filterable: ['teamId', 'userId', 'role', 'status'],
    },
    useApi: {
      uri: 'team-members',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
      middleware: ['auth'],
    },
  },

  attributes: {
    teamId: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.number().required(),
      },
    },

    userId: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.number().required(),
      },
    },

    role: {
      required: true,
      fillable: true,
      default: 'member',
      validation: {
        rule: schema.enum(['owner', 'admin', 'member', 'viewer']),
      },
    },

    status: {
      required: true,
      fillable: true,
      default: 'active',
      validation: {
        rule: schema.enum(['active', 'suspended']),
      },
    },
  },

  dashboard: {
    enabled: false,
  },
} as const)
