'use client';

/**
 * Lightweight EN/HI/MR internationalization for MilkFlow.
 * No external deps. Preference persists in localStorage; <html lang> follows.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type UILang = 'en' | 'hi' | 'mr';

const STORAGE_KEY = 'milkflow_ui_lang';

const dict = {
  en: {
    'brand.tag': 'Dairy Field OS',
    'brand.sub': 'Milk Delivery & Billing Platform',
    'nav.today': 'Today',
    'nav.yesterday': 'Yesterday',
    'nav.notifications': 'Notifications',
    'nav.unread': 'unread',
    'nav.markAllRead': 'Mark all read',
    'nav.noNotif': 'No notifications',
    'nav.switchPersona': 'Switch Test Persona',
    'nav.language': 'Language',
    'tab.daily': 'Daily Delivery',
    'tab.calendar': 'Monthly Calendar',
    'tab.customers': 'Customers',
    'tab.billing': 'Bills & Invoices',
    'tab.disputes': 'Disputes',
    'tab.requests': 'Requests',
    'tab.pricing': 'Products & Rates',
    'tab.forecast': 'Demand Forecast',
    'tab.audit': 'Audit Trail',
    'tab.routes': 'Delivery Routes',
    'tab.inventory': 'Inventory',
    'ctab.home': 'My Milk Dashboard',
    'ctab.calendar': 'Monthly Consumption',
    'ctab.billing': 'Invoices & Pay',
    'ctab.vacation': 'Pause / Vacation',
    'admin.banner': 'Dairy Operations Console',
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
    'login.title': 'MilkFlow Dairy OS',
    'login.subtitle': 'Fresh milk accounting for modern dairies',
    'login.phone': 'Phone Number',
    'login.password': 'Password',
    'login.signIn': 'Sign In',
    'login.newHere': 'New customer? Activate your account',
    'billing.title': 'Automated Monthly Billing & Invoices',
    'billing.reminder': 'Reminder',
    'billing.sendReminder': 'Send Reminder',
    'action.deliver': 'Deliver',
    'action.skip': 'Skip',
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.confirm': 'Confirm',
    'action.undo': 'Undo',
    'action.retry': 'Retry',
    'status.delivered': 'Delivered',
    'status.skipped': 'Skipped',
    'status.pending': 'Pending',
    'status.partial': 'Partial',
    'status.disputed': 'Disputed',
    'field.bottles': 'Bottles',
    'field.litres': 'Litres',
    'field.notes': 'Notes',
    'field.amount': 'Amount',
    'field.date': 'Date',
  },
  hi: {
    'brand.tag': 'डेयरी फील्ड ओएस',
    'brand.sub': 'दूध वितरण और बिलिंग मंच',
    'nav.today': 'आज',
    'nav.yesterday': 'कल',
    'nav.notifications': 'सूचनाएं',
    'nav.unread': 'अपठित',
    'nav.markAllRead': 'सभी पढ़ा हुआ चिह्नित करें',
    'nav.noNotif': 'कोई सूचना नहीं',
    'nav.switchPersona': 'टेस्ट पर्सोना बदलें',
    'nav.language': 'भाषा',
    'tab.daily': 'दैनिक डिलीवरी',
    'tab.calendar': 'मासिक कैलेंडर',
    'tab.customers': 'ग्राहक',
    'tab.billing': 'बिल और चालान',
    'tab.disputes': 'विवाद',
    'tab.requests': 'अनुरोध',
    'tab.pricing': 'उत्पाद और दरें',
    'tab.forecast': 'मांग पूर्वानुमान',
    'tab.audit': 'ऑडिट ट्रेल',
    'tab.routes': 'डिलीवरी मार्ग',
    'tab.inventory': 'इन्वेंटरी',
    'ctab.home': 'मेरा दूध डैशबोर्ड',
    'ctab.calendar': 'मासिक खपत',
    'ctab.billing': 'बिल और भुगतान',
    'ctab.vacation': 'विराम / अवकाश',
    'admin.banner': 'डेयरी ऑपरेशंस कंसोल',
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
    'login.title': 'मिल्कफ्लो डेयरी ओएस',
    'login.subtitle': 'आधुनिक डेयरियों के लिए ताज़ा दूध लेखांकन',
    'login.phone': 'फ़ोन नंबर',
    'login.password': 'पासवर्ड',
    'login.signIn': 'साइन इन',
    'login.newHere': 'नए ग्राहक? अपना खाता सक्रिय करें',
    'billing.title': 'स्वचालित मासिक बिलिंग और चालान',
    'billing.reminder': 'रिमाइंडर',
    'billing.sendReminder': 'रिमाइंडर भेजें',
    'action.deliver': 'वितरित करें',
    'action.skip': 'छोड़ें',
    'action.save': 'सहेजें',
    'action.cancel': 'रद्द करें',
    'action.confirm': 'पुष्टि करें',
    'action.undo': 'पूर्ववत करें',
    'action.retry': 'पुनः प्रयास करें',
    'status.delivered': 'वितरित',
    'status.skipped': 'छोड़ा गया',
    'status.pending': 'लंबित',
    'status.partial': 'आंशिक',
    'status.disputed': 'विवादित',
    'field.bottles': 'बोतलें',
    'field.litres': 'लीटर',
    'field.notes': 'टिप्पणी',
    'field.amount': 'राशि',
    'field.date': 'तारीख',
  },
  mr: {
    'brand.tag': 'डेअरी फील्ड ओएस',
    'brand.sub': 'दूध वितरण आणि बिलिंग मंच',
    'nav.today': 'आज',
    'nav.yesterday': 'काल',
    'nav.notifications': 'सूचना',
    'nav.unread': 'न वाचलेल्या',
    'nav.markAllRead': 'सर्व वाचले म्हणून चिन्हांकित करा',
    'nav.noNotif': 'सूचना नाहीत',
    'nav.switchPersona': 'टेस्ट पर्सोना बदला',
    'nav.language': 'भाषा',
    'tab.daily': 'दैनिक डिलिव्हरी',
    'tab.calendar': 'मासिक कॅलेंडर',
    'tab.customers': 'ग्राहक',
    'tab.billing': 'बिले आणि चलने',
    'tab.disputes': 'तक्रारी',
    'tab.requests': 'विनंत्या',
    'tab.pricing': 'उत्पादने आणि दर',
    'tab.forecast': 'मागणी अंदाज',
    'tab.audit': 'ऑडिट ट्रेल',
    'tab.routes': 'डिलिव्हरी मार्ग',
    'tab.inventory': 'इन्व्हेंटरी',
    'ctab.home': 'माझे दूध डॅशबोर्ड',
    'ctab.calendar': 'मासिक वापर',
    'ctab.billing': 'बिले आणि भरणा',
    'ctab.vacation': 'विराम / सुट्टी',
    'admin.banner': 'डेअरी ऑपरेशन्स कन्सोल',
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
    'login.title': 'मिल्कफ्लो डेअरी ओएस',
    'login.subtitle': 'आधुनिक डेअरींसाठी ताजे दूध हिशोब',
    'login.phone': 'फोन नंबर',
    'login.password': 'पासवर्ड',
    'login.signIn': 'साइन इन',
    'login.newHere': 'नवीन ग्राहक? आपले खाते सक्रिय करा',
    'billing.title': 'स्वयंचलित मासिक बिलिंग आणि चलने',
    'billing.reminder': 'स्मरणपत्र',
    'billing.sendReminder': 'स्मरणपत्र पाठवा',
    'action.deliver': 'वितरित करा',
    'action.skip': 'वगळा',
    'action.save': 'जतन करा',
    'action.cancel': 'रद्द करा',
    'action.confirm': 'खात्री करा',
    'action.undo': 'पूर्ववत करा',
    'action.retry': 'पुन्हा प्रयत्न करा',
    'status.delivered': 'वितरित',
    'status.skipped': 'वगळले',
    'status.pending': 'प्रलंबित',
    'status.partial': 'अंशतः',
    'status.disputed': 'तक्रार',
    'field.bottles': 'बाटल्या',
    'field.litres': 'लिटर',
    'field.notes': 'नोंद',
    'field.amount': 'रक्कम',
    'field.date': 'दिनांक',
  },
} as const;

export type I18nKey = keyof (typeof dict)['en'];

export const I18N_LANGS: UILang[] = ['en', 'hi', 'mr'];

/** Dynamic localized date formatter */
export function formatLocalizedDate(dateInput: string | Date, lang: UILang = 'en'): string {
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const locale = lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-IN';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d);
  } catch {
    return String(dateInput);
  }
}

