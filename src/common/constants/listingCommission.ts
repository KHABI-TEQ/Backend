/** Mandatory agent commission on sale / off-plan listings. */
export const SALE_AGENT_COMMISSION_PERCENT = 5;
/** Mandatory agent commission on rental listings. */
export const RENT_AGENT_COMMISSION_PERCENT = 10;
/** JV / shortlet remain optionally adjustable up to this cap. */
export const FLEXIBLE_AGENT_COMMISSION_PERCENT_MAX = 5;

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

export function listingCommissionFields(payload: {
  propertyType?: string;
  price?: unknown;
  agentCommissionPercent?: unknown;
  agentCommissionAmount?: unknown;
}): {
  agentCommissionPercent?: number;
  agentCommissionAmount?: number;
} {
  const price = Number(payload.price);
  const amountFrom = (pct: number) =>
    Number.isFinite(price) && price > 0
      ? Math.round((price * pct) / 100)
      : undefined;

  const mandatory = mandatoryAgentCommissionPercent(payload.propertyType);
  if (mandatory != null) {
    const amount = amountFrom(mandatory);
    return {
      agentCommissionPercent: mandatory,
      ...(amount != null ? { agentCommissionAmount: amount } : {}),
    };
  }

  if (payload.agentCommissionPercent == null) return {};
  const pct = Math.min(
    FLEXIBLE_AGENT_COMMISSION_PERCENT_MAX,
    Math.max(0, Number(payload.agentCommissionPercent)),
  );
  if (!Number.isFinite(pct)) return {};
  const explicitAmount = Number(payload.agentCommissionAmount);
  const amount =
    Number.isFinite(explicitAmount) && explicitAmount >= 0
      ? Math.round(explicitAmount)
      : amountFrom(pct);
  return {
    agentCommissionPercent: pct,
    ...(amount != null ? { agentCommissionAmount: amount } : {}),
  };
}
