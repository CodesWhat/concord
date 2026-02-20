import Redis from "ioredis";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { automodRules } from "../models/schema.js";
import { config } from "../config.js";
import type { ServiceResult } from "@concord/shared";

const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 1 });
const CACHE_TTL = 60; // seconds

interface AutomodRule {
  id: string;
  serverId: string;
  type: string;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  action: string;
}

interface CheckResult {
  blocked: boolean;
  reason?: string;
  action: "delete" | "warn" | "mute" | "kick";
  ruleName?: string;
}

// Get rules from cache or DB
export async function getRules(serverId: string): Promise<AutomodRule[]> {
  const cacheKey = `automod:rules:${serverId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const rules = await db.select().from(automodRules).where(eq(automodRules.serverId, serverId));
  const mapped: AutomodRule[] = rules.map((r) => ({
    ...r,
    config: r.config as Record<string, unknown>,
  }));
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(mapped));
  return mapped;
}

// Check message against all enabled rules
export async function checkMessage(
  serverId: string,
  userId: string,
  content: string,
): Promise<CheckResult> {
  const rules = await getRules(serverId);
  const enabledRules = rules.filter((r) => r.enabled);

  for (const rule of enabledRules) {
    const result = await checkRule(rule, serverId, userId, content);
    if (result.blocked) return result;
  }

  return { blocked: false, action: "delete" };
}

async function checkRule(
  rule: AutomodRule,
  serverId: string,
  userId: string,
  content: string,
): Promise<CheckResult> {
  switch (rule.type) {
    case "word_filter":
      return checkWordFilter(rule, content);
    case "link_filter":
      return checkLinkFilter(rule, content);
    case "spam":
      return await checkSpam(rule, serverId, userId);
    case "raid":
      // Raid detection is checked on member join, not on message
      return { blocked: false, action: "delete" };
    default:
      return { blocked: false, action: "delete" };
  }
}

function checkWordFilter(rule: AutomodRule, content: string): CheckResult {
  const cfg = rule.config as { words?: string[]; matchMode?: "exact" | "contains" };
  const words = cfg.words ?? [];
  const mode = cfg.matchMode ?? "contains";
  const lower = content.toLowerCase();

  for (const word of words) {
    const lowerWord = word.toLowerCase();
    if (mode === "exact") {
      const regex = new RegExp(`\\b${escapeRegex(lowerWord)}\\b`, "i");
      if (regex.test(lower)) {
        return {
          blocked: true,
          reason: "Message contains blocked word",
          action: rule.action as CheckResult["action"],
          ruleName: rule.name,
        };
      }
    } else {
      if (lower.includes(lowerWord)) {
        return {
          blocked: true,
          reason: "Message contains blocked content",
          action: rule.action as CheckResult["action"],
          ruleName: rule.name,
        };
      }
    }
  }

  return { blocked: false, action: "delete" };
}

function checkLinkFilter(rule: AutomodRule, content: string): CheckResult {
  const cfg = rule.config as { allowedDomains?: string[]; blockedDomains?: string[] };
  const urlRegex = /https?:\/\/([^\s/]+)/gi;
  let match;

  while ((match = urlRegex.exec(content)) !== null) {
    const domain = match[1]!.toLowerCase();

    if (cfg.blockedDomains?.length) {
      if (cfg.blockedDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
        return {
          blocked: true,
          reason: `Link from blocked domain: ${domain}`,
          action: rule.action as CheckResult["action"],
          ruleName: rule.name,
        };
      }
    }

    if (cfg.allowedDomains?.length) {
      if (!cfg.allowedDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
        return {
          blocked: true,
          reason: `Link from unauthorized domain: ${domain}`,
          action: rule.action as CheckResult["action"],
          ruleName: rule.name,
        };
      }
    }
  }

  return { blocked: false, action: "delete" };
}

async function checkSpam(
  rule: AutomodRule,
  serverId: string,
  userId: string,
): Promise<CheckResult> {
  const cfg = rule.config as { maxMessages?: number; timeWindowSeconds?: number };
  const maxMessages = cfg.maxMessages ?? 5;
  const timeWindow = cfg.timeWindowSeconds ?? 5;

  const key = `spam:${serverId}:${userId}`;
  const now = Date.now();
  const windowStart = now - timeWindow * 1000;

  // Add current message timestamp and trim old entries
  await redis.zadd(key, now.toString(), `${now}`);
  await redis.zremrangebyscore(key, "-inf", windowStart.toString());
  await redis.expire(key, timeWindow + 1);

  const count = await redis.zcard(key);

  if (count > maxMessages) {
    return {
      blocked: true,
      reason: `Spam detected (${count} messages in ${timeWindow}s)`,
      action: rule.action as CheckResult["action"],
      ruleName: rule.name,
    };
  }

  return { blocked: false, action: "delete" };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// CRUD operations
export async function createRule(
  serverId: string,
  data: {
    name: string;
    type: string;
    config?: Record<string, unknown>;
    action?: string;
    enabled?: boolean;
  },
): Promise<ServiceResult<AutomodRule>> {
  try {
    const [rule] = await db
      .insert(automodRules)
      .values({
        serverId,
        name: data.name,
        type: data.type as any,
        config: data.config ?? {},
        action: data.action ?? "delete",
        enabled: data.enabled ?? true,
      })
      .returning();

    if (!rule) {
      return { data: null, error: { code: "INTERNAL", message: "Failed to create rule", statusCode: 500 } };
    }

    await invalidateCache(serverId);
    return { data: rule as unknown as AutomodRule, error: null };
  } catch (err) {
    console.error("[Automod] createRule error:", err);
    return { data: null, error: { code: "INTERNAL", message: "Internal error", statusCode: 500 } };
  }
}

export async function updateRule(
  ruleId: string,
  serverId: string,
  data: Partial<{ name: string; config: Record<string, unknown>; action: string; enabled: boolean }>,
): Promise<ServiceResult<AutomodRule>> {
  try {
    const [rule] = await db
      .update(automodRules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(automodRules.id, ruleId), eq(automodRules.serverId, serverId)))
      .returning();

    if (!rule) {
      return { data: null, error: { code: "NOT_FOUND", message: "Rule not found", statusCode: 404 } };
    }

    await invalidateCache(serverId);
    return { data: rule as unknown as AutomodRule, error: null };
  } catch (err) {
    console.error("[Automod] updateRule error:", err);
    return { data: null, error: { code: "INTERNAL", message: "Internal error", statusCode: 500 } };
  }
}

export async function deleteRule(
  ruleId: string,
  serverId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  try {
    await db
      .delete(automodRules)
      .where(and(eq(automodRules.id, ruleId), eq(automodRules.serverId, serverId)));

    await invalidateCache(serverId);
    return { data: { deleted: true }, error: null };
  } catch (err) {
    console.error("[Automod] deleteRule error:", err);
    return { data: null, error: { code: "INTERNAL", message: "Internal error", statusCode: 500 } };
  }
}

export async function listRules(serverId: string): Promise<ServiceResult<AutomodRule[]>> {
  try {
    const rules = await getRules(serverId);
    return { data: rules, error: null };
  } catch (err) {
    console.error("[Automod] listRules error:", err);
    return { data: null, error: { code: "INTERNAL", message: "Internal error", statusCode: 500 } };
  }
}

async function invalidateCache(serverId: string): Promise<void> {
  await redis.del(`automod:rules:${serverId}`);
}
