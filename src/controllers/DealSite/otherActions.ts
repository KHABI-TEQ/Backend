import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DB } from "..";
import { DealSiteService } from "../../services/dealSite.service";
import { dealSiteActivityService } from "../../services/dealSiteActivity.service";
import { generateDealSiteContactOwnerMail, generateDealSiteContactUserMail } from "../../common/emailTemplates/dealSiteMails";
import sendEmail from "../../common/send.email";
import { generalTemplate } from "../../common/email.template";
import { getKhabiteqEmailLogoUrl } from "../../common/constants/emailBranding";
import { RouteError } from "../../common/classes";
import { isLikelyE164CapableLocalPhone, runWhatsapp } from "../../services/whatsappClient.service";

/**
 * Bulk update a DealSite (handles multiple sections in one request)
 * Used by frontend forms that update multiple sections at once
 */
/**
 * @swagger
 * /account/dealSite/update:
 *   post:
 *     tags:
 *       - Account > DealSite
 *     summary: Bulk update deal site
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updates
 *             properties:
 *               updates:
 *                 type: array
 *                 items: {'type': 'object'}
 *                 description: Array of update objects
 *     responses:
 *       200:
 *         description: Deal site updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Deal site not found
 */
export const bulkUpdateDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    const payload = req.body;

    const branding = payload?.brandingSeo && typeof payload.brandingSeo === "object"
      ? payload.brandingSeo
      : {};
    const dealSite = await DealSiteService.ensurePublicAccessForUser(userId, {
      title: branding.title,
      description: branding.description,
      keywords: branding.keywords,
      logoUrl: branding.logoUrl,
      footer: payload?.footer,
    });
    const publicSlug = dealSite.publicSlug;

    // Process each section in the payload
    const sections = Object.keys(payload);
    let updated = dealSite;

    for (const sectionName of sections) {
      updated = await DealSiteService.updateDealSiteSection(
        userId,
        publicSlug,
        sectionName,
        payload[sectionName]
      );
    }

    // Log activity
    await dealSiteActivityService.logActivity({
      dealSiteId: updated._id.toString(),
      actorId: req.user._id,
      actorModel: "User",
      category: "settings-updated",
      action: `Updated ${sections.join(", ")} sections`,
      description: `User modified multiple settings on their deal site.`,
      req,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page updated successfully",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update a DealSite
 */
/**
 * @swagger
 * /account/dealSite/:publicSlug/:sectionName/update:
 *   put:
 *     tags:
 *       - Account > DealSite
 *     summary: Update deal site section
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: publicSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: sectionName
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: object
 *                 description: Section content
 *               settings:
 *                 type: object
 *                 description: Section settings
 *     responses:
 *       200:
 *         description: Deal site section updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Deal site or section not found
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
/**
 * @swagger
 * /account/dealSite/:publicSlug/pause:
 *   put:
 *     tags:
 *       - Account > DealSite
 *     summary: Pause deal site
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: publicSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deal site paused successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Deal site not found
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
/**
 * @swagger
 * /account/dealSite/:publicSlug/resume:
 *   put:
 *     tags:
 *       - Account > DealSite
 *     summary: Resume deal site
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: publicSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deal site resumed successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Deal site not found
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
/**
 * @swagger
 * /account/dealSite/:publicSlug/delete:
 *   delete:
 *     tags:
 *       - Account > DealSite
 *     summary: Delete deal site
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: publicSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deal site deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Deal site not found
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
/**
 * @swagger
 * /account/dealSite/:publicSlug/contactUs:
 *   post:
 *     tags:
 *       - Account > DealSite
 *     summary: Create contact us message
 *     security: []
 *     parameters:
 *       - name: publicSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Contact message sent successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Deal site not found
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
      .select("firstName lastName email phoneNumber")
      .lean();

    if (!ownerDetails) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "DealSite owner not found");
    }

    const { name, email, phoneNumber, whatsAppNumber, subject, message, propertyInterest } =
      req.body;

    const composedMessage = propertyInterest
      ? `${String(message || "").trim()}\n\nProperty interested in: ${String(propertyInterest).trim()}`
      : message;

    // ✅ Create Contact Us record
    const contact = await DB.Models.ContactUs.create({
      name,
      email,
      phoneNumber,
      whatsAppNumber,
      subject: subject || (propertyInterest ? `Enquiry: ${propertyInterest}` : "Public page enquiry"),
      message: composedMessage,
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
      footer,
      socialLinks = {},
    } = dealSite;

    const companyName = title || paymentDetails?.businessName || "Our Partner";
    const address = footer?.shortDescription || "Lagos, Nigeria";

    // send mails to seller and buyer
    const sellerEmailRaw = generateDealSiteContactOwnerMail({
      ownerName: dealSite?.title || dealSite?.paymentDetails?.businessName,
      dealSiteName: dealSite?.title || dealSite?.paymentDetails?.businessName,
      name,
      email,
      phoneNumber,
      whatsAppNumber,
      subject: subject || (propertyInterest ? `Enquiry: ${propertyInterest}` : "Public page enquiry"),
      message: composedMessage,
    });

    const buyerEmailRaw = generateDealSiteContactUserMail({
      name,
      email,
      subject: subject || (propertyInterest ? `Enquiry: ${propertyInterest}` : "Public page enquiry"),
      message: composedMessage,
      phoneNumber,
      whatsAppNumber,
      dealSiteName: dealSite?.title || dealSite?.paymentDetails?.businessName,
    })

    const buyerEmail = generalTemplate(buyerEmailRaw, {
      companyName,
      logoUrl: logoUrl || getKhabiteqEmailLogoUrl(),
      address,
      facebookUrl: socialLinks.facebook || "",
      instagramUrl: socialLinks.instagram || "",
      linkedinUrl: socialLinks.linkedin || "",
      twitterUrl: socialLinks.twitter || "",
    });

    const sellerEmail = generalTemplate(sellerEmailRaw, {
      companyName,
      logoUrl: logoUrl || getKhabiteqEmailLogoUrl(),
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

    const inquirerLine = (whatsAppNumber || phoneNumber || "").toString().replace(/\s/g, "");
    const ownerLine = (ownerDetails.phoneNumber || "").toString().replace(/\s/g, "");
    if (isLikelyE164CapableLocalPhone(inquirerLine) && isLikelyE164CapableLocalPhone(ownerLine)) {
      void runWhatsapp("dealsite_contact_inquiry", async (wa) => {
        await wa.sendMessage(ownerLine, "property_inquiry", {
          agentName: ownerDetails.firstName || "there",
          userName: name,
          userPhone: inquirerLine,
          propertyName: subject || "Contact form",
          propertyLocation: companyName,
          inquiryMessage: message,
        });
      });
    }

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Your inquiry has been submitted successfully",
      data: contact,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Get all contact messages for a DealSite (for agent dashboard)
 */
/**
 * @swagger
 * /account/dealSite/contact-messages:
 *   get:
 *     tags:
 *       - Account > DealSite
 *     summary: Get deal site contact messages
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contact messages fetched successfully
 *       401:
 *         description: Not authenticated
 */
export const getDealSiteContactMessages = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;

    // Normalize query params
    const page = Number(req.query.page) || 1;
    const limit = Math.min(100, Number(req.query.limit) || 10);
    const status = typeof req.query.status === "string" && req.query.status.trim() !== ""
      ? req.query.status
      : undefined;
    const search = typeof req.query.search === "string" && req.query.search.trim() !== ""
      ? req.query.search
      : undefined;

    // Verify dealSite ownership
    const userDealSite = await DB.Models.DealSite.findOne({ createdBy: userId })
      .select("-paymentDetails -__v")
      .lean();

    if (!userDealSite) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Public access page not found",
      });
    }

    // Build query
    const query: any = {
      "receiverMode.dealSiteID": userDealSite._id.toString(),
      "receiverMode.type": "dealSite",
    };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      DB.Models.ContactUs.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DB.Models.ContactUs.countDocuments(query),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Contact messages retrieved successfully",
      data: messages,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};



