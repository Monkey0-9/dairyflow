'use client';

import React, { useState } from 'react';
import {
  Droplets,
  Plus,
  Edit2,
  Check,
  PackageCheck,
  X,
  Sparkles,
} from 'lucide-react';
import { Product, ProductCategory } from '@/lib/types';

interface ProductPricingProps {
  products: Product[];
  onUpdateProductPrice?: (productId: string, newPrice: number | null) => void;
  onRefresh?: () => void;
}

export default function ProductPricing({ products, onUpdateProductPrice, onRefresh }: ProductPricingProps) {
  const [productList, setProductList] = useState<Product[]>(products);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [isEditNull, setIsEditNull] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New product form
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('COW');
  const [newCategory, setNewCategory] = useState<ProductCategory>('MILK');
  const [newUnit, setNewUnit] = useState('Litre');
  const [newPrice, setNewPrice] = useState('60');
  const [isNewPriceNull, setIsNewPriceNull] = useState(false);
  const [newDescription, setNewDescription] = useState('');

  const handleStartEdit = (p: Product) => {
    setEditingId(p.id);
    if (p.basePrice === null || p.basePrice === undefined) {
      setEditPrice('');
      setIsEditNull(true);
    } else {
      setEditPrice(p.basePrice.toString());
      setIsEditNull(false);
    }
  };

  const handleSavePrice = async (id: string) => {
    setIsSaving(true);
    try {
      const finalPrice: number | null = isEditNull ? null : parseFloat(editPrice);

      // Call API
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: id,
          pricePerUnit: finalPrice,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setProductList((prev) =>
          prev.map((item) => (item.id === id ? { ...item, basePrice: finalPrice } : item))
        );
        if (onUpdateProductPrice) {
          onUpdateProductPrice(id, finalPrice);
        }
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Failed to update product cost:', err);
    } finally {
      setIsSaving(false);
      setEditingId(null);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    setIsSaving(true);
    try {
      const finalPrice = isNewPriceNull ? null : parseFloat(newPrice);
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          code: newCode || newName.slice(0, 4).toUpperCase(),
          category: newCategory,
          unit: newUnit,
          pricePerUnit: finalPrice,
          description: newDescription,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const created: Product = {
          id: data.product?.id || `prod_${Date.now()}`,
          tenantId: data.product?.tenantId || 'tenant_greenvalley',
          farmerId: 'farmer_01',
          name: newName,
          category: newCategory,
          unit: newUnit,
          basePrice: finalPrice,
          description: newDescription,
          inStock: true,
        };
        setProductList((prev) => [...prev, created]);
        setShowAddModal(false);
        // Reset form
        setNewName('');
        setNewDescription('');
        setNewPrice('60');
        setIsNewPriceNull(false);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Failed to create product:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getProductCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'MILK':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CURD':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'GHEE':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'PANEER':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Droplets className="w-5 h-5 text-emerald-600" />
            <span>Farm Dairy Products & Cost Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure rates for Cow Milk, Buffalo Milk, A2 Milk, and products. Set explicit costs or mark as Dynamic/Null.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full font-bold">
            {productList.length} Dairy Products
          </span>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Milk Variety / Product</span>
          </button>
        </div>
      </div>

      {/* Pricing Tier Matrix Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Regular Home Delivery</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Standard
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Base catalog pricing applied</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Retail / Walk-in</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              +₹5 / Unit
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Cash retail at farm counter</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Wholesale / Sweet Mart</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              -₹5 to -₹10 / Unit
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Bulk daily orders above 15L</div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {productList.map((p) => {
          const isEditing = editingId === p.id;
          const isNullPrice = p.basePrice === null || p.basePrice === undefined;

          return (
            <div
              key={p.id}
              className="bg-white rounded-3xl p-5 border border-slate-200 hover:border-emerald-400 transition-all shadow-xs hover:shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${getProductCategoryBadge(
                        p.category
                      )}`}
                    >
                      {p.category}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1.5">{p.name}</h3>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
                    <PackageCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{p.description || 'Pure dairy product direct from farm'}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Cost per {p.unit}
                </div>

                {isEditing ? (
                  <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEditNull}
                          onChange={(e) => setIsEditNull(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Set as Null (Dynamic Rate)</span>
                      </label>
                    </div>

                    {!isEditNull && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-700">₹</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          placeholder="Rate"
                          className="w-24 px-2 py-1 text-sm font-bold font-mono border border-emerald-500 rounded-lg focus:outline-none bg-white"
                        />
                        <span className="text-xs text-slate-500">/ {p.unit}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSavePrice(p.id)}
                        disabled={isSaving}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isSaving ? 'Saving...' : 'Save Cost'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      {isNullPrice ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>Dynamic (Null Rate)</span>
                        </div>
                      ) : (
                        <div className="text-xl font-black text-slate-900 font-mono">
                          ₹{p.basePrice?.toFixed(2)}{' '}
                          <span className="text-xs font-normal text-slate-400">/ {p.unit}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleStartEdit(p)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Modify Cost</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Add Milk Variety / Product</h3>
                <p className="text-xs text-slate-500">Add Cow Milk, Buffalo Milk, A2 Milk, or dairy products</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Product / Milk Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Rich Buffalo Milk, Desi Gir Cow Milk"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="e.g. BUFFALO, COW"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ProductCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                  >
                    <option value="MILK">MILK</option>
                    <option value="CURD">CURD</option>
                    <option value="GHEE">GHEE</option>
                    <option value="PANEER">PANEER</option>
                    <option value="BUTTERMILK">BUTTERMILK</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                  >
                    <option value="Litre">Litre</option>
                    <option value="Kg">Kg</option>
                    <option value="Bottle">Bottle</option>
                    <option value="Packet">Packet</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cost Rate</label>
                  {isNewPriceNull ? (
                    <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs">
                      Dynamic / Null Rate
                    </div>
                  ) : (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        placeholder="e.g. 70"
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isNewPriceNull}
                    onChange={(e) => setIsNewPriceNull(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Leave cost as Null (Dynamic / Variable Rate)</span>
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g. Pure fresh buffalo milk with 7.5% fat"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-98 cursor-pointer"
              >
                <span>{isSaving ? 'Creating Product...' : 'Create Dairy Product'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
