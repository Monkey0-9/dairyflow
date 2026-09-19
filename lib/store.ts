import crypto from 'crypto';
import {
  User,
  FarmerProfile,
  CustomerProfile,
  Product,
  Subscription,
  DeliveryRecord,
  Dispute,
  Invoice,
  Payment,
  VacationPause,
  TemporaryQuantityChange,
  CryptographicAuditBlock,
  InventoryReconciliation,
  Notification,
  DeliveryStatus,
  DayOfWeek,
  DisputeReason,
  DisputeResolutionType,
  DayLockStatus,
  UserRole,
  DeliveryShift,
  AccountStatus,
  ExtraMilkRequest,
  PauseRequest,
  ActivityEvent,
  AdminOperationalStats,
} from './types';

declare global {
  var __milkFlowStore: MilkFlowStore | undefined;
}

export class MilkFlowStore {
  tenantId = 'tenant_greenvalley';
  users: User[] = [];
  farmer: FarmerProfile;
  customers: CustomerProfile[] = [];
  products: Product[] = [];
  subscriptions: Subscription[] = [];
  vacationPauses: VacationPause[] = [];
  tempQuantityChanges: TemporaryQuantityChange[] = [];
  deliveryRecords: Map<string, DeliveryRecord> = new Map();
  disputes: Dispute[] = [];
  invoices: Invoice[] = [];
  payments: Payment[] = [];
  auditChain: CryptographicAuditBlock[] = [];
  inventoryReconciliations: Map<string, InventoryReconciliation> = new Map(); // key: date
  dayLockStatusMap: Map<string, DayLockStatus> = new Map(); // key: date
  notifications: Notification[] = [];
  processedTransactionRefs: Set<string> = new Set(); // For payment idempotency
  extraMilkRequests: ExtraMilkRequest[] = [];
  pauseRequests: PauseRequest[] = [];
  activities: ActivityEvent[] = [];

  constructor() {
    this.farmer = {
      id: 'farmer_01',
      tenantId: this.tenantId,
      userId: 'user_prakash',
      farmName: 'GreenValley Dairy Farm',
      phone: '+91 98765 43210',
      address: 'Plot 42, Anand-Nadiad Highway, Anand, Gujarat 388001',
      upiId: 'prakash@okaxis',
      qrPayload: 'upi://pay?pa=prakash@okaxis&pn=GreenValley%20Dairy&cu=INR',
    };

    // Production Safety Guard: Demo data is strictly prohibited in production.
    // It is ONLY populated during automated test suites or if explicitly requested in non-production environments.
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || process.env.TEST_ENV === 'unit';
    const isDevWithDemo = process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEMO_DATA === 'true';
    if (isTest || isDevWithDemo) {
      this.initDemoData();
    }
  }

  // Cryptographic SHA-256 Hash Chain Engine
  private computeBlockHash(
    blockIndex: number,
    timestamp: string,
    entityType: string,
    entityId: string,
    action: string,
    beforeStateStr: string,
    afterStateStr: string,
    previousHash: string
  ): string {
    const dataToHash = `${blockIndex}|${timestamp}|${entityType}|${entityId}|${action}|${beforeStateStr}|${afterStateStr}|${previousHash}`;
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
  }

  public appendCryptographicAudit(params: {
    entityType: CryptographicAuditBlock['entityType'];
    entityId: string;
    action: string;
    actor: { userId: string; name: string; role: UserRole; ipAddress?: string };
    beforeState?: Record<string, unknown>;
    afterState: Record<string, unknown>;
    reason?: string;
  }): CryptographicAuditBlock {
    const blockIndex = this.auditChain.length;
    const timestamp = new Date().toISOString();
    const previousHash =
      blockIndex === 0
        ? '0000000000000000000000000000000000000000000000000000000000000000'
        : this.auditChain[blockIndex - 1].currentHash;

    const beforeStateStr = JSON.stringify(params.beforeState || {});
    const afterStateStr = JSON.stringify(params.afterState);

    const currentHash = this.computeBlockHash(
      blockIndex,
      timestamp,
      params.entityType,
      params.entityId,
      params.action,
      beforeStateStr,
      afterStateStr,
      previousHash
    );

    const block: CryptographicAuditBlock = {
      blockIndex,
      timestamp,
      entityType: params.entityType,
      entityId: params.entityId,
      tenantId: this.tenantId,
      actor: {
        userId: params.actor.userId,
        name: params.actor.name,
        role: params.actor.role,
        ipAddress: params.actor.ipAddress || '127.0.0.1',
      },
      action: params.action,
      beforeState: params.beforeState,
      afterState: params.afterState,
      reason: params.reason,
      previousHash,
      currentHash,
    };

    this.auditChain.push(block);
    return block;
  }

  // Audit-chain verification algorithm: traverses chain and re-hashes every block
  public verifyAuditChain(): {
    valid: boolean;
    totalBlocks: number;
    tamperedBlockIndex?: number;
    errorReason?: string;
    latestHash: string;
  } {
    if (this.auditChain.length === 0) {
      return { valid: true, totalBlocks: 0, latestHash: '' };
    }

    for (let i = 0; i < this.auditChain.length; i++) {
      const block = this.auditChain[i];

      // Check previousHash link
      const expectedPrevHash =
        i === 0
          ? '0000000000000000000000000000000000000000000000000000000000000000'
          : this.auditChain[i - 1].currentHash;

      if (block.previousHash !== expectedPrevHash) {
        return {
          valid: false,
          totalBlocks: this.auditChain.length,
          tamperedBlockIndex: i,
          errorReason: `Block #${i} has broken previousHash link. Expected: ${expectedPrevHash.substring(0, 12)}..., found: ${block.previousHash.substring(0, 12)}...`,
          latestHash: this.auditChain[this.auditChain.length - 1].currentHash,
        };
      }

      // Re-hash block content
      const recalculatedHash = this.computeBlockHash(
        block.blockIndex,
        block.timestamp,
        block.entityType,
        block.entityId,
        block.action,
        JSON.stringify(block.beforeState || {}),
        JSON.stringify(block.afterState),
        block.previousHash
      );

      if (recalculatedHash !== block.currentHash) {
        return {
          valid: false,
          totalBlocks: this.auditChain.length,
          tamperedBlockIndex: i,
          errorReason: `Block #${i} data has been altered! Hash mismatch. Recalculated: ${recalculatedHash.substring(0, 12)}..., stored: ${block.currentHash.substring(0, 12)}...`,
          latestHash: this.auditChain[this.auditChain.length - 1].currentHash,
        };
      }
    }

    return {
      valid: true,
      totalBlocks: this.auditChain.length,
      latestHash: this.auditChain[this.auditChain.length - 1].currentHash,
    };
  }

