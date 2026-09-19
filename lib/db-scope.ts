import crypto from 'crypto';
import { query } from './db';
import type { SessionUser } from './auth';

/**
 * Shared durability helpers.
 *
 * Root cause of "edits not saving": API routes generated non-UUID ids
 * (`cust_*`, `del_*`, `pay_*`, …) while PostgreSQL PKs are `uuid()`,
 * hardcoded seed scope (`tenant_greenvalley` / `farmer_01` / `F001`)
 * that violates real FK rows, and swallowed DB errors with
 * `catch + console.warn` while still returning `success: true`
 * for an in-memory-only write that vanishes on restart and is masked
 * on the next DB-first read.
 *
 * Rules for durable writes:
 * 1. Always generate `crypto.randomUUID()` ids for DB inserts.
 * 2. Always resolve tenant/farmer to real DB UUIDs via `resolveDbScope`.
 * 3. Never `ON CONFLICT DO NOTHING` silently — check duplicates first.
 * 4. Never return `success: true` when the DB write failed outside tests.
 */

export const isTestMode = (): boolean =>
  process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

export const newUuid = (): string => crypto.randomUUID();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v?: string | null): v is string => !!v && UUID_RE.test(v);

export interface DbScope {
  tenantId: string;
  farmerId: string;
}

let scopeCache: { scope: DbScope; at: number } | null = null;
const SCOPE_TTL_MS = 60_000;

export function clearScopeCache(): void {
  scopeCache = null;
}

/**
 * Resolve the real tenant + farmer UUIDs that satisfy DB foreign keys.
 * Prefers the session values when they are UUIDs present in the database,
 * otherwise falls back to the first active tenant and its farmer profile.
 * Throws when no tenant/farmer exists so callers fail loudly (500)
 * instead of pretending an in-memory write was saved.
 */
export async function resolveDbScope(session?: SessionUser | null): Promise<DbScope> {
  if (scopeCache && Date.now() - scopeCache.at < SCOPE_TTL_MS) {
    return scopeCache.scope;
  }

  // 1. Session tenant, when it is a real DB row.
  let tenantId: string | null = null;
  if (isUuid(session?.tenantId)) {
    try {
      const t = await query(`SELECT id FROM tenants WHERE id = $1`, [session!.tenantId]);
      if (t.rows.length > 0) tenantId = session!.tenantId;
    } catch {
      // fall through to default tenant lookup
    }
  }

  // 2. Default: first active tenant.
  if (!tenantId) {
    const t = await query(
      `SELECT id FROM tenants WHERE is_active = true ORDER BY created_at ASC LIMIT 1`
    );
    if (t.rows.length === 0) {
      throw new Error('No active tenant found in database. Run database seed/migration first.');
    }
    tenantId = t.rows[0].id as string;
  }

  // 3. Farmer: session farmer when real, else first farmer of the tenant.
  let farmerId: string | null = null;
  if (isUuid(session?.farmerId)) {
    try {
      const f = await query(
        `SELECT id FROM farmer_profiles WHERE id = $1 AND tenant_id = $2`,
        [session!.farmerId, tenantId]
      );
      if (f.rows.length > 0) farmerId = session!.farmerId;
    } catch {
      // fall through
    }
  }
  if (!farmerId) {
    const f = await query(
      `SELECT id FROM farmer_profiles WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [tenantId]
    );
    if (f.rows.length === 0) {
      throw new Error('No farmer profile found for tenant. Run database seed first.');
    }
    farmerId = f.rows[0].id as string;
  }

  const scope = { tenantId, farmerId };
  scopeCache = { scope, at: Date.now() };
  return scope;
}
