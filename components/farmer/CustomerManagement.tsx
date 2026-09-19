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
  X,
  Printer,
  CheckCircle2,
  ChevronRight,
  Mail,
  Trash2,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Edit2,
  Save,
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
  onAddCustomer: (data: any) => Promise<any>;
  onDeleteCustomer?: (customerId: string) => Promise<any>;
  onRefresh: () => void;
}

export default function CustomerManagement({
  customers,
  products,
  onAddCustomer,
  onDeleteCustomer,
  onRefresh,
}: CustomerManagementProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'PAUSED' | 'DISPUTED'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustForQR, setSelectedCustForQR] = useState<CustomerWithSub | null>(null);
  const [selectedCust360, setSelectedCust360] = useState<CustomerWithSub | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerWithSub | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerWithSub | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    phone: string;
    temporaryPassword: string;
    loginUrl: string;
  } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newProductId, setNewProductId] = useState(products[0]?.id || 'prod_cow_milk');
  const [newQuantity, setNewQuantity] = useState('1.0');
  const [newCustomPrice, setNewCustomPrice] = useState('');
  const [newTime, setNewTime] = useState('06:30 AM');
  const [newShift, setNewShift] = useState<'MORNING' | 'EVENING' | 'BOTH'>('MORNING');
  const [newNotes, setNewNotes] = useState('');

  // Edit Customer Form State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editProductId, setEditProductId] = useState('');
  const [editQuantity, setEditQuantity] = useState('1.0');
  const [editCustomPrice, setEditCustomPrice] = useState('');
  const [editTime, setEditTime] = useState('06:30 AM');
  const [editShift, setEditShift] = useState<'MORNING' | 'EVENING' | 'BOTH'>('MORNING');
  const [editStatus, setEditStatus] = useState<AccountStatus>('ACTIVE');
  const [editNotes, setEditNotes] = useState('');

  // Filter customers by search and accountStatus
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.customerCode.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') return c.accountStatus === 'ACTIVE';
    if (statusFilter === 'PENDING') return c.accountStatus === 'PENDING';
    if (statusFilter === 'DISPUTED') return Boolean(c.notes?.toLowerCase().includes('dispute'));
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
      const res = await onAddCustomer({
        name: newName,
        phone: newPhone,
        email: newEmail.trim() || undefined,
        password: newPassword.trim() || undefined,
        address: newAddress,
        productId: newProductId,
        quantity: parseFloat(newQuantity),
        deliveryTime: newTime,
        deliveryShift: newShift,
        customPrice: newCustomPrice ? parseFloat(newCustomPrice) : undefined,
        notes: newNotes,
      });
      setShowAddModal(false);

      if (res?.credentials) {
        setCreatedCredentials({
          name: newName,
          email: res.credentials.email,
          phone: res.credentials.phone,
          temporaryPassword: res.credentials.temporaryPassword,
          loginUrl: '/login',
        });
      }

      // reset
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewPassword('');
      setNewAddress('');
      setNewQuantity('1.0');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditCustomer = (c: CustomerWithSub) => {
    setEditingCustomer(c);
    setEditName(c.name || '');
    setEditPhone(c.phone || '');
    setEditEmail(c.email || '');
    setEditAddress(c.address || '');
    setEditProductId(c.subscription?.productId || products[0]?.id || 'prod_cow_milk');
    setEditQuantity(c.subscription?.defaultQuantity ? String(c.subscription.defaultQuantity) : '1.0');
    setEditCustomPrice(c.subscription?.customPricePerUnit ? String(c.subscription.customPricePerUnit) : '');
    setEditTime(c.deliveryTime || '06:30 AM');
    setEditShift(c.deliveryShift || 'MORNING');
    setEditStatus(c.accountStatus || 'ACTIVE');
    setEditNotes(c.notes || '');
  };

  const handleSaveEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editName || !editPhone) return;
    setIsSubmittingEdit(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: editingCustomer.id,
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim() || undefined,
          address: editAddress.trim(),
          productId: editProductId,
          quantity: parseFloat(editQuantity) || 1.0,
          customPrice: editCustomPrice ? parseFloat(editCustomPrice) : undefined,
          deliveryTime: editTime,
          deliveryShift: editShift,
          status: editStatus,
          notes: editNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
        setEditingCustomer(null);
        if (selectedCust360?.id === editingCustomer.id) {
          setSelectedCust360((prev) =>
            prev
              ? {
                  ...prev,
                  name: editName.trim(),
                  phone: editPhone.trim(),
                  email: editEmail.trim() || undefined,
                  address: editAddress.trim(),
                  deliveryTime: editTime,
                  deliveryShift: editShift,
                  accountStatus: editStatus,
                  subscription: prev.subscription
                    ? {
                        ...prev.subscription,
                        productId: editProductId,
                        defaultQuantity: parseFloat(editQuantity) || 1.0,
                        customPricePerUnit: editCustomPrice ? parseFloat(editCustomPrice) : prev.subscription.customPricePerUnit,
                        productName: products.find((p) => p.id === editProductId)?.name || prev.subscription.productName,
                      }
                    : undefined,
                }
              : null
          );
        }
      }
    } catch (err) {
      console.error('Failed to update customer:', err);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setActionLoadingId(customerToDelete.id);
    try {
      if (onDeleteCustomer) {
        await onDeleteCustomer(customerToDelete.id);
      } else {
        await fetch(`/api/customers?id=${customerToDelete.id}`, { method: 'DELETE' });
        onRefresh();
      }
      if (selectedCust360?.id === customerToDelete.id) {
        setSelectedCust360(null);
      }
      setCustomerToDelete(null);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoadingId(null);
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
                      {c.email && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                          <Mail className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="truncate max-w-42.5">{c.email}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleStartEditCustomer(c)}
                        className="p-2 rounded-xl border border-blue-200 hover:bg-blue-50 text-blue-600 hover:text-blue-800 transition cursor-pointer"
                        title="Edit Customer Details & Subscription"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

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

                      <button
                        onClick={() => setCustomerToDelete(c)}
                        className="p-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition cursor-pointer"
                        title="Remove / Delete Customer"
                      >
                        <Trash2 className="w-4 h-4" />
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
                      <div className="text-[10px] text-slate-400 font-bold uppercase">This Month</div>
                      <div className="font-mono font-bold text-slate-800 mt-0.5">
                        {c.currentInvoice ? `${c.currentInvoice.totalQuantity} L` : '0.0 L'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Bill</div>
                      <div className="font-mono font-bold text-slate-800 mt-0.5">
                        ₹{c.currentInvoice ? c.currentInvoice.totalAmount : '0'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Due</div>
                      <div
                        className={`font-mono font-bold mt-0.5 ${
                          (c.currentInvoice?.outstandingAmount || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        ₹{c.currentInvoice ? c.currentInvoice.outstandingAmount : '0'}
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
                  <p className="text-xs text-slate-500">{selectedCust360.phone} {selectedCust360.email ? `• ${selectedCust360.email}` : ''} • {selectedCust360.address}</p>
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

              {/* Monthly Consumption Breakdown */}
              <div>
                <h4 className="font-extrabold text-slate-900 text-xs mb-2">Delivery & Billing Overview</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Daily Scheduled</span>
                    <div className="text-lg font-black text-emerald-950 mt-1 font-mono">
                      {selectedCust360.accountStatus === 'PAUSED' ? '0.0 L' : `${selectedCust360.subscription?.defaultQuantity || 1.0} L`}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Delivered This Month</span>
                    <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                      {selectedCust360.currentInvoice?.totalQuantity ? `${selectedCust360.currentInvoice.totalQuantity} L` : '0.0 L'}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Current Month Bill</span>
                    <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                      ₹{selectedCust360.currentInvoice?.totalAmount || '0'}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Outstanding Balance</span>
                    <div className="text-lg font-black text-rose-600 mt-1 font-mono">
                      ₹{selectedCust360.currentInvoice?.outstandingAmount || '0'}
                    </div>
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
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
                <button
                  onClick={() => {
                    const c = selectedCust360;
                    setSelectedCust360(null);
                    setCustomerToDelete(c);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Client</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const c = selectedCust360;
                      setSelectedCust360(null);
                      handleStartEditCustomer(c);
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-blue-200"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Profile & Plan</span>
                  </button>

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

      {/* Delete Customer Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-rose-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Remove Client</h3>
                <p className="text-xs text-slate-500">Deactivate customer and cancel daily milk subscriptions</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-rose-50/70 p-3.5 rounded-2xl border border-rose-100">
              Are you sure you want to remove <strong>{customerToDelete.name}</strong> ({customerToDelete.customerCode}, {customerToDelete.phone})? This will immediately remove them from the active daily delivery route.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCustomerToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={actionLoadingId === customerToDelete.id}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{actionLoadingId === customerToDelete.id ? 'Removing...' : 'Yes, Remove Client'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Created Credentials Modal */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-emerald-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Client Added Successfully!</h3>
                <p className="text-xs text-emerald-700 font-semibold">Login credentials generated for client portal</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-sans font-bold">Client Name:</span>
                <span className="text-slate-900 font-bold">{createdCredentials.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-sans font-bold">Email / Login ID:</span>
                <span className="text-emerald-700 font-bold">{createdCredentials.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-sans font-bold">Mobile Phone:</span>
                <span className="text-slate-900 font-bold">{createdCredentials.phone}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-sans font-bold">Starting Password:</span>
                <span className="text-rose-600 font-extrabold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {createdCredentials.temporaryPassword}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans font-bold">Portal URL:</span>
                <span className="text-blue-600 underline">/login</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              The client can immediately sign in using their <strong>Email</strong> or <strong>Mobile Number</strong> with this password, view daily deliveries, pause schedules, and pay monthly invoices.
            </p>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  const text = `GreenValley Dairy Login Credentials:\nEmail: ${createdCredentials.email}\nPhone: ${createdCredentials.phone}\nPassword: ${createdCredentials.temporaryPassword}\nLogin Portal: ${window.location.origin}/login`;
                  navigator.clipboard.writeText(text);
                  setCopiedCredentials(true);
                  setTimeout(() => setCopiedCredentials(false), 3000);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedCredentials ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCredentials ? 'Credentials Copied!' : 'Copy Login Details'}</span>
              </button>

              <button
                onClick={() => setCreatedCredentials(null)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Add New Milk Subscriber</h3>
                <p className="text-xs text-slate-500">Configure profile, subscription, and instant login access</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewCustomer} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Phone Number *</label>
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
                  <label className="block font-bold text-slate-700 mb-1">Email Address (For Easy Login)</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. ramesh@gmail.com"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Starting Password Setup */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Starting Login Password</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewPassword(`Milk#${Math.floor(1000 + Math.random() * 9000)}`)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="e.g. Milk#2026 (Leave empty to auto-generate)"
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">The client can change this password upon initial login.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Complete Address *</label>
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
                        {p.name} ({p.basePrice !== null ? `₹${p.basePrice}/${p.unit}` : 'Dynamic Rate'})
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Delivery Shift</label>
                  <select
                    value={newShift}
                    onChange={(e) => setNewShift(e.target.value as 'MORNING' | 'EVENING' | 'BOTH')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                  >
                    <option value="MORNING">MORNING</option>
                    <option value="EVENING">EVENING</option>
                    <option value="BOTH">BOTH</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Notes / Door Instructions</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g. Ring bell, leave on doorstep"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-98 cursor-pointer"
              >
                <span>{isSubmitting ? 'Creating Customer & Credentials...' : 'Create Customer & Generate Login'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Edit Present Client Profile</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {editingCustomer.customerCode} • {editingCustomer.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingCustomer(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="e.g. +91 98234 56789"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address (Login ID)</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="e.g. ramesh@gmail.com"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Delivery Address *</label>
                <textarea
                  rows={2}
                  required
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Complete Delivery Address"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Milk Product</label>
                  <select
                    value={editProductId}
                    onChange={(e) => setEditProductId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.basePrice !== null ? `₹${p.basePrice}/${p.unit}` : 'Dynamic Rate'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Daily Litres</label>
                  <select
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                  >
                    <option value="0.5">0.5 L</option>
                    <option value="1.0">1.0 L</option>
                    <option value="1.5">1.5 L</option>
                    <option value="2.0">2.0 L</option>
                    <option value="2.5">2.5 L</option>
                    <option value="3.0">3.0 L</option>
                    <option value="4.0">4.0 L</option>
                    <option value="5.0">5.0 L</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Custom Rate (₹/Litre)</label>
                  <input
                    type="number"
                    value={editCustomPrice}
                    onChange={(e) => setEditCustomPrice(e.target.value)}
                    placeholder="Leave empty for standard base price"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as AccountStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                  >
                    <option value="ACTIVE">ACTIVE (Active Delivery)</option>
                    <option value="PAUSED">PAUSED (Paused Delivery)</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Delivery Time</label>
                  <input
                    type="text"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    placeholder="06:30 AM"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Shift</label>
                  <select
                    value={editShift}
                    onChange={(e) => setEditShift(e.target.value as 'MORNING' | 'EVENING' | 'BOTH')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                  >
                    <option value="MORNING">MORNING</option>
                    <option value="EVENING">EVENING</option>
                    <option value="BOTH">BOTH</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Preferences</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Ring bell twice, leave on doorstep bag"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmittingEdit ? 'Saving Changes...' : 'Save Customer Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
