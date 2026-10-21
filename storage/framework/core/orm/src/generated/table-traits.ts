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

function generateCommentableInterface(): string {
  return `
export interface CommentablesTable {
  id?: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentables_id: number
  commentables_type: string
  user_id: number | null
  author_name?: string | null
  author_email?: string | null
  created_at?: string
  updated_at?: string | null
}`
}

function generateCommentableUpvotesTableInterface(): string {
  return `
export interface CommentableUpvotesTable {
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
    categorizable_type: string
    categorizable_id: number
    created_at?: string
    updated_at?: string
  }`
}

function generateQueryLogsTableInterface(): string {
  return `
  export interface QueryLogsTable {
    id?: number
    query: string
    normalized_query: string
    duration: number
    connection: string
    status: 'completed' | 'failed' | 'slow'
    error?: string
    executed_at?: string
    bindings?: string
    trace?: string
    model?: string
    method?: string
    file?: string
    line?: number
    memory_usage?: number
    rows_affected?: number
    transaction_id?: string
    tags?: string
    affected_tables?: string
    indexes_used?: string
    missing_indexes?: string
    explain_plan?: string
    optimization_suggestions?: string
  }`
}

export function generateTraitTableInterfaces(): string {
  return [
    generateMigrationsTableInterface(),
    generatePasswordResetsTableInterface(),
    generatePasskeysTableInterface(),
    generateCommentableInterface(),
    generateCommentableUpvotesTableInterface(),
    generateCategorizableTableInterface(),
    generateTaggableTableInterface(),
    generateTaggableModelsTableInterface(),
    generateCategorizableModelsTableInterface(),
    generateQueryLogsTableInterface(),
  ].join('\n')
}
