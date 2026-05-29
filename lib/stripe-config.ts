export const STRIPE_PAYMENT_LINK = 
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/dRmbJ26DcgvE0S7f7v8EM04';

/**
 * Builds the Stripe Payment Link URL with prefilled customer email and trade reference ID.
 */
export function getPaymentLink(email: string, tradeId: string): string {
  try {
    const url = new URL(STRIPE_PAYMENT_LINK);
    url.searchParams.set('prefilled_email', email);
    url.searchParams.set('client_reference_id', tradeId);
    return url.toString();
  } catch (error) {
    console.error("Invalid Stripe payment link configuration:", error);
    // Return a fallback format if URL parsing fails
    const separator = STRIPE_PAYMENT_LINK.includes('?') ? '&' : '?';
    return `${STRIPE_PAYMENT_LINK}${separator}prefilled_email=${encodeURIComponent(email)}&client_reference_id=${encodeURIComponent(tradeId)}`;
  }
}

/**
 * Helper to determine if we should run in simulation mode.
 * Simulation mode is triggered when the link is a placeholder, blank, or explicitly marked.
 */
export function isSimulationMode(): boolean {
  return (
    !STRIPE_PAYMENT_LINK || 
    STRIPE_PAYMENT_LINK.includes('test_') || 
    STRIPE_PAYMENT_LINK.includes('placeholder') ||
    STRIPE_PAYMENT_LINK === 'https://buy.stripe.com/...'
  );
}
