import { path } from '@stacksjs/path'

function generateMigrationsTableInterface(): string {
  return `
export interface MigrationsTable {
  name: string
  timestamp: string
}`
}

function generatePasswordResetsTableInterface(): string {
  return `
export interface PasswordResetsTable {
  email: string
  token: string
  created_at?: string
}`
}

function generatePasskeysTableInterface(): string {
  return `
export interface PasskeysTable {
  id?: number
  cred_public_key: string
  user_id: number
  webauthn_user_id: string
  counter: number
  credential_type: string
  device_type: string
  backup_eligible: boolean
  backup_status: boolean
  transports?: string
  created_at?: string
  updated_at?: string
  last_used_at: string
}`
}

function generateCommenteableInterface(): string {
  return `
export interface commentablesTable {
  id?: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentables_id: number
  commentables_type: string
  user_id: number | null
  created_at?: string
  updated_at?: string | null
}`
}

function generateCommenteableUpvotesTableInterface(): string {
  return `
export interface CommenteableUpvotesTable {
  id?: number
  user_id: number
  upvoteable_id: number
  upvoteable_type: string
  created_at?: string
}`
}

function generateCategorizableTableInterface(): string {
  return `
  export interface CategorizableTable {
    id?: number
    name: string
    slug: string
    description?: string
    is_active: boolean
    categorizable_id: number
    categorizable_type: string
    created_at?: string
    updated_at?: string
  }`
}

function generateTaggableTableInterface(): string {
  return `
  export interface TaggableTable {
    id?: number
    name: string
    slug: string
    description?: string
    is_active: boolean
    taggable_id: number
    taggable_type: string
    created_at?: string
    updated_at?: string
  }`
}

function generateTaggableModelsTableInterface(): string {
  return `
  export interface TaggableModelsTable {
    id?: number
    tag_id: number
    taggable_id: number
    taggable_type: string
    created_at?: string
    updated_at?: string
  }`
}

function generateCategorizableModelsTableInterface(): string {
  return `
  export interface CategorizableModelsTable {
    id?: number
    category_id: number
    categorizable_id: number
    categorizable_type: string
    created_at?: string
    updated_at?: string
  }`
}

export function generateTraitTableInterfaces(): string {
  return [
    generateMigrationsTableInterface(),
    generatePasswordResetsTableInterface(),
    generatePasskeysTableInterface(),
    generateCommenteableInterface(),
    generateCommenteableUpvotesTableInterface(),
    generateCategorizableTableInterface(),
    generateTaggableTableInterface(),
    generateTaggableModelsTableInterface(),
    generateCategorizableModelsTableInterface(),
  ].join('\n')
}

export async function generateTraitRequestTypes(): Promise<string> {
  let typeString = `import { Request } from '../core/router/src/request'\nimport type { VineType } from '@stacksjs/types'\n\n`

  typeString += `interface ValidationField {
    rule: VineType
    message: Record<string, string>
  }\n\n`

  typeString += `interface CustomAttributes {
    [key: string]: ValidationField
  }\n\n`

  // Generate request types for each trait interface
  const traitInterfaces = [
    {
      name: 'Migrations',
      fields: {
        name: 'string',
        timestamp: 'string',
      },
    },
    {
      name: 'PasswordResets',
      fields: {
        email: 'string',
        token: 'string',
        created_at: 'string',
      },
    },
    {
      name: 'Passkeys',
      fields: {
        id: 'number',
        cred_public_key: 'string',
        user_id: 'number',
        webauthn_user_id: 'string',
        counter: 'number',
        credential_type: 'string',
        device_type: 'string',
        backup_eligible: 'boolean',
        backup_status: 'boolean',
        transports: 'string',
        created_at: 'string',
        updated_at: 'string',
        last_used_at: 'string',
      },
    },
    {
      name: 'commentables',
      fields: {
        id: 'number',
        title: 'string',
        body: 'string',
        status: 'string',
        approved_at: 'number | null',
        rejected_at: 'number | null',
        commentables_id: 'number',
        commentables_type: 'string',
        reports_count: 'number',
        reported_at: 'number | null',
        upvotes_count: 'number',
        downvotes_count: 'number',
        user_id: 'number | null',
        created_at: 'string',
        updated_at: 'string | null',
      },
    },
    {
      name: 'CommenteableUpvotes',
      fields: {
        id: 'number',
        user_id: 'number',
        upvoteable_id: 'number',
        upvoteable_type: 'string',
        created_at: 'string',
      },
    },
    {
      name: 'Categorizable',
      fields: {
        id: 'number',
        name: 'string',
        slug: 'string',
        description: 'string',
        is_active: 'boolean',
        categorizable_id: 'number',
        categorizable_type: 'string',
        created_at: 'string',
        updated_at: 'string',
      },
    },
    {
      name: 'Taggable',
      fields: {
        id: 'number',
        name: 'string',
        slug: 'string',
        description: 'string',
        is_active: 'boolean',
        taggable_id: 'number',
        taggable_type: 'string',
        created_at: 'string',
        updated_at: 'string',
      },
    },
    {
      name: 'TaggableModels',
      fields: {
        id: 'number',
        tag_id: 'number',
        taggable_id: 'number',
        taggable_type: 'string',
        created_at: 'string',
        updated_at: 'string | null',
      },
    },
    {
      name: 'CategorizableModels',
      fields: {
        id: 'number',
        category_id: 'number',
        categorizable_id: 'number',
        categorizable_type: 'string',
        created_at: 'string',
        updated_at: 'string | null',
      },
    },
  ]

  let importTypesString = ''

  for (let i = 0; i < traitInterfaces.length; i++) {
    const trait = traitInterfaces[i]
    let fieldString = ''
    let fieldStringType = ''

    // Add fields to the interface
    for (const [field, type] of Object.entries(trait.fields)) {
      fieldString += ` ${field}: ${type}\n     `
    }

    fieldStringType += ` get: <T>(element: string, defaultValue?: T) => T`

    const types = `export interface ${trait.name}RequestType extends Request {
      validate(attributes?: CustomAttributes): void
      ${fieldStringType}
      all(): RequestData${trait.name}
      ${fieldString}
    }\n\n`

    typeString += `interface RequestData${trait.name} {
      ${fieldString}
    }\n`

    typeString += types

    importTypesString += `${trait.name}RequestType`
    if (i < traitInterfaces.length - 1)
      importTypesString += ' | '
  }

  typeString += `export type TraitRequest = ${importTypesString}`

  const traitsFile = Bun.file(path.frameworkPath('types/traits.d.ts'))
  const writer = traitsFile.writer()
  writer.write(typeString)
  await writer.end()

  return typeString
}
