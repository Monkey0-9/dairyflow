'use client';

/**
 * Lightweight EN/HI/MR internationalization for MilkFlow portal chrome.
 * No external deps. Preference persists in localStorage; <html lang> follows.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type UILang = 'en' | 'hi' | 'mr';

const STORAGE_KEY = 'milkflow_ui_lang';

const dict = {
  en: {
    'brand.tag': 'Digital Dairy Ledger',
    'brand.sub': 'Subscription & Delivery Management Platform',
    'nav.today': 'Today (16 Sep)',
    'nav.yesterday': 'Yesterday',
    'nav.notifications': 'Notifications',
    'nav.unread': 'unread',
    'nav.markAllRead': 'Mark all read',
    'nav.noNotif': 'No notifications',
    'nav.switchPersona': 'Switch Test Persona',
    'nav.language': 'Language',
    'tab.daily': 'Daily Delivery',
    'tab.calendar': 'Monthly Calendar',
    'tab.customers': 'Customers & Subs',
    'tab.billing': 'Monthly Billing',
    'tab.disputes': 'Disputes',
    'tab.requests': 'Requests',
    'tab.pricing': 'Products & Rates',
    'tab.forecast': 'AI Demand Forecast',
    'tab.audit': 'Audit Trail',
    'tab.routes': 'Delivery Routes',
    'tab.inventory': 'Inventory',
    'ctab.home': 'My Milk Dashboard',
    'ctab.calendar': 'Monthly Consumption',
    'ctab.billing': 'Invoices & Pay',
    'ctab.vacation': 'Pause / Vacation',
    'admin.banner': 'Admin Control Room • GreenValley Dairy Platform',
    'cust.welcome': 'Welcome back',
    'cust.liveUpdate': 'Live update',
    'cust.portal': 'Customer Portal',
    'farmer.needsAttention': 'Needs Attention',
    'farmer.customerRequests': 'Customer Requests',
    'farmer.openDispute': 'Open Dispute',
    'farmer.pendingBilling': 'Pending Billing',
    'farmer.exceptionsToday': 'Exceptions Today',
    'farmer.scheduledDemand': 'Scheduled Demand',
    'farmer.deliveredMilk': 'Delivered Milk',
    'farmer.pending': 'Pending / Remainder',
    'farmer.exceptionsSkips': 'Exceptions & Skips',
    'login.title': 'Digital Dairy Ledger',
    'login.subtitle': 'Fresh milk accounting for modern dairies',
    'login.phone': 'Phone Number',
    'login.password': 'Password',
    'login.signIn': 'Sign In',
    'login.newHere': 'New customer? Register your subscription',
    'billing.title': 'Automated Monthly Billing & Invoices',
    'billing.reminder': 'Reminder',
    'billing.sendReminder': 'Send Reminder',
  },
  hi: {
    'brand.tag': 'डिजिटल डेयरी लेजर',
    'brand.sub': 'सब्सक्रिप्शन और डिलीवरी प्रबंधन मंच',
    'nav.today': 'आज (16 सितं)',
    'nav.yesterday': 'कल',
    'nav.notifications': 'सूचनाएं',
    'nav.unread': 'अपठित',
    'nav.markAllRead': 'सभी पढ़ा हुआ चिह्नित करें',
    'nav.noNotif': 'कोई सूचना नहीं',
    'nav.switchPersona': 'टेस्ट पर्सोना बदलें',
    'nav.language': 'भाषा',
    'tab.daily': 'दैनिक डिलीवरी',
    'tab.calendar': 'मासिक कैलेंडर',
    'tab.customers': 'ग्राहक और सदस्यता',
    'tab.billing': 'मासिक बिलिंग',
    'tab.disputes': 'विवाद',
    'tab.requests': 'अनुरोध',
    'tab.pricing': 'उत्पाद और दरें',
    'tab.forecast': 'AI मांग पूर्वानुमान',
    'tab.audit': 'ऑडिट ट्रेल',
    'tab.routes': 'डिलीवरी मार्ग',
    'tab.inventory': 'इन्वेंटरी',
    'ctab.home': 'मेरा दूध डैशबोर्ड',
    'ctab.calendar': 'मासिक खपत',
    'ctab.billing': 'बिल और भुगतान',
    'ctab.vacation': 'विराम / अवकाश',
    'admin.banner': 'एडमिन कंट्रोल रूम • ग्रीनवैली डेयरी मंच',
    'cust.welcome': 'वापसी पर स्वागत है',
    'cust.liveUpdate': 'लाइव अपडेट',
    'cust.portal': 'ग्राहक पोर्टल',
    'farmer.needsAttention': 'ध्यान आवश्यक',
    'farmer.customerRequests': 'ग्राहक अनुरोध',
    'farmer.openDispute': 'खुला विवाद',
    'farmer.pendingBilling': 'लंबित बिलिंग',
    'farmer.exceptionsToday': 'आज के अपवाद',
    'farmer.scheduledDemand': 'निर्धारित मांग',
    'farmer.deliveredMilk': 'वितरित दूध',
    'farmer.pending': 'लंबित / शेष',
    'farmer.exceptionsSkips': 'अपवाद और छूट',
    'login.title': 'डिजिटल डेयरी लेजर',
    'login.subtitle': 'आधुनिक डेयरियों के लिए ताज़ा दूध लेखांकन',
    'login.phone': 'फ़ोन नंबर',
    'login.password': 'पासवर्ड',
    'login.signIn': 'साइन इन',
    'login.newHere': 'नए ग्राहक? अपनी सदस्यता पंजीकृत करें',
    'billing.title': 'स्वचालित मासिक बिलिंग और चालान',
    'billing.reminder': 'रिमाइंडर',
    'billing.sendReminder': 'रिमाइंडर भेजें',
  },
  mr: {
    'brand.tag': 'डिजिटल डेअरी लेजर',
    'brand.sub': 'सबस्क्रिप्शन आणि डिलिव्हरी व्यवस्थापन मंच',
    'nav.today': 'आज (16 सप्टें)',
    'nav.yesterday': 'काल',
    'nav.notifications': 'सूचना',
    'nav.unread': 'न वाचलेल्या',
    'nav.markAllRead': 'सर्व वाचले म्हणून चिन्हांकित करा',
    'nav.noNotif': 'सूचना नाहीत',
    'nav.switchPersona': 'टेस्ट पर्सोना बदला',
    'nav.language': 'भाषा',
    'tab.daily': 'दैनिक डिलिव्हरी',
    'tab.calendar': 'मासिक कॅलेंडर',
    'tab.customers': 'ग्राहक आणि सदस्यत्व',
    'tab.billing': 'मासिक बिलिंग',
    'tab.disputes': 'तक्रारी',
    'tab.requests': 'विनंत्या',
    'tab.pricing': 'उत्पादने आणि दर',
    'tab.forecast': 'AI मागणी अंदाज',
    'tab.audit': 'ऑडिट ट्रेल',
    'tab.routes': 'डिलिव्हरी मार्ग',
    'tab.inventory': 'इन्व्हेंटरी',
    'ctab.home': 'माझे दूध डॅशबोर्ड',
    'ctab.calendar': 'मासिक वापर',
    'ctab.billing': 'बिले आणि भरणा',
    'ctab.vacation': 'विराम / सुट्टी',
    'admin.banner': 'अ‍ॅडमिन कंट्रोल रूम • ग्रीनव्हॅली डेअरी मंच',
    'cust.welcome': 'परत स्वागत आहे',
    'cust.liveUpdate': 'लाइव्ह अपडेट',
    'cust.portal': 'ग्राहक पोर्टल',
    'farmer.needsAttention': 'लक्ष आवश्यक',
    'farmer.customerRequests': 'ग्राहक विनंत्या',
    'farmer.openDispute': 'प्रलंबित तक्रार',
    'farmer.pendingBilling': 'प्रलंबित बिलिंग',
    'farmer.exceptionsToday': 'आजचे अपवाद',
    'farmer.scheduledDemand': 'नियोजित मागणी',
    'farmer.deliveredMilk': 'वितरित दूध',
    'farmer.pending': 'प्रलंबित / शिल्लक',
    'farmer.exceptionsSkips': 'अपवाद आणि वगळले',
    'login.title': 'डिजिटल डेअरी लेजर',
    'login.subtitle': 'आधुनिक डेअरींसाठी ताजे दूध हिशोब',
    'login.phone': 'फोन नंबर',
    'login.password': 'पासवर्ड',
    'login.signIn': 'साइन इन',
    'login.newHere': 'नवीन ग्राहक? आपले सदस्यत्व नोंदवा',
    'billing.title': 'स्वयंचलित मासिक बिलिंग आणि चलने',
    'billing.reminder': 'स्मरणपत्र',
    'billing.sendReminder': 'स्मरणपत्र पाठवा',
  },
} as const;

export type I18nKey = keyof (typeof dict)['en'];

export const I18N_LANGS: UILang[] = ['en', 'hi', 'mr'];

/** Pure lookup (testable outside React). Falls back to English. */
export function tFor(lang: UILang, key: I18nKey): string {
  return dict[lang][key] ?? dict.en[key];
}

interface LangContext {
  lang: UILang;
  setLang: (l: UILang) => void;
  t: (key: I18nKey) => string;
}

const Ctx = createContext<LangContext>({ lang: 'en', setLang: () => undefined, t: (k) => dict.en[k] });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<UILang>(() => {
    if (typeof window === 'undefined') return 'en';
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as UILang | null;
      return saved === 'hi' || saved === 'mr' || saved === 'en' ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  // Keep <html lang> in sync (external system sync — no state writes here).
  useEffect(() => {
    try {
      document.documentElement.lang = lang === 'en' ? 'en' : lang;
    } catch { /* DOM unavailable */ }
  }, [lang]);

  const setLang = useCallback((l: UILang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l === 'en' ? 'en' : l;
    } catch { /* ignore */ }
  }, []);

  const t = useCallback((key: I18nKey) => tFor(lang, key), [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useT(): LangContext {
  return useContext(Ctx);
}

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useT();
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('nav.language')}>
      {(['en', 'hi', 'mr'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition ${
            lang === l ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-400'
          } ${compact ? 'px-1.5' : ''}`}
        >
          {l === 'en' ? 'EN' : l === 'hi' ? 'हिं' : 'मर'}
        </button>
      ))}
    </div>
  );
}
