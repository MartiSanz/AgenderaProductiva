// WhatsApp message cost: USD per sent message, converted to ARS at the day's rate plus VAT.
export const WA_USD_PER_MESSAGE = 0.026;
export const AR_VAT = 0.21;

export function whatsappCost(messages: number, usdToArs: number | null) {
  const usd = messages * WA_USD_PER_MESSAGE;
  if (!usdToArs) return { usd, arsNet: null, vat: null, arsTotal: null };
  const arsNet = usd * usdToArs;
  const vat = arsNet * AR_VAT;
  return { usd, arsNet, vat, arsTotal: arsNet + vat };
}
