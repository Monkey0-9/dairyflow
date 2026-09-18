/**
 * Multilingual payment reminder generator (English / Hindi / Marathi).
 */

export type ReminderLang = 'en' | 'hi' | 'mr';

export function buildReminderMessage(params: {
  customerName: string;
  dairyName?: string;
  amount: number;
  payLink?: string;
  lang?: ReminderLang;
}): string {
  const dairy = params.dairyName || 'GreenValley Dairy Farm';
  const amt = `₹${params.amount}`;
  const link = params.payLink ? ` ${params.payLink}` : '';
  switch (params.lang || 'en') {
    case 'hi':
      return `नमस्ते ${params.customerName}, ${dairy} से आपका दूध बिल ${amt} देय है। कृपया${link} पर भुगतान करें। धन्यवाद!`;
    case 'mr':
      return `नमस्कार ${params.customerName}, ${dairy} कडून आपले दूध बिल ${amt} थकित आहे. कृपया${link} वर भरणा करा. धन्यवाद!`;
    default:
      return `Hello ${params.customerName}, your milk bill of ${amt} from ${dairy} is due. Please pay here:${link} Thank you!`;
  }
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  // Assume Indian numbers without country code get +91 prefix
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
