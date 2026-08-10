import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A single-use invitation to join a team.
 *
 * The raw bearer token is only returned by the dedicated invite action and
 * sent to the recipient. This model stores its SHA-256 digest so generated
 * API responses and database reads cannot leak a usable invitation.
 */
export default defineModel({
  name: 'TeamInvitation',
  table: 'team_invitations',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'team_invitations_token_hash_unique',
      columns: ['token_hash'],
      unique: true,
    },
    {
      name: 'team_invitations_pending_key_unique',
      columns: ['pending_key'],
      unique: true,
    },
    {
      name: 'team_invitations_team_email_status_index',
      columns: ['team_id', 'email', 'status'],
    },
  ],

  belongsTo: ['Team'],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: { count: 0 },
    useSearch: {
      displayable: ['id', 'teamId', 'email', 'role', 'status', 'deliveryStatus', 'expiresAt', 'createdAt'],
      searchable: ['email'],
      sortable: ['email', 'role', 'status', 'expiresAt', 'createdAt', 'updatedAt'],
      filterable: ['teamId', 'role', 'status', 'deliveryStatus'],
    },
    useApi: {
      uri: 'team-invitations',
      routes: ['index', 'show', 'destroy'],
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

    email: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().email().required().max(320),
      },
    },

    role: {
      required: true,
      fillable: true,
      default: 'member',
      validation: {
        rule: schema.enum(['admin', 'member', 'viewer']),
      },
    },

    tokenHash: {
      required: true,
      hidden: true,
      validation: {
        rule: schema.string().required().max(64),
      },
    },

    pendingKey: {
      required: false,
      hidden: true,
      validation: {
        rule: schema.string().max(384),
      },
    },

    invitedByUserId: {
      required: false,
      validation: {
        rule: schema.number(),
      },
    },

    acceptedByUserId: {
      required: false,
      validation: {
        rule: schema.number(),
      },
    },

    status: {
      required: true,
      fillable: true,
      default: 'pending',
      validation: {
        rule: schema.enum(['pending', 'accepted', 'revoked', 'expired']),
      },
    },

    deliveryStatus: {
      required: true,
      default: 'pending',
      validation: {
        rule: schema.enum(['pending', 'sent', 'failed']),
      },
    },

    deliveryError: {
      required: false,
      hidden: true,
      validation: {
        rule: schema.string().max(2000),
      },
    },

    expiresAt: {
      required: true,
      validation: {
        rule: schema.timestamp().required(),
      },
    },

    deliveredAt: {
      required: false,
      validation: {
        rule: schema.timestamp(),
      },
    },

    acceptedAt: {
      required: false,
      validation: {
        rule: schema.timestamp(),
      },
    },
  },

  dashboard: {
    enabled: false,
  },
} as const)
