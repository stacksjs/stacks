import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'QueryLog',
  table: 'query_logs',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'query_logs_executed_at_index',
      columns: ['executed_at'],
    },
    {
      name: 'query_logs_status_index',
      columns: ['status'],
    },
    {
      name: 'query_logs_duration_index',
      columns: ['duration'],
    },
  ],

  traits: {
    useTimestamps: true,
    useApi: {
      uri: 'query-logs',
      routes: ['index', 'show'],
      middleware: ['auth'],
    },
  },

  attributes: {
    query: {
      required: true,
      fillable: true,
      type: 'text',
      validation: {
        rule: schema.string().required(),
      },
    },
    normalized_query: {
      fillable: true,
      type: 'text',
      validation: {
        rule: schema.string(),
      },
    },
    duration: {
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
    },
    connection: {
      fillable: true,
      default: 'unknown',
      validation: {
        rule: schema.string().max(255),
      },
    },
    status: {
      fillable: true,
      default: 'completed',
      validation: {
        rule: schema.enum(['completed', 'failed', 'slow']),
      },
    },
    error: {
      fillable: true,
      type: 'text',
      validation: {
        rule: schema.string(),
      },
    },
    executed_at: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
    },
    bindings: {
      hidden: true,
      fillable: true,
      type: 'text',
      validation: {
        rule: schema.string(),
      },
    },
    trace: {
      hidden: true,
      fillable: true,
      type: 'text',
      validation: {
        rule: schema.string(),
      },
    },
    model: {
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
    },
    method: {
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
    },
    file: {
      hidden: true,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
    },
    line: {
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
    },
    memory_usage: {
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
    },
    rows_affected: {
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
    },
    transaction_id: {
      fillable: true,
      foreignKey: false,
      validation: {
        rule: schema.string().max(255),
      },
    },
    tags: {
      fillable: true,
      validation: {
        rule: schema.string(),
      },
    },
    affected_tables: {
      fillable: true,
      validation: {
        rule: schema.string(),
      },
    },
    indexes_used: {
      fillable: true,
      validation: {
        rule: schema.string(),
      },
    },
    missing_indexes: {
      fillable: true,
      validation: {
        rule: schema.string(),
      },
    },
    explain_plan: {
      fillable: true,
      validation: {
        rule: schema.string(),
      },
    },
    optimization_suggestions: {
      fillable: true,
      validation: {
        rule: schema.string(),
      },
    },
  },
} as const)
