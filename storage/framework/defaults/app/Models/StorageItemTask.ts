import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * One unit of background processing for one file (stacksjs/stacks#2578).
 *
 * The three things #245 asked for that could not happen inside a request -
 * image optimization, video transcode, AI tagging - share the same shape:
 * dispatch work and show what happened to it. Transcoding is minutes, not
 * milliseconds; a vision call is a round trip to a third party. An upload
 * handler that waits for either is an upload handler that times out.
 *
 * ## Why this is not a column on `StorageItem`
 *
 * A file can have three of these at once and they succeed and fail
 * independently - a video whose transcode finished and whose tagging failed is
 * a normal state, and a single `processing` column cannot say it. The file
 * manager aggregates these rows into the one word a UI shows; the rows are what
 * a retry and an error message need.
 *
 * It is also keyed by `(disk, path, kind)` rather than by a `storage_items` id,
 * deliberately. A `storage_items` row exists only while somebody has starred or
 * tagged the file - it is deleted when it has nothing left to say - and most
 * uploads are neither. Hanging a task off it would mean creating a metadata row
 * for every upload just to have somewhere to put the task.
 *
 * Same reconciliation rules as `storage_items`, through the same store: a
 * rename moves these rows, a delete forgets them, and a completed listing
 * sweeps the ones whose file is gone.
 */
export default defineModel({
  name: 'StorageItemTask',
  table: 'storage_item_tasks',
  primaryKey: 'id',
  autoIncrement: true,

  /**
   * One task per kind per file.
   *
   * Re-running replaces the row rather than adding a second, so "what happened
   * to the transcode" has one answer. The history of previous attempts is the
   * queue's to keep, not this table's.
   */
  indexes: [
    {
      name: 'storage_item_tasks_disk_path_kind_unique',
      columns: ['disk', 'path', 'kind'],
      unique: true,
    },
  ],

  traits: {
    useUuid: true,
    useTimestamps: true,

    useSearch: {
      displayable: ['id', 'disk', 'path', 'kind', 'state'],
      searchable: ['path'],
      sortable: ['path', 'createdAt'],
      filterable: ['disk', 'kind', 'state'],
    },

    useSeeder: { count: 0 },
  },

  attributes: {
    disk: {
      order: 1,
      fillable: true,
      validation: { rule: schema.string().required().min(1).max(64) },
      factory: () => 'public',
    },

    path: {
      order: 2,
      fillable: true,
      validation: { rule: schema.string().required().min(1).max(2048) },
      factory: faker => faker.system.fileName(),
    },

    kind: {
      order: 3,
      fillable: true,
      // `optimize` (images), `transcode` (video), `tag` (AI). An enum rather
      // than free text so a typo in a dispatch is a validation error instead of
      // a task nothing will ever run.
      validation: { rule: schema.enum(['optimize', 'transcode', 'tag']) },
      factory: () => 'optimize',
    },

    state: {
      order: 4,
      fillable: true,
      default: 'queued',
      validation: { rule: schema.enum(['queued', 'running', 'done', 'failed']) },
      factory: () => 'queued',
    },

    attempts: {
      order: 5,
      fillable: true,
      default: 0,
      // Counted here as well as in the queue, because the queue's count is gone
      // once the job leaves it and this is what the dashboard reads.
      validation: { rule: schema.number() },
      factory: () => 0,
    },

    error: {
      order: 6,
      fillable: true,
      // The failure as the worker saw it. Truncated by the writer rather than
      // by the column, so a stack trace does not silently lose its first line.
      validation: { rule: schema.string().max(2000) },
      factory: () => '',
    },

    startedAt: {
      order: 7,
      fillable: true,
      validation: { rule: schema.string() },
      factory: () => '',
    },

    finishedAt: {
      order: 8,
      fillable: true,
      validation: { rule: schema.string() },
      factory: () => '',
    },
  },

  dashboard: { enabled: false },
} as const)
