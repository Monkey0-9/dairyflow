import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Navigation2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Droplets,
} from 'lucide-react';
import { CustomerProfile, DeliveryRecord } from '@/lib/types';

interface InteractiveRouteMapProps {
  routeStops: CustomerProfile[];
  records: DeliveryRecord[];
  selectedStopId: string | null;
  onSelectStop: (stopId: string | null) => void;
  onDrop?: (record: DeliveryRecord) => Promise<void>;
  onSkip?: (record: DeliveryRecord) => Promise<void>;
  busyRecordId?: string | null;
}

interface WaypointNode {
  id: string;
  isFarm: boolean;
  label: string;
  subtitle: string;
  sequence: number;
  x: number;
  y: number;
  customer?: CustomerProfile;
  record?: DeliveryRecord;
  status: 'COMPLETED' | 'PENDING' | 'SKIPPED' | 'FARM';
}

// Map Dimensions and Farm Origin
const MAP_WIDTH = 840;
const MAP_HEIGHT = 440;
const FARM_POS = { x: 90, y: 220 };

export default function InteractiveRouteMap({
  routeStops,
  records,
  selectedStopId,
  onSelectStop,
  onDrop,
  onSkip,
  busyRecordId,
}: InteractiveRouteMapProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Calculate waypoints across the delivery loop
  const waypoints = useMemo<WaypointNode[]>(() => {
    const list: WaypointNode[] = [];

    // 1. Depot / Farm Node
    list.push({
      id: 'depot_origin',
      isFarm: true,
      label: 'GreenValley Dairy Farm',
      subtitle: 'Depot & Dispatch Bay',
      sequence: 0,
      x: FARM_POS.x,
      y: FARM_POS.y,
      status: 'FARM',
    });

    // 2. Compute waypoints for each stop
    const n = routeStops.length;
    routeStops.forEach((cust, i) => {
      const record = records.find((r) => r.customerId === cust.id);
      let status: 'COMPLETED' | 'PENDING' | 'SKIPPED' = 'PENDING';
      if (record?.status === 'DELIVERED' || record?.status === 'EXTRA') status = 'COMPLETED';
      else if (record?.status === 'SKIPPED') status = 'SKIPPED';

      // If custom coordinates exist, use them; otherwise distribute along an organic residential circuit
      let x: number;
      let y: number;

      if (cust.latitude && cust.longitude) {
        x = 180 + ((cust.longitude % 1) * 2000) % 550;
        y = 80 + ((cust.latitude % 1) * 2000) % 300;
      } else {
        // Geometric circuit layout
        const angle = (i / Math.max(n, 1)) * 2 * Math.PI - Math.PI / 2;
        const radiusX = 260 + (i % 2 === 0 ? 35 : -25);
        const radiusY = 130 + (i % 3 === 0 ? 25 : -20);
        x = 480 + Math.cos(angle) * radiusX;
        y = 220 + Math.sin(angle) * radiusY;
      }

      list.push({
        id: cust.id,
        isFarm: false,
        label: cust.name,
        subtitle: cust.address,
        sequence: i + 1,
        x: Math.round(x),
        y: Math.round(y),
        customer: cust,
        record,
        status,
      });
    });

    return list;
  }, [routeStops, records]);

  // Selected stop data
  const activeWaypoint = waypoints.find((w) => w.id === selectedStopId);

  // Pan interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Build SVG path string connecting all waypoints in circuit
  const circuitPathData = useMemo(() => {
    if (waypoints.length < 2) return '';
    const points = waypoints.map((w) => `${w.x},${w.y}`);
    // Close loop back to farm
    points.push(`${waypoints[0].x},${waypoints[0].y}`);
    return `M ${points.join(' L ')}`;
  }, [waypoints]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Map Control Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <Navigation2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900">Interactive GPS Circuit Map</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                Live Waypoints
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Interactive topological circuit from GreenValley Farm depot to doorsteps
            </p>
          </div>
        </div>

        {/* Action & Zoom Controls */}
        <div className="flex items-center gap-1.5 self-end sm:self-center">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.2, 2.2))}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            title="Zoom In"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.2, 0.7))}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetView}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            title="Reset View"
            aria-label="Reset zoom and pan"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Map Area */}
      <div
        className="relative h-[420px] bg-slate-50/70 overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Subtle Grid Backdrop */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          <defs>
            {/* Pulsing ring filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#059669" floodOpacity="0.25" />
            </filter>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>

          {/* Planned / Traversed Circuit Line */}
          {circuitPathData && (
            <>
              {/* Outer boundary shadow path */}
              <path
                d={circuitPathData}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Main circuit road */}
              <path
                d={circuitPathData}
                fill="none"
                stroke="url(#routeGradient)"
                strokeWidth="4"
                strokeDasharray="6 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Render Nodes */}
          {waypoints.map((node) => {
            const isSelected = node.id === selectedStopId;
            const isDelivered = node.status === 'COMPLETED';
            const isSkipped = node.status === 'SKIPPED';

            if (node.isFarm) {
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectStop(node.id === selectedStopId ? null : node.id);
                  }}
                >
                  {/* Outer pulse */}
                  <circle r="22" fill="#064e3b" fillOpacity="0.15" className="animate-pulse" />
                  <circle r="16" fill="#064e3b" stroke="#ffffff" strokeWidth="2.5" />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="800"
                  >
                    ★
                  </text>
                  <g transform="translate(0, 26)">
                    <rect
                      x="-65"
                      y="-10"
                      width="130"
                      height="20"
                      rx="6"
                      fill="#0f172a"
                      fillOpacity="0.9"
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="700"
                    >
                      GreenValley Farm (Start)
                    </text>
                  </g>
                </g>
              );
            }

            // Customer Waypoint Pin
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectStop(node.id === selectedStopId ? null : node.id);
                }}
              >
                {/* Active Selection Ring */}
                {isSelected && (
                  <circle
                    r="24"
                    fill="none"
                    stroke="#059669"
                    strokeWidth="3"
                    strokeDasharray="3 3"
                    className="animate-spin"
                    style={{ animationDuration: '8s' }}
                  />
                )}

                {/* Main Waypoint Pin Circle */}
                <circle
                  r="14"
                  fill={isDelivered ? '#059669' : isSkipped ? '#e11d48' : '#0f172a'}
                  stroke="#ffffff"
                  strokeWidth="2"
                  filter={isSelected ? 'url(#glow)' : undefined}
                />

                {/* Sequence Number */}
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="800"
                >
                  {node.sequence}
                </text>

                {/* Hover / Label Tag */}
                <g transform="translate(0, 22)">
                  <rect
                    x="-45"
                    y="-9"
                    width="90"
                    height="18"
                    rx="6"
                    fill={isSelected ? '#059669' : '#ffffff'}
                    stroke={isSelected ? '#047857' : '#e2e8f0'}
                    strokeWidth="1"
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isSelected ? '#ffffff' : '#0f172a'}
                    fontSize="8.5"
                    fontWeight="700"
                  >
                    {node.label.length > 12 ? `${node.label.substring(0, 11)}…` : node.label}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Legend Bar Overlay */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3 text-[10px] font-bold text-slate-700 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span>Delivered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            <span>Skipped</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-950 border border-emerald-300" />
            <span>Farm Hub</span>
          </div>
        </div>
      </div>

      {/* Interactive Detail Drawer for Clicked Waypoint */}
      {activeWaypoint && !activeWaypoint.isFarm && activeWaypoint.customer && (
        <div className="p-4 bg-emerald-50/40 border-t border-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-mono font-bold text-[10px]">
                Stop #{activeWaypoint.sequence}
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">
                {activeWaypoint.customer.customerCode}
              </span>
              <h4 className="text-sm font-extrabold text-slate-900">{activeWaypoint.customer.name}</h4>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                  activeWaypoint.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : activeWaypoint.status === 'SKIPPED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {activeWaypoint.status}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {activeWaypoint.customer.address}
              </span>
              <span className="flex items-center gap-1 font-mono font-bold text-slate-800">
                <Droplets className="w-3.5 h-3.5 text-emerald-600" />
                {activeWaypoint.record ? `${activeWaypoint.record.deliveredQuantity} L` : '1.0 L'}
              </span>
            </div>

            {activeWaypoint.customer.notes && (
              <p className="text-[11px] text-amber-800 italic">
                Note: "{activeWaypoint.customer.notes}"
              </p>
            )}
          </div>

          {/* Quick Actions Directly From Waypoint */}
          {activeWaypoint.record && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => onDrop?.(activeWaypoint.record!)}
                disabled={busyRecordId === activeWaypoint.record.id}
                className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-xs transition"
              >
                {busyRecordId === activeWaypoint.record.id ? 'Saving…' : '✓ Quick Drop'}
              </button>
              <button
                onClick={() => onSkip?.(activeWaypoint.record!)}
                disabled={busyRecordId === activeWaypoint.record.id}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-white hover:bg-rose-50 border border-slate-200 text-slate-700 hover:text-rose-700 text-xs font-bold rounded-xl transition"
              >
                Skip Stop
              </button>
              <button
                onClick={() => onSelectStop(null)}
                className="p-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
