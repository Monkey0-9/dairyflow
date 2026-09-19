import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { generateRawInvitationToken, hashInvitationToken } from '@/lib/security/invitation-crypto';

export interface CsvCustomerRow {
  name: string;
  phone: string;
  address: string;
  milkType?: string;
  quantity?: number;
  shift?: string;
  price?: number;
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req, ['OWNER', 'FARMER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const { customers, dryRun } = await req.json();

    if (!Array.isArray(customers) || customers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'A non-empty array of customer records is required.' },
        { status: 400 }
      );
    }

    const tenantId = auth.user.tenantId;
    const farmerId = auth.user.farmerId || 'F001';

    const errors: { row: number; phone: string; error: string }[] = [];
    const validRows: CsvCustomerRow[] = [];

    // Phase 1: Validation & Deduplication Check
    for (let i = 0; i < customers.length; i++) {
      const row = customers[i];
      if (!row.name || !row.phone || !row.address) {
        errors.push({ row: i + 1, phone: row.phone || 'N/A', error: 'Missing name, phone, or address.' });
        continue;
      }

      const cleanPhone = String(row.phone).trim();
      const existing = await query('SELECT id FROM users WHERE phone = $1', [cleanPhone]);
      if (existing.rows.length > 0) {
        errors.push({ row: i + 1, phone: cleanPhone, error: 'Phone number already registered.' });
        continue;
      }

      validRows.push({
        name: String(row.name).trim(),
        phone: cleanPhone,
        address: String(row.address).trim(),
        milkType: row.milkType || 'Cow',
        quantity: typeof row.quantity === 'number' ? row.quantity : 1.0,
        shift: row.shift || 'MORNING',
        price: typeof row.price === 'number' ? row.price : 60.0,
      });
    }

    // If dryRun mode (Preview phase)
    if (dryRun) {
      return NextResponse.json({
        success: true,
        preview: true,
        totalRows: customers.length,
        validCount: validRows.length,
        errorCount: errors.length,
        errors,
        validRows,
      });
    }

    // If errors exist in actual execution mode and user expects clean import
    if (errors.length > 0 && validRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'All rows failed validation.',
        errors,
      }, { status: 400 });
    }

    // Phase 2: Transactional Batch Creation in INVITED state
    const createdCustomers = [];
    await query('BEGIN');

    for (const row of validRows) {
      const userId = `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const customerId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const email = `${row.phone.replace(/[^0-9]/g, '')}@milkflow.local`;
      const qrToken = `qr_inv_${customerId}`;

      // 1. Create User
      await query(
        `INSERT INTO users (id, tenant_id, email, phone, name, password_hash, password_salt, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'INVITED_PENDING_ACTIVATION', 'SALT', 'CUSTOMER', false, NOW(), NOW())`,
        [userId, tenantId, email, row.phone, row.name]
      );

      // 2. Create Customer Profile in INVITED state
      await query(
        `INSERT INTO customer_profiles (id, user_id, tenant_id, farmer_id, delivery_address, milk_type, daily_quantity, qr_token, is_active, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, 'INVITED', NOW(), NOW())`,
        [customerId, userId, tenantId, farmerId, row.address, row.milkType, row.quantity, qrToken]
      );

      // 3. Create Hashed Invitation Token
      const rawToken = generateRawInvitationToken();
      const tokenHash = hashInvitationToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await query(
        `INSERT INTO customer_invitations (id, customer_id, token_hash, channel, expires_at, created_by_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'SMS', $3, $4, NOW())`,
        [customerId, tokenHash, expiresAt.toISOString(), auth.user.userId]
      );

      createdCustomers.push({
        customerId,
        name: row.name,
        phone: row.phone,
        invitationToken: rawToken, // Provided once in import response for dispatch
      });
    }

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      importedCount: createdCustomers.length,
      errorCount: errors.length,
      errors,
      createdCustomers,
    });
  } catch (err: unknown) {
    await query('ROLLBACK').catch(() => {});
    const message = err instanceof Error ? err.message : 'Import failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