  private initDemoData() {
    // 1. Users with tenantId
    this.users = [
      {
        id: 'user_prakash',
        tenantId: this.tenantId,
        name: 'Prakash Paraveen (Admin)',
        email: 'prakashparaveen046@gmail.com',
        phone: '+91 98765 43210',
        role: 'FARMER',
      },
      {
        id: 'user_farmer',
        tenantId: this.tenantId,
        name: 'Suresh Patel (Farmer)',
        email: 'suresh@greenvalleydairy.in',
        phone: '+91 98765 43210',
        role: 'FARMER',
      },
      {
        id: 'user_ravi',
        tenantId: this.tenantId,
        name: 'Ravi Kumar',
        email: 'ravi.kumar@gmail.com',
        phone: '+91 98234 56780',
        role: 'CUSTOMER',
      },
      {
        id: 'user_suresh_c',
        tenantId: this.tenantId,
        name: 'Suresh Sharma',
        email: 'suresh.sharma@yahoo.com',
        phone: '+91 98234 56781',
        role: 'CUSTOMER',
      },
      {
        id: 'user_manju',
        tenantId: this.tenantId,
        name: 'Manju Devi',
        email: 'manju.devi@gmail.com',
        phone: '+91 98234 56782',
        role: 'CUSTOMER',
      },
      {
        id: 'user_arun',
        tenantId: this.tenantId,
        name: 'Arun Pillai',
        email: 'arun.pillai@gmail.com',
        phone: '+91 98234 56783',
        role: 'CUSTOMER',
      },
      {
        id: 'user_priya',
        tenantId: this.tenantId,
        name: 'Priya Sharma',
        email: 'priya.sharma@outlook.com',
        phone: '+91 98234 56784',
        role: 'CUSTOMER',
      },
      {
        id: 'user_anand',
        tenantId: this.tenantId,
        name: 'Anand Verma',
        email: 'anand.verma@gmail.com',
        phone: '+91 98234 56785',
        role: 'CUSTOMER',
      },
      {
        id: 'user_admin',
        tenantId: 'tenant_platform',
        name: 'Platform SuperAdmin',
        email: 'admin@milkflow.in',
        phone: '+91 99999 00000',
        role: 'ADMIN',
      },
    ];

    // 2. Products
    this.products = [
      {
        id: 'prod_cow_milk',
        tenantId: this.tenantId,
        farmerId: 'farmer_01',
        name: 'Fresh Cow Milk',
        category: 'MILK',
        unit: 'Litre',
        basePrice: 50.0,
        description: '100% Pure, unadulterated fresh cow milk delivered daily morning',
        inStock: true,
      },
      {
        id: 'prod_buffalo_milk',
        tenantId: this.tenantId,
        farmerId: 'farmer_01',
        name: 'Rich Buffalo Milk',
        category: 'MILK',
        unit: 'Litre',
        basePrice: 70.0,
        description: 'Thick, creamy 7%+ fat buffalo milk ideal for tea and sweets',
        inStock: true,
      },
      {
        id: 'prod_a2_milk',
        tenantId: this.tenantId,
        farmerId: 'farmer_01',
        name: 'Desi Gir Cow A2 Milk',
        category: 'MILK',
        unit: 'Litre',
        basePrice: 85.0,
        description: 'Vedic Gir cow A2 certified wholesome farm fresh milk',
        inStock: true,
      },
      {
        id: 'prod_curd',
        tenantId: this.tenantId,
        farmerId: 'farmer_01',
        name: 'Fresh Malai Dahi (Curd)',
        category: 'CURD',
        unit: 'Kg',
        basePrice: 80.0,
        description: 'Set curd with sweet natural aroma and velvety texture',
        inStock: true,
      },
      {
        id: 'prod_paneer',
        tenantId: this.tenantId,
        farmerId: 'farmer_01',
        name: 'Farm Fresh Malai Paneer',
        category: 'PANEER',
        unit: 'Kg',
        basePrice: 360.0,
        description: 'Soft, melt-in-mouth cottage cheese prepared daily',
        inStock: true,
      },
      {
        id: 'prod_ghee',
        tenantId: this.tenantId,
        farmerId: 'farmer_01',
        name: 'Bilona Desi Cow Ghee',
        category: 'GHEE',
        unit: 'Kg',
        basePrice: 750.0,
        description: 'Traditional curd-churned golden aromatic ghee',
        inStock: true,
      },
      {
        id: 'prod_buttermilk',
        tenantId: this.tenantId,
        farmerId: 'farmer_01',
        name: 'Spiced Farm Buttermilk (Chaas)',
        category: 'BUTTERMILK',
        unit: 'Litre',
        basePrice: 25.0,
        description: 'Refreshing probiotic digestive chaas with cumin & mint',
        inStock: true,
      },
    ];

    // 3. Customers with Opaque Secure QR Tokens (no PII in QR)
    this.customers = [
      {
        id: 'cust_ravi',
        tenantId: this.tenantId,
        userId: 'user_ravi',
        farmerId: 'farmer_01',
        customerCode: 'MK-1024',
        qrToken: 'MK_QR_9a8b7c6d5e4f3a2b',
        name: 'Ravi Kumar',
        phone: '+91 98234 56780',
        address: 'Flat 302, Krishna Heights, Station Road',
        deliveryShift: 'MORNING',
        deliveryTime: '06:30 AM',
        deliverySequence: 1,
        active: true,
        accountStatus: 'ACTIVE',
        notes: 'Ring doorbell once and leave bottle in door basket',
        walletBalance: 0,
      },
      {
        id: 'cust_suresh',
        tenantId: this.tenantId,
        userId: 'user_suresh_c',
        farmerId: 'farmer_01',
        customerCode: 'MK-1025',
        qrToken: 'MK_QR_1b2c3d4e5f6a7b8c',
        name: 'Suresh Sharma',
        phone: '+91 98234 56781',
        address: 'B-14, Shanti Niketan Society',
        deliveryShift: 'MORNING',
        deliveryTime: '06:35 AM',
        deliverySequence: 2,
        active: true,
        accountStatus: 'ACTIVE',
        notes: 'Takes 0.5L daily, leaves washed glass bottle out',
        walletBalance: 0,
      },
      {
        id: 'cust_manju',
        tenantId: this.tenantId,
        userId: 'user_manju',
        farmerId: 'farmer_01',
        customerCode: 'MK-1026',
        qrToken: 'MK_QR_3c4d5e6f7a8b9c0d',
        name: 'Manju Devi',
        phone: '+91 98234 56782',
        address: 'House 88, Near Old Water Tank',
        deliveryShift: 'MORNING',
        deliveryTime: '06:40 AM',
        deliverySequence: 3,
        active: true,
        accountStatus: 'ACTIVE',
        notes: 'Buffalo milk preferred',
        walletBalance: 0,
      },
      {
        id: 'cust_arun',
        tenantId: this.tenantId,
        userId: 'user_arun',
        farmerId: 'farmer_01',
        customerCode: 'MK-1027',
        qrToken: 'MK_QR_5e6f7a8b9c0d1e2f',
        name: 'Arun Pillai',
        phone: '+91 98234 56783',
        address: 'Rowhouse 5, Palm Meadows',
        deliveryShift: 'MORNING',
        deliveryTime: '06:45 AM',
        deliverySequence: 4,
        active: true,
        accountStatus: 'ACTIVE',
        notes: 'Sometimes requests half milk on Wednesdays',
        walletBalance: 0,
      },
      {
        id: 'cust_priya',
        tenantId: this.tenantId,
        userId: 'user_priya',
        farmerId: 'farmer_01',
        customerCode: 'MK-1028',
        qrToken: 'MK_QR_7a8b9c0d1e2f3a4b',
        name: 'Priya Sharma',
        phone: '+91 98234 56784',
        address: 'Penthouse 7B, Skyway Residency',
        deliveryShift: 'MORNING',
        deliveryTime: '06:50 AM',
        deliverySequence: 5,
        active: true,
        accountStatus: 'PAUSED',
        notes: '1.5L Buffalo milk, scheduled vacation pause Sept 20-25',
        walletBalance: 0,
      },
      {
        id: 'cust_anand',
        tenantId: this.tenantId,
        userId: 'user_anand',
        farmerId: 'farmer_01',
        customerCode: 'MK-1029',
        qrToken: 'MK_QR_9c0d1e2f3a4b5c6d',
        name: 'Anand Verma',
        phone: '+91 98234 56785',
        address: 'Villa 12, Green Acres Lane',
        deliveryShift: 'MORNING',
        deliveryTime: '06:55 AM',
        deliverySequence: 6,
        active: true,
        accountStatus: 'ACTIVE',
        notes: '2.0L A2 Desi Cow Milk daily',
        walletBalance: 0,
      },
      {
        id: 'cust_vikram',
        tenantId: this.tenantId,
        userId: 'user_vikram',
        farmerId: 'farmer_01',
        customerCode: 'MK-1030',
        qrToken: 'MK_QR_9f8e7d6c5b4a3f2e',
        name: 'Vikram Singh',
        phone: '+91 98234 56786',
        address: 'House 45, Sector 4, Anand',
        deliveryShift: 'MORNING',
        deliveryTime: '07:00 AM',
        deliverySequence: 7,
        active: false,
        accountStatus: 'PENDING',
        notes: 'Requested 1.5 L Cow Milk daily morning. Awaiting farmer approval.',
        walletBalance: 0,
      },
    ];

    // 4. Subscriptions
    this.subscriptions = [
      {
        id: 'sub_ravi',
        tenantId: this.tenantId,
        customerId: 'cust_ravi',
        farmerId: 'farmer_01',
        productId: 'prod_cow_milk',
        productName: 'Fresh Cow Milk',
        defaultQuantity: 1.0,
        customPricePerUnit: 50.0,
        deliveryDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        deliveryShift: 'MORNING',
        startDate: '2026-01-01',
        active: true,
      },
      {
        id: 'sub_suresh',
        tenantId: this.tenantId,
        customerId: 'cust_suresh',
        farmerId: 'farmer_01',
        productId: 'prod_cow_milk',
        productName: 'Fresh Cow Milk',
        defaultQuantity: 0.5,
        customPricePerUnit: 50.0,
        deliveryDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        deliveryShift: 'MORNING',
        startDate: '2026-02-01',
        active: true,
      },
      {
        id: 'sub_manju',
        tenantId: this.tenantId,
        customerId: 'cust_manju',
        farmerId: 'farmer_01',
        productId: 'prod_buffalo_milk',
        productName: 'Rich Buffalo Milk',
        defaultQuantity: 1.0,
        customPricePerUnit: 70.0,
        deliveryDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        deliveryShift: 'MORNING',
        startDate: '2026-01-15',
        active: true,
      },
      {
        id: 'sub_arun',
        tenantId: this.tenantId,
        customerId: 'cust_arun',
        farmerId: 'farmer_01',
        productId: 'prod_cow_milk',
        productName: 'Fresh Cow Milk',
        defaultQuantity: 1.0,
        customPricePerUnit: 50.0,
        deliveryDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        deliveryShift: 'MORNING',
        startDate: '2026-03-01',
        active: true,
      },
      {
        id: 'sub_priya',
        tenantId: this.tenantId,
        customerId: 'cust_priya',
        farmerId: 'farmer_01',
        productId: 'prod_buffalo_milk',
        productName: 'Rich Buffalo Milk',
        defaultQuantity: 1.5,
        customPricePerUnit: 70.0,
        deliveryDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        deliveryShift: 'MORNING',
        startDate: '2026-01-10',
        active: true,
      },
      {
        id: 'sub_anand',
        tenantId: this.tenantId,
        customerId: 'cust_anand',
        farmerId: 'farmer_01',
        productId: 'prod_a2_milk',
        productName: 'Desi Gir Cow A2 Milk',
        defaultQuantity: 2.0,
        customPricePerUnit: 85.0,
        deliveryDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        deliveryShift: 'MORNING',
        startDate: '2026-04-01',
        active: true,
      },
    ];

    // 5. Vacation Pause
    this.vacationPauses = [
      {
        id: 'vac_priya_01',
        tenantId: this.tenantId,
        customerId: 'cust_priya',
        subscriptionId: 'sub_priya',
        startDate: '2026-09-20',
        endDate: '2026-09-25',
        reason: 'Family vacation to village - pause all milk deliveries',
        createdAt: '2026-09-14T10:00:00Z',
        status: 'ACTIVE',
      },
    ];

    // 6. Temporary Extra
    this.tempQuantityChanges = [
      {
        id: 'temp_ravi_01',
        tenantId: this.tenantId,
        customerId: 'cust_ravi',
        subscriptionId: 'sub_ravi',
        startDate: '2026-09-18',
        endDate: '2026-09-19',
        overrideQuantity: 2.0,
        reason: 'Guests arriving for Ganesh festival',
      },
    ];

    // 7. Populate September Delivery History
    this.seedSeptemberHistory();

    // 8. Open Dispute
    this.disputes = [
      {
        id: 'disp_01',
        tenantId: this.tenantId,
        deliveryRecordId: 'del_2026-09-16_cust_anand',
        customerId: 'cust_anand',
        customerName: 'Anand Verma',
        customerCode: 'MK-1029',
        farmerId: 'farmer_01',
        date: '2026-09-16',
        recordedQuantity: 2.0,
        claimedQuantity: 0.0,
        reason: 'DID_NOT_RECEIVE',
        customerNote: 'Delivery was marked as 2L delivered, but we did not receive any milk today morning. Please check.',
        status: 'OPEN',
        createdAt: '2026-09-16T08:30:00Z',
      },
    ];

    // 9. Initial Invoices
    this.invoices = [
      {
        id: 'inv_2026_09_ravi',
        tenantId: this.tenantId,
        farmerId: 'farmer_01',
        customerId: 'cust_ravi',
        customerName: 'Ravi Kumar',
        customerPhone: '+91 98234 56780',
        customerAddress: 'Flat 302, Krishna Heights, Station Road',
        invoiceNumber: 'INV-202609-1024',
        month: 9,
        year: 2026,
        monthName: 'September 2026',
        items: [
          {
            id: 'item_01',
            productId: 'prod_cow_milk',
            productName: 'Fresh Cow Milk',
            totalQuantity: 27.0,
            pricePerUnit: 50.0,
            amount: 1350.0,
          },
        ],
        totalQuantity: 27.0,
        subtotal: 1350.0,
        extraCharges: 0.0,
        creditsOrAdjustments: 0.0,
        totalAmount: 1350.0,
        paidAmount: 1000.0,
        outstandingAmount: 350.0,
        status: 'PARTIALLY_PAID',
        dueDate: '2026-10-05',
        generatedAt: '2026-09-16T00:00:00Z',
        lastPaymentAt: '2026-09-05T14:30:00Z',
      },
      {
        id: 'inv_2026_09_suresh',
        tenantId: this.tenantId,
        farmerId: 'farmer_01',
        customerId: 'cust_suresh',
        customerName: 'Suresh Sharma',
        customerPhone: '+91 98234 56781',
        customerAddress: 'B-14, Shanti Niketan Society',
        invoiceNumber: 'INV-202609-1025',
        month: 9,
        year: 2026,
        monthName: 'September 2026',
        items: [
          {
            id: 'item_02',
            productId: 'prod_cow_milk',
            productName: 'Fresh Cow Milk',
            totalQuantity: 14.5,
            pricePerUnit: 50.0,
            amount: 725.0,
          },
        ],
        totalQuantity: 14.5,
        subtotal: 725.0,
        extraCharges: 0.0,
        creditsOrAdjustments: 0.0,
        totalAmount: 725.0,
        paidAmount: 725.0,
        outstandingAmount: 0.0,
        status: 'PAID',
        dueDate: '2026-10-05',
        generatedAt: '2026-09-16T00:00:00Z',
        lastPaymentAt: '2026-09-10T11:20:00Z',
      },
    ];

    // 10. Processed Transaction Refs (Idempotency seed)
    this.processedTransactionRefs.add('UPI-20260905-19284');
    this.processedTransactionRefs.add('UPI-20260910-82910');

    // 11. Initial Payments
    this.payments = [
      {
        id: 'pay_01',
        tenantId: this.tenantId,
        invoiceId: 'inv_2026_09_ravi',
        customerId: 'cust_ravi',
        customerName: 'Ravi Kumar',
        farmerId: 'farmer_01',
        amount: 1000.0,
        paymentMethod: 'UPI',
        transactionRef: 'UPI-20260905-19284',
        receiptNumber: 'REC-202609-901',
        paidAt: '2026-09-05T14:30:00Z',
        note: 'Advance partial payment via Google Pay',
        status: 'SUCCESS',
      },
      {
        id: 'pay_02',
        tenantId: this.tenantId,
        invoiceId: 'inv_2026_09_suresh',
        customerId: 'cust_suresh',
        customerName: 'Suresh Sharma',
        farmerId: 'farmer_01',
        amount: 725.0,
        paymentMethod: 'UPI',
        transactionRef: 'UPI-20260910-82910',
        receiptNumber: 'REC-202609-902',
        paidAt: '2026-09-10T11:20:00Z',
        note: 'Full September bill payment via PhonePe',
        status: 'SUCCESS',
      },
    ];

    // 12. Genesis Cryptographic Audit Block
    this.appendCryptographicAudit({
      entityType: 'SUBSCRIPTION',
      entityId: 'sub_ravi',
      action: 'SYSTEM_INITIALIZATION',
      actor: {
        userId: 'user_farmer',
        name: 'Suresh Patel (Farmer)',
        role: 'FARMER',
        ipAddress: '127.0.0.1',
      },
      beforeState: {},
      afterState: { system: 'MilkFlow Ledger', status: 'ACTIVE' },
      reason: 'Genesis Ledger Initialization with cryptographic SHA-256 block 0',
    });

    // 13. Second Audit Block: Manju Devi Skip
    this.appendCryptographicAudit({
      entityType: 'DELIVERY_RECORD',
      entityId: 'del_2026-09-16_cust_manju',
      action: 'RECORD_STATUS_SKIPPED',
      actor: {
        userId: 'user_farmer',
        name: 'Suresh Patel (Farmer)',
        role: 'FARMER',
        ipAddress: '192.168.1.10',
      },
      beforeState: { scheduledQuantity: 1.0, deliveredQuantity: 1.0, status: 'DELIVERED' },
      afterState: { scheduledQuantity: 1.0, deliveredQuantity: 0.0, status: 'SKIPPED' },
      reason: 'Customer requested skip via WhatsApp',
    });

    // 14. Notifications
    this.notifications = [
      {
        id: 'notif_01',
        tenantId: this.tenantId,
        userId: 'user_farmer',
        title: '⚠ Delivery Dispute Raised',
        message: 'Anand Verma reported they did not receive milk today (16 Sep). Recorded: 2L.',
        type: 'DISPUTE',
        read: false,
        timestamp: '2026-09-16T08:35:00Z',
      },
      {
        id: 'notif_02',
        tenantId: this.tenantId,
        userId: 'user_farmer',
        title: '🌴 Vacation Pause Scheduled',
        message: 'Priya Sharma scheduled vacation pause from Sept 20 to Sept 25 (6 days).',
        type: 'SYSTEM',
        read: false,
        timestamp: '2026-09-14T10:05:00Z',
      },
      {
        id: 'notif_03',
        tenantId: this.tenantId,
        userId: 'user_ravi',
        title: '🥛 Milk Delivered — 1.0 L',
        message: 'Fresh Cow Milk 1.0 L delivered successfully at 06:30 AM.',
        type: 'DELIVERY',
        read: true,
        timestamp: '2026-09-16T06:32:00Z',
      },
    ];

    // 15. Initial Daily Inventory for 16 Sep (Morning yield: 85 L)
    this.inventoryReconciliations.set('2026-09-16', {
      date: '2026-09-16',
      tenantId: this.tenantId,
      cowMilkProduced: 55.0,
      buffaloMilkProduced: 22.0,
      a2MilkProduced: 8.0,
      totalProduced: 85.0,
      totalDelivered: 4.5,
      remainingStock: 78.5,
      wasteOrSpillage: 1.0,
      personalConsumption: 1.0,
      discrepancy: 0.0,
      closedAt: '',
      closedBy: '',
      status: 'BALANCED',
    });

    // 16. Initial Extra Milk Requests
    this.extraMilkRequests = [
      {
        id: 'req_extra_01',
        tenantId: this.tenantId,
        customerId: 'cust_ravi',
        farmerId: 'farmer_01',
        customerName: 'Ravi Kumar',
        customerCode: 'MK-1024',
        date: '2026-09-17',
        normalQuantity: 1.0,
        requestedQuantity: 2.0,
        reason: 'Family and guests arriving for dinner tomorrow',
        status: 'PENDING',
        createdAt: '2026-09-16T10:15:00Z',
      },
    ];

    // Initial Pause Requests
    this.pauseRequests = [
      {
        id: 'req_pause_01',
        tenantId: this.tenantId,
        customerId: 'cust_priya',
        customerName: 'Priya Sharma',
        customerCode: 'MK-1025',
        farmerId: 'farmer_01',
        startDate: '2026-09-20',
        endDate: '2026-09-25',
        reason: 'Family trip to village',
        status: 'PENDING',
        createdAt: '2026-09-16T11:00:00Z',
      },
    ];

    // 17. Initial Live Activity Stream
    this.activities = [
      {
        id: 'act_01',
        tenantId: this.tenantId,
        type: 'DELIVERY',
        title: 'Milk Delivered',
        description: 'Delivered 1.0 L Fresh Cow Milk to Ravi Kumar (Flat 302)',
        actorName: 'Farmer Suresh',
        timestamp: '2026-09-16T06:30:00Z',
      },
      {
        id: 'act_02',
        tenantId: this.tenantId,
        type: 'DELIVERY',
        title: 'Milk Delivered',
        description: 'Delivered 0.5 L Fresh Cow Milk to Suresh Sharma (B-14)',
        actorName: 'Farmer Suresh',
        timestamp: '2026-09-16T06:35:00Z',
      },
      {
        id: 'act_03',
        tenantId: this.tenantId,
        type: 'DELIVERY',
        title: 'Delivery Skipped',
        description: 'Delivery skipped for Manju Devi (House 88) per WhatsApp request',
        actorName: 'Farmer Suresh',
        timestamp: '2026-09-16T07:15:00Z',
      },
      {
        id: 'act_04',
        tenantId: this.tenantId,
        type: 'DISPUTE',
        title: 'Dispute Raised',
        description: 'Anand Verma reported not receiving 2.0 L A2 Milk',
        actorName: 'Anand Verma',
        timestamp: '2026-09-16T08:30:00Z',
      },
      {
        id: 'act_05',
        tenantId: this.tenantId,
        type: 'EXTRA_REQUEST',
        title: 'Extra Milk Requested',
        description: 'Ravi Kumar requested 2.0 L for tomorrow (17 Sep)',
        actorName: 'Ravi Kumar',
        timestamp: '2026-09-16T10:15:00Z',
      },
      {
        id: 'act_06',
        tenantId: this.tenantId,
        type: 'PAYMENT',
        title: 'Payment Received',
        description: 'Received ₹725 via UPI from Suresh Sharma (INV-202609-1025)',
        actorName: 'Suresh Sharma',
        timestamp: '2026-09-16T11:20:00Z',
      },
      {
        id: 'act_07',
        tenantId: this.tenantId,
        type: 'REGISTRATION',
        title: 'New Customer Registered',
        description: 'Vikram Singh signed up for 1.5 L Cow Milk (Pending Approval)',
        actorName: 'Vikram Singh',
        timestamp: '2026-09-16T13:40:00Z',
      },
    ];
  }

