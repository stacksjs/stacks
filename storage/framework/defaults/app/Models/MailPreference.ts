import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'MailPreference',
  table: 'mail_preferences',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useApi: {
      uri: 'mail-preferences',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
      middleware: ['auth'],
    },
  },

  attributes: {
    mailbox: {
      fillable: true,
      required: true,
      unique: true,
      validation: {
        rule: schema.string().email().max(320).required(),
      },
    },

    accountName: {
      fillable: true,
      required: true,
      default: 'Stacks',
      validation: {
        rule: schema.string().max(255).required(),
      },
    },

    signature: {
      fillable: true,
      required: false,
      validation: {
        rule: schema.string().max(20_000),
      },
    },

    displayDensity: {
      fillable: true,
      required: true,
      default: 'default',
      validation: {
        rule: schema.enum(['comfortable', 'default', 'compact']),
      },
    },

    theme: {
      fillable: true,
      required: true,
      default: 'system',
      validation: {
        rule: schema.enum(['light', 'dark', 'system']),
      },
    },

    language: {
      fillable: true,
      required: true,
      default: 'en',
      validation: {
        rule: schema.enum(['en', 'fr', 'de', 'es', 'ja']),
      },
    },

    defaultReplyBehavior: {
      fillable: true,
      required: true,
      default: 'replyAll',
      validation: {
        rule: schema.enum(['reply', 'replyAll']),
      },
    },

    sendAndArchive: {
      fillable: true,
      required: true,
      default: true,
      validation: {
        rule: schema.boolean(),
      },
    },

    autoAdvance: {
      fillable: true,
      required: true,
      default: 'newer',
      validation: {
        rule: schema.enum(['newer', 'older', 'back']),
      },
    },

    desktopNotifications: {
      fillable: true,
      required: true,
      default: true,
      validation: {
        rule: schema.boolean(),
      },
    },

    notificationSound: {
      fillable: true,
      required: true,
      default: 'default',
      validation: {
        rule: schema.enum(['default', 'subtle', 'none']),
      },
    },

    notificationPreview: {
      fillable: true,
      required: true,
      default: true,
      validation: {
        rule: schema.boolean(),
      },
    },

    filters: {
      fillable: true,
      required: true,
      default: '[]',
      validation: {
        rule: schema.string(),
      },
    },

    blockedSenders: {
      fillable: true,
      required: true,
      default: '[]',
      validation: {
        rule: schema.string(),
      },
    },

    labels: {
      fillable: true,
      required: true,
      default: '[]',
      validation: {
        rule: schema.string(),
      },
    },

    loadRemoteImages: {
      fillable: true,
      required: true,
      default: false,
      validation: {
        rule: schema.boolean(),
      },
    },

    showExternalContent: {
      fillable: true,
      required: true,
      default: false,
      validation: {
        rule: schema.boolean(),
      },
    },

    vacationEnabled: {
      fillable: true,
      required: true,
      default: false,
      validation: {
        rule: schema.boolean(),
      },
    },

    vacationStartDate: {
      fillable: true,
      required: false,
      validation: {
        rule: schema.string(),
      },
    },

    vacationEndDate: {
      fillable: true,
      required: false,
      validation: {
        rule: schema.string(),
      },
    },

    vacationSubject: {
      fillable: true,
      required: false,
      validation: {
        rule: schema.string().max(255),
      },
    },

    vacationMessage: {
      fillable: true,
      required: false,
      validation: {
        rule: schema.string().max(20_000),
      },
    },
  },
} as const)
