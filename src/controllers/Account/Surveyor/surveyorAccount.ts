import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  assertSurveyorFeeInRange,
  getSurveyorFeeBounds,
  getSurveyorPlatformChargePercent,
} from "../../../services/professionalFee.service";
import { PaystackService } from "../../../services/paystack.service";

function requireSurveyor(req: AppRequest) {
  const pending = (req.user as { pendingProfessionalType?: string })?.pendingProfessionalType;
  if (
    !req.user?._id ||
    (req.user.userType !== "Surveyor" &&
      !(req.user.userType === "PropertyScout" && pending === "Surveyor"))
  ) {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, "Surveyor account required.");
  }
  return req.user;
}

async function getOrCreateProfile(userId: string) {
  let profile = await DB.Models.SurveyorProfile.findOne({ userId });
  if (!profile) {
    profile = await DB.Models.SurveyorProfile.create({
      userId,
      surveyFee: 0,
      kycStatus: "none",
      isMarketplaceVisible: false,
      serviceTypes: ["plan-verification"],
    });
  }
  return profile;
}

/**
 * @swagger
 * /account/surveyor/me:
 *   get:
 *     tags:
 *       - Account > Surveyor
 *     summary: Get surveyor profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Surveyor profile fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phoneNumber:
 *                       type: string
 *                     firmName:
 *                       type: string
 *                     bio:
 *                       type: string
 *                     serviceTypes:
 *                       type: array
 *                       items:
 *                         type: string
 *                     licenseNumber:
 *                       type: string
 *                     surveyFee:
 *                       type: number
 *                     kycStatus:
 *                       type: string
 *       403:
 *         description: Surveyor account required
 */
export const getSurveyorMe = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireSurveyor(req);
    const profile = await getOrCreateProfile(String(user._id));
    const bounds = await getSurveyorFeeBounds();
    const platformChargePercent = await getSurveyorPlatformChargePercent();
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          profile_picture: user.profile_picture,
          accountApproved: user.accountApproved,
          isAccountVerified: user.isAccountVerified,
          accountStatus: user.accountStatus,
          userType: user.userType,
        },
        profile,
        feeBounds: bounds,
        platformChargePercent,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/surveyor/profile:
 *   put:
 *     tags:
 *       - Account > Surveyor
 *     summary: Update surveyor profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firmName:
 *                 type: string
 *               profilePhoto:
 *                 type: string
 *               bio:
 *                 type: string
 *               serviceTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *               surveyFee:
 *                 type: number
 *               licenseNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Surveyor profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       403:
 *         description: Surveyor account required
 */
export const updateSurveyorProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireSurveyor(req);
    const profile = await getOrCreateProfile(String(user._id));
    const {
      firmName,
      profilePhoto,
      bio,
      serviceTypes,
      surveyFee,
      licenseNumber,
    } = req.body;

    if (surveyFee !== undefined) {
      await assertSurveyorFeeInRange(Number(surveyFee));
      profile.surveyFee = Number(surveyFee);
    }
    if (firmName !== undefined) profile.firmName = String(firmName).trim();
    if (profilePhoto !== undefined) profile.profilePhoto = String(profilePhoto).trim();
    if (bio !== undefined) profile.bio = String(bio).trim();
    if (Array.isArray(serviceTypes)) {
      profile.serviceTypes = serviceTypes.filter((s: string) =>
        ["plan-verification", "site-survey"].includes(s)
      );
    }
    if (licenseNumber !== undefined) profile.licenseNumber = String(licenseNumber).trim();
    await profile.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Surveyor profile updated.",
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/surveyor/kyc:
 *   put:
 *     tags:
 *       - Account > Surveyor
 *     summary: Submit surveyor KYC
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - kycDocuments
 *             properties:
 *               kycDocuments:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: Array of KYC documents
 *               licenseNumber:
 *                 type: string
 *               surveyFee:
 *                 type: number
 *               bio:
 *                 type: string
 *               profilePhoto:
 *                 type: string
 *               certificateKind:
 *                 type: string
 *               certificateNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: KYC submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     kycStatus:
 *                       type: string
 *       400:
 *         description: Upload at least one professional document for KYC
 *       403:
 *         description: Surveyor account required
 */
