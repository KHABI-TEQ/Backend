import { Request, Response, NextFunction } from "express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import {
  adminGetClaim,
  adminListClaims,
  adminListPolicies,
  adminUpdateClaim,
} from "../../services/searchInsurance.service";
import type { SearchInsuranceClaimStatus } from "../../common/constants/searchInsuranceCatalog";

export const adminListSearchInsurancePolicies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await adminListPolicies({
      status: req.query.status as string | undefined,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Search insurance policies fetched.",
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

export const adminListSearchInsuranceClaims = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await adminListClaims({
      status: req.query.status as string | undefined,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Search insurance claims fetched.",
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

export const adminGetSearchInsuranceClaim = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await adminGetClaim(String(req.params.id));
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const adminPatchSearchInsuranceClaim = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const adminId = (req as any).admin?._id || (req as any).user?._id;
    const data = await adminUpdateClaim({
      claimId: String(req.params.id),
      adminId: adminId ? String(adminId) : undefined,
      status: req.body?.status as SearchInsuranceClaimStatus | undefined,
      adminNotes: req.body?.adminNotes,
      approvedAmount:
        req.body?.approvedAmount != null
          ? Number(req.body.approvedAmount)
          : undefined,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Claim updated.",
      data,
    });
  } catch (err) {
    next(err);
  }
};
