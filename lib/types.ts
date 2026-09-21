export type UserRole = 'OWNER' | 'MANAGER' | 'DELIVERY_AGENT' | 'ACCOUNTANT' | 'SUPPORT' | 'FARMER' | 'CUSTOMER' | 'ADMIN' | 'SUPERADMIN';

export type DeliveryStatus =
  | 'EXPECTED'
  | 'DELIVERED'
  | 'PARTIAL'
  | 'SKIPPED'
  | 'EXTRA'
  | 'NOT_DELIVERED'
  | 'DISPUTED';

export type DayLockStatus = 'OPEN' | 'REVIEW' | 'FINALIZED';

export type DeliveryShift = 'MORNING' | 'EVENING' | 'BOTH';

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export type ProductCategory = 'MILK' | 'CURD' | 'GHEE' | 'PANEER' | 'BUTTER' | 'BUTTERMILK';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type PaymentMethod = 'UPI' | 'CASH' | 'CARD' | 'NETBANKING';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED';

export type DisputeResolutionType =
  | 'CUSTOMER_VALID'
  | 'FARMER_VALID'
  | 'PARTIAL_ADJUSTMENT'
  | 'CREDIT_ISSUED'
  | 'NO_CHANGE';

export type DisputeReason =
  | 'DID_NOT_RECEIVE'
  | 'TOOK_LESS'
  | 'TOOK_MORE'
  | 'WRONG_QUANTITY'
  | 'QUALITY_ISSUE'
  | 'OTHER';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  tenantId: string;
  avatarUrl?: string;
}

export interface FarmerProfile {
  id: string;
  tenantId: string;
  userId: string;
  farmName: string;
  phone: string;
  address: string;
  upiId: string;
  qrPayload: string;
}

export type AccountStatus =
  | 'INVITED'
  | 'PENDING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'SUSPENDED'
  | 'DEACTIVATED';

export interface CustomerProfile {
  id: string;
  tenantId: string;
  userId: string;
  farmerId: string;
  customerCode: string; // e.g. "MK-1024"
  qrToken: string; // Opaque secure token e.g. "MK_QR_8f7b2c1a9e"
  name: string;
  email?: string;
  phone: string;
  address: string;
  deliveryShift: DeliveryShift;
  deliveryTime: string; // e.g. "06:30 AM"
  deliverySequence: number; // 1, 2, 3 route order
  active: boolean;
  accountStatus: AccountStatus;
  notes?: string;
  walletBalance?: number;
  latitude?: number;
  longitude?: number;
}

export interface Product {
  id: string;
  tenantId: string;
  farmerId: string;
  name: string;
  category: ProductCategory;
  unit: string; // "Litre", "Kg", "Bottle"
  basePrice: number | null; // e.g. ₹50 or null for dynamic/variable
  description?: string;
  inStock: boolean;
}

export interface Subscription {
  id: string;
  tenantId: string;
  customerId: string;
  farmerId: string;
  productId: string;
  productName: string;
  defaultQuantity: number; // e.g. 1.0 L
  customPricePerUnit?: number; // e.g. ₹50/L
  deliveryDays: DayOfWeek[];
  deliveryShift: DeliveryShift;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  active: boolean;
}

