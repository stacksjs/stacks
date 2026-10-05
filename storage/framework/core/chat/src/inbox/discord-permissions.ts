/**
 * Whether a member can see a channel, by Discord's own rules: the server's
 * @everyone role and the member's roles set the base, Administrator sees
 * everything, and the channel's overwrites then apply in order - @everyone,
 * then the member's roles together, then the member themselves.
 */

export const VIEW_CHANNEL = 1n << 10n
export const READ_MESSAGE_HISTORY = 1n << 16n
const ADMINISTRATOR = 1n << 3n

export interface RoleLike { id: string, permissions: string | number }
export interface OverwriteLike { id: string, type: number | string, allow: string | number, deny: string | number }

const bits = (value: string | number | undefined | null): bigint => BigInt(value ?? 0)

export function channelPermissions(input: {
  guildId: string
  ownerId?: string | null
  userId: string
  memberRoles: string[]
  roles: RoleLike[]
  overwrites: OverwriteLike[]
}): bigint {
  if (input.ownerId && input.ownerId === input.userId)
    return ~0n
  const roleById = new Map(input.roles.map(role => [role.id, role]))
  // The @everyone role's id is the server's id.
  let base = bits(roleById.get(input.guildId)?.permissions)
  for (const id of input.memberRoles)
    base |= bits(roleById.get(id)?.permissions)
  if (base & ADMINISTRATOR)
    return ~0n

  let permissions = base
  const everyone = input.overwrites.find(o => o.id === input.guildId)
  if (everyone)
    permissions = (permissions & ~bits(everyone.deny)) | bits(everyone.allow)

  let allow = 0n
  let deny = 0n
  for (const overwrite of input.overwrites) {
    // Type 0 is a role, 1 a member (older payloads say "role"/"member").
    const isRole = overwrite.type === 0 || overwrite.type === 'role'
    if (isRole && input.memberRoles.includes(overwrite.id)) {
      allow |= bits(overwrite.allow)
      deny |= bits(overwrite.deny)
    }
  }
  permissions = (permissions & ~deny) | allow

  const own = input.overwrites.find(o => (o.type === 1 || o.type === 'member') && o.id === input.userId)
  if (own)
    permissions = (permissions & ~bits(own.deny)) | bits(own.allow)
  return permissions
}

export function canRead(permissions: bigint): boolean {
  return (permissions & VIEW_CHANNEL) !== 0n && (permissions & READ_MESSAGE_HISTORY) !== 0n
}
