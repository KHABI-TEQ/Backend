/**
 * Shortlet commission & guest checkout pricing (single source of truth).
 *
 * - Guest pays 8% service charge on top of host base (nightly subtotal + cleaning + deposit).
 * - Host commission 7% is deducted from host base at payout (not added to guest total).
 * - Total platform commission = 15% of host base (8% guest + 7% host).
 */

export const SHORTLET_GUEST_SERVICE_CHARGE_RATE = 0.08;
export const SHORTLET_HOST_COMMISSION_RATE = 0.07;
export const SHORTLET_PLATFORM_COMMISSION_RATE =
  SHORTLET_GUEST_SERVICE_CHARGE_RATE + SHORTLET_HOST_COMMISSION_RATE; // 0.15

/** Platform retention portion of the 15% commission pool (Paystack transaction_charge target). */
export const SHORTLET_PLATFORM_RETENTION_RATE = 0.1;

/** Budget for Paystack processing fees within the 15% pool (informational; fees are deducted by Paystack). */
export const SHORTLET_PAYSTACK_FEE_BUDGET_RATE = 0.05;

export type ShortletPricingInput = {
  nightlyRate: number;
  nights: number;
  cleaningFee?: number;
  securityDeposit?: number;
  weeklyDiscountPct?: number;
  monthlyDiscountPct?: number;
};

export type ShortletPricingBreakdown = {
  nights: number;
  duration: number;
  rate: number;
  base: number;
  discountPct: number;
  discountAmount: number;
  subtotal: number;
  cleaningFee: number;
  securityDeposit: number;
  /** Nightly subtotal + cleaning + deposit (before guest service charge). */
  hostBase: number;
  guestServiceCharge: number;
  /** Amount guest pays at checkout. */
  guestTotal: number;
  hostCommission: number;
  platformTotalCommission: number;
  /** Amount host should receive after 7% commission. */
  hostPayout: number;
  /** Alias for guestTotal (legacy booking controllers). */
  expectedAmount: number;
};

function roundNaira(n: number): number {
  return Math.round(n);
}

export function calculateShortletPricing(input: ShortletPricingInput): ShortletPricingBreakdown {
  const nights = Math.max(0, input.nights);
  const rate = Number.isFinite(input.nightlyRate) ? input.nightlyRate : 0;
  const cleaningFee = input.cleaningFee ?? 0;
  const securityDeposit = input.securityDeposit ?? 0;
  const weeklyDiscount = input.weeklyDiscountPct ?? 0;
  const monthlyDiscount = input.monthlyDiscountPct ?? 0;

  const base = nights * rate;
  const discountPct = nights >= 30 ? monthlyDiscount : nights >= 7 ? weeklyDiscount : 0;
  const discountAmount = roundNaira((base * discountPct) / 100);
  const subtotal = Math.max(0, base - discountAmount);
  const hostBase = subtotal + cleaningFee + securityDeposit;

  const guestServiceCharge = roundNaira(hostBase * SHORTLET_GUEST_SERVICE_CHARGE_RATE);
  const guestTotal = hostBase + guestServiceCharge;
  const hostCommission = roundNaira(hostBase * SHORTLET_HOST_COMMISSION_RATE);
  const platformTotalCommission = guestServiceCharge + hostCommission;
  const hostPayout = hostBase - hostCommission;

  return {
    nights,
    duration: nights,
    rate,
    base,
    discountPct,
    discountAmount,
    subtotal,
    cleaningFee,
    securityDeposit,
    hostBase,
    guestServiceCharge,
    guestTotal,
    hostCommission,
    platformTotalCommission,
    hostPayout,
    expectedAmount: guestTotal,
  };
}

export function calculateShortletPricingFromDates(
  property: {
    price?: number;
    shortletDetails?: {
      pricing?: {
        nightly?: number;
        cleaningFee?: number;
        securityDeposit?: number;
        weeklyDiscount?: number;
        monthlyDiscount?: number;
      };
    };
  },
  checkIn: Date,
  checkOut: Date
): ShortletPricingBreakdown {
  const msInDay = 1000 * 60 * 60 * 24;
  const diffMs = Math.max(0, checkOut.getTime() - checkIn.getTime());
  const nights = diffMs > 0 ? Math.ceil(diffMs / msInDay) : 0;

  const pricing = property.shortletDetails?.pricing || {};
  const nightlyRate =
    typeof pricing.nightly === "number" ? pricing.nightly : Number(property.price || 0);

  return calculateShortletPricing({
    nightlyRate,
    nights,
    cleaningFee: typeof pricing.cleaningFee === "number" ? pricing.cleaningFee : 0,
    securityDeposit: typeof pricing.securityDeposit === "number" ? pricing.securityDeposit : 0,
    weeklyDiscountPct: typeof pricing.weeklyDiscount === "number" ? pricing.weeklyDiscount : 0,
    monthlyDiscountPct: typeof pricing.monthlyDiscount === "number" ? pricing.monthlyDiscount : 0,
  });
}

/**
 * Flat amount (NGN) sent to the platform via Paystack `transaction_charge` on split checkout.
 * Uses 10% of host base as platform retention; remaining 5% of the 15% pool covers Paystack fees.
 */
export function paystackPlatformRetentionCharge(pricing: ShortletPricingBreakdown): number {
  return roundNaira(pricing.hostBase * SHORTLET_PLATFORM_RETENTION_RATE);
}

/**
 * Subaccount `percentage_charge` so the main account receives ~15% of host base from gross guest payment.
 * Only needed when not using a flat transaction_charge alone.
 */
export function paystackMainAccountPercentOfGross(): number {
  return Math.round((SHORTLET_PLATFORM_COMMISSION_RATE / (1 + SHORTLET_GUEST_SERVICE_CHARGE_RATE)) * 10000) / 100;
}

export function shortletHostPayoutEligibleAt(checkIn: Date): Date {
  const hours = Number(process.env.SHORTLET_HOST_PAYOUT_DELAY_HOURS || 12);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 12;
  return new Date(checkIn.getTime() + safeHours * 60 * 60 * 1000);
}

export function shortletPricingMeta(pricing: ShortletPricingBreakdown) {
  return {
    nights: pricing.nights,
    duration: pricing.duration,
    pricePerNight: pricing.rate,
    hostBase: pricing.hostBase,
    guestServiceCharge: pricing.guestServiceCharge,
    hostCommission: pricing.hostCommission,
    platformTotalCommission: pricing.platformTotalCommission,
    hostPayout: pricing.hostPayout,
    extralFees: {
      cleaningFee: pricing.cleaningFee,
      securityDeposit: pricing.securityDeposit,
    },
    totalPrice: pricing.guestTotal,
    commissionRates: {
      guestServiceCharge: SHORTLET_GUEST_SERVICE_CHARGE_RATE,
      hostCommission: SHORTLET_HOST_COMMISSION_RATE,
      platformTotal: SHORTLET_PLATFORM_COMMISSION_RATE,
    },
  };
}