export const submitSurveyorKyc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireSurveyor(req);
    const profile = await getOrCreateProfile(String(user._id));
    const { kycDocuments, licenseNumber, surveyFee, bio, profilePhoto, certificateKind, certificateNumber } = req.body;

    if (!Array.isArray(kycDocuments) || kycDocuments.length === 0) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Upload at least one professional document for KYC."
      );
    }
    if (surveyFee !== undefined) {
      await assertSurveyorFeeInRange(Number(surveyFee));
      profile.surveyFee = Number(surveyFee);
    } else if (!profile.surveyFee) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Set a survey fee within the allowed range before submitting KYC."
      );
    } else {
      await assertSurveyorFeeInRange(profile.surveyFee);
    }

    profile.kycDocuments = kycDocuments
      .map((d: any) => ({
        name: String(d.name || "Document"),
        url: String(d.url || ""),
      }))
      .filter((d: any) => d.url);
    if (!profile.kycDocuments.length) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "KYC document URLs are required.");
    }
    if (licenseNumber) profile.licenseNumber = String(licenseNumber).trim();
    if (certificateKind === "cac" || certificateKind === "lasrera") {
      profile.certificateKind = certificateKind;
    }
    if (certificateNumber) profile.certificateNumber = String(certificateNumber).trim();
    if (bio) profile.bio = String(bio).trim();
    if (profilePhoto) profile.profilePhoto = String(profilePhoto).trim();
    profile.kycStatus = "pending";
    profile.isMarketplaceVisible = false;
    await profile.save();

    await DB.Models.User.findByIdAndUpdate(user._id, { accountApproved: false });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "KYC submitted successfully. Please await admin approval within 24 hours.",
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/surveyor/bank:
 *   post:
 *     tags:
 *       - Account > Surveyor
 *     summary: Setup surveyor bank account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - businessName
 *               - bankCode
 *               - accountNumber
 *             properties:
 *               businessName:
 *                 type: string
 *                 description: Business name for the account
 *               bankCode:
 *                 type: string
 *                 description: Bank code
 *               accountNumber:
 *                 type: string
 *                 description: Bank account number
 *     responses:
 *       200:
 *         description: Settlement account connected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     paystackSubaccountCode:
 *                       type: string
 *                     bankDetails:
 *                       type: object
 *       400:
 *         description: businessName, bankCode and accountNumber are required
 *       403:
 *         description: Surveyor account required
 */
export const setupSurveyorBank = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireSurveyor(req);
    const profile = await getOrCreateProfile(String(user._id));
    const { businessName, bankCode, accountNumber } = req.body;
    if (!businessName || !bankCode || !accountNumber) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "businessName, bankCode and accountNumber are required."
      );
    }

    const sub = await PaystackService.createSubaccount({
      businessName: String(businessName).trim(),
      settlementBank: String(bankCode).trim(),
      accountNumber: String(accountNumber).trim(),
      percentageCharge: 0,
      primaryContactEmail: user.email,
      primaryContactName: `${user.firstName} ${user.lastName}`.trim(),
      primaryContactPhone: user.phoneNumber,
    });

    profile.bankDetails = {
      businessName: String(businessName).trim(),
      bankCode: String(bankCode).trim(),
      accountNumber: String(accountNumber).trim(),
      accountName: sub.accountName || "",
    };
    profile.paystackSubaccountCode = sub.subAccountCode;
    profile.paystackSubaccountId = sub.subAccountCode;
    await profile.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Settlement account connected.",
      data: {
        paystackSubaccountCode: profile.paystackSubaccountCode,
        bankDetails: profile.bankDetails,
      },
    });
  } catch (err) {
    next(err);
  }
};

function redactBuyerUntilPaid(job: any) {
  const paid = ["payment-approved", "in-progress", "completed"].includes(
    String(job?.status || "")
  );
  if (paid) return job;
  const buyer = job?.buyerId;
  if (buyer && typeof buyer === "object") {
    return {
      ...job,
      buyerId: {
        _id: buyer._id,
        fullName: buyer.fullName || "Buyer",
      },
    };
  }
  return job;
}

/**
 * @swagger
 * /account/surveyor/jobs:
 *   get:
 *     tags:
 *       - Account > Surveyor
 *     summary: List surveyor jobs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Surveyor jobs fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       403:
 *         description: Surveyor account required
 */
