import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DB } from "..";
import { DealSiteService } from "../../services/dealSite.service";
import { dealSiteActivityService } from "../../services/dealSiteActivity.service";
import { generateDealSiteContactOwnerMail, generateDealSiteContactUserMail } from "../../common/emailTemplates/dealSiteMails";
import sendEmail from "../../common/send.email";
import { generalTemplate } from "../../common/email.template";
import { RouteError } from "../../common/classes";

/**
 * Update a DealSite
 */
export const updateDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try { 
    const { publicSlug, sectionName } = req.params;
    const userId = req.user?._id;

    const updated = await DealSiteService.updateDealSiteSection(
      userId,
      publicSlug,
      sectionName,
      req.body
    );

    await dealSiteActivityService.logActivity({
      dealSiteId: updated._id.toString(),
      actorId: req.user._id,
      actorModel: "User",
      category: "settings-updated",
      action: `Updated ${sectionName} section`,
      description: `User modified the ${sectionName} settings on their deal site.`,
      req,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `${sectionName} section updated successfully`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};



/**
 * Disable (pause) a DealSite
 */
export const disableDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;
    const userId = req.user?._id;

    // 🔹 Proceed to disable
    const result = await DealSiteService.disableDealSite(userId, publicSlug);

    await dealSiteActivityService.logActivity({
      dealSiteId: result._id.toString(),
      actorId: req.user._id,
      actorModel: "User",
      category: "deal-paused",
      action: "Paused public access page",
      description:
        "User temporarily paused their public access page, making it unavailable to the public.",
      req,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page disabled successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Enable (resume) a DealSite
 */
export const enableDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;
    const userId = req.user?._id;

    // 🔹 Proceed to enable
    const result = await DealSiteService.enableDealSite(userId, publicSlug);

    await dealSiteActivityService.logActivity({
      dealSiteId: result._id.toString(),
      actorId: req.user._id,
      actorModel: "User",
      category: "deal-resumed",
      action: "Resumed public access page",
      description:
        "User reactivated their public access page, making it visible and accessible to the public again.",
      req,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page enabled successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Delete a DealSite
 */
export const deleteDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;
    const userId = req.user?._id;

    const result = await DealSiteService.deleteDealSite(userId, publicSlug);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Create Contact Us message for DealSite
 */
export const createDealSiteContactUs = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try { 
    const { publicSlug } = req.params;

    // ✅ Ensure dealSite exists
    const dealSite = await DealSiteService.getBySlug(publicSlug);
    if (!dealSite) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Public access page not found",
      });
    }

    // fetch the owner email and name
    const ownerDetails = await DB.Models.User.findById(dealSite.createdBy)
      .select("firstName lastName email")
      .lean();

    if (!ownerDetails) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "DealSite owner not found");
    }

    const { name, email, phoneNumber, whatsAppNumber, subject, message } =
      req.body;

    // ✅ Create Contact Us record
    const contact = await DB.Models.ContactUs.create({
      name,
      email,
      phoneNumber,
      whatsAppNumber,
      subject,
      message,
      status: "pending",
      receiverMode: {
        type: "dealSite",
        dealSiteID: dealSite._id,
      },
    });
 
     const {
      paymentDetails,
      logoUrl,
      title,
      footerSection,
      socialLinks = {},
    } = dealSite;

    const companyName = title || paymentDetails?.businessName || "Our Partner";
    const address = footerSection?.shortDescription || "Lagos, Nigeria";

    // send mails to seller and buyer
    const sellerEmailRaw = generateDealSiteContactOwnerMail({
      ownerName: dealSite?.title || dealSite?.paymentDetails?.businessName,
      dealSiteName: dealSite?.title || dealSite?.paymentDetails?.businessName,
      name,
      email,
      phoneNumber,
      whatsAppNumber,
      subject,
      message,
    });

    const buyerEmailRaw = generateDealSiteContactUserMail({
      name,
      email,
      subject,
      message,
      phoneNumber,
      whatsAppNumber,
      dealSiteName: dealSite?.title || dealSite?.paymentDetails?.businessName,
    })

    const buyerEmail = generalTemplate(buyerEmailRaw, {
      companyName,
      logoUrl:
        logoUrl ||
        "https://res.cloudinary.com/dkqjneask/image/upload/v1744050595/logo_1_flo1nf.png",
      address,
      facebookUrl: socialLinks.facebook || "",
      instagramUrl: socialLinks.instagram || "",
      linkedinUrl: socialLinks.linkedin || "",
      twitterUrl: socialLinks.twitter || "",
    });

    const sellerEmail = generalTemplate(sellerEmailRaw, {
      companyName,
      logoUrl:
        logoUrl ||
        "https://res.cloudinary.com/dkqjneask/image/upload/v1744050595/logo_1_flo1nf.png",
      address,
      facebookUrl: socialLinks.facebook || "",
      instagramUrl: socialLinks.instagram || "",
      linkedinUrl: socialLinks.linkedin || "",
      twitterUrl: socialLinks.twitter || "",
    });

    await sendEmail({
        to: email,
        subject: `Your message to ${companyName} has been received`,
        html: buyerEmail,
        text: buyerEmail,
    });

    await sendEmail({
        to: ownerDetails.email,
        subject: `New Contact Message from ${name} via ${companyName} Page`,
        html: sellerEmail,
        text: sellerEmail,
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Your inquiry has been submitted successfully",
      data: contact,
    });
  } catch (err) {
    next(err);
  }
};
