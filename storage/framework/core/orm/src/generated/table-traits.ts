function generateMigrationsTableInterface(): string {
  return `
export interface MigrationsTable {
  name: string
  timestamp: string
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
  last_used_at: string
}`
}

function generateCommenteableInterface(): string {
  return `
export interface CommentableTable {
  id?: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentable_id: number
  commentable_type: string
  reports_count: number
  reported_at: number | null
  upvotes_count: number
  downvotes_count: number
  user_id: number | null
  created_at: string
  updated_at: string | null
}`
}

function generateCommenteableUpvotesTableInterface(): string {
  return `
export interface CommenteableUpvotesTable {
  id?: number
  user_id: number
  upvoteable_id: number
  upvoteable_type: string
  created_at: string
}`
}

function generateCategorizableTableInterface(): string {
  return `
  export interface CategorizableTable {
    id?: number
    name: string
    slug: string
    description?: string
    order: number
    is_active: boolean
    categorizable_id: number
    categorizable_type: string
    created_at: string
    updated_at?: string
  }`
}

export function generateTraitTableInterfaces(): string {
  return [
    generateMigrationsTableInterface(),
    generatePasskeysTableInterface(),
    generateCommenteableInterface(),
    generateCommenteableUpvotesTableInterface(),
    generateCategorizableTableInterface(),
  ].join('\n')
}
