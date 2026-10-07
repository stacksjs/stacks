import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

/**
 * A file attached to a card. Today that means one screenshot on a card filed
 * through a feedback link (stacksjs/stacks#2872).
 *
 * The bytes live on a disk and this row is the only thing that knows they
 * belong to a card: a disk knows a path and some bytes, not which card a
 * screenshot illustrates. Same division as `StorageItem`, for the same
 * reason, and deliberately a separate table from it - `storage_items` is
 * advisory metadata keyed by `(disk, path)` for the file manager, while this
 * is a card's own content and is authoritative about what is attached to
 * what.
 *
 * ## The disk is chosen here, not by the uploader
 *
 * `disk` is recorded rather than assumed so a row written while an app used
 * local storage still resolves after it moves to S3. It is written by the
 * action from configuration; nothing a submitter sends reaches it, and
 * neither does any part of `path`, which is generated. See
 * `feedback-attachment.ts`, which holds the rules.
 *
 * A feedback attachment is written to a PRIVATE disk. An unauthenticated
 * stranger's upload landing under `public/` would be world-readable at a
 * path the dashboard also prints.
 *
 * ## Removing a screenshot removes the file
 *
 * A screenshot is likely to contain personal data - it is a picture of
 * somebody's screen - so deleting one has to delete the bytes, not only this
 * row. The card, column and board destroy actions do both, file first, through
 * `removeCardAttachments` (stacksjs/stacks#2881). They cannot lean on the
 * cascade declared below, which SQLite does not enforce, and a row deleted
 * without its file leaves bytes on the disk that nothing can find again.
 *
 * `buddy gdpr:erase` does not reach these rows, and the `gdpr` trait here is
 * the processing-register entry rather than an erasure path. The submitter of
 * a feedback card is not an account: the card is filed with no user, so no
 * data subject's erasure can match it. An external reviewer's request is met
 * by deleting the card they filed, which removes the screenshot with it.
 *
 * No `useApi`. These rows are written by the feedback intake action and read
 * by the dashboard's own board actions; a REST surface over them would
 * publish a list of every uploaded file.
 */
export default defineModel({
  name: 'CardAttachment',
  table: 'card_attachments',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    gdpr: { erasure: 'delete', basis: 'legitimate_interests', purpose: 'A screenshot attached to a card, usually illustrating a bug report' },
    useTimestamps: true,
    useUuid: true,
  },

  // Cascade: an attachment to a card that no longer exists is a file nothing
  // can reach and a row nothing can render. Declared, and not relied on -
  // SQLite enforces it only with `foreign_keys = ON`, which the framework
  // sets while renaming and not otherwise.
  belongsTo: [{ model: 'Card', onDelete: 'cascade' }],

  attributes: {
    /** Which configured disk holds the bytes, e.g. `local`. */
    disk: {
      required: true,
      order: 1,
      fillable: true,
      validation: { rule: schema.string().max(40) },
      factory: () => 'local',
    },

    /**
     * The path on that disk. Unique, so the same bytes cannot be claimed by
     * two cards, and generated in full by `feedbackAttachmentPath`.
     */
    path: {
      required: true,
      order: 2,
      fillable: true,
      unique: true,
      validation: { rule: schema.string().max(400) },
      factory: faker => `feedback/1/${faker.string.uuid()}.png`,
    },

    /**
     * What the bytes actually are, read from the file's own leading bytes
     * rather than from the declared content type, which an uploader writes.
     * The dashboard serves the file as this.
     */
    mimeType: {
      required: true,
      order: 3,
      fillable: true,
      validation: { rule: schema.string().max(80) },
      factory: () => 'image/png',
    },

    /** Size as stored, so a listing does not have to stat every file. */
    sizeBytes: {
      required: true,
      order: 4,
      fillable: true,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 1000, max: 500_000 }),
    },
  },
} as const)