export const listSurveyorJobs = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireSurveyor(req);
    const jobs = await DB.Models.SurveyRequest.find({ surveyorId: user._id })
      .populate("buyerId", "fullName email phoneNumber")
      .sort({ createdAt: -1 })
      .lean();
    const { listCatalogJobsForProfessional } = await import(
      "../../../services/professionalCatalog.service"
    );
    const catalogJobs = await listCatalogJobsForProfessional(
      String(user._id),
      "surveyor"
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: [...jobs.map(redactBuyerUntilPaid), ...catalogJobs],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/surveyor/jobs/{id}:
 *   get:
 *     tags:
 *       - Account > Surveyor
 *     summary: Get single surveyor job
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Surveyor job fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       403:
 *         description: Surveyor account required
 */
export const getSurveyorJob = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireSurveyor(req);
    const job = await DB.Models.SurveyRequest.findOne({
      _id: req.params.id,
      surveyorId: user._id,
    })
      .populate("buyerId", "fullName email phoneNumber")
      .lean();
    if (job) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        data: redactBuyerUntilPaid(job),
      });
    }
    const { getCatalogJobForProfessional } = await import(
      "../../../services/professionalCatalog.service"
    );
    const catalogJob = await getCatalogJobForProfessional({
      requestId: req.params.id,
      userId: String(user._id),
      category: "surveyor",
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: catalogJob,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/surveyor/jobs/{id}/respond:
 *   post:
 *     tags:
 *       - Account > Surveyor
 *     summary: Respond to surveyor job (accept/decline or submit offer)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accept:
 *                 type: boolean
 *                 description: Accept or decline
 *               reason:
 *                 type: string
 *                 description: Reason for declining
 *               coverageNote:
 *                 type: string
 *               fee:
 *                 type: number
 *                 description: Proposed fee
 *               serviceItems:
 *                 type: array
 *                 items:
 *                   type: object
 *               commissionAccepted:
 *                 type: boolean
 *               letterheadReportAccepted:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Request accepted, declined, or offer sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       403:
 *         description: Surveyor account required
 */
export const respondSurveyorJob = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireSurveyor(req);
    const accept = req.body?.accept === true;
    const reason = req.body?.reason as string | undefined;
    const assigned = await DB.Models.SurveyRequest.findOne({
      _id: req.params.id,
      surveyorId: user._id,
    }).select("_id");
    if (!assigned) {
      const { acceptCatalogServiceRequest } = await import(
        "../../../services/professionalCatalog.service"
      );
      const job = await acceptCatalogServiceRequest({
        requestId: req.params.id,
        userId: String(user._id),
        accept,
        reason,
      });
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: accept
          ? "Request accepted. Buyer has been asked to pay."
          : "You declined this request. It remains open for other professionals.",
        data: job,
      });
    }
    const { respondToSurveyorRequest } = await import(
      "../../../services/professionalRequest.service"
    );
    const job = await respondToSurveyorRequest({
      jobId: req.params.id,
      surveyorUserId: String(user._id),
      accept,
      reason,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: accept
        ? "Request accepted. Buyer has been asked to pay."
        : "Request declined.",
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/surveyor/jobs/{id}/report:
 *   post:
 *     tags:
 *       - Account > Surveyor
 *     summary: Submit surveyor job report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 description: Report description
 *               documentUrl:
 *                 type: string
 *                 description: URL of report document
 *     responses:
 *       200:
 *         description: Survey report submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Job is not ready for a report
 *       403:
 *         description: Surveyor account required
 *       404:
 *         description: Job not found
 */
export const submitSurveyorJobReport = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireSurveyor(req);
    const { description, documentUrl } = req.body as {
      description?: string;
      documentUrl?: string;
    };

    const job = await DB.Models.SurveyRequest.findOne({
      _id: req.params.id,
      surveyorId: user._id,
    });
    if (!job) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Job not found.");
    }
    if (!["payment-approved", "in-progress"].includes(job.status)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Job is not ready for a report."
      );
    }

    job.status = "completed";
    job.report = {
      description: description || "",
      documentUrl: documentUrl || "",
      completedAt: new Date(),
    };
    await job.save();

    const buyer = await DB.Models.Buyer.findById(job.buyerId);
    if (buyer?.email) {
      const sendEmail = (await import("../../../common/send.email")).default;
      void sendEmail({
        to: buyer.email,
        subject: "Survey request completed",
        text: `Your ${job.serviceType} request has been completed. ${description || ""} Open Survey services in the Khabi-Teq app.`,
        inboxMeta: {
          source: "system",
          audience: "buyer",
          screen: "surveys",
          actionPath: "/surveys",
          surveyRequestId: String(job._id),
        },
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Survey report submitted.",
      data: job,
    });
  } catch (err) {
    next(err);
  }
};
