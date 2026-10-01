import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import {
  getPractitionerKycStatus,
  isPractitionerKycApproved,
} from "./publisherKyc.service";
import { buildKycNotice } from "./kycNotice.service";

export const INSPECTION_RESPONSE_KYC_MESSAGE =
  "Before you can proceed with this request, you need to complete your KYC verification.";

/** Incomplete KYC blocks practitioner inspection responses and returns the verification overlay. */
export async function assertInspectionRequestMutationAllowed(
  userId: string
): Promise<void> {
  if (await isPractitionerKycApproved(userId)) return;

  const [kycStatus, user] = await Promise.all([
    getPractitionerKycStatus(userId),
    DB.Models.User.findById(userId).select("kycNoticeDismissedStatus").lean(),
  ]);
  const kycOverlay = buildKycNotice({
    kycStatus,
    dismissedStatus: user?.kycNoticeDismissedStatus,
    forceVisible: true,
  });

  throw new RouteError(HttpStatusCodes.FORBIDDEN, INSPECTION_RESPONSE_KYC_MESSAGE, undefined, {
    code: "KYC_REQUIRED_FOR_INSPECTION",
    kycOverlay,
  });
}