  private seedSeptemberHistory() {
    for (let day = 1; day <= 16; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      this.getOrGenerateDailyLedger(`2026-09-${dayStr}`);
    }

    const today = '2026-09-16';

    const rRavi = this.deliveryRecords.get(`del_${today}_cust_ravi`);
    if (rRavi) {
      rRavi.status = 'DELIVERED';
      rRavi.deliveredQuantity = 1.0;
      rRavi.billableAmount = 50.0;
      rRavi.deliveredAt = '06:30 AM';
    }

    const rSuresh = this.deliveryRecords.get(`del_${today}_cust_suresh`);
    if (rSuresh) {
      rSuresh.status = 'DELIVERED';
      rSuresh.deliveredQuantity = 0.5;
      rSuresh.billableAmount = 25.0;
      rSuresh.deliveredAt = '06:35 AM';
    }

    const rManju = this.deliveryRecords.get(`del_${today}_cust_manju`);
    if (rManju) {
      rManju.status = 'SKIPPED';
      rManju.deliveredQuantity = 0.0;
      rManju.billableAmount = 0.0;
      rManju.reason = 'Customer requested skip';
      rManju.markedBy = 'FARMER';
    }

    const rArun = this.deliveryRecords.get(`del_${today}_cust_arun`);
    if (rArun) {
      rArun.status = 'PARTIAL';
      rArun.deliveredQuantity = 0.5;
      rArun.billableAmount = 25.0;
      rArun.reason = 'Customer requested half quantity today';
      rArun.deliveredAt = '06:45 AM';
    }

    const rAnand = this.deliveryRecords.get(`del_${today}_cust_anand`);
    if (rAnand) {
      rAnand.status = 'DISPUTED';
      rAnand.hasDispute = true;
    }
  }

