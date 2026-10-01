import { Types } from "mongoose";
import { DB } from "../controllers";
import { getPropertyTitleFromLocation } from "../utils/helper";

export const AGENT_FEE_CATEGORIES = [
  "inspection_fee",
  "commission_fee",
  "property_sales_price_fee",
] as const;

export type AgentFeeCategory = (typeof AGENT_FEE_CATEGORIES)[number];

export type AgentFeeRow = {
  id: string;
  date: string;
  totalAmount: string;
  totalAmountValue: number;
  customerDetails: string | null;
  transactionReference: string | null;
  address: string;
};

export const AGENT_FEE_TABLE_COLUMNS = [
  { key: "date", label: "date" },
  { key: "totalAmount", label: "Total amount" },
  { key: "customerDetails", label: "Customer details" },
  { key: "transactionReference", label: "Transaction reference" },
  { key: "address", label: "address" },
] as const;

const FEE_TAB_LABELS: Record<AgentFeeCategory, string> = {
  inspection_fee: "Inspection fee",
  commission_fee: "Commission fee",
  property_sales_price_fee: "Property sales price fee",
};

export function agentFeeTabLabel(category: AgentFeeCategory): string {
  return FEE_TAB_LABELS[category];
}

function asId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

function emailOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const email = (value as { email?: string }).email;
  return email ? String(email) : null;
}

function formatFeeDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

function formatFeeAmount(amount: number): string {
  return Number(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function addressOf(property: unknown): string {
  const location = (property as { location?: Parameters<typeof getPropertyTitleFromLocation>[0] } | null)
    ?.location;
  if (!location) return "";
  const line = [
    location.streetAddress,
    location.area,
    location.localGovernment,
    location.state,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
  return line;
}

function toFeeRow(input: {
  id: string;
  date: Date | string | null | undefined;
  totalAmount: number;
  customerDetails: string | null;
  transactionReference: string | null;
  address: string;
}): AgentFeeRow {
  const totalAmountValue = Number(input.totalAmount || 0);
  return {
    id: input.id,
    date: formatFeeDate(input.date),
    totalAmount: formatFeeAmount(totalAmountValue),
    totalAmountValue,
    customerDetails: input.customerDetails,
    transactionReference: input.transactionReference,
    address: input.address,
  };
}

function commissionAmount(request: {
  actualSalePriceNaira?: number;
  commissionPercent?: number;
  agentCommissionPercent?: number;
  agentCommissionAmount?: number;
}): number {
  const price = Number(request.actualSalePriceNaira || 0);
  const percent = Number(request.commissionPercent ?? request.agentCommissionPercent ?? 0);
  if (price > 0 && percent > 0) return Math.round((price * percent) / 100);
  return Number(request.agentCommissionAmount || 0);
}

export async function listAgentFeeRows(
  userId: string,
  category: AgentFeeCategory
): Promise<AgentFeeRow[]> {
  const ownerId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;

  if (category === "inspection_fee") {
    const inspections = await DB.Models.InspectionBooking.find({
      $or: [{ owner: ownerId }, { assignedFieldAgent: ownerId }],
      transaction: { $exists: true, $ne: null },
    })
      .populate("propertyId", "location")
      .populate("requestedBy", "email fullName")
      .populate("transaction", "reference amount status createdAt")
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    return inspections.flatMap((inspection) => {
      const transaction = inspection.transaction as
        | { reference?: string; amount?: number; status?: string; createdAt?: Date }
        | undefined;
      if (!transaction || transaction.status !== "success") return [];
      const split = Number(inspection.inspectionFeeSplit?.licensedAgentNaira || 0);
      return [
        toFeeRow({
          id: asId(inspection._id),
          date: transaction.createdAt || inspection.updatedAt || inspection.createdAt || null,
          totalAmount: Number(transaction.amount || split || 0),
          customerDetails: emailOf(inspection.requestedBy),
          transactionReference: transaction.reference || asId(transaction) || null,
          address: addressOf(inspection.propertyId),
        }),
      ];
    });
  }

  const requests = await DB.Models.RequestToMarket.find({
    requestedByAgentId: ownerId,
    status: "accepted",
    saleRegisteredAt: { $exists: true, $ne: null },
  })
    .populate("propertyId", "location")
    .populate("publisherId", "email fullName")
    .populate("paymentTransactionId", "reference")
    .sort({ saleRegisteredAt: -1 })
    .limit(200)
    .lean();

  return requests.map((request) => {
    const payment = request.paymentTransactionId as { reference?: string } | undefined;
    const amount =
      category === "property_sales_price_fee"
        ? Number(request.actualSalePriceNaira || 0)
        : commissionAmount(request);
    return toFeeRow({
      id: asId(request._id),
      date: request.saleRegisteredAt || request.updatedAt || request.createdAt || null,
      totalAmount: amount,
      customerDetails: emailOf(request.publisherId),
      transactionReference: payment?.reference || String(request._id).slice(-8).toUpperCase(),
      address: addressOf(request.propertyId),
    });
  });
}
