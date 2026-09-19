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

export function clearScopeCache(): void {
  // No-op for backward compatibility
}

/**
 * Resolve the real tenant + farmer UUIDs that satisfy DB foreign keys for an authenticated session.
 * Enforces multi-tenant isolation by checking session parameters against PostgreSQL.
 * In unit test mode without live DB, returns fixture scope.
 */
export async function resolveDbScope(session?: SessionUser | null): Promise<DbScope> {
  if (isTestMode()) {
    const tenantId = session?.tenantId || 'tenant_greenvalley';
    const farmerId = session?.farmerId || 'farmer_01';
    return { tenantId, farmerId };
  }

  if (!session || !session.tenantId) {
    throw new Error('Unauthorized: Valid authenticated session context required.');
  }

  const tenantId = session.tenantId;

  // 1. Verify tenant exists and is active
  const t = await query(`SELECT id FROM tenants WHERE id = $1 AND is_active = true`, [tenantId]);
  if (t.rows.length === 0) {
    throw new Error(`Tenant '${tenantId}' does not exist or is inactive.`);
  }

  // 2. Resolve farmer profile for tenant
  let farmerId: string | null = session.farmerId || null;
  if (farmerId) {
    const f = await query(
      `SELECT id FROM farmer_profiles WHERE id = $1 AND tenant_id = $2`,
      [farmerId, tenantId]
    );
    if (f.rows.length > 0) farmerId = f.rows[0].id as string;
    else farmerId = null;
  }

  if (!farmerId) {
    // Lookup farmer associated with user or tenant
    const f = await query(
      `SELECT f.id FROM farmer_profiles f
       WHERE f.tenant_id = $1
       ORDER BY f.created_at ASC LIMIT 1`,
      [tenantId]
    );
    if (f.rows.length > 0) {
      farmerId = f.rows[0].id as string;
    } else {
      throw new Error(`No farmer profile found for tenant '${tenantId}'.`);
    }
  }

  return { tenantId, farmerId };
}