  private getDayOfWeek(dateStr: string): DayOfWeek {
    const d = new Date(dateStr + 'T00:00:00');
    const dayIndex = d.getDay();
    const map: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return map[dayIndex];
  }

  // Multi-tenant check helper
  public validateTenantAccess(tenantId: string): boolean {
    return tenantId === this.tenantId || tenantId === 'tenant_platform';
  }

  // Subscription Engine: Generates expected daily ledger for ANY date
  public getOrGenerateDailyLedger(dateStr: string, tenantId = this.tenantId): DeliveryRecord[] {
    const dayOfWeek = this.getDayOfWeek(dateStr);
    const results: DeliveryRecord[] = [];

    const isDayLocked = this.dayLockStatusMap.get(dateStr) === 'FINALIZED';

    for (const cust of this.customers) {
      if (!cust.active || cust.tenantId !== tenantId) continue;

      const id = `del_${dateStr}_${cust.id}`;
      let record = this.deliveryRecords.get(id);

      if (!record) {
        const sub = this.subscriptions.find((s) => s.customerId === cust.id && s.active);
        if (!sub) continue;

        const isScheduledDay = sub.deliveryDays.includes(dayOfWeek);
        if (!isScheduledDay) continue;

        const prod = this.products.find((p) => p.id === sub.productId);
        // Lock historical price at delivery creation time
        const price = sub.customPricePerUnit ?? prod?.basePrice ?? 50.0;
        let scheduledQty = sub.defaultQuantity;
        let deliveredQty = sub.defaultQuantity;
        let status: DeliveryStatus = 'DELIVERED';
        let reason = '';

        // Check for Vacation Pause (approved pause request or active vacation pause)
        const isVacation =
          this.pauseRequests.some(
            (p) =>
              p.customerId === cust.id &&
              p.status === 'APPROVED' &&
              dateStr >= p.startDate &&
              dateStr <= p.endDate
          ) ||
          this.vacationPauses.some(
            (v) =>
              v.customerId === cust.id &&
              v.status === 'ACTIVE' &&
              dateStr >= v.startDate &&
              dateStr <= v.endDate
          );

        if (isVacation) {
          status = 'SKIPPED';
          deliveredQty = 0.0;
          reason = 'Scheduled Vacation Pause';
        }

        // Check for Approved Extra Milk Request
        const approvedExtraMilk = this.extraMilkRequests.find(
          (m) =>
            m.customerId === cust.id &&
            m.date === dateStr &&
            m.status === 'APPROVED'
        );

        if (approvedExtraMilk && !isVacation) {
          scheduledQty = approvedExtraMilk.requestedQuantity;
          deliveredQty = approvedExtraMilk.requestedQuantity;
          status = 'EXTRA';
          reason = `Extra Milk: ${approvedExtraMilk.reason}`;
        }

        // Check for Temporary Quantity Override
        const tempChange = this.tempQuantityChanges.find(
          (t) => cust.id === t.customerId && dateStr >= t.startDate && dateStr <= t.endDate
        );

        if (tempChange && !isVacation && !approvedExtraMilk) {
          scheduledQty = tempChange.overrideQuantity;
          deliveredQty = tempChange.overrideQuantity;
          if (tempChange.overrideQuantity > sub.defaultQuantity) {
            status = 'EXTRA';
            reason = `Temporary Extra: ${tempChange.reason}`;
          }
        }

        // Server-Side Billable Quantity Invariant:
        // DELIVERED: billable = deliveredQty * price
        // PARTIAL: billable = deliveredQty * price
        // SKIPPED: billable = 0
        // EXTRA: billable = deliveredQty * price
        // NOT_DELIVERED: billable = 0
        // DISPUTED: provisional on hold
        let billableAmount = deliveredQty * price;
        if ((status as string) === 'SKIPPED' || (status as string) === 'NOT_DELIVERED') {
          billableAmount = 0.0;
          deliveredQty = 0.0;
        }

        record = {
          id,
          tenantId: this.tenantId,
          farmerId: this.farmer.id,
          customerId: cust.id,
          customerName: cust.name,
          customerCode: cust.customerCode,
          subscriptionId: sub.id,
          productId: sub.productId,
          productName: sub.productName,
          date: dateStr,
          shift: sub.deliveryShift,
          scheduledQuantity: scheduledQty,
          deliveredQuantity: deliveredQty,
          status,
          reason: reason || undefined,
          pricePerUnit: price,
          billableAmount,
          deliveredAt: status === 'SKIPPED' ? undefined : cust.deliveryTime,
          markedBy: isVacation ? 'SYSTEM_AUTO' : 'FARMER',
          hasDispute: false,
          isLocked: isDayLocked,
          updatedAt: new Date().toISOString(),
        };

        this.deliveryRecords.set(id, record);
      }

      results.push(record);
    }

    return results.sort((a, b) => {
      const custA = this.customers.find((c) => c.id === a.customerId);
      const custB = this.customers.find((c) => c.id === b.customerId);
      return (custA?.deliverySequence ?? 99) - (custB?.deliverySequence ?? 99);
    });
  }

  // Update Delivery Record with State Machine & Cryptographic Audit Chaining
  public updateDeliveryRecord(
    recordId: string,
    updates: {
      deliveredQuantity?: number;
      status?: DeliveryStatus;
      reason?: string;
      notes?: string;
      bottlesReturned?: number;
    },
    actor: { userId: string; name: string; role: UserRole; ipAddress?: string },
    allowAdjustmentOnLocked = false
  ): { record: DeliveryRecord | null; error?: string } {
    const record = this.deliveryRecords.get(recordId);
    if (!record) return { record: null, error: 'Delivery record not found' };

    // Check if day is locked / finalized
    const isLocked = this.dayLockStatusMap.get(record.date) === 'FINALIZED' || record.isLocked;
    if (isLocked && !allowAdjustmentOnLocked) {
      return {
        record: null,
        error: `Ledger for date ${record.date} has been FINALIZED. Historical modifications require explicit authorized adjustment credentials.`,
      };
    }

    const beforeState = {
      deliveredQuantity: record.deliveredQuantity,
      status: record.status,
      billableAmount: record.billableAmount,
      reason: record.reason,
    };

    if (updates.status !== undefined) record.status = updates.status;
    if (updates.deliveredQuantity !== undefined) record.deliveredQuantity = updates.deliveredQuantity;
    if (updates.reason !== undefined) record.reason = updates.reason;
    if (updates.notes !== undefined) record.notes = updates.notes;
    if (updates.bottlesReturned !== undefined) record.bottlesReturned = updates.bottlesReturned;

    // Server-side calculation invariant:
    if (record.status === 'SKIPPED' || record.status === 'NOT_DELIVERED') {
      record.billableAmount = 0.0;
      record.deliveredQuantity = 0.0;
    } else if (record.status === 'DISPUTED') {
      // Provisional on hold
      record.billableAmount = 0.0;
    } else {
      record.billableAmount = record.deliveredQuantity * record.pricePerUnit;
    }

    record.updatedAt = new Date().toISOString();

    const afterState = {
      deliveredQuantity: record.deliveredQuantity,
      status: record.status,
      billableAmount: record.billableAmount,
      reason: record.reason,
      adjustmentApplied: isLocked,
    };

    // Append cryptographic audit block
    this.appendCryptographicAudit({
      entityType: 'DELIVERY_RECORD',
      entityId: record.id,
      action: isLocked ? 'ADJUSTMENT_POST_FINALIZATION' : `STATUS_CHANGE_${record.status}`,
      actor,
      beforeState,
      afterState,
      reason: record.reason,
    });

    // Automatically recalculate monthly bill
    const [yearStr, monthStr] = record.date.split('-');
    this.recalculateMonthlyInvoice(record.customerId, parseInt(monthStr, 10), parseInt(yearStr, 10));

    return { record };
  }

  // End of Day Closing & Reconciliation
  public closeDay(
    date: string,
    productionData: {
      cowMilkProduced: number;
      buffaloMilkProduced: number;
      a2MilkProduced: number;
      wasteOrSpillage: number;
      personalConsumption: number;
      remainingStock: number;
    },
    actor: { userId: string; name: string; role: UserRole }
  ): InventoryReconciliation {
    // Ensure all records for that date are marked isLocked = true
    const dayRecords = this.getOrGenerateDailyLedger(date);
    let totalDelivered = 0;
    dayRecords.forEach((r) => {
      r.isLocked = true;
      totalDelivered += r.deliveredQuantity;
    });

    const totalProduced =
      productionData.cowMilkProduced +
      productionData.buffaloMilkProduced +
      productionData.a2MilkProduced;

    const accounted =
      totalDelivered +
      productionData.remainingStock +
      productionData.wasteOrSpillage +
      productionData.personalConsumption;

    const discrepancy = parseFloat((totalProduced - accounted).toFixed(1));

    const reconciliation: InventoryReconciliation = {
      date,
      tenantId: this.tenantId,
      cowMilkProduced: productionData.cowMilkProduced,
      buffaloMilkProduced: productionData.buffaloMilkProduced,
      a2MilkProduced: productionData.a2MilkProduced,
      totalProduced,
      totalDelivered: parseFloat(totalDelivered.toFixed(1)),
      remainingStock: productionData.remainingStock,
      wasteOrSpillage: productionData.wasteOrSpillage,
      personalConsumption: productionData.personalConsumption,
      discrepancy,
      closedAt: new Date().toISOString(),
      closedBy: actor.name,
      status: Math.abs(discrepancy) < 0.1 ? 'BALANCED' : 'DISCREPANCY',
    };

    this.inventoryReconciliations.set(date, reconciliation);
    this.dayLockStatusMap.set(date, 'FINALIZED');

    // Append cryptographic audit block for Day Closing
    this.appendCryptographicAudit({
      entityType: 'DAY_CLOSING',
      entityId: `closing_${date}`,
      action: 'END_OF_DAY_FINALIZED',
      actor: { ...actor, ipAddress: '127.0.0.1' },
      beforeState: { dayStatus: 'OPEN' },
      afterState: {
        dayStatus: 'FINALIZED',
        totalProduced,
        totalDelivered,
        discrepancy,
        status: reconciliation.status,
      },
      reason: `Day closed with status ${reconciliation.status}. Ledger records locked.`,
    });

    return reconciliation;
  }

