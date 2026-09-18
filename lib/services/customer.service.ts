import { query } from '../db';

export interface DbCustomerProfile {
  id: string;
  userId: string;
  tenantId: string;
  farmerId: string;
  deliveryAddress: string;
  milkType: string;
  dailyQuantity: number;
  qrToken: string;
  isActive: boolean;
  name?: string;
  phone?: string;
  email?: string;
}

export async function getCustomersByFarmer(farmerId: string, tenantId?: string): Promise<DbCustomerProfile[]> {
  try {
    let sql = `
      SELECT c.id, c.user_id as "userId", c.tenant_id as "tenantId", c.farmer_id as "farmerId",
             c.delivery_address as "deliveryAddress", c.milk_type as "milkType",
             c.daily_quantity::float as "dailyQuantity", c.qr_token as "qrToken",
             c.is_active as "isActive", u.name, u.phone, u.email
      FROM customer_profiles c
      JOIN users u ON c.user_id = u.id
      WHERE c.farmer_id = $1
    `;
    const params: unknown[] = [farmerId];
    if (tenantId) {
      sql += ` AND c.tenant_id = $2`;
      params.push(tenantId);
    }
    sql += ` ORDER BY u.name ASC`;
    const res = await query<DbCustomerProfile>(sql, params);
    return res.rows;
  } catch (err) {
    console.error('[CustomerService] getCustomersByFarmer error:', err);
    return [];
  }
}

export async function getCustomerById(customerId: string): Promise<DbCustomerProfile | null> {
  try {
    const res = await query<DbCustomerProfile>(
      `SELECT c.id, c.user_id as "userId", c.tenant_id as "tenantId", c.farmer_id as "farmerId",
              c.delivery_address as "deliveryAddress", c.milk_type as "milkType",
              c.daily_quantity::float as "dailyQuantity", c.qr_token as "qrToken",
              c.is_active as "isActive", u.name, u.phone, u.email
       FROM customer_profiles c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [customerId]
    );
    return res.rows[0] || null;
  } catch (err) {
    console.error('[CustomerService] getCustomerById error:', err);
    return null;
  }
}

export async function getCustomerByUserId(userId: string): Promise<DbCustomerProfile | null> {
  try {
    const res = await query<DbCustomerProfile>(
      `SELECT c.id, c.user_id as "userId", c.tenant_id as "tenantId", c.farmer_id as "farmerId",
              c.delivery_address as "deliveryAddress", c.milk_type as "milkType",
              c.daily_quantity::float as "dailyQuantity", c.qr_token as "qrToken",
              c.is_active as "isActive", u.name, u.phone, u.email
       FROM customer_profiles c
       JOIN users u ON c.user_id = u.id
       WHERE c.user_id = $1`,
      [userId]
    );
    return res.rows[0] || null;
  } catch (err) {
    console.error('[CustomerService] getCustomerByUserId error:', err);
    return null;
  }
}

export async function getAllCustomersPlatform(): Promise<DbCustomerProfile[]> {
  try {
    const res = await query<DbCustomerProfile>(
      `SELECT c.id, c.user_id as "userId", c.tenant_id as "tenantId", c.farmer_id as "farmerId",
              c.delivery_address as "deliveryAddress", c.milk_type as "milkType",
              c.daily_quantity::float as "dailyQuantity", c.qr_token as "qrToken",
              c.is_active as "isActive", u.name, u.phone, u.email
       FROM customer_profiles c
       JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC`
    );
    return res.rows;
  } catch (err) {
    console.error('[CustomerService] getAllCustomersPlatform error:', err);
    return [];
  }
}
