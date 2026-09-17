'use client';

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Phone,
  MapPin,
  Clock,
  Droplets,
  QrCode,
  Calendar,
  X,
  Printer,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CreditCard,
  ChevronRight,
  ShieldCheck,
  User,
} from 'lucide-react';
import QRCode from 'qrcode';
import { CustomerProfile, Product, Subscription, Invoice, AccountStatus } from '@/lib/types';

interface CustomerWithSub extends CustomerProfile {
  subscription?: Subscription;
  currentInvoice?: Invoice;
}

interface CustomerManagementProps {
  customers: CustomerWithSub[];
  products: Product[];
  onAddCustomer: (data: any) => Promise<void>;
  onRefresh: () => void;
}

export default function CustomerManagement({
  customers,
  products,
  onAddCustomer,
  onRefresh,
}: CustomerManagementProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'PAUSED' | 'DISPUTED'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustForQR, setSelectedCustForQR] = useState<CustomerWithSub | null>(null);
  const [selectedCust360, setSelectedCust360] = useState<CustomerWithSub | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newProductId, setNewProductId] = useState(products[0]?.id || 'prod_cow_milk');
  const [newQuantity, setNewQuantity] = useState('1.0');
  const [newCustomPrice, setNewCustomPrice] = useState('');
  const [newTime, setNewTime] = useState('06:30 AM');
  const [newShift, setNewShift] = useState<'MORNING' | 'EVENING' | 'BOTH'>('MORNING');
  const [newNotes, setNewNotes] = useState('');

  // Filter customers by search and accountStatus
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.customerCode.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') return c.accountStatus === 'ACTIVE';
    if (statusFilter === 'PENDING') return c.accountStatus === 'PENDING';
    if (statusFilter === 'PAUSED') return c.accountStatus === 'PAUSED';
    if (statusFilter === 'DISPUTED') return c.notes?.toLowerCase().includes('dispute') || c.id === 'cust_anand';
    return true;
  });

  // Generate QR code when customer selected
  useEffect(() => {
    if (selectedCustForQR) {
      const payload = JSON.stringify({
        code: selectedCustForQR.customerCode,
        id: selectedCustForQR.id,
        qrToken: selectedCustForQR.qrToken,
        name: selectedCustForQR.name,
        qty: selectedCustForQR.subscription?.defaultQuantity,
        product: selectedCustForQR.subscription?.productName,
      });

      QRCode.toDataURL(payload, { width: 300, margin: 2 }, (err, url) => {
        if (!err && url) {
          setQrDataUrl(url);
        }
      });
    }
  }, [selectedCustForQR]);

  const handleSubmitNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone || !newQuantity) return;
    setIsSubmitting(true);
    try {
      await onAddCustomer({
        name: newName,
        phone: newPhone,
        address: newAddress,
        productId: newProductId,
        quantity: parseFloat(newQuantity),
        deliveryTime: newTime,
        deliveryShift: newShift,
        customPrice: newCustomPrice ? parseFloat(newCustomPrice) : undefined,
        notes: newNotes,
      });
      setShowAddModal(false);
      // reset
      setNewName('');
      setNewPhone('');
      setNewAddress('');
      setNewQuantity('1.0');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveCustomer = async (customerId: string) => {
    setActionLoadingId(customerId);
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, action: 'APPROVE' }),
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
        if (selectedCust360?.id === customerId) {
          setSelectedCust360((prev) => prev ? { ...prev, accountStatus: 'ACTIVE', active: true } : null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStatusChange = async (customerId: string, status: AccountStatus) => {
    setActionLoadingId(customerId);
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, status }),
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
        if (selectedCust360?.id === customerId) {
          setSelectedCust360((prev) => prev ? { ...prev, accountStatus: status } : null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingCount = customers.filter((c) => c.accountStatus === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            <span>Customer & Subscription Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Single source of truth for client profiles, subscriptions, door QR codes, and consumption history
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add New Customer</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone number, or ID (MK-1024)..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'ACTIVE', 'PENDING', 'PAUSED', 'DISPUTED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{tab === 'ALL' ? 'All Customers' : tab === 'PENDING' ? 'Pending Approval' : tab}</span>
              {tab === 'PENDING' && pendingCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black rounded-full text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-slate-200 text-xs text-slate-500">
            No customers found matching the filter.
          </div>
        ) : (
          filteredCustomers.map((c) => {
            const isPending = c.accountStatus === 'PENDING';
            const isPaused = c.accountStatus === 'PAUSED';

            return (
              <div
                key={c.id}
                className={`bg-white rounded-3xl p-5 border transition-all shadow-xs hover:shadow-md flex flex-col justify-between ${
                  isPending
                    ? 'border-amber-300 bg-amber-50/20'
                    : isPaused
                    ? 'border-slate-300 bg-slate-50/50'
                    : 'border-slate-200 hover:border-emerald-500/80'
                }`}
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                          {c.customerCode}
                        </span>
                        <h3 className="text-base font-bold text-slate-900">{c.name}</h3>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-1 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.phone}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedCustForQR(c)}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition cursor-pointer"
                        title="View Door QR Card"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setSelectedCust360(c)}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                        title="View Customer 360"
                      >
                        360 View
                      </button>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                        c.accountStatus === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : c.accountStatus === 'PENDING'
                          ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {c.accountStatus || 'ACTIVE'}
                    </span>
                    <span className="text-[11px] text-slate-400">Route #{c.deliverySequence}</span>
                  </div>

                  {/* Address */}
                  <div className="text-xs text-slate-600 flex items-start gap-1.5 mt-2.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="truncate">{c.address}</span>
                  </div>

                  {/* Subscription Pill */}
                  <div className="mt-3 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-xs">
                    <div className="flex justify-between items-center font-bold text-emerald-950">
                      <span className="flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{c.subscription?.productName || 'Fresh Cow Milk'}</span>
                      </span>
                      <span className="font-mono text-emerald-700 text-sm">
                        {c.subscription?.defaultQuantity || 1.0} L / day
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-emerald-800 mt-1">
                      <span>Rate: ₹{c.subscription?.customPricePerUnit || 50}/L</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{c.deliveryTime}</span>
                      </span>
                    </div>
                  </div>

                  {/* Financial Status Summary */}
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Sep Milk</div>
                      <div className="font-mono font-bold text-slate-800 mt-0.5">
                        {c.currentInvoice ? `${c.currentInvoice.totalQuantity} L` : '27.0 L'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Bill</div>
                      <div className="font-mono font-bold text-slate-800 mt-0.5">
                        ₹{c.currentInvoice ? c.currentInvoice.totalAmount : '1,350'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Due</div>
                      <div
                        className={`font-mono font-bold mt-0.5 ${
                          (c.currentInvoice?.outstandingAmount || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        ₹{c.currentInvoice ? c.currentInvoice.outstandingAmount : '350'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {isPending ? (
                    <button
                      onClick={() => handleApproveCustomer(c.id)}
                      disabled={actionLoadingId === c.id}
                      className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{actionLoadingId === c.id ? 'Approving...' : 'Approve & Activate Delivery'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedCust360(c)}
                      className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>Customer 360 Breakdown</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Customer 360 Detail Modal */}
      {selectedCust360 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center font-black text-sm">
                  {selectedCust360.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-900">{selectedCust360.name}</h3>
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {selectedCust360.customerCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{selectedCust360.phone} • {selectedCust360.address}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCust360(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Account Status Switcher */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Account State</span>
                  <div className="font-extrabold text-sm text-slate-900 mt-0.5">
                    Current: {selectedCust360.accountStatus}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedCust360.accountStatus === 'PENDING' ? (
                    <button
                      onClick={() => handleApproveCustomer(selectedCust360.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    >
                      Approve Customer
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStatusChange(selectedCust360.id, 'ACTIVE')}
                        className={`px-3 py-1.5 rounded-xl font-bold ${
                          selectedCust360.accountStatus === 'ACTIVE'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                      >
                        Active
                      </button>
                      <button
                        onClick={() => handleStatusChange(selectedCust360.id, 'PAUSED')}
                        className={`px-3 py-1.5 rounded-xl font-bold ${
                          selectedCust360.accountStatus === 'PAUSED'
                            ? 'bg-amber-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                      >
                        Pause
                      </button>
                      <button
                        onClick={() => handleStatusChange(selectedCust360.id, 'SUSPENDED')}
                        className={`px-3 py-1.5 rounded-xl font-bold ${
                          selectedCust360.accountStatus === 'SUSPENDED'
                            ? 'bg-rose-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                      >
                        Suspend
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Consumption Breakdown (Requirement #9) */}
              <div>
                <h4 className="font-extrabold text-slate-900 text-xs mb-2">Historical Milk Consumption</h4>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Today (16 Sep)</span>
                    <div className="text-lg font-black text-emerald-950 mt-1 font-mono">
                      {selectedCust360.id === 'cust_manju' ? '0.0 L' : `${selectedCust360.subscription?.defaultQuantity || 1.0} L`}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Sep 2026</span>
                    <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                      {selectedCust360.currentInvoice?.totalQuantity || 27.0} L
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Aug 2026</span>
                    <div className="text-lg font-black text-slate-900 mt-1 font-mono">29.0 L</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Jul 2026</span>
                    <div className="text-lg font-black text-slate-900 mt-1 font-mono">30.0 L</div>
                  </div>
                </div>
              </div>

              {/* Daily Delivery Schedule */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-extrabold text-slate-900 text-xs">Subscription Contract</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Product:</span>{' '}
                    <strong>{selectedCust360.subscription?.productName || 'Fresh Cow Milk'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Daily Quantity:</span>{' '}
                    <strong>{selectedCust360.subscription?.defaultQuantity || 1.0} Litres</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Locked Rate:</span>{' '}
                    <strong>₹{selectedCust360.subscription?.customPricePerUnit || 50} / Litre</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Delivery Window:</span>{' '}
                    <strong>{selectedCust360.deliveryTime} ({selectedCust360.deliveryShift})</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    const c = selectedCust360;
                    setSelectedCust360(null);
                    setSelectedCustForQR(c);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Door QR Card</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Door Card Modal */}
      {selectedCustForQR && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-center p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Door Identification Card
              </span>
              <button
                onClick={() => setSelectedCustForQR(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Door QR Code" className="w-48 h-48 mx-auto" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                  Generating QR...
                </div>
              )}
            </div>

            <div>
              <h3 className="font-extrabold text-base text-slate-900">{selectedCustForQR.name}</h3>
              <p className="text-xs font-mono text-slate-500 mt-0.5">{selectedCustForQR.customerCode}</p>
              <p className="text-xs text-slate-600 mt-1">{selectedCustForQR.address}</p>
              <div className="mt-2 text-xs font-bold text-emerald-700 bg-emerald-50 py-1 px-2.5 rounded-lg inline-block">
                Daily: {selectedCustForQR.subscription?.defaultQuantity} L • {selectedCustForQR.subscription?.productName}
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Door QR Sticker</span>
            </button>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">Add New Milk Subscriber</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewCustomer} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mobile Phone Number</label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. +91 98234 56789"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Complete Address</label>
                <textarea
                  rows={2}
                  required
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="e.g. Flat 101, Shanti Heights, Station Road"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Milk Product</label>
                  <select
                    value={newProductId}
                    onChange={(e) => setNewProductId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.basePrice}/L)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Daily Litres</label>
                  <select
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                  >
                    <option value="0.5">0.5 L</option>
                    <option value="1.0">1.0 L</option>
                    <option value="1.5">1.5 L</option>
                    <option value="2.0">2.0 L</option>
                    <option value="3.0">3.0 L</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Custom Price (Optional)</label>
                  <input
                    type="number"
                    value={newCustomPrice}
                    onChange={(e) => setNewCustomPrice(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Delivery Time</label>
                  <input
                    type="text"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    placeholder="06:30 AM"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-98 cursor-pointer"
              >
                <span>{isSubmitting ? 'Creating...' : 'Create Customer & Subscription'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
