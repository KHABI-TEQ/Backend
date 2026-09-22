/** Default agent commission on sale / off-plan listings. */
export const SALE_AGENT_COMMISSION_PERCENT = 5;
/** Default agent commission on rental listings. */
export const RENT_AGENT_COMMISSION_PERCENT = 10;
/** JV / shortlet default and upper cap. */
export const FLEXIBLE_AGENT_COMMISSION_PERCENT_MAX = 5;

/** Landlord may reduce the default rate, but not below this floor. */
export const LANDLORD_COMMISSION_PERCENT_MIN = 3;
/** Developer may reduce the default rate, but not below this floor. */
export const DEVELOPER_COMMISSION_PERCENT_MIN = 1;

export type CommissionPublisherType = "Landowners" | "Developer" | string;

export function publisherCommissionPercentMin(
  publisherType?: string | null,
): number {
  return publisherType === "Developer"
    ? DEVELOPER_COMMISSION_PERCENT_MIN
    : LANDLORD_COMMISSION_PERCENT_MIN;
}

export function listingCommissionCap(propertyType?: string | null): number {
  const t = String(propertyType || "")
    .toLowerCase()
    .replace(/_/g, "-");
  if (t === "rent") return RENT_AGENT_COMMISSION_PERCENT;
  return SALE_AGENT_COMMISSION_PERCENT;
}

/** Default (indicative) rate when the publisher does not reduce it. */
export function defaultAgentCommissionPercent(
  propertyType?: string | null,
): number {
  const t = String(propertyType || "")
    .toLowerCase()
    .replace(/_/g, "-");
  if (t === "rent") return RENT_AGENT_COMMISSION_PERCENT;
  if (t === "sell" || t === "buy" || t === "off-plan" || t === "offplan") {
    return SALE_AGENT_COMMISSION_PERCENT;
  }
  return FLEXIBLE_AGENT_COMMISSION_PERCENT_MAX;
}

/** @deprecated Use defaultAgentCommissionPercent — rates are no longer mandatory-fixed. */
export function mandatoryAgentCommissionPercent(
  propertyType?: string | null,
): number | null {
  const t = String(propertyType || "")
    .toLowerCase()
    .replace(/_/g, "-");
  if (t === "sell" || t === "buy" || t === "off-plan" || t === "offplan") {
    return SALE_AGENT_COMMISSION_PERCENT;
  }
  if (t === "rent") return RENT_AGENT_COMMISSION_PERCENT;
  return null;
}

export function clampListingCommissionPercent(
  percent: number,
  opts: { propertyType?: string | null; publisherType?: string | null },
): number {
  const max = listingCommissionCap(opts.propertyType);
  const min = Math.min(publisherCommissionPercentMin(opts.publisherType), max);
  return Math.min(max, Math.max(min, percent));
}

export function listingCommissionFields(payload: {
  propertyType?: string;
  price?: unknown;
  agentCommissionPercent?: unknown;
  agentCommissionAmount?: unknown;
  publisherType?: string | null;
}): {
  agentCommissionPercent?: number;
  agentCommissionAmount?: number;
} {
  if (
    payload.publisherType &&
    payload.publisherType !== "Landowners" &&
    payload.publisherType !== "Developer"
  ) {
    return {};
  }

  const price = Number(payload.price);
  const amountFrom = (pct: number) =>
    Number.isFinite(price) && price > 0
      ? Math.round((price * pct) / 100)
      : undefined;

  const raw = Number(payload.agentCommissionPercent);
  const pct = clampListingCommissionPercent(
    Number.isFinite(raw) ? raw : defaultAgentCommissionPercent(payload.propertyType),
    {
      propertyType: payload.propertyType,
      publisherType: payload.publisherType,
    },
  );

  const explicitAmount = Number(payload.agentCommissionAmount);
  const amount =
    Number.isFinite(explicitAmount) &&
    explicitAmount >= 0 &&
    payload.agentCommissionPercent == null
      ? Math.round(explicitAmount)
      : amountFrom(pct);

  return {
    agentCommissionPercent: pct,
    ...(amount != null ? { agentCommissionAmount: amount } : {}),
  };
}

/** Rate to apply at sale / transaction registration — listing rate, not a fixed 5%. */
export function resolveListingCommissionPercent(input: {
  requestPercent?: unknown;
  propertyPercent?: unknown;
  listingAmount?: unknown;
  listingPrice?: unknown;
  publisherType?: string | null;
  propertyType?: string | null;
}): number {
  const candidates = [
    Number(input.requestPercent),
    Number(input.propertyPercent),
  ];
  for (const value of candidates) {
    if (Number.isFinite(value) && value > 0) {
      return clampListingCommissionPercent(value, input);
    }
  }

  const amount = Number(input.listingAmount);
  const price = Number(input.listingPrice);
  if (amount > 0 && price > 0) {
    return clampListingCommissionPercent((amount / price) * 100, input);
  }

  return defaultAgentCommissionPercent(input.propertyType);
}