  // Dispute resolution with proper accounting
  public resolveDispute(
    disputeId: string,
    action: 'ACCEPT' | 'REJECT' | 'CUSTOM',
    customQuantity?: number,
    farmerNote?: string,
    actorName = 'Suresh Patel (Farmer)'
  ): { dispute: Dispute; record: DeliveryRecord } | null {
    const dispute = this.disputes.find((d) => d.id === disputeId);
    if (!dispute) return null;

    const record = this.deliveryRecords.get(dispute.deliveryRecordId);
    if (!record) return null;

    dispute.farmerNote = farmerNote;
    dispute.resolvedAt = new Date().toISOString();
    dispute.status = 'RESOLVED';

    const beforeState = {
      deliveredQuantity: record.deliveredQuantity,
      status: record.status,
      billableAmount: record.billableAmount,
    };

    let resolutionType: DisputeResolutionType = 'NO_CHANGE';
    let adjustmentAmount = 0;

    if (action === 'ACCEPT') {
      resolutionType = 'CUSTOMER_VALID';
      record.deliveredQuantity = dispute.claimedQuantity;
      record.status = dispute.claimedQuantity === 0 ? 'SKIPPED' : 'PARTIAL';
      record.reason = `Dispute Accepted: ${dispute.customerNote}`;
      record.billableAmount = dispute.claimedQuantity * record.pricePerUnit;
      adjustmentAmount = (dispute.recordedQuantity - dispute.claimedQuantity) * record.pricePerUnit;
    } else if (action === 'REJECT') {
      resolutionType = 'FARMER_VALID';
      record.status = record.scheduledQuantity === record.deliveredQuantity ? 'DELIVERED' : 'PARTIAL';
      record.reason = `Dispute Rejected: ${farmerNote || 'Delivery confirmed at doorstep'}`;
      record.billableAmount = record.deliveredQuantity * record.pricePerUnit;
    } else if (action === 'CUSTOM' && customQuantity !== undefined) {
      resolutionType = 'PARTIAL_ADJUSTMENT';
      record.deliveredQuantity = customQuantity;
      record.status = customQuantity === 0 ? 'SKIPPED' : 'PARTIAL';
      record.reason = `Dispute Adjusted: ${customQuantity}L settled (${farmerNote || ''})`;
      record.billableAmount = customQuantity * record.pricePerUnit;
      adjustmentAmount = (dispute.recordedQuantity - customQuantity) * record.pricePerUnit;
    }

    dispute.resolutionType = resolutionType;
    dispute.adjustmentAmount = adjustmentAmount;
    record.hasDispute = false;

    // Cryptographic audit
    this.appendCryptographicAudit({
      entityType: 'DISPUTE',
      entityId: dispute.id,
      action: `DISPUTE_RESOLVED_${resolutionType}`,
      actor: { userId: 'user_farmer', name: actorName, role: 'FARMER', ipAddress: '127.0.0.1' },
      beforeState,
      afterState: {
        deliveredQuantity: record.deliveredQuantity,
        status: record.status,
        resolutionType,
        adjustmentAmount,
      },
      reason: farmerNote || 'Dispute settlement',
    });

    const [yearStr, monthStr] = record.date.split('-');
    this.recalculateMonthlyInvoice(record.customerId, parseInt(monthStr, 10), parseInt(yearStr, 10));

    return { dispute, record };
  }

  // Vacation Pause
  public scheduleVacationPause(
    customerId: string,
    startDate: string,
    endDate: string,
    reason: string
  ): VacationPause {
    const pause: VacationPause = {
      id: `vac_${Date.now()}`,
      tenantId: this.tenantId,
      customerId,
      startDate,
      endDate,
      reason,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
    };

    this.vacationPauses.push(pause);

    for (const record of this.deliveryRecords.values()) {
      if (record.customerId === customerId && record.date >= startDate && record.date <= endDate) {
        record.status = 'SKIPPED';
        record.deliveredQuantity = 0.0;
        record.billableAmount = 0.0;
        record.reason = `Vacation Pause: ${reason}`;
        record.markedBy = 'SYSTEM_AUTO';

        const [y, m] = record.date.split('-');
        this.recalculateMonthlyInvoice(customerId, parseInt(m, 10), parseInt(y, 10));
      }
    }

    return pause;
  }

  // Temporary Quantity Request
  public scheduleTemporaryQuantity(
    customerId: string,
    startDate: string,
    endDate: string,
    overrideQuantity: number,
    reason: string
  ): TemporaryQuantityChange {
    const change: TemporaryQuantityChange = {
      id: `temp_${Date.now()}`,
      tenantId: this.tenantId,
      customerId,
      startDate,
      endDate,
      overrideQuantity,
      reason,
    };

    this.tempQuantityChanges.push(change);

    for (const record of this.deliveryRecords.values()) {
      if (record.customerId === customerId && record.date >= startDate && record.date <= endDate) {
        if (record.status !== 'SKIPPED') {
          record.scheduledQuantity = overrideQuantity;
          record.deliveredQuantity = overrideQuantity;
          record.status = overrideQuantity > 1.0 ? 'EXTRA' : 'DELIVERED';
          record.billableAmount = overrideQuantity * record.pricePerUnit;
          record.reason = `Temporary Change: ${reason}`;

          const [y, m] = record.date.split('-');
          this.recalculateMonthlyInvoice(customerId, parseInt(m, 10), parseInt(y, 10));
        }
      }
    }

    return change;
  }

  // Submit dispute from Customer
  public submitDispute(
    customerId: string,
    deliveryRecordId: string,
    claimedQuantity: number,
    reason: DisputeReason,
    customerNote: string
  ): Dispute | null {
    const record = this.deliveryRecords.get(deliveryRecordId);
    if (!record) return null;

    const dispute: Dispute = {
      id: `disp_${Date.now()}`,
      tenantId: this.tenantId,
      deliveryRecordId,
      customerId,
      customerName: record.customerName,
      customerCode: record.customerCode,
      farmerId: record.farmerId,
      date: record.date,
      recordedQuantity: record.deliveredQuantity,
      claimedQuantity,
      reason,
      customerNote,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };

    record.hasDispute = true;
    record.status = 'DISPUTED';

    this.disputes.unshift(dispute);

    return dispute;
  }

  // Dynamic Monthly Invoice Recalculation
  public recalculateMonthlyInvoice(customerId: string, month: number, year: number): Invoice | null {
    const cust = this.customers.find((c) => c.id === customerId);
    if (!cust) return null;

    const monthPrefix = `${year}-${month < 10 ? `0${month}` : month}`;
    let totalLitres = 0;
    let subtotal = 0;
    const itemsMap = new Map<string, { productId: string; name: string; qty: number; price: number; amount: number }>();

    // Calculate directly from delivery ledger
    for (const record of this.deliveryRecords.values()) {
      if (record.customerId === customerId && record.date.startsWith(monthPrefix)) {
        totalLitres += record.deliveredQuantity;
        subtotal += record.billableAmount;

        const current = itemsMap.get(record.productId) || {
          productId: record.productId,
          name: record.productName,
          qty: 0,
          price: record.pricePerUnit,
          amount: 0,
        };

        current.qty += record.deliveredQuantity;
        current.amount += record.billableAmount;
        itemsMap.set(record.productId, current);
      }
    }

    let invoice = this.invoices.find(
      (inv) => inv.customerId === customerId && inv.month === month && inv.year === year
    );

    const paid = invoice?.paidAmount || 0;
    const extraCharges = invoice?.extraCharges || 0;
    const creditsOrAdjustments = invoice?.creditsOrAdjustments || 0;
    const total = Math.max(0, subtotal + extraCharges - creditsOrAdjustments);
    const outstanding = Math.max(0, total - paid);

    let status: Invoice['status'] = 'ISSUED';
    if (outstanding <= 0 && total > 0) {
      status = 'PAID';
    } else if (paid > 0 && outstanding > 0) {
      status = 'PARTIALLY_PAID';
    }

    const items = Array.from(itemsMap.values()).map((it, idx) => ({
      id: `item_${month}_${idx}`,
      productId: it.productId,
      productName: it.name,
      totalQuantity: parseFloat(it.qty.toFixed(1)),
      pricePerUnit: it.price,
      amount: parseFloat(it.amount.toFixed(2)),
    }));

    if (invoice) {
      invoice.totalQuantity = parseFloat(totalLitres.toFixed(1));
      invoice.subtotal = parseFloat(subtotal.toFixed(2));
      invoice.totalAmount = parseFloat(total.toFixed(2));
      invoice.outstandingAmount = parseFloat(outstanding.toFixed(2));
      invoice.status = status;
      invoice.items = items;
    } else {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      invoice = {
        id: `inv_${year}_${month}_${customerId}`,
        tenantId: this.tenantId,
        farmerId: this.farmer.id,
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
        customerAddress: cust.address,
        invoiceNumber: `INV-${year}${month < 10 ? `0${month}` : month}-${cust.customerCode.replace('MK-', '')}`,
        month,
        year,
        monthName: `${monthNames[month - 1]} ${year}`,
        items,
        totalQuantity: parseFloat(totalLitres.toFixed(1)),
        subtotal: parseFloat(subtotal.toFixed(2)),
        extraCharges: 0.0,
        creditsOrAdjustments: 0.0,
        totalAmount: parseFloat(total.toFixed(2)),
        paidAmount: 0.0,
        outstandingAmount: parseFloat(total.toFixed(2)),
        status: total === 0 ? 'PAID' : 'ISSUED',
        dueDate: `${year}-${month < 10 ? `0${month}` : month}-28`,
        generatedAt: new Date().toISOString(),
      };
      this.invoices.push(invoice);
    }

    return invoice;
  }

