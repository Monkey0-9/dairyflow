'use client';

import React, { useState, useEffect } from 'react';
import {
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
  LayoutGrid,
  List,
  Users,
  AlertCircle,
  TrendingUp,
  CreditCard,
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
  const [routeFilter, setRouteFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'sequence' | 'name' | 'quota' | 'due'>('sequence');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
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
  // Surfaces failed saves (network, validation, duplicate phone) instead of
  // closing the modal as if the change had been saved.
  const [formError, setFormError] = useState<string | null>(null);

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

  // Helper to extract customer initials for FAANG/Stripe-grade monogram avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const uniqueRoutes = Array.from(
    new Set(customers.map((c) => c.deliverySequence).filter((seq): seq is number => seq != null))
  ).sort((a, b) => a - b);

  // Filter & sort customers
  const filteredCustomers = customers
    .filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.customerCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchesSearch) return false;

      if (statusFilter === 'ACTIVE' && c.accountStatus !== 'ACTIVE') return false;
      if (statusFilter === 'PENDING' && c.accountStatus !== 'PENDING') return false;
      if (statusFilter === 'PAUSED' && c.accountStatus !== 'PAUSED') return false;
      if (statusFilter === 'DISPUTED' && !c.notes?.toLowerCase().includes('dispute')) return false;

      if (routeFilter !== 'ALL' && String(c.deliverySequence) !== routeFilter) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'quota') {
        const qA = a.subscription?.defaultQuantity || 0;
        const qB = b.subscription?.defaultQuantity || 0;
        return qB - qA;
      }
      if (sortBy === 'due') {
        const dA = a.currentInvoice?.outstandingAmount || 0;
        const dB = b.currentInvoice?.outstandingAmount || 0;
        return dB - dA;
      }
      return (a.deliverySequence || 999) - (b.deliverySequence || 999);
    });

  const pendingCount = customers.filter((c) => c.accountStatus === 'PENDING').length;
  const activeCount = customers.filter((c) => c.accountStatus === 'ACTIVE').length;
  const totalDailyLitres = customers.reduce((acc, c) => {
    if (c.accountStatus === 'ACTIVE') {
      return acc + (Number(c.subscription?.defaultQuantity) || 0);
    }
    return acc;
  }, 0);
  const totalOutstandingDue = customers.reduce((acc, c) => {
    return acc + (c.currentInvoice?.outstandingAmount || 0);
  }, 0);

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
    if (!newName.trim() || !newPhone.trim() || !newQuantity) {
      setFormError('Full name, mobile phone, and daily litres are all required.');
      return;
    }
    const qty = parseFloat(newQuantity);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 50) {
      setFormError('Daily litres must be between 0.5 L and 50 L.');
      return;
    }
    if (newCustomPrice.trim() !== '') {
      const cp = parseFloat(newCustomPrice);
      if (!Number.isFinite(cp) || cp < 0) {
        setFormError('Custom price must be a valid non-negative number.');
        return;
      }
    }
    setIsSubmitting(true);
    setFormError(null);
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
      // Parent throws on failure, so reaching here means the customer saved.
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
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add customer. Please retry.');
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
    if (!editingCustomer || !editName.trim() || !editPhone.trim()) {
      setFormError('Full name and mobile phone are required to save changes.');
      return;
    }
    const qty = parseFloat(editQuantity);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 50) {
      setFormError('Daily litres must be between 0.5 L and 50 L.');
      return;
    }
    setIsSubmittingEdit(true);
    setFormError(null);
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
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Update failed (${res.status}).`);
      }
      await onRefresh();
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
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update customer. Please retry.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setActionLoadingId(customerToDelete.id);
    setFormError(null);
    try {
      if (onDeleteCustomer) {
        await onDeleteCustomer(customerToDelete.id);
      } else {
        const res = await fetch(`/api/customers?id=${customerToDelete.id}`, { method: 'DELETE' });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || `Delete failed (${res.status}).`);
        }
        await onRefresh();
      }
      if (selectedCust360?.id === customerToDelete.id) {
        setSelectedCust360(null);
      }
      setCustomerToDelete(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to delete customer. Please retry.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveCustomer = async (customerId: string) => {
    setActionLoadingId(customerId);
    setFormError(null);
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, action: 'APPROVE' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Approval failed (${res.status}).`);
      }
      await onRefresh();
      if (selectedCust360?.id === customerId) {
        setSelectedCust360((prev) => (prev ? { ...prev, accountStatus: 'ACTIVE', active: true } : null));
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to approve customer. Please retry.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStatusChange = async (customerId: string, status: AccountStatus) => {
    setActionLoadingId(customerId);
    setFormError(null);
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Status update failed (${res.status}).`);
      }
      await onRefresh();
      if (selectedCust360?.id === customerId) {
        setSelectedCust360((prev) => (prev ? { ...prev, accountStatus: status } : null));
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to update status. Please retry.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {formError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Change not saved.</p>
            <p className="mt-0.5">{formError}</p>
          </div>
          <button onClick={() => setFormError(null)} className="rounded-lg px-2 py-1 text-xs font-bold hover:bg-red-100" aria-label="Dismiss error">
            Dismiss
          </button>
        </div>
      )}
      {/* Enterprise KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Customers</span>
            <div className="text-xl font-black text-slate-900 mt-0.5 tracking-tight font-mono">{customers.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400" />
              <span>Registered accounts</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Deliveries</span>
            <div className="text-xl font-black text-emerald-700 mt-0.5 tracking-tight font-mono">{activeCount}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span>Receiving daily</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending Approvals</span>
            <div className={`text-xl font-black mt-0.5 tracking-tight font-mono ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {pendingCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {pendingCount > 0 ? 'Requires review' : 'All verified'}
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
            pendingCount > 0
              ? 'bg-amber-50 border-amber-200 text-amber-600 animate-pulse'
              : 'bg-slate-50 border-slate-200/60 text-slate-400'
          }`}>
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Daily Demand</span>
            <div className="text-xl font-black text-teal-700 mt-0.5 tracking-tight font-mono">{totalDailyLitres.toFixed(1)} L</div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-teal-600" />
              <span>Quota per day</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
            <Droplets className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Outstanding Due</span>
            <div className={`text-xl font-black mt-0.5 tracking-tight font-mono ${totalOutstandingDue > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              ₹{totalOutstandingDue.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-slate-400" />
              <span>Unpaid balance</span>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
            totalOutstandingDue > 0
              ? 'bg-rose-50 border-rose-200 text-rose-600'
              : 'bg-emerald-50 border-emerald-200/60 text-emerald-700'
          }`}>
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control & Toolbar Hub */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5">
        {/* Top Control Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, phone, code (MK-1021), or address..."
              className="w-full pl-10 pr-9 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50/70 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Actions & Filters Group */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Route Filter Dropdown */}
            {uniqueRoutes.length > 0 && (
              <div className="flex items-center">
                <select
                  value={routeFilter}
                  onChange={(e) => setRouteFilter(e.target.value)}
                  className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/80 text-slate-700 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                  title="Filter by delivery route sequence"
                >
                  <option value="ALL">All Routes ({uniqueRoutes.length})</option>
                  {uniqueRoutes.map((rt) => (
                    <option key={rt} value={String(rt)}>
                      Route #{rt}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Selector */}
            <div className="flex items-center">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/80 text-slate-700 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                title="Sort customer directory"
              >
                <option value="sequence">Sort: Route Sequence</option>
                <option value="name">Sort: Name (A-Z)</option>
                <option value="quota">Sort: Daily Quota (High-Low)</option>
                <option value="due">Sort: Balance Due (High-Low)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Card Grid View"
                aria-label="Card Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="High-Density Table View"
                aria-label="High-Density Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Add New Customer CTA */}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-[0.98] cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Customer</span>
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto pt-1 pb-0.5 border-t border-slate-100">
          {(['ALL', 'ACTIVE', 'PENDING', 'PAUSED', 'DISPUTED'] as const).map((tab) => {
            const count =
              tab === 'ALL'
                ? customers.length
                : tab === 'ACTIVE'
                ? activeCount
                : tab === 'PENDING'
                ? pendingCount
                : tab === 'PAUSED'
                ? customers.filter((c) => c.accountStatus === 'PAUSED').length
                : customers.filter((c) => Boolean(c.notes?.toLowerCase().includes('dispute'))).length;

            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === tab
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab === 'ALL' ? 'All Customers' : tab === 'PENDING' ? 'Pending Approval' : tab}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    statusFilter === tab
                      ? 'bg-slate-800 text-slate-200'
                      : tab === 'PENDING' && count > 0
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Customer Display: Grid or Table */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-xs text-slate-500 shadow-xs">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <p className="font-semibold text-slate-700 text-sm">No customers found</p>
          <p className="text-slate-400 text-xs mt-1">Try changing your search query or status filter.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* FAANG-Grade Responsive Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCustomers.map((c) => {
            const isPending = c.accountStatus === 'PENDING';
            const isPaused = c.accountStatus === 'PAUSED';

            return (
              <div
                key={c.id}
                className={`bg-white rounded-2xl p-4.5 border transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between group ${
                  isPending
                    ? 'border-amber-300/80 bg-amber-50/10'
                    : isPaused
                    ? 'border-slate-300 bg-slate-50/40'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Card Header: Avatar, Name, Code, Status & Compact Action Toolbar */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                          isPending
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : isPaused
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200/70'
                        }`}
                      >
                        {getInitials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3
                            className="text-sm font-bold text-slate-900 truncate max-w-[140px] sm:max-w-[160px]"
                            title={c.name}
                          >
                            {c.name}
                          </h3>
                          <span className="font-mono text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/80 shrink-0">
                            {c.customerCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                              c.accountStatus === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : c.accountStatus === 'PENDING'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                c.accountStatus === 'ACTIVE'
                                  ? 'bg-emerald-500'
                                  : c.accountStatus === 'PENDING'
                                  ? 'bg-amber-500 animate-pulse'
                                  : 'bg-slate-400'
                              }`}
                            />
                            <span>{c.accountStatus || 'ACTIVE'}</span>
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Route #{c.deliverySequence ?? '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Compact Micro-Action Toolbar (Never wraps or squashes the name) */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleStartEditCustomer(c)}
                        className="p-1.5 rounded-lg border border-slate-200/70 hover:border-blue-300 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                        title="Edit Customer Details & Subscription"
                        aria-label="Edit customer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setSelectedCustForQR(c)}
                        className="p-1.5 rounded-lg border border-slate-200/70 hover:border-emerald-300 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                        title="View Door QR Card"
                        aria-label="View QR Code"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>

                      {onDeleteCustomer && (
                        <button
                          onClick={() => setCustomerToDelete(c)}
                          className="p-1.5 rounded-lg border border-slate-200/70 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Remove / Delete Customer"
                          aria-label="Delete customer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contact Strip */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1 text-xs text-slate-500">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-mono text-[11px] text-slate-600">{c.phone}</span>
                      </div>
                      {c.email && (
                        <div className="flex items-center gap-1 text-[11px] truncate max-w-[130px] text-slate-400">
                          <Mail className="w-3 h-3 text-emerald-600/70 shrink-0" />
                          <span className="truncate" title={c.email}>{c.email}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate" title={c.address}>{c.address}</span>
                    </div>
                  </div>

                  {/* Subscription Plan Cardlet */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs truncate">
                        <Droplets className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{c.subscription?.productName || 'Fresh Cow Milk'}</span>
                      </span>
                      <span className="font-mono font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md text-xs shrink-0">
                        {c.subscription?.defaultQuantity || 1.0} L / day
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1.5 pt-1.5 border-t border-slate-200/50 font-mono">
                      <span>Rate: ₹{c.subscription?.customPricePerUnit || 50}/L</span>
                      <span className="flex items-center gap-1 text-slate-600">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{c.deliveryTime} • {c.deliveryShift || 'MORNING'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Financial Status Summary */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-center text-xs">
                    <div className="bg-slate-50/60 py-1 rounded-lg">
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Delivered MTD</div>
                      <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">
                        {c.currentInvoice ? `${c.currentInvoice.totalQuantity} L` : '0.0 L'}
                      </div>
                    </div>
                    <div className="bg-slate-50/60 py-1 rounded-lg">
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Billed</div>
                      <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">
                        ₹{c.currentInvoice ? c.currentInvoice.totalAmount : '0'}
                      </div>
                    </div>
                    <div
                      className={`py-1 rounded-lg ${
                        (c.currentInvoice?.outstandingAmount || 0) > 0 ? 'bg-rose-50/70' : 'bg-emerald-50/50'
                      }`}
                    >
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Due</div>
                      <div
                        className={`font-mono font-bold text-xs mt-0.5 ${
                          (c.currentInvoice?.outstandingAmount || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        ₹{c.currentInvoice ? c.currentInvoice.outstandingAmount : '0'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100">
                  {isPending ? (
                    <button
                      onClick={() => handleApproveCustomer(c.id)}
                      disabled={actionLoadingId === c.id}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-[0.98] cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{actionLoadingId === c.id ? 'Approving...' : 'Approve & Activate Delivery'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedCust360(c)}
                      className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer group-hover:border-slate-300"
                    >
                      <span>Customer 360 Dossier</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* High-Density Enterprise Data Table View */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Subscription Plan</th>
                  <th className="py-3 px-4">Route & Shift</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Delivered MTD</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c) => {
                  const isPending = c.accountStatus === 'PENDING';
                  const isPaused = c.accountStatus === 'PAUSED';

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border ${
                              isPending
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : isPaused
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200/70'
                            }`}
                          >
                            {getInitials(c.name)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{c.name}</div>
                            <span className="font-mono text-[10px] text-slate-500">{c.customerCode}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            c.accountStatus === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : c.accountStatus === 'PENDING'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.accountStatus === 'ACTIVE'
                                ? 'bg-emerald-500'
                                : c.accountStatus === 'PENDING'
                                ? 'bg-amber-500 animate-pulse'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span>{c.accountStatus || 'ACTIVE'}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Droplets className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-medium text-slate-800">
                            {c.subscription?.productName || 'Fresh Cow Milk'}
                          </span>
                        </div>
                        <div className="font-mono text-slate-500 text-[11px] mt-0.5">
                          {c.subscription?.defaultQuantity || 1.0} L/day @ ₹{c.subscription?.customPricePerUnit || 50}/L
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-medium text-slate-800">Route #{c.deliverySequence ?? '—'}</div>
                        <div className="text-[11px] text-slate-400">{c.deliveryShift || 'MORNING'} ({c.deliveryTime})</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-700 text-[11px]">{c.phone}</div>
                        <div className="text-slate-400 text-[11px] truncate max-w-[140px]">{c.address}</div>
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {c.currentInvoice ? `${c.currentInvoice.totalQuantity} L` : '0.0 L'}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`font-mono font-bold ${
                            (c.currentInvoice?.outstandingAmount || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          ₹{c.currentInvoice ? c.currentInvoice.outstandingAmount : '0'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <button
                              onClick={() => handleApproveCustomer(c.id)}
                              disabled={actionLoadingId === c.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer"
                              title="Approve Customer"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedCust360(c)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition cursor-pointer"
                            title="Customer 360"
                          >
                            360 Dossier
                          </button>
                          <button
                            onClick={() => handleStartEditCustomer(c)}
                            className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedCustForQR(c)}
                            className="p-1 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                            title="QR Code"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteCustomer && (
                            <button
                              onClick={() => setCustomerToDelete(c)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
