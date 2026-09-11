import { Types } from "mongoose";
import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import {
  computeInspectionFeeSplit,
  LICENSED_AGENT_BANK_REQUIRED_MESSAGE,
  LICENSED_AGENT_BANK_SETUP_PATH,
} from "../common/constants/inspectionFeeSplit";
import { PaystackService } from "./paystack.service";

export type LicensedAgentPayoutAccount = {
  dealSiteId: string;
  subAccountCode: string;
  accountName?: string;
  accountNumber?: string;
};

function dealSiteHasBank(pd: any): boolean {
  return Boolean(
    String(pd?.accountNumber || "").trim() && String(pd?.sortCode || "").trim(),
  );
}

async function findAgentDealSite(userId: string) {
  const owner = new Types.ObjectId(userId);
  const withSub = await DB.Models.DealSite.findOne({
    createdBy: owner,
    "paymentDetails.subAccountCode": { $exists: true, $nin: [null, ""] },
  })
    .sort({ updatedAt: -1 })
    .exec();
  if (withSub) return withSub;

  return DB.Models.DealSite.findOne({ createdBy: owner })
    .sort({ updatedAt: -1 })
    .exec();
}

export async function resolveLicensedAgentPayoutAccount(
  userId: string,
): Promise<LicensedAgentPayoutAccount | null> {
  const dealSite = await findAgentDealSite(userId);
  if (!dealSite) return null;

  const pd = (dealSite as any).paymentDetails || {};
  if (pd.subAccountCode) {
    return {
      dealSiteId: String(dealSite._id),
      subAccountCode: String(pd.subAccountCode),
      accountName: pd.accountName || pd.businessName,
      accountNumber: pd.accountNumber,
    };
  }

  if (!dealSiteHasBank(pd)) return null;

  const created = await PaystackService.createSubaccount({
    businessName: String(pd.businessName || "Licensed Agent").trim(),
    settlementBank: String(pd.sortCode).trim(),
    accountNumber: String(pd.accountNumber).trim(),
    percentageCharge: 0,
    primaryContactEmail: pd.primaryContactEmail || undefined,
    primaryContactName: pd.primaryContactName || undefined,
    primaryContactPhone: pd.primaryContactPhone || undefined,
  });

  (dealSite as any).paymentDetails = {
    ...pd,
    subAccountCode: created.subAccountCode,
    accountName: created.accountName || pd.accountName,
    accountBankName: created.accountBankName || pd.accountBankName,
    isVerified: created.isVerified,
    active: created.active,
    percentageCharge: 0,
  };
  await dealSite.save();

  return {
    dealSiteId: String(dealSite._id),
    subAccountCode: created.subAccountCode,
    accountName: created.accountName || pd.accountName,
    accountNumber: pd.accountNumber,
  };
}

export async function assertLicensedAgentPayoutReady(userId: string) {
  const account = await resolveLicensedAgentPayoutAccount(userId);
  if (!account?.subAccountCode) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      LICENSED_AGENT_BANK_REQUIRED_MESSAGE,
    );
  }
  return account;
}

export function inspectionSplitPayload(
  feeNaira: number,
  account?: LicensedAgentPayoutAccount | null,
) {
  const split = computeInspectionFeeSplit(feeNaira);
  return {
    ...split,
    subAccountCode: account?.subAccountCode,
    dealSiteId: account?.dealSiteId,
    bankSetupPath: LICENSED_AGENT_BANK_SETUP_PATH,
  };
}