  // Idempotent Payment Processor
  public recordPayment(
    invoiceId: string,
    amount: number,
    paymentMethod: Payment['paymentMethod'],
    ref?: string,
    note?: string
  ): { payment: Payment; isDuplicate: boolean } | null {
    const invoice = this.invoices.find((i) => i.id === invoiceId);
    if (!invoice) return null;

    const txRef = ref || `UPI-${new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14)}`;

    // Idempotency check: prevent duplicate billing on replay
    if (this.processedTransactionRefs.has(txRef)) {
      const existing = this.payments.find((p) => p.transactionRef === txRef);
      if (existing) {
        return { payment: existing, isDuplicate: true };
      }
    }

    this.processedTransactionRefs.add(txRef);

    const receiptNum = `REC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payment: Payment = {
      id: `pay_${Date.now()}`,
      tenantId: this.tenantId,
      invoiceId,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      farmerId: invoice.farmerId,
      amount,
      paymentMethod,
      transactionRef: txRef,
      receiptNumber: receiptNum,
      paidAt: new Date().toISOString(),
      note,
      status: 'SUCCESS',
    };

    this.payments.unshift(payment);

    // Update invoice state
    invoice.paidAmount = parseFloat((invoice.paidAmount + amount).toFixed(2));
    invoice.outstandingAmount = Math.max(0, parseFloat((invoice.totalAmount - invoice.paidAmount).toFixed(2)));
    invoice.lastPaymentAt = payment.paidAt;

    if (invoice.outstandingAmount <= 0) {
      invoice.status = 'PAID';
    } else {
      invoice.status = 'PARTIALLY_PAID';
    }

    // Cryptographic audit
    this.appendCryptographicAudit({
      entityType: 'PAYMENT',
      entityId: payment.id,
      action: 'PAYMENT_RECORDED',
      actor: {
        userId: invoice.customerId,
        name: invoice.customerName,
        role: paymentMethod === 'CASH' ? 'FARMER' : 'CUSTOMER',
        ipAddress: '127.0.0.1',
      },
      beforeState: { outstandingDue: invoice.outstandingAmount + amount },
      afterState: {
        paidAmount: amount,
        remainingOutstanding: invoice.outstandingAmount,
        transactionRef: txRef,
        receiptNumber: receiptNum,
      },
      reason: note || `Payment via ${paymentMethod}`,
    });

    return { payment, isDuplicate: false };
  }

  // Resolve customer by opaque secure QR token
  public resolveCustomerByQRToken(token: string, tenantId = this.tenantId): CustomerProfile | null {
    const cust = this.customers.find((c) => c.qrToken === token && c.tenantId === tenantId);
    return cust || null;
  }

  // Add customer
  public addCustomer(data: {
    name: string;
    phone: string;
    email?: string;
    password?: string;
    address: string;
    productId: string;
    quantity: number;
    deliveryTime: string;
    deliveryShift: 'MORNING' | 'EVENING' | 'BOTH';
    customPrice?: number;
    notes?: string;
    farmerId?: string;
  }): CustomerProfile & { temporaryPassword?: string } {
    const nextSeq = this.customers.length + 1;
    const codeNum = 1024 + this.customers.length;
    const custId = `cust_${Date.now()}`;
    const userId = `user_${custId}`;
    const qrToken = `MK_QR_${crypto.randomBytes(8).toString('hex')}`;
    const assignedFarmerId = data.farmerId || this.farmer.id;
    const cleanDigits = data.phone.replace(/[^0-9]/g, '');
    const effectiveEmail = data.email || `${cleanDigits || Date.now()}@dairyclient.com`;
    const tempPassword = data.password || `Milk#${Math.floor(1000 + Math.random() * 9000)}`;

    const prod = this.products.find((p) => p.id === data.productId) || this.products[0];

    const newUser: User = {
      id: userId,
      tenantId: this.tenantId,
      name: data.name,
      email: effectiveEmail,
      phone: data.phone,
      role: 'CUSTOMER',
    };
    this.users.push(newUser);

    const newCustomer: CustomerProfile = {
      id: custId,
      tenantId: this.tenantId,
      userId,
      farmerId: assignedFarmerId,
      customerCode: `MK-${codeNum}`,
      qrToken,
      name: data.name,
      email: effectiveEmail,
      phone: data.phone,
      address: data.address,
      deliveryShift: data.deliveryShift,
      deliveryTime: data.deliveryTime,
      deliverySequence: nextSeq,
      active: true,
      accountStatus: 'ACTIVE',
      notes: data.notes,
      walletBalance: 0,
    };

    const newSub: Subscription = {
      id: `sub_${custId}`,
      tenantId: this.tenantId,
      customerId: custId,
      farmerId: assignedFarmerId,
      productId: prod?.id || 'prod_cow_milk',
      productName: prod?.name || 'Fresh Cow Milk',
      defaultQuantity: data.quantity,
      customPricePerUnit: data.customPrice ?? (prod?.basePrice ?? 50.0),
      deliveryDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      deliveryShift: data.deliveryShift,
      startDate: new Date().toISOString().split('T')[0],
      active: true,
    };

    this.customers.push(newCustomer);
    this.subscriptions.push(newSub);

    const today = new Date().toISOString().split('T')[0];
    this.getOrGenerateDailyLedger(today);

    this.appendCryptographicAudit({
      entityType: 'SUBSCRIPTION',
      entityId: newSub.id,
      action: 'CUSTOMER_ONBOARDED',
      actor: { userId: 'user_farmer', name: 'Suresh Patel (Farmer)', role: 'FARMER', ipAddress: '127.0.0.1' },
      beforeState: {},
      afterState: { customerCode: newCustomer.customerCode, name: newCustomer.name, email: effectiveEmail, defaultQuantity: data.quantity },
      reason: 'New customer onboarding with login credentials',
    });

    return { ...newCustomer, temporaryPassword: tempPassword };
  }

  // Delete / Remove customer
  public deleteCustomer(customerId: string): boolean {
    const custIndex = this.customers.findIndex((c) => c.id === customerId);
    if (custIndex === -1) return false;
    const removedCust = this.customers[custIndex];

    this.customers.splice(custIndex, 1);
    this.subscriptions = this.subscriptions.filter((s) => s.customerId !== customerId);
    this.users = this.users.filter((u) => u.id !== removedCust.userId);

    this.appendCryptographicAudit({
      entityType: 'CUSTOMER',
      entityId: customerId,
      action: 'CUSTOMER_REMOVED',
      actor: { userId: 'user_farmer', name: 'Suresh Patel (Farmer)', role: 'FARMER', ipAddress: '127.0.0.1' },
      beforeState: { id: customerId, name: removedCust.name, phone: removedCust.phone },
      afterState: { removed: true },
      reason: 'Customer removed by farmer or admin',
    });

    return true;
  }

  // Update product price
  public updateProductPrice(productId: string, price: number | null): Product | null {
    const prod = this.products.find((p) => p.id === productId);
    if (!prod) return null;
    prod.basePrice = price;
    return prod;
  }

  // Add live activity
  public addActivity(event: Omit<ActivityEvent, 'id' | 'tenantId' | 'timestamp'>): ActivityEvent {
    const activity: ActivityEvent = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenantId: this.tenantId,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.activities.unshift(activity);
    if (this.activities.length > 50) this.activities.pop();
    return activity;
  }

