import { query } from '@/lib/db';

export interface InvariantResult {
  valid: boolean;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * CustomerOwnershipInvariant:
 * Guarantees that a customer is strictly bound to their creator Farmer and Tenant,
 * and cannot be orphaned or assigned to multiple primary farmers without an approved transfer.
 */
export async function assertCustomerOwnership(params: {
  customerId: string;
  farmerId: string;
  tenantId: string;
}): Promise<InvariantResult> {
  const res = await query<{
    id: string;
    farmerId: string;
    tenantId: string;
  }>(
    `SELECT id, farmer_id as "farmerId", tenant_id as "tenantId" 
     FROM customer_profiles 
     WHERE id = $1`,
    [params.customerId]
  );

  const customer = res.rows[0];
  if (!customer) {
    return {
      valid: false,
      code: 'CUSTOMER_NOT_FOUND',
      message: `Customer ${params.customerId} does not exist in database.`,
    };
  }

  if (customer.tenantId !== params.tenantId) {
    return {
      valid: false,
      code: 'TENANT_MISMATCH',
      message: `Customer ${params.customerId} belongs to tenant ${customer.tenantId}, not ${params.tenantId}.`,
      details: { expectedTenantId: params.tenantId, actualTenantId: customer.tenantId },
    };
  }

  if (customer.farmerId !== params.farmerId) {
    return {
      valid: false,
      code: 'FARMER_OWNERSHIP_MISMATCH',
      message: `Customer ${params.customerId} is owned by farmer ${customer.farmerId}, not ${params.farmerId}.`,
      details: { expectedFarmerId: params.farmerId, actualFarmerId: customer.farmerId },
    };
  }

  return { valid: true, code: 'OK', message: 'Customer ownership invariant satisfied.' };
}
