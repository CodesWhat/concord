export type PermissionOverrides = Record<string, { allow: number; deny: number }>;

/**
 * Resolve effective channel permissions by applying category and channel overrides.
 *
 * Algorithm:
 * 1. Start with base server permissions (from role resolution)
 * 2. If ADMINISTRATOR bit is set, return early (admin bypasses all overrides)
 * 3. Apply category overrides: merge allow/deny across all of user's roles, then apply
 * 4. Apply channel overrides: same merge + apply
 * 5. Deny always takes precedence when both allow and deny set for same permission
 */
export function resolveChannelPermissions(
  basePermissions: number,
  memberRoleIds: string[],
  categoryOverrides: PermissionOverrides | null | undefined,
  channelOverrides: PermissionOverrides | null | undefined,
): number {
  // Administrator bypasses all overrides
  if ((basePermissions & (1 << 30)) !== 0) return basePermissions;

  let perms = basePermissions;

  // Apply category-level overrides
  if (categoryOverrides) {
    perms = applyOverrides(perms, memberRoleIds, categoryOverrides);
  }

  // Apply channel-level overrides (more specific, takes precedence)
  if (channelOverrides) {
    perms = applyOverrides(perms, memberRoleIds, channelOverrides);
  }

  return perms;
}

function applyOverrides(
  perms: number,
  memberRoleIds: string[],
  overrides: PermissionOverrides,
): number {
  let allow = 0;
  let deny = 0;

  // Merge allow/deny across all of the user's roles that have overrides
  for (const roleId of memberRoleIds) {
    const override = overrides[roleId];
    if (override) {
      allow |= override.allow;
      deny |= override.deny;
    }
  }

  // Apply: remove denied bits, then add allowed bits
  // Deny takes precedence: if a bit is in both allow and deny, deny wins
  perms = (perms & ~deny) | (allow & ~deny);

  return perms;
}
