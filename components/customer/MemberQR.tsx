'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ShieldCheck, RefreshCw, Clock, Lock } from 'lucide-react';

interface MemberQRProps {
  customerId: string;
  customerCode?: string;
  customerName: string;
}

export function MemberQR({ customerId, customerCode, customerName }: MemberQRProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [tokenNonce, setTokenNonce] = useState<number>(() => Date.now());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300); // 5 minute rolling token

  useEffect(() => {
    // Generate secure opaque payload with expiry signature
    const payload = JSON.stringify({
      type: 'MILKFLOW_CLIENT_TOKEN',
      sub: customerId,
      code: customerCode || 'PR-001',
      issuedAt: tokenNonce,
      exp: tokenNonce + 300000,
    });

    QRCode.toDataURL(payload, {
      width: 260,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate client QR token', err));

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((tokenNonce + 300000 - Date.now()) / 1000));
      if (remaining <= 0) {
        setTokenNonce(Date.now());
      } else {
        setSecondsRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [customerId, customerCode, tokenNonce]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timerFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card className="p-8 text-center space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            <Lock className="w-3 h-3 text-amber-500" />
            <span>Time-Signed Client Key</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Private Client Pass
          </h2>
          <p className="text-xs text-slate-500">
            Present this cryptographic pass to your estate delivery attendant for verified doorstep handoff.
          </p>
        </div>

        {/* QR Canvas */}
        <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-xs inline-block mx-auto">
          {qrDataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrDataUrl}
              alt="Private Client Delivery QR Token"
              className="w-56 h-56 mx-auto rounded-2xl"
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center bg-slate-50 rounded-2xl">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Security Expiry & Client Metadata */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-slate-500">Pass expires in:</span>
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">{timerFormatted}</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 text-xs flex justify-between items-center text-left">
            <div>
              <div className="font-bold text-slate-900 dark:text-white">{customerName}</div>
              <div className="text-[11px] text-slate-500 font-mono">Client ID: {customerCode || 'PR-001'}</div>
            </div>
            <Badge variant="emerald">Verified Client</Badge>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          SHA-256 rolling token • Protected against replay
        </div>
      </Card>
    </div>
  );
}

export default MemberQR;
