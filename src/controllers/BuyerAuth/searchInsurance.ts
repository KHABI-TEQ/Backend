import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import {
  fileSearchInsuranceClaim,
  getBuyerClaim,
  listBuyerSearchInsurance,
} from "../../services/searchInsurance.service";

function requireBuyerId(req: AppRequest) {
  const id = req.buyer?._id;
  if (!id) {
    throw new RouteError(
      HttpStatusCodes.UNAUTHORIZED,
      "Buyer not authenticated."
    );
  }
  return String(id);
}

export const getMySearchInsurance = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await listBuyerSearchInsurance(requireBuyerId(req));
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createMySearchInsuranceClaim = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const claim = await fileSearchInsuranceClaim({
      buyerId: requireBuyerId(req),
      policyId: String(req.params.policyId),
      description: req.body?.description,
      practitionerName: req.body?.practitionerName,
      practitionerUser: req.body?.practitionerUser,
      evidence: Array.isArray(req.body?.evidence) ? req.body.evidence : [],
    });
    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Claim submitted for review.",
      data: claim,
    });
  } catch (err) {
    next(err);
  }
};

export const getMySearchInsuranceClaim = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const claim = await getBuyerClaim(
      requireBuyerId(req),
      String(req.params.claimId)
    );
    return res.status(HttpStatusCodes.OK).json({ success: true, data: claim });
  } catch (err) {
    next(err);
  }
};