/** Pure lookup (testable outside React). Falls back to English. */
export function tFor(lang: UILang, key: I18nKey): string {
  return dict[lang][key] ?? dict.en[key];
}

interface LangContext {
  lang: UILang;
  setLang: (l: UILang) => void;
  t: (key: I18nKey) => string;
  formatDate: (date: string | Date) => string;
}

const Ctx = createContext<LangContext>({
  lang: 'en',
  setLang: () => undefined,
  t: (k) => dict.en[k],
  formatDate: (d) => String(d),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<UILang>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY) as UILang | null;
        if (saved && I18N_LANGS.includes(saved)) {
          return saved;
        }
      } catch {
        // localStorage may be disabled
      }
    }
    return 'en';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((l: UILang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback((key: I18nKey) => tFor(lang, key), [lang]);
  const formatDate = useCallback((d: string | Date) => formatLocalizedDate(d, lang), [lang]);

  return <Ctx.Provider value={{ lang, setLang, t, formatDate }}>{children}</Ctx.Provider>;
}

export function useT() {
  return useContext(Ctx);
}

const LABELS: Record<UILang, string> = {
  en: 'EN',
  hi: 'हिंदी',
  mr: 'मराठी',
};

export function LanguageToggle({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useT();

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center rounded-xl bg-slate-100 p-0.5 text-xs font-bold border border-slate-200/80 shadow-2xs"
    >
      {I18N_LANGS.map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={`rounded-lg px-2 py-1 transition-all cursor-pointer ${
              active
                ? 'bg-white text-emerald-700 font-extrabold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            } ${compact ? 'text-[11px] px-1.5' : ''}`}
            title={`Switch to ${LABELS[code]}`}
          >
            {LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
