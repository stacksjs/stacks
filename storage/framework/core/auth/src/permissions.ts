export type RolePermissionMap<TRole extends string, TPermission extends string> = Record<TRole, readonly TPermission[]>

export interface RolePermissions<TRole extends string, TPermission extends string> {
  /** True when the role is granted the requested permission. */
  roleCan: (role: TRole | null | undefined, permission: TPermission) => boolean
  /** True when the subject's role is granted the requested permission. */
  can: (subject: { role: TRole } | null | undefined, permission: TPermission) => boolean
  /** True when the subject is granted at least one requested permission. */
  canAny: (subject: { role: TRole } | null | undefined, permissions: readonly TPermission[]) => boolean
  /** True when the subject is granted every requested permission. */
  canAll: (subject: { role: TRole } | null | undefined, permissions: readonly TPermission[]) => boolean
  /** Every permission granted to the role. */
  forRole: (role: TRole | null | undefined) => readonly TPermission[]
}

/**
 * Define a typed, deterministic role-to-permission resolver.
 *
 * This complements the database-backed `Rbac` facade for applications whose
 * role grants live in source control, or whose tenant membership is the
 * authorization subject rather than the authenticated user record itself.
 */
export function defineRolePermissions<const TRole extends string, const TPermission extends string>(
  grants: RolePermissionMap<TRole, TPermission>,
): RolePermissions<TRole, TPermission> {
  const frozenGrants = Object.fromEntries(
    Object.entries(grants).map(([role, permissions]) => [role, Object.freeze([...(permissions as readonly TPermission[])])]),
  ) as RolePermissionMap<TRole, TPermission>

  const forRole = (role: TRole | null | undefined): readonly TPermission[] => role ? frozenGrants[role] ?? [] : []
  const roleCan = (role: TRole | null | undefined, permission: TPermission): boolean => forRole(role).includes(permission)
  const can = (subject: { role: TRole } | null | undefined, permission: TPermission): boolean => roleCan(subject?.role, permission)
  const canAny = (subject: { role: TRole } | null | undefined, permissions: readonly TPermission[]): boolean => permissions.some(permission => can(subject, permission))
  const canAll = (subject: { role: TRole } | null | undefined, permissions: readonly TPermission[]): boolean => permissions.every(permission => can(subject, permission))

  return Object.freeze({ roleCan, can, canAny, canAll, forRole })
}