export interface PauseRequest {
  id: string;
  tenantId: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  farmerId: string;
  subscriptionId?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface VacationPause {
  id: string;
  tenantId: string;
  customerId: string;
  farmerId?: string;
  subscriptionId?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  createdAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
}

export interface TemporaryQuantityChange {
  id: string;
  tenantId: string;
  customerId: string;
  farmerId?: string;
  subscriptionId?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  overrideQuantity: number; // e.g. 2.5 L
  reason: string;
}

export interface QuantityChangeRequest {
  id: string;
  tenantId: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  farmerId: string;
  subscriptionId: string;
  currentQuantity: number;
  requestedQuantity: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface DeliveryRecord {
  id: string;
  tenantId: string;
  farmerId: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  qrToken?: string;
  subscriptionId?: string;
  productId: string;
  productName: string;
  date: string; // YYYY-MM-DD
  shift: DeliveryShift;
  scheduledQuantity: number; // e.g. 1.0 L
  deliveredQuantity: number; // e.g. 1.0, 0.5, 0.0, 1.5
  status: DeliveryStatus;
  reason?: string;
  pricePerUnit: number; // Historical price locked at delivery time
  billableAmount: number; // deliveredQuantity * pricePerUnit (server calculated)
  deliveredAt?: string;
  markedBy: 'FARMER' | 'CUSTOMER' | 'SYSTEM_AUTO';
  hasDispute?: boolean;
  bottlesReturned?: number;
  notes?: string;
  isLocked?: boolean; // locked once day is finalized
  updatedAt: string;
}

export interface Dispute {
  id: string;
  tenantId: string;
  deliveryRecordId: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  farmerId: string;
  date: string;
  recordedQuantity: number;
  claimedQuantity: number;
  reason: DisputeReason;
  customerNote: string;
  farmerNote?: string;
  resolutionType?: DisputeResolutionType;
  adjustmentAmount?: number;
  status: DisputeStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  totalQuantity: number;
  pricePerUnit: number;
  amount: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  farmerId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  invoiceNumber: string; // e.g. "INV-202609-1024"
  month: number; // 1-12
  year: number; // 2026
  monthName: string; // "September 2026"
  items: InvoiceItem[];
  totalQuantity: number;
  subtotal: number;
  extraCharges: number;
  creditsOrAdjustments: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: InvoiceStatus;
  dueDate: string;
  generatedAt: string;
  lastPaymentAt?: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  invoiceId?: string;
  customerId: string;
  customerName: string;
  farmerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionRef: string; // e.g. "UPI-20260916-8912" (Idempotency key)
  receiptNumber: string; // e.g. "REC-98214"
  paidAt: string;
  note?: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
}

export interface CryptographicAuditBlock {
  blockIndex: number;
  timestamp: string;
  entityType: 'DELIVERY_RECORD' | 'INVOICE' | 'DISPUTE' | 'PAYMENT' | 'VACATION' | 'SUBSCRIPTION' | 'DAY_CLOSING' | 'CUSTOMER';
  entityId: string;
  tenantId: string;
  actor: {
    userId: string;
    name: string;
    role: UserRole;
    ipAddress: string;
  };
  action: string;
  beforeState?: Record<string, unknown>;
  afterState: Record<string, unknown>;
  reason?: string;
  previousHash: string;
  currentHash: string;
}

export interface InventoryReconciliation {
  date: string;
  tenantId: string;
  cowMilkProduced: number;
  buffaloMilkProduced: number;
  a2MilkProduced: number;
  totalProduced: number;
  totalDelivered: number;
  remainingStock: number;
  wasteOrSpillage: number;
  personalConsumption: number;
  discrepancy: number; // totalProduced - (totalDelivered + remainingStock + wasteOrSpillage + personalConsumption)
  closedAt: string;
  closedBy: string;
  status: 'BALANCED' | 'DISCREPANCY';
}

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  type: 'DELIVERY' | 'INVOICE' | 'PAYMENT' | 'DISPUTE' | 'SYSTEM';
  read: boolean;
  timestamp: string;
  linkUrl?: string;
}

export interface AIForecastMetrics {
  maeLitres: number; // Mean Absolute Error
  rmseLitres: number; // Root Mean Squared Error
  mapePercentage: number; // Mean Absolute Percentage Error
  biasLitres: number; // Forecast Bias
  evaluationWindow: string; // e.g. "Past 14 Days Evaluation"
  baselineComparison: {
    modelName: string;
    mae: number;
    rmse: number;
    description: string;
  }[];
}

export interface AIForecastItem {
  date: string;
  dayName: string;
  predictedDemandLitres: number;
  predictionIntervalLower: number;
  predictionIntervalUpper: number;
  baseScheduledLitres: number;
  vacationLossLitres: number;
  extraRequestsLitres: number;
  safetyBufferLitres: number;
  confidenceScore: number; // 0-100
  factors: string[];
  recommendation: string;
}

export interface ExplainableChurnRisk {
  customerId: string;
  customerName: string;
  riskScore: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  factualIndicators: string[];
  recommendedAction: string;
}

export interface ExtraMilkRequest {
  id: string;
  tenantId: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  farmerId: string;
  subscriptionId?: string;
  date: string; // YYYY-MM-DD
  milkType?: string; // 'COW' | 'BUFFALO' | 'Cow' | 'Buffalo'
  normalQuantity: number;
  requestedQuantity: number; // Total requested for that day
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export type MilkRequest = ExtraMilkRequest;

export interface ActivityEvent {
  id: string;
  tenantId: string;
  type:
    | 'DELIVERY'
    | 'VACATION'
    | 'EXTRA_REQUEST'
    | 'DISPUTE'
    | 'PAYMENT'
    | 'REGISTRATION'
    | 'INVOICE'
    | 'DAY_CLOSING';
  title: string;
  description: string;
  actorName: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AdminOperationalStats {
  date: string;
  totalCustomers: number;
  expectedLitres: number;
  deliveredLitres: number;
  partialLitres: number;
  skippedLitres: number;
  extraLitres: number;
  billableLitres: number;
  todayRevenue: number;
  todayCollected: number;
  todayOutstanding: number;
  productBreakdown: {
    cow: number;
    buffalo: number;
    a2: number;
  };
  exceptionCounts: {
    partial: number;
    skipped: number;
    disputes: number;
    extraRequests: number;
    pendingCustomers: number;
    overdueInvoices: number;
  };
}