  // Request Extra Milk (Customer)
  public requestExtraMilk(params: {
    customerId: string;
    farmerId?: string;
    date: string;
    requestedQuantity: number;
    reason: string;
  }): ExtraMilkRequest {
    const cust = this.customers.find((c) => c.id === params.customerId);
    const sub = this.subscriptions.find((s) => s.customerId === params.customerId && s.active);
    const normalQty = sub?.defaultQuantity || 1.0;
    const targetFarmerId = params.farmerId || cust?.farmerId || this.farmer.id;

    const req: ExtraMilkRequest = {
      id: `req_extra_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      tenantId: this.tenantId,
      customerId: params.customerId,
      farmerId: targetFarmerId,
      subscriptionId: sub?.id,
      customerName: cust?.name || 'Customer',
      customerCode: cust?.customerCode || 'MK-1024',
      date: params.date,
      normalQuantity: normalQty,
      requestedQuantity: params.requestedQuantity,
      reason: params.reason,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    this.extraMilkRequests.unshift(req);

    this.addActivity({
      type: 'EXTRA_REQUEST',
      title: 'Extra Milk Requested',
      description: `${cust?.name || 'Customer'} requested ${params.requestedQuantity} L for ${params.date} (${params.reason})`,
      actorName: cust?.name || 'Customer',
    });

    this.notifications.unshift({
      id: `notif_${Date.now()}`,
      tenantId: this.tenantId,
      userId: 'user_farmer',
      title: '🥛 Extra Milk Request',
      message: `${cust?.name || 'Customer'} requested ${params.requestedQuantity} L for ${params.date}. Reason: "${params.reason}"`,
      type: 'SYSTEM',
      read: false,
      timestamp: new Date().toISOString(),
    });

    return req;
  }

  // Review Extra Milk Request (Farmer Approve / Reject)
  public reviewExtraMilkRequest(params: {
    requestId: string;
    action: 'APPROVED' | 'REJECTED';
    reviewedBy: string;
    note?: string;
  }): ExtraMilkRequest | null {
    const req = this.extraMilkRequests.find((r) => r.id === params.requestId);
    if (!req) return null;

    req.status = params.action;
    req.reviewedAt = new Date().toISOString();
    req.reviewedBy = params.reviewedBy;
    if (params.note) {
      req.rejectionReason = params.note;
    }

    if (params.action === 'APPROVED') {
      const records = this.getOrGenerateDailyLedger(req.date);
      const rec = records.find((r) => r.customerId === req.customerId);
      if (rec) {
        const prevQty = rec.scheduledQuantity;
        rec.scheduledQuantity = req.requestedQuantity;
        rec.deliveredQuantity = req.requestedQuantity;
        rec.status = 'EXTRA';
        rec.reason = `Extra Milk Approved: ${req.reason}`;
        rec.billableAmount = req.requestedQuantity * rec.pricePerUnit;

        this.appendCryptographicAudit({
          entityType: 'DELIVERY_RECORD',
          entityId: rec.id,
          action: 'EXTRA_MILK_APPROVED',
          actor: { userId: 'user_farmer', name: params.reviewedBy, role: 'FARMER', ipAddress: '127.0.0.1' },
          beforeState: { scheduledQuantity: prevQty },
          afterState: { scheduledQuantity: req.requestedQuantity, status: 'EXTRA' },
          reason: req.reason,
        });

        const [y, m] = req.date.split('-');
        this.recalculateMonthlyInvoice(req.customerId, parseInt(m, 10), parseInt(y, 10));
      }

      this.addActivity({
        type: 'EXTRA_REQUEST',
        title: 'Extra Milk Approved',
        description: `Approved ${req.requestedQuantity} L extra milk for ${req.customerName} on ${req.date}`,
        actorName: params.reviewedBy,
      });

      const cust = this.customers.find((c) => c.id === req.customerId);
      if (cust) {
        this.notifications.unshift({
          id: `notif_${Date.now()}`,
          tenantId: this.tenantId,
          userId: cust.userId,
          title: '✓ Extra Milk Request Approved',
          message: `Your request for ${req.requestedQuantity} L on ${req.date} has been approved by the farmer.`,
          type: 'SYSTEM',
          read: false,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      this.addActivity({
        type: 'EXTRA_REQUEST',
        title: 'Extra Milk Request Declined',
        description: `Declined extra milk request for ${req.customerName}: ${params.note || 'No reason provided'}`,
        actorName: params.reviewedBy,
      });

      const cust = this.customers.find((c) => c.id === req.customerId);
      if (cust) {
        this.notifications.unshift({
          id: `notif_${Date.now()}`,
          tenantId: this.tenantId,
          userId: cust.userId,
          title: '✕ Extra Milk Request Declined',
          message: `Your request for ${req.requestedQuantity} L on ${req.date} was declined. ${params.note ? `Reason: ${params.note}` : ''}`,
          type: 'SYSTEM',
          read: false,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return req;
  }

  // Create Pause Request (Customer)
  public createPauseRequest(params: {
    customerId: string;
    startDate: string;
    endDate: string;
    reason: string;
    farmerId?: string;
    subscriptionId?: string;
  }): PauseRequest {
    const cust = this.customers.find((c) => c.id === params.customerId);
    const sub = this.subscriptions.find((s) => s.customerId === params.customerId);
    const targetFarmerId = params.farmerId || cust?.farmerId || this.farmer.id;

    const req: PauseRequest = {
      id: `req_pause_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      tenantId: this.tenantId,
      customerId: params.customerId,
      customerName: cust?.name || 'Customer',
      customerCode: cust?.customerCode || 'MK-1024',
      farmerId: targetFarmerId,
      subscriptionId: params.subscriptionId || sub?.id,
      startDate: params.startDate,
      endDate: params.endDate,
      reason: params.reason,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    this.pauseRequests.unshift(req);

    this.addActivity({
      type: 'VACATION',
      title: 'Vacation Pause Requested',
      description: `${cust?.name || 'Customer'} requested pause from ${params.startDate} to ${params.endDate} (${params.reason})`,
      actorName: cust?.name || 'Customer',
    });

    this.notifications.unshift({
      id: `notif_${Date.now()}`,
      tenantId: this.tenantId,
      userId: 'user_farmer',
      title: '⏸️ Vacation Pause Request',
      message: `${cust?.name || 'Customer'} requested vacation pause from ${params.startDate} to ${params.endDate}. Reason: "${params.reason}"`,
      type: 'SYSTEM',
      read: false,
      timestamp: new Date().toISOString(),
    });

    return req;
  }

  // Review Pause Request (Farmer Approve / Reject)
  public reviewPauseRequest(params: {
    requestId: string;
    action: 'APPROVED' | 'REJECTED';
    reviewedBy: string;
    rejectionReason?: string;
  }): PauseRequest | null {
    const req = this.pauseRequests.find((r) => r.id === params.requestId);
    if (!req) return null;

    req.status = params.action;
    req.reviewedAt = new Date().toISOString();
    req.reviewedBy = params.reviewedBy;
    if (params.rejectionReason) {
      req.rejectionReason = params.rejectionReason;
    }

    if (params.action === 'APPROVED') {
      // Keep vacationPauses entry for backward compatibility
      this.vacationPauses.push({
        id: `vac_${req.id}`,
        tenantId: this.tenantId,
        customerId: req.customerId,
        farmerId: req.farmerId,
        subscriptionId: req.subscriptionId,
        startDate: req.startDate,
        endDate: req.endDate,
        reason: req.reason,
        createdAt: req.createdAt,
        status: 'ACTIVE',
      });

      // Update existing delivery records in date range
      for (const record of this.deliveryRecords.values()) {
        if (record.customerId === req.customerId && record.date >= req.startDate && record.date <= req.endDate) {
          const prevStatus = record.status;
          record.status = 'SKIPPED';
          record.deliveredQuantity = 0.0;
          record.billableAmount = 0.0;
          record.reason = `Vacation Pause Approved: ${req.reason}`;
          record.markedBy = 'FARMER';

          this.appendCryptographicAudit({
            entityType: 'DELIVERY_RECORD',
            entityId: record.id,
            action: 'VACATION_PAUSE_APPROVED',
            actor: { userId: 'user_farmer', name: params.reviewedBy, role: 'FARMER', ipAddress: '127.0.0.1' },
            beforeState: { status: prevStatus, deliveredQuantity: record.deliveredQuantity },
            afterState: { status: 'SKIPPED', deliveredQuantity: 0.0, billableAmount: 0.0 },
            reason: req.reason,
          });

          const [y, m] = record.date.split('-');
          this.recalculateMonthlyInvoice(req.customerId, parseInt(m, 10), parseInt(y, 10));
        }
      }

      this.addActivity({
        type: 'VACATION',
        title: 'Vacation Pause Approved',
        description: `Approved pause for ${req.customerName} (${req.startDate} to ${req.endDate})`,
        actorName: params.reviewedBy,
      });

      const cust = this.customers.find((c) => c.id === req.customerId);
      if (cust) {
        this.notifications.unshift({
          id: `notif_${Date.now()}`,
          tenantId: this.tenantId,
          userId: cust.userId,
          title: '✅ Vacation Pause Approved',
          message: `Your vacation pause request from ${req.startDate} to ${req.endDate} has been approved by your farmer.`,
          type: 'SYSTEM',
          read: false,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      this.addActivity({
        type: 'VACATION',
        title: 'Vacation Pause Declined',
        description: `Declined pause for ${req.customerName}: ${params.rejectionReason || 'No reason provided'}`,
        actorName: params.reviewedBy,
      });

      const cust = this.customers.find((c) => c.id === req.customerId);
      if (cust) {
        this.notifications.unshift({
          id: `notif_${Date.now()}`,
          tenantId: this.tenantId,
          userId: cust.userId,
          title: '❌ Vacation Pause Declined',
          message: `Your vacation pause request from ${req.startDate} to ${req.endDate} was declined. ${params.rejectionReason ? `Reason: ${params.rejectionReason}` : ''}`,
          type: 'SYSTEM',
          read: false,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return req;
  }

  // Scoped Query: Get Farmer Requests (Pause, Extra Milk, Disputes)
  public getFarmerRequests(farmerId: string = 'farmer_01') {
    const pauseReqs = this.pauseRequests.filter(
      (r) => !r.farmerId || r.farmerId === farmerId
    );
    const milkReqs = this.extraMilkRequests.filter(
      (r) => !r.farmerId || r.farmerId === farmerId
    );
    const disputes = this.disputes.filter(
      (d) => !d.farmerId || d.farmerId === farmerId
    );

    return {
      pauseRequests: pauseReqs,
      milkRequests: milkReqs,
      disputes,
      pendingCount:
        pauseReqs.filter((p) => p.status === 'PENDING').length +
        milkReqs.filter((m) => m.status === 'PENDING').length +
        disputes.filter((d) => d.status === 'OPEN').length,
    };
  }

  // Scoped Query: Get Farmer Customers
  public getFarmerCustomers(farmerId: string = 'farmer_01') {
    return this.customers.filter((c) => !c.farmerId || c.farmerId === farmerId);
  }

  // Scoped Query: Get Customer Dashboard Data (Strictly isolated to customer's own data)
  public getCustomerDashboardData(customerId: string) {
    const customer = this.customers.find((c) => c.id === customerId);
    if (!customer) return null;

    const farmer = this.farmer;
    const subscriptions = this.subscriptions.filter((s) => s.customerId === customerId);
    const pauseRequests = this.pauseRequests.filter((p) => p.customerId === customerId);
    const milkRequests = this.extraMilkRequests.filter((m) => m.customerId === customerId);
    const disputes = this.disputes.filter((d) => d.customerId === customerId);
    const invoices = this.invoices.filter((i) => i.customerId === customerId);

    const records: DeliveryRecord[] = [];
    for (const rec of this.deliveryRecords.values()) {
      if (rec.customerId === customerId) {
        records.push(rec);
      }
    }
    records.sort((a, b) => b.date.localeCompare(a.date));

    return {
      customer,
      farmer,
      subscriptions,
      pauseRequests,
      milkRequests,
      disputes,
      invoices,
      records: records.slice(0, 30),
      summary: {
        totalDeliveredLitres: records
          .filter((r) => r.status === 'DELIVERED' || r.status === 'EXTRA' || r.status === 'PARTIAL')
          .reduce((sum, r) => sum + r.deliveredQuantity, 0),
        pendingRequestsCount:
          pauseRequests.filter((p) => p.status === 'PENDING').length +
          milkRequests.filter((m) => m.status === 'PENDING').length,
        openDisputesCount: disputes.filter((d) => d.status === 'OPEN').length,
        unpaidInvoicesAmount: invoices
          .filter((i) => i.status !== 'PAID')
          .reduce((sum, i) => sum + (i.totalAmount - (i.paidAmount || 0)), 0),
      },
    };
  }

  // Approve Customer Signup (Farmer)
  public approveCustomer(customerId: string, approvedBy = 'Suresh Patel (Farmer)'): CustomerProfile | null {
    const cust = this.customers.find((c) => c.id === customerId);
    if (!cust) return null;

    cust.accountStatus = 'ACTIVE';
    cust.active = true;

    const sub = this.subscriptions.find((s) => s.customerId === customerId);
    if (sub) {
      sub.active = true;
    }

    const today = '2026-09-16';
    this.getOrGenerateDailyLedger(today);

    this.appendCryptographicAudit({
      entityType: 'SUBSCRIPTION',
      entityId: sub?.id || cust.id,
      action: 'CUSTOMER_APPROVED',
      actor: { userId: 'user_farmer', name: approvedBy, role: 'FARMER', ipAddress: '127.0.0.1' },
      beforeState: { accountStatus: 'PENDING', active: false },
      afterState: { accountStatus: 'ACTIVE', active: true },
      reason: `Customer verified and activated by ${approvedBy}`,
    });

    this.addActivity({
      type: 'REGISTRATION',
      title: 'Customer Approved',
      description: `${cust.name} was approved and added to active deliveries`,
      actorName: approvedBy,
    });

    this.notifications.unshift({
      id: `notif_${Date.now()}`,
      tenantId: this.tenantId,
      userId: cust.userId,
      title: '✓ Dairy Account Approved!',
      message: `Welcome to MilkFlow! Your milk subscription with GreenValley Dairy Farm is now active.`,
      type: 'SYSTEM',
      read: false,
      timestamp: new Date().toISOString(),
    });

    return cust;
  }

  // Update customer status (Active, Paused, Suspended)
  public updateCustomerStatus(customerId: string, status: AccountStatus): CustomerProfile | null {
    const cust = this.customers.find((c) => c.id === customerId);
    if (!cust) return null;

    cust.accountStatus = status;
    cust.active = status === 'ACTIVE';

    const sub = this.subscriptions.find((s) => s.customerId === customerId);
    if (sub) {
      sub.active = status === 'ACTIVE';
    }

    this.addActivity({
      type: 'REGISTRATION',
      title: 'Customer Status Changed',
      description: `${cust.name} status updated to ${status}`,
      actorName: 'Farmer Suresh',
    });

    return cust;
  }

  // Update existing/present customer profile & subscription
  public updateCustomer(customerId: string, updates: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    deliveryTime?: string;
    deliveryShift?: DeliveryShift;
    deliverySequence?: number;
    notes?: string;
    productId?: string;
    quantity?: number;
    customPrice?: number;
    status?: AccountStatus;
  }): CustomerProfile | null {
    const cust = this.customers.find((c) => c.id === customerId);
    if (!cust) return null;

    const beforeState = { ...cust };

    if (updates.name !== undefined) cust.name = updates.name;
    if (updates.email !== undefined) cust.email = updates.email;
    if (updates.phone !== undefined) cust.phone = updates.phone;
    if (updates.address !== undefined) cust.address = updates.address;
    if (updates.deliveryTime !== undefined) cust.deliveryTime = updates.deliveryTime;
    if (updates.deliveryShift !== undefined) cust.deliveryShift = updates.deliveryShift;
    if (updates.deliverySequence !== undefined) cust.deliverySequence = updates.deliverySequence;
    if (updates.notes !== undefined) cust.notes = updates.notes;
    if (updates.status !== undefined) {
      cust.accountStatus = updates.status;
      cust.active = updates.status === 'ACTIVE';
    }

    // Also update user record if name/email/phone changed
    const user = this.users.find((u) => u.id === cust.userId);
    if (user) {
      if (updates.name !== undefined) user.name = updates.name;
      if (updates.email !== undefined) user.email = updates.email;
      if (updates.phone !== undefined) user.phone = updates.phone;
    }

    // Also update active subscription if productId/quantity/customPrice changed
    const sub = this.subscriptions.find((s) => s.customerId === customerId);
    if (sub) {
      if (updates.productId) {
        const prod = this.products.find((p) => p.id === updates.productId);
        if (prod) {
          sub.productId = prod.id;
          sub.productName = prod.name;
        }
      }
      if (updates.quantity !== undefined && !isNaN(updates.quantity)) {
        sub.defaultQuantity = updates.quantity;
      }
      if (updates.customPrice !== undefined) {
        sub.customPricePerUnit = updates.customPrice;
      }
      if (updates.deliveryShift) {
        sub.deliveryShift = updates.deliveryShift;
      }
      if (updates.status !== undefined) {
        sub.active = updates.status === 'ACTIVE';
      }
    }

    this.appendCryptographicAudit({
      entityType: 'CUSTOMER',
      entityId: cust.id,
      action: 'CUSTOMER_UPDATED',
      actor: { userId: 'user_farmer', name: 'Suresh Patel (Farmer)', role: 'FARMER', ipAddress: '127.0.0.1' },
      beforeState: { name: beforeState.name, phone: beforeState.phone, email: beforeState.email, address: beforeState.address },
      afterState: { name: cust.name, phone: cust.phone, email: cust.email, address: cust.address, quantity: sub?.defaultQuantity },
      reason: 'Customer profile updated by farmer/admin',
    });

    return cust;
  }

  // Register Customer (Public Signup)
  public registerCustomer(params: {
    name: string;
    phone: string;
    address: string;
    productId: string;
    quantity: number;
    deliveryShift: DeliveryShift;
    farmerId?: string;
    autoApprove?: boolean;
  }): { user: User; customer: CustomerProfile; subscription: Subscription } {
    const nextSeq = this.customers.length + 1;
    const codeNum = 1024 + this.customers.length;
    const custId = `cust_${Date.now()}`;
    const userId = `user_${custId}`;
    const qrToken = `MK_QR_${crypto.randomBytes(8).toString('hex')}`;
    const isAutoApproved = params.autoApprove ?? true;
    const assignedFarmerId = params.farmerId || this.farmer.id;

    const user: User = {
      id: userId,
      tenantId: this.tenantId,
      name: params.name,
      email: `${params.phone.replace(/[^0-9]/g, '')}@milkflow.in`,
      phone: params.phone,
      role: 'CUSTOMER',
    };

    const prod = this.products.find((p) => p.id === params.productId) || this.products[0];

    const customer: CustomerProfile = {
      id: custId,
      tenantId: this.tenantId,
      userId,
      farmerId: assignedFarmerId,
      customerCode: `MK-${codeNum}`,
      qrToken,
      name: params.name,
      phone: params.phone,
      address: params.address,
      deliveryShift: params.deliveryShift,
      deliveryTime: params.deliveryShift === 'EVENING' ? '06:00 PM' : '07:00 AM',
      deliverySequence: nextSeq,
      active: isAutoApproved,
      accountStatus: isAutoApproved ? 'ACTIVE' : 'PENDING',
      notes: `Self-registered customer via MilkFlow portal`,
      walletBalance: 0,
    };

    const subscription: Subscription = {
      id: `sub_${custId}`,
      tenantId: this.tenantId,
      customerId: custId,
      farmerId: assignedFarmerId,
      productId: prod.id,
      productName: prod.name,
      defaultQuantity: params.quantity,
      customPricePerUnit: prod.basePrice ?? undefined,
      deliveryDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      deliveryShift: params.deliveryShift,
      startDate: new Date().toISOString().split('T')[0],
      active: isAutoApproved,
    };

    this.users.push(user);
    this.customers.push(customer);
    this.subscriptions.push(subscription);

    const today = new Date().toISOString().split('T')[0];
    if (isAutoApproved) {
      this.getOrGenerateDailyLedger(today);
    }

    this.addActivity({
      type: 'REGISTRATION',
      title: 'New Customer Registered',
      description: `${customer.name} registered for ${params.quantity} L ${prod.name} (${isAutoApproved ? 'Active' : 'Pending Approval'})`,
      actorName: customer.name,
    });

    this.notifications.unshift({
      id: `notif_${Date.now()}`,
      tenantId: this.tenantId,
      userId: 'user_farmer',
      title: '👤 New Customer Signup',
      message: `${customer.name} signed up for ${params.quantity} L ${prod.name}. Phone: ${customer.phone}. Address: ${customer.address}.`,
      type: 'SYSTEM',
      read: false,
      timestamp: new Date().toISOString(),
    });

    return { user, customer, subscription };
  }

  // Calculate Real Admin Operational Stats across records & invoices
  public getAdminOperationalStats(dateStr: string): AdminOperationalStats {
    const records = this.getOrGenerateDailyLedger(dateStr);
    const activeCustomers = this.customers.filter((c) => c.active && c.accountStatus === 'ACTIVE');

    let expectedLitres = 0;
    let deliveredLitres = 0;
    let partialLitres = 0;
    let skippedLitres = 0;
    let extraLitres = 0;
    let billableLitres = 0;
    let todayRevenue = 0;

    const prodMap = { cow: 0, buffalo: 0, a2: 0 };
    let partialCount = 0;
    let skippedCount = 0;

    for (const rec of records) {
      expectedLitres += rec.scheduledQuantity;

      if (rec.status === 'DELIVERED') {
        deliveredLitres += rec.deliveredQuantity;
        billableLitres += rec.deliveredQuantity;
        todayRevenue += rec.billableAmount;
      } else if (rec.status === 'PARTIAL') {
        partialCount++;
        partialLitres += rec.deliveredQuantity;
        deliveredLitres += rec.deliveredQuantity;
        billableLitres += rec.deliveredQuantity;
        todayRevenue += rec.billableAmount;
      } else if (rec.status === 'SKIPPED' || rec.status === 'NOT_DELIVERED') {
        skippedCount++;
        skippedLitres += rec.scheduledQuantity;
      } else if (rec.status === 'EXTRA') {
        deliveredLitres += rec.deliveredQuantity;
        billableLitres += rec.deliveredQuantity;
        extraLitres += Math.max(0, rec.deliveredQuantity - rec.scheduledQuantity);
        todayRevenue += rec.billableAmount;
      } else if (rec.status === 'DISPUTED') {
        deliveredLitres += rec.deliveredQuantity;
      }

      if (rec.deliveredQuantity > 0) {
        if (rec.productId === 'prod_cow_milk') prodMap.cow += rec.deliveredQuantity;
        else if (rec.productId === 'prod_buffalo_milk') prodMap.buffalo += rec.deliveredQuantity;
        else if (rec.productId === 'prod_a2_milk') prodMap.a2 += rec.deliveredQuantity;
      }
    }

    let todayCollected = 0;
    for (const p of this.payments) {
      if (p.paidAt.startsWith(dateStr) && p.status === 'SUCCESS') {
        todayCollected += p.amount;
      }
    }

    const todayOutstanding = Math.max(0, todayRevenue - todayCollected);
    const openDisputes = this.disputes.filter((d) => d.status === 'OPEN').length;
    const pendingExtra = this.extraMilkRequests.filter((r) => r.status === 'PENDING').length;
    const pendingCusts = this.customers.filter((c) => c.accountStatus === 'PENDING').length;
    const overdueInvs = this.invoices.filter((i) => i.status === 'OVERDUE' || (i.status === 'PARTIALLY_PAID' && i.outstandingAmount > 0)).length;

    return {
      date: dateStr,
      totalCustomers: activeCustomers.length,
      expectedLitres: parseFloat(expectedLitres.toFixed(1)),
      deliveredLitres: parseFloat(deliveredLitres.toFixed(1)),
      partialLitres: parseFloat(partialLitres.toFixed(1)),
      skippedLitres: parseFloat(skippedLitres.toFixed(1)),
      extraLitres: parseFloat(extraLitres.toFixed(1)),
      billableLitres: parseFloat(billableLitres.toFixed(1)),
      todayRevenue: parseFloat(todayRevenue.toFixed(2)),
      todayCollected: parseFloat(todayCollected.toFixed(2)),
      todayOutstanding: parseFloat(todayOutstanding.toFixed(2)),
      productBreakdown: {
        cow: parseFloat(prodMap.cow.toFixed(1)),
        buffalo: parseFloat(prodMap.buffalo.toFixed(1)),
        a2: parseFloat(prodMap.a2.toFixed(1)),
      },
      exceptionCounts: {
        partial: partialCount,
        skipped: skippedCount,
        disputes: openDisputes,
        extraRequests: pendingExtra,
        pendingCustomers: pendingCusts,
        overdueInvoices: overdueInvs,
      },
    };
  }

  public clearAllMockData(): void {
    this.customers = [];
    this.subscriptions = [];
    this.deliveryRecords.clear();
    this.disputes = [];
    this.invoices = [];
    this.payments = [];
    this.vacationPauses = [];
    this.tempQuantityChanges = [];
    this.extraMilkRequests = [];
    this.pauseRequests = [];
    this.notifications = [];
    this.activities = [];
    this.users = this.users.filter((u) => u.role === 'FARMER' || u.role === 'ADMIN');
  }
}

export function getStore(): MilkFlowStore {
  if (!global.__milkFlowStore || typeof global.__milkFlowStore.getFarmerRequests !== 'function') {
    global.__milkFlowStore = new MilkFlowStore();
    if (
      process.env.VITEST !== 'true' &&
      (process.env.DEMO_LOGIN_ENABLED === 'false' || process.env.CLEAN_MOCK_DATA === 'true')
    ) {
      global.__milkFlowStore.clearAllMockData();
    }
  }
  return global.__milkFlowStore;
}

