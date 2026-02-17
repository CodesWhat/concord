import { eq, and, desc, max } from "drizzle-orm";
import { db } from "../db.js";
import { roles, memberRoles } from "../models/schema.js";
import type { ServiceResult } from "@concord/shared";

// Role type with permissions as number (not bigint) for JSON serialization
type Role = Omit<typeof roles.$inferSelect, "permissions"> & { permissions: number };

function toRole(row: typeof roles.$inferSelect): Role {
  return { ...row, permissions: Number(row.permissions) };
}

export async function getRoles(
  serverId: string,
): Promise<ServiceResult<Role[]>> {
  const result = await db
    .select()
    .from(roles)
    .where(eq(roles.serverId, serverId))
    .orderBy(desc(roles.position));

  return { data: result.map(toRole), error: null };
}

export async function createRole(
  serverId: string,
  data: {
    name: string;
    color?: string;
    permissions?: number;
    mentionable?: boolean;
    hoisted?: boolean;
  },
): Promise<ServiceResult<Role>> {
  // Get next position (max + 1)
  const [maxResult] = await db
    .select({ maxPos: max(roles.position) })
    .from(roles)
    .where(eq(roles.serverId, serverId));

  const nextPosition = (maxResult?.maxPos ?? -1) + 1;

  const [role] = await db
    .insert(roles)
    .values({
      serverId,
      name: data.name,
      color: data.color,
      permissions: data.permissions != null ? BigInt(data.permissions) : 0n,
      mentionable: data.mentionable,
      hoisted: data.hoisted,
      position: nextPosition,
    })
    .returning();

  if (!role) {
    return { data: null, error: { code: "INTERNAL", message: "Failed to create role", statusCode: 500 } };
  }

  return { data: toRole(role), error: null };
}

export async function updateRole(
  roleId: string,
  serverId: string,
  updates: {
    name?: string;
    color?: string;
    permissions?: number;
    mentionable?: boolean;
    hoisted?: boolean;
  },
): Promise<ServiceResult<Role>> {
  // Check if this is the default (position-0) role
  const existing = await db
    .select({ position: roles.position, name: roles.name })
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.serverId, serverId)))
    .limit(1);

  if (existing.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Role not found", statusCode: 404 } };
  }

  // Prevent renaming the position-0 default role
  if (existing[0]!.position === 0 && updates.name && updates.name !== existing[0]!.name) {
    return { data: null, error: { code: "BAD_REQUEST", message: "Cannot rename the default role", statusCode: 400 } };
  }

  // Build set object, converting permissions to bigint if present
  const setValues: Record<string, unknown> = {};
  if (updates.name !== undefined) setValues.name = updates.name;
  if (updates.color !== undefined) setValues.color = updates.color;
  if (updates.permissions !== undefined) setValues.permissions = BigInt(updates.permissions);
  if (updates.mentionable !== undefined) setValues.mentionable = updates.mentionable;
  if (updates.hoisted !== undefined) setValues.hoisted = updates.hoisted;

  if (Object.keys(setValues).length === 0) {
    return { data: null, error: { code: "BAD_REQUEST", message: "No updates provided", statusCode: 400 } };
  }

  const result = await db
    .update(roles)
    .set(setValues)
    .where(and(eq(roles.id, roleId), eq(roles.serverId, serverId)))
    .returning();

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Role not found", statusCode: 404 } };
  }

  return { data: toRole(result[0]!), error: null };
}

export async function deleteRole(
  roleId: string,
  serverId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  // Check if this is the default role
  const existing = await db
    .select({ position: roles.position })
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.serverId, serverId)))
    .limit(1);

  if (existing.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Role not found", statusCode: 404 } };
  }

  if (existing[0]!.position === 0) {
    return { data: null, error: { code: "BAD_REQUEST", message: "Cannot delete the default role", statusCode: 400 } };
  }

  // Transaction: delete member_roles first, then the role
  await db.transaction(async (tx) => {
    await tx.delete(memberRoles).where(eq(memberRoles.roleId, roleId));
    await tx.delete(roles).where(and(eq(roles.id, roleId), eq(roles.serverId, serverId)));
  });

  return { data: { deleted: true }, error: null };
}

export async function assignRole(
  userId: string,
  serverId: string,
  roleId: string,
): Promise<ServiceResult<{ assigned: true }>> {
  // Validate role belongs to server
  const role = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.serverId, serverId)))
    .limit(1);

  if (role.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Role not found in this server", statusCode: 404 } };
  }

  await db
    .insert(memberRoles)
    .values({ userId, serverId, roleId })
    .onConflictDoNothing();

  return { data: { assigned: true }, error: null };
}

export async function removeRole(
  userId: string,
  serverId: string,
  roleId: string,
): Promise<ServiceResult<{ removed: true }>> {
  // Check if this is the default role
  const role = await db
    .select({ position: roles.position })
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.serverId, serverId)))
    .limit(1);

  if (role.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Role not found", statusCode: 404 } };
  }

  if (role[0]!.position === 0) {
    return { data: null, error: { code: "BAD_REQUEST", message: "Cannot remove the default role assignment", statusCode: 400 } };
  }

  await db
    .delete(memberRoles)
    .where(
      and(
        eq(memberRoles.userId, userId),
        eq(memberRoles.serverId, serverId),
        eq(memberRoles.roleId, roleId),
      ),
    );

  return { data: { removed: true }, error: null };
}

export async function getMemberRoles(
  userId: string,
  serverId: string,
): Promise<ServiceResult<Role[]>> {
  const result = await db
    .select({
      id: roles.id,
      serverId: roles.serverId,
      name: roles.name,
      color: roles.color,
      position: roles.position,
      permissions: roles.permissions,
      mentionable: roles.mentionable,
      hoisted: roles.hoisted,
    })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .where(
      and(
        eq(memberRoles.userId, userId),
        eq(memberRoles.serverId, serverId),
      ),
    );

  return { data: result.map(toRole), error: null };
}

export async function getHighestRolePosition(
  userId: string,
  serverId: string,
): Promise<number> {
  const result = await db
    .select({ maxPos: max(roles.position) })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .where(
      and(
        eq(memberRoles.userId, userId),
        eq(memberRoles.serverId, serverId),
      ),
    );

  return result[0]?.maxPos ?? 0;
}
