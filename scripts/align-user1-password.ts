import { query, getPool } from '../lib/db.js';
import { hashPassword } from '../lib/auth.js';

async function updatePassword() {
  const { hash, salt } = hashPassword('Abc@1234');
  const res = await query(
    `UPDATE users
     SET password_hash = $1, password_salt = $2, is_active = true
     WHERE LOWER(email) = 'user1@dairy.com'`,
    [hash, salt]
  );
  console.log(`Updated user1@dairy.com password: ${res.rowCount} row(s) updated.`);
  await getPool().end();
  process.exit(0);
}

updatePassword().catch(err => {
  console.error(err);
  process.exit(1);
});
