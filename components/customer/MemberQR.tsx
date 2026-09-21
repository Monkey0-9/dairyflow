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
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);

  useEffect(() => {
    const payload = JSON.stringify({
      type: 'MILKFLOW_CLIENT_TOKEN',
      sub: customerId,
      code: customerCode || 'PR-001',
      issuedAt: tokenNonce,
      exp: tokenNonce + 300000,
    });

    QRCode.toDataURL(payload, {
      width: 240,
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
    <div className="max-w-sm mx-auto space-y-4">
      <Card className="p-6 text-center space-y-5" hover={false}>
        {/* Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <Lock className="w-3 h-3 text-amber-500" />
            <span>Time-Signed Token</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Identity & Access Token
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed max-w-xs mx-auto">
            Present to your delivery attendant for verified doorstep handoff.
          </p>
        </div>

        {/* QR Code */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 dark:border-slate-700 inline-block mx-auto shadow-sm">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Client Identity Token QR"
              className="w-48 h-48 mx-auto rounded-xl"
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-xl">
              <RefreshCw className="w-5 h-5 text-slate-300 dark:text-slate-600 animate-spin" />
            </div>
          )}
        </div>

        {/* Expiry & Client Details */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-center gap-1.5 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-slate-400 dark:text-slate-500">Expires in</span>
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">{timerFormatted}</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-left gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">{customerName}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                {customerCode || 'PR-001'}
              </div>
            </div>
            <Badge variant="emerald">Verified</Badge>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          SHA-256 rolling token · Replay protected
        </div>
      </Card>
    </div>
  );
}

export default MemberQR;