/**
 * Delete a contact message
 */
/**
 * @swagger
 * /account/dealSite/contact-messages/:messageId:
 *   delete:
 *     tags:
 *       - Account > DealSite
 *     summary: Delete contact message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: messageId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Message not found
 */
export const deleteDealSiteContactMessage = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?._id;

    // Verify dealSite ownership
    const dealSites = await DealSiteService.getByAgent(userId, false);
    if (!dealSites || dealSites.length === 0) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Public access page not found",
      });
    }

    // Delete message
    const message = await DB.Models.ContactUs.findByIdAndDelete(messageId);

    if (!message) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Message not found",
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Get all email subscribers for a DealSite
 */
/**
 * @swagger
 * /account/dealSite/email-subscribers:
 *   get:
 *     tags:
 *       - Account > DealSite
 *     summary: Get deal site email subscribers
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email subscribers fetched successfully
 *       401:
 *         description: Not authenticated
 */
export const getDealSiteEmailSubscribers = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    const { page = "1", limit = "10", status, search } = req.query;

    // Verify dealSite ownership
    const userDealSite = await DB.Models.DealSite.findOne({ createdBy: userId })
      .sort({ createdAt: -1 })
      .select("-paymentDetails -__v")
      .lean();

    if (!userDealSite) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Public access page not found",
      });
    }

    // Build query
    const query: any = {
      "receiverMode.dealSiteID": userDealSite._id,
      "receiverMode.type": "dealSite",
    };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, parseInt(limit as string) || 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch subscribers
    const subscribers = await DB.Models.EmailSubscription.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await DB.Models.EmailSubscription.countDocuments(query);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Email subscribers retrieved successfully",
      data: subscribers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Delete an email subscriber
 */
