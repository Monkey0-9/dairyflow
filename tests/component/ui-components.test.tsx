import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import InvoiceModal from '@/components/common/InvoiceModal';
import ReceiptModal from '@/components/common/ReceiptModal';
import QRScannerModal from '@/components/common/QRScannerModal';
import DisputeResolver from '@/components/farmer/DisputeResolver';
import { Invoice, Payment, Dispute } from '@/lib/types';

describe('Component Testing: UI Components Rendering & Visual Integrity', () => {
  const dummyInvoice: Invoice = {
    id: 'inv_test_01',
    tenantId: 'tenant_greenvalley',
    farmerId: 'farmer_01',
    customerId: 'cust_ravi',
    customerName: 'Ravi Kumar',
    customerPhone: '+91 98234 56780',
    customerAddress: 'Flat 302, Krishna Heights',
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
    creditsOrAdjustments: 50.0,
    totalAmount: 1300.0,
    paidAmount: 1000.0,
    outstandingAmount: 300.0,
    status: 'PARTIALLY_PAID',
    dueDate: '2026-10-05',
    generatedAt: '2026-09-16T00:00:00Z',
  };

  const dummyPayment: Payment = {
    id: 'pay_test_01',
    tenantId: 'tenant_greenvalley',
    invoiceId: 'inv_test_01',
    customerId: 'cust_ravi',
    customerName: 'Ravi Kumar',
    farmerId: 'farmer_01',
    amount: 1000.0,
    paymentMethod: 'UPI',
    transactionRef: 'UPI-20260916-8912',
    receiptNumber: 'REC-202609-9821',
    paidAt: '2026-09-16T10:30:00Z',
    status: 'SUCCESS',
  };

  const dummyDisputes: Dispute[] = [
    {
      id: 'disp_01',
      tenantId: 'tenant_greenvalley',
      deliveryRecordId: 'del_2026-09-16_cust_anand',
      customerId: 'cust_anand',
      customerName: 'Anand Verma',
      customerCode: 'MK-1004',
      farmerId: 'farmer_01',
      date: '2026-09-16',
      recordedQuantity: 2.0,
      claimedQuantity: 0.0,
      reason: 'DID_NOT_RECEIVE',
      customerNote: 'Delivery was not dropped in canister',
      status: 'OPEN',
      createdAt: '2026-09-16T08:30:00Z',
    },
  ];

  it('should render InvoiceModal with correct invoice metadata and currency amounts', () => {
    const html = renderToString(
      <InvoiceModal
        invoice={dummyInvoice}
        onClose={() => {}}
      />
    );

    expect(html).toContain('INV-202609-1024');
    expect(html).toContain('Ravi Kumar');
    expect(html).toContain('Fresh Cow Milk');
    expect(html).toContain('PARTIALLY PAID');
    expect(html).toContain('1,300'); // Total Bill after discount
    expect(html).toContain('50.00'); // Adjustment / Discount
  });

  it('should render ReceiptModal with receipt number and UPI transaction reference', () => {
    const html = renderToString(
      <ReceiptModal
        payment={dummyPayment}
        onClose={() => {}}
      />
    );

    expect(html).toContain('REC-202609-9821');
    expect(html).toContain('UPI-20260916-8912');
    expect(html).toContain('1,000');
    expect(html).toContain('Official Milk Payment Receipt');
  });

  it('should render QRScannerModal with modal layout and instructions', () => {
    const dummyCustomers = [
      {
        id: 'cust_ravi',
        tenantId: 'tenant_greenvalley',
        userId: 'user_ravi',
        farmerId: 'farmer_01',
        customerCode: 'MK-1024',
        qrToken: 'MK_QR_1024',
        name: 'Ravi Kumar',
        phone: '+91 98234 56780',
        address: 'Flat 302',
        deliveryShift: 'MORNING' as const,
        deliveryTime: '06:30 AM',
        deliverySequence: 1,
        active: true,
        accountStatus: 'ACTIVE' as const,
      },
    ];

    const html = renderToString(
      <QRScannerModal
        customers={dummyCustomers}
        onClose={() => {}}
        onScanSuccess={() => {}}
      />
    );

    expect(html).toContain('QR Delivery Scanner');
    expect(html).toContain('Point camera at door QR code');
  });

  it('should render DisputeResolver with active dispute details', () => {
    const html = renderToString(
      <DisputeResolver
        disputes={dummyDisputes}
        onResolveDispute={async () => {}}
        onRefresh={() => {}}
      />
    );

    expect(html).toContain('Anand Verma');
    expect(html).toContain('Delivery was not dropped in canister');
    expect(html).toContain('DID NOT RECEIVE');
  });
});
