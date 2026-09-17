'use client';

import React, { useState } from 'react';
import {
  Droplets,
  Plus,
  Edit2,
  Check,
  Tag,
  PackageCheck,
  Percent,
} from 'lucide-react';
import { Product } from '@/lib/types';

interface ProductPricingProps {
  products: Product[];
  onUpdateProductPrice?: (productId: string, newPrice: number) => void;
}

export default function ProductPricing({ products }: ProductPricingProps) {
  const [productList, setProductList] = useState<Product[]>(products);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');

  const handleStartEdit = (p: Product) => {
    setEditingId(p.id);
    setEditPrice(p.basePrice.toString());
  };

  const handleSavePrice = (id: string) => {
    const val = parseFloat(editPrice);
    if (!isNaN(val) && val > 0) {
      setProductList((prev) =>
        prev.map((item) => (item.id === id ? { ...item, basePrice: val } : item))
      );
    }
    setEditingId(null);
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
            <span>Farm Dairy Products & Pricing Catalog</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure baseline dairy product rates, units, and customer tier pricing rules
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full font-bold">
            {productList.length} Active Farm Products
          </span>
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

                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{p.description}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Rate per {p.unit}
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm font-bold text-slate-700">₹</span>
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-20 px-2 py-1 text-sm font-bold font-mono border border-emerald-500 rounded-lg focus:outline-none"
                      />
                      <button
                        onClick={() => handleSavePrice(p.id)}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                      ₹{p.basePrice.toFixed(2)}{' '}
                      <span className="text-xs font-normal text-slate-400">/ {p.unit}</span>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <button
                    onClick={() => handleStartEdit(p)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Rate</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