/**
 * @swagger
 * /account/dealSite/email-subscribers/:subscriberId:
 *   delete:
 *     tags:
 *       - Account > DealSite
 *     summary: Delete email subscriber
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: subscriberId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscriber deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Subscriber not found
 */
export const deleteDealSiteEmailSubscriber = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriberId } = req.params;
    const userId = req.user?._id;

    // Verify dealSite ownership
    const dealSites = await DealSiteService.getByAgent(userId, false);
    if (!dealSites || dealSites.length === 0) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Public access page not found",
      });
    }

    // Delete subscriber
    const subscriber = await DB.Models.EmailSubscription.findByIdAndDelete(subscriberId);

    if (!subscriber) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Subscriber not found",
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Subscriber deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Export email subscribers as CSV
 */
/**
 * @swagger
 * /account/dealSite/email-subscribers/export/csv:
 *   get:
 *     tags:
 *       - Account > DealSite
 *     summary: Export email subscribers to CSV
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV exported successfully
 *       401:
 *         description: Not authenticated
 */
export const exportDealSiteEmailSubscribers = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    const status =
      typeof req.query.status === "string" && req.query.status.trim() !== ""
        ? req.query.status
        : undefined;

    // Verify dealSite ownership
    const userDealSite = await DB.Models.DealSite.findOne({
      createdBy: userId,
    })
      .sort({ createdAt: -1 })
      .select("-paymentDetails -__v")
      .lean();

    if (!userDealSite) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Public access page not found",
      });
    }

    // Build query
    const query: any = {
      "receiverMode.dealSiteID": userDealSite._id.toString(),
      "receiverMode.type": "dealSite",
    };

    if (status) {
      query.status = status;
    }

    // Fetch all subscribers
    const subscribers = await DB.Models.EmailSubscription.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Convert to CSV
    const csvHeaders = "First Name,Last Name,Email,Status,Subscribed Date\n";

    const csvRows = subscribers
      .map((sub) => {
        const firstName = sub.firstName || "";
        const lastName = sub.lastName || "";
        const email = `"${sub.email}"`;
        const status = sub.status;
        const subscribedDate = new Date(sub.createdAt).toLocaleDateString();

        return `${firstName},${lastName},${email},${status},${subscribedDate}`;
      })
      .join("\n");

    const csvContent = csvHeaders + csvRows;

    // Set response headers
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="subscribers_${userDealSite.publicSlug}_${new Date()
        .toISOString()
        .split("T")[0]}.csv"`
    );

    return res.send(csvContent);
  } catch (err) {
    next(err);
  }
};
