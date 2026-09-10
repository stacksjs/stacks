import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Dashboard metadata for one file on one disk (stacksjs/stacks#2577).
 *
 * Every file-manager operation shipped before this maps to a `StorageAdapter`
 * method - `write`, `list`, `moveFile`, `changeVisibility`, `deleteFile`. A disk
 * knows a path, some bytes, a size and an ACL. It does not know that somebody
 * starred a file, and there is nowhere on a disk to write that down: extended
 * attributes do not survive a copy and cost a syscall per file, and S3 object
 * metadata is set at write time, so starring a 2 GB video would rewrite 2 GB.
 * Both are a database row wearing a disguise, so this is the row.
 *
 * ## The disk is authoritative, this table is advisory
 *
 * That is the question #2577 asks to settle first, and it decides everything
 * else. A bucket several systems write to changes without the dashboard's
 * knowledge, so a table that claimed to describe its contents would be wrong
 * within a day of being right. Instead:
 *
 * - The listing comes from the disk and is joined to these rows. A path with no
 *   row is a file with no stars, which is the normal case and needs no row.
 * - A row whose path no longer exists is an orphan and is simply not shown. The
 *   listing pass already enumerates every path in the subtree, so it sweeps the
 *   orphans it can prove are orphans - the ones under a prefix it just walked -
 *   at no extra cost. Nothing walks the whole disk to garbage collect.
 * - Renames and deletes made THROUGH the dashboard reconcile eagerly, so a
 *   starred file keeps its star the moment it moves rather than waiting for a
 *   sweep. A folder rename is a prefix update, because moving a folder moves
 *   every file beneath it.
 *
 * The consequence worth stating: a file renamed outside the dashboard loses its
 * metadata, because nothing connects the old path to the new one. That is not
 * a gap to close later - a copy and a rename are indistinguishable to a bucket
 * listing, so any reconciliation would be guessing.
 *
 * Keyed by `(disk, path)` rather than by a file id, because a disk has no file
 * ids to key by.
 *
 * ## Tags are the existing vocabulary, reached the way the CMS reaches it
 *
 * #2577 asks for the `taggable` trait rather than a second tag vocabulary, and
 * that trait is `taggables` (the words) joined through `taggable_models` (the
 * pivot), with `taggable_type` keeping one model's rows away from another's.
 * `@stacksjs/cms`'s taggables module is what reads and writes it, so
 * `file-metadata.ts` calls that rather than declaring a `belongsToMany` here:
 * the ORM relation would resolve `tag_id` against the `tags` TABLE, which is a
 * different table from `taggables` and a different set of words. Declaring one
 * would have created exactly the second vocabulary the issue says not to.
 */
export default defineModel({
  name: 'StorageItem',
  table: 'storage_items',
  primaryKey: 'id',
  autoIncrement: true,

  /**
   * One row per file, enforced rather than assumed.
   *
   * Every write here is a get-or-create keyed on this pair, and a duplicate
   * would not be a visible bug - it would be a file that is starred and also
   * not starred, depending which row the query happened to read first.
   */
  indexes: [
    {
      name: 'storage_items_disk_path_unique',
      columns: ['disk', 'path'],
      unique: true,
    },
  ],

  traits: {
    useUuid: true,
    useTimestamps: true,

    useSearch: {
      displayable: ['id', 'disk', 'path', 'favorite'],
      searchable: ['path'],
      sortable: ['path', 'createdAt'],
      filterable: ['disk', 'favorite'],
    },

    useSeeder: { count: 0 },
  },

  attributes: {
    disk: {
      order: 1,
      fillable: true,
      // The disk NAME, not its driver: two disks can point at one bucket with
      // different prefixes, and they are different namespaces to the dashboard.
      validation: { rule: schema.string().required().min(1).max(64) },
      factory: () => 'public',
    },

    path: {
      order: 2,
      fillable: true,
      // Disk-relative and without a leading slash, exactly as the file manager
      // reports it, so a lookup is an equality match rather than a normalization
      // problem at every call site.
      validation: { rule: schema.string().required().min(1).max(2048) },
      factory: faker => `${faker.system.fileName()}`,
    },

    favorite: {
      order: 3,
      fillable: true,
      default: false,
      validation: { rule: schema.boolean() },
      factory: () => false,
    },
  },

  // Managed from the file manager, not as a top-level model row: a list of
  // (disk, path, favorite) tuples is not a thing anybody wants to browse.
  dashboard: { enabled: false },
} as const)
