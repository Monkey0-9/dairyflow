import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hashPassword, verifyPassword } from '@/lib/auth';
import { query, transaction } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Active session required.' }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json({ success: false, error: 'Current password is required.' }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    // 1. Fetch current password hash from PostgreSQL
    const userRes = await query<{
      id: string;
      password_hash: string;
      password_salt: string;
      tenant_id: string;
      email: string;
      role: string;
    }>(
      `SELECT id, password_hash, password_salt, tenant_id, email, role FROM users WHERE id = $1`,
      [session.userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User account not found.' }, { status: 404 });
    }

    const userRow = userRes.rows[0];

    // 2. Constant-time verification of current password
    const isCurrentValid = verifyPassword(currentPassword, userRow.password_hash, userRow.password_salt);
    if (!isCurrentValid) {
      return NextResponse.json(
        { success: false, error: 'The current password you entered is incorrect.' },
        { status: 400 }
      );
    }

    // 3. Hash new password with scrypt
    const { hash: newHash, salt: newSalt } = hashPassword(newPassword);

    // 4. Update password inside a transaction and log audit block
    await transaction(async (client) => {
      await client.query(
        `UPDATE users
         SET password_hash = $1, password_salt = $2, updated_at = NOW()
         WHERE id = $3`,
        [newHash, newSalt, session.userId]
      );

      // Fetch last audit block hash for cryptographic continuity
      const lastAuditRes = await client.query<{ current_hash: string; block_index: number }>(
        `SELECT current_hash, block_index FROM audit_blocks ORDER BY block_index DESC LIMIT 1`
      );

      const previousHash = lastAuditRes.rows[0]?.current_hash || '0000000000000000000000000000000000000000000000000000000000000000';
      const blockIndex = (lastAuditRes.rows[0]?.block_index ?? -1) + 1;
      const timestamp = new Date().toISOString();
      const auditId = `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const rawBlock = `${blockIndex}|${timestamp}|USER|${session.userId}|PASSWORD_CHANGED|${previousHash}`;
      const currentHash = crypto.createHash('sha256').update(rawBlock).digest('hex');

      await client.query(
        `INSERT INTO audit_blocks (
           id, block_index, timestamp, entity_type, entity_id, action,
           actor_id, actor_name, actor_role, before_state, after_state,
           previous_hash, current_hash
         ) VALUES ($1, $2, $3, 'USER', $4, 'PASSWORD_CHANGED', $5, $6, $7, $8, $9, $10, $11)`,
        [
          auditId,
          blockIndex,
          timestamp,
          session.userId,
          session.userId,
          session.name,
          session.role,
          JSON.stringify({ passwordUpdated: false }),
          JSON.stringify({ passwordUpdated: true, timestamp }),
          previousHash,
          currentHash,
        ]
      );
    });

    return NextResponse.json({
      success: true,
      message: 'Your password has been successfully updated and secured.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update password';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
