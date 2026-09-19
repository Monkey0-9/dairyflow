import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hashPassword, verifyPassword } from '@/lib/auth';
import { query, transaction } from '@/lib/db';

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
        { status: 401 }
      );
    }

    // 3. Hash new password with scrypt
    const { hash: newHash, salt: newSalt } = hashPassword(newPassword);

    // 4. Update password inside a transaction and log cryptographic audit block
    await transaction(async (client) => {
      await client.query(
        `UPDATE users
         SET password_hash = $1, password_salt = $2, updated_at = NOW()
         WHERE id = $3`,
        [newHash, newSalt, session.userId]
      );
    });

    try {
      const { appendAuditLog } = await import('@/lib/services/audit.service');
      await appendAuditLog({
        tenantId: userRow.tenant_id,
        actorId: session.userId,
        actorRole: userRow.role,
        entityType: 'USER',
        entityId: session.userId,
        action: 'USER_PASSWORD_CHANGED',
        beforeState: { passwordUpdated: false },
        afterState: { passwordUpdated: true, timestamp: new Date().toISOString() },
      });
    } catch (auditErr) {
      console.warn('[ChangePassword] Audit log warning:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been successfully updated and secured.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update password';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
