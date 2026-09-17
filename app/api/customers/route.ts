import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const store = getStore();
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('id');

    if (customerId) {
      const customer = store.customers.find((c) => c.id === customerId);
      if (!customer) {
        return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
      }
      const subscription = store.subscriptions.find((s) => s.customerId === customerId);
      const invoices = store.invoices.filter((i) => i.customerId === customerId);
      const payments = store.payments.filter((p) => p.customerId === customerId);
      const disputes = store.disputes.filter((d) => d.customerId === customerId);
      const vacations = store.vacationPauses.filter((v) => v.customerId === customerId);

      return NextResponse.json({
        success: true,
        customer,
        subscription,
        invoices,
        payments,
        disputes,
        vacations,
      });
    }

    const farmerId = searchParams.get('farmerId');
    let filteredCustomers = store.customers;
    if (farmerId) {
      filteredCustomers = filteredCustomers.filter((c) => !c.farmerId || c.farmerId === farmerId);
    }

    // Return all
    const customersWithSubs = filteredCustomers.map((c) => {
      const sub = store.subscriptions.find((s) => s.customerId === c.id);
      const latestInvoice = store.invoices.find((i) => i.customerId === c.id && i.month === 9 && i.year === 2026);
      return {
        ...c,
        subscription: sub,
        currentInvoice: latestInvoice,
      };
    });

    return NextResponse.json({
      success: true,
      customers: customersWithSubs,
      products: store.products,
      farmer: store.farmer,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch customers';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();

    if (!body.name || !body.phone || !body.productId || !body.quantity) {
      return NextResponse.json({ success: false, error: 'Name, phone, product, and quantity are required.' }, { status: 400 });
    }

    const newCustomer = store.addCustomer({
      name: body.name,
      phone: body.phone,
      address: body.address || 'Local Residence',
      productId: body.productId,
      quantity: parseFloat(body.quantity),
      deliveryTime: body.deliveryTime || '06:30 AM',
      deliveryShift: body.deliveryShift || 'MORNING',
      customPrice: body.customPrice ? parseFloat(body.customPrice) : undefined,
      notes: body.notes,
      farmerId: body.farmerId,
    });

    return NextResponse.json({ success: true, customer: newCustomer });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add customer';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, action, status, approvedBy } = body;
    const store = getStore();

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customerId is required' }, { status: 400 });
    }

    if (action === 'APPROVE') {
      const approved = store.approveCustomer(customerId, approvedBy || 'Suresh Patel (Farmer)');
      if (!approved) {
        return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, customer: approved });
    } else if (status) {
      const updated = store.updateCustomerStatus(customerId, status);
      if (!updated) {
        return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, customer: updated });
    }

    return NextResponse.json({ success: false, error: 'Invalid update action or status' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update customer';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

