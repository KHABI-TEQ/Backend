import { Response, NextFunction } from "express";
import { AppRequest } from "../../../../types/express";
import { DB } from "../../..";
import HttpStatusCodes from "../../../../common/HttpStatusCodes";
import { RouteError } from "../../../../common/classes";

/**
 * Verify a document verification access code
 */
export const verifyAccessCode = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { documentId, accessCode } = req.body;

    if (!documentId || !accessCode) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Document ID and access code are required");
    }

    // Find the document by ID
    const docVerification = await DB.Models.DocumentVerification.findById(documentId);

    if (!docVerification) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Document verification record not found");
    }

    // Check if access codes match
    if (docVerification.accessCode?.code !== accessCode) {
      return res.status(HttpStatusCodes.OK).json({
        success: false,
        message: "Invalid access code"
      });
    }

    // Update status to approved if not already approved
    if (docVerification.accessCode.status !== "approved") {
      docVerification.accessCode.status = "approved";
      await docVerification.save();
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Access code verified successfully"
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Fetch document verification details (only if accessCode is approved)
 */
export const getDocumentVerificationDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Document verification ID is required");
    }

    const docVerification = await DB.Models.DocumentVerification.findById(documentId)
      .lean();

    if (!docVerification) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Document verification not found");
    }

    // Check access code approval status
    if (docVerification.accessCode?.status !== "approved") {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, "Access code not approved. Please verify the access code first.");
    }

    // Remove accessCode before sending to client
    const { accessCode, ...safeData } = docVerification;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Document verification details fetched successfully",
      data: safeData
    });
  } catch (err) {
    next(err);
  }
};



export const submitVerificationReport = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { documentId } = req.params;
    const { reports } = req.body;

    if (!Array.isArray(reports) || reports.length === 0) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Reports array is required");
    }

    const docVerification = await DB.Models.DocumentVerification.findById(documentId);
    if (!docVerification) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Document verification record not found");
    }

    const formattedReports = reports.map(report => {
      if (!report.originalDocumentType) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Each report must include originalDocumentType");
      }
      if (!["verified", "rejected"].includes(report.status)) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Status must be either 'verified' or 'rejected'");
      }
      return {
        originalDocumentType: report.originalDocumentType,
        newDocumentUrl: report.newDocumentUrl,
        description: report.description,
        status: report.status,
        verifiedAt: new Date(),
      };
    });

    docVerification.verificationReports = [
      ...(docVerification.verificationReports || []),
      ...formattedReports
    ];

    await docVerification.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verification reports submitted successfully"
    });
  } catch (err) {
    next(err);
  }
};

