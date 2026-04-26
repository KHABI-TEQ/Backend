import axios from 'axios';
import { Types } from 'mongoose';
import { DB } from '../controllers';
import { IInspectionBooking, INewTransactionDoc } from '../models';
import notificationService from './notification.service';
import { InspectionLogService } from './inspectionLog.service';
import { generalTemplate, InspectionRequestWithNegotiation, InspectionTransactionRejectionTemplate } from '../common/email.template';
import { notifyAgentPaymentReceived } from './inspectionWorkflow.service';
import sendEmail from '../common/send.email';
import { generalEmailLayout } from '../common/emailTemplates/emailLayout';
import { generateThirdPartyVerificationEmail, GenerateVerificationEmailParams, generateVerificationSubmissionEmail } from '../common/emailTemplates/documentVerificationMails';
import { generateSubscriptionFailureEmail, generateSubscriptionReceiptEmail } from '../common/emailTemplates/subscriptionMails';
import { SystemSettingService } from './systemSetting.service';
import { PaymentMethodService } from './paymentMethod.service';
import { referralService } from './referral.service';
import { UserSubscriptionSnapshotService } from './userSubscriptionSnapshot.service';
import { getPropertyTitleFromLocation } from '../utils/helper';
import { BookingLogService } from './bookingLog.service';
import { generateSuccessfulBookingReceiptForBuyer, generateSuccessfulBookingReceiptForSeller } from '../common/emailTemplates/bookingMails';
import { Url } from 'url';
import { getClientDashboardUrl } from '../utils/clientAppUrl';
import { isLikelyE164CapableLocalPhone, runWhatsapp } from './whatsappClient.service';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export class PaystackService {
  /**
   * Single source of truth: DB `paystack_secret_key` when set, else `PAYSTACK_SECRET_KEY`.
   * `initializePayment` and `verifyPayment` must use the same key or verification always fails.
   */
  static async getPaystackSecretKey(): Promise<string> {
    const envVal = process.env.PAYSTACK_SECRET_KEY?.trim() || "";
    const fromDb = await SystemSettingService.getSetting("paystack_secret_key");
    const dbVal = typeof fromDb?.value === "string" ? fromDb.value.trim() : "";
   
    const key = envVal || dbVal;
    if (!key) {
      throw new Error(
        "Paystack secret key missing: set PAYSTACK_SECRET_KEY in environment and/or system setting paystack_secret_key."
      );
    }
    return key;
  }

  /**
   * Initialize a Paystack transaction and store it as pending in DB.
   */
  static async initializePayment({
    email,
    amount,
    fromWho,
    transactionType,
    paymentMode = 'card',
    currency = 'NGN',
    metadata = {},
  }: {
    email: string;
    amount: number;
    fromWho: { kind: 'User' | 'Buyer'; item: Types.ObjectId };
    transactionType: string;
    paymentMode?: string;
    currency?: string;
    metadata?: Record<string, any>;
  }) {

    const reference = 'KT' + Math.floor(Math.random() * 9e14 + 1e14).toString();

    // Create transaction record (status: pending)
    const transactionData = await DB.Models.NewTransaction.create({
      reference,
      fromWho,
      amount,
      transactionType,
      paymentMode,
      status: 'pending',
      currency,
      meta: metadata,
    });
 
    const paystackKey = await PaystackService.getPaystackSecretKey();

    // Initialize Paystack payment
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount: amount * 100, // convert to kobo
        callback_url: `${process.env.CLIENT_LINK}/payment-verification`,
        reference,
        currency,
        metadata: {
          ...metadata,
          transactionType,
          fromWho,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      reference,
      transactionId: transactionData._id,
      authorization_url: response.data.data.authorization_url,
      access_code: response.data.data.access_code,
    };
  }
  

  /**
   * Initialize a Paystack split transaction and store it as pending in DB.
   */
  static async initializeSplitPayment({
    subAccount,
    publicPageUrl,
    amountCharge,
    email,
    amount,
    fromWho,
    transactionType,
    paymentMode = 'card',
    currency = 'NGN',
    metadata = {},
  }: {
    subAccount: string;
    publicPageUrl: string;
    amountCharge: number;
    email: string;
    amount: number;
    fromWho: { kind: 'User' | 'Buyer'; item: Types.ObjectId };
    transactionType: string;
    paymentMode?: string;
    currency?: string;
    metadata?: Record<string, any>;
  }) {

    const reference = 'KT' + Math.floor(Math.random() * 9e14 + 1e14).toString();

    // Create transaction record (status: pending)
    const transactionData = await DB.Models.NewTransaction.create({
      reference,
      fromWho,
      amount,
      transactionType,
      paymentMode,
      status: 'pending',
      currency,
      meta: metadata,
    });
 
    const paystackKey = await PaystackService.getPaystackSecretKey();

    // Initialize Paystack payment
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount: amount * 100, // convert to kobo
        callback_url: `${publicPageUrl}/payment-verification`,
        reference,
        currency,
        subaccount: subAccount,
        transaction_charge: amountCharge * 100,
        metadata: {
          ...metadata,
          transactionType,
          fromWho,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      reference,
      transactionId: transactionData._id,
      authorization_url: response.data.data.authorization_url,
      access_code: response.data.data.access_code,
    };
  }


  /**
   * Automatically charge a user using saved authorization for auto-renewal
   */
  static async autoCharge({
    userId,
    subscriptionId,
    amount,
    authorizationCode,
    email,
    transactionType = 'subscription',
    currency = 'NGN',
  }: {
    userId: Types.ObjectId | string;
    subscriptionId: Types.ObjectId | string;
    amount: number;
    authorizationCode: string;
    email: string;
    transactionType?: string;
    currency?: string;
  }) {
    try {
      const reference = 'AR' + Math.floor(Math.random() * 9e14 + 1e14).toString();

      // Create pending transaction record in DB
      const transactionData = await DB.Models.NewTransaction.create({
        reference,
        fromWho: { kind: 'User', item: userId },
        amount,
        transactionType,
        paymentMode: 'card',
        status: 'pending',
        currency,
        meta: { subscriptionId, autoRenewal: true },
      });

      // Charge via Paystack using saved authorization code
      const paystackKey = await PaystackService.getPaystackSecretKey();
      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/transaction/charge_authorization`,
        {
          authorization_code: authorizationCode,
          amount: amount * 100, // kobo
          email,
          reference,
          currency,
        },
        {
          headers: {
            Authorization: `Bearer ${paystackKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data.data;

      // Update DB transaction status based on Paystack response
      const updatedTx = await DB.Models.NewTransaction.findByIdAndUpdate(
        transactionData._id,
        {
          status: data.status === 'success' ? 'success' : 'failed',
          paymentDetails: {
            ...data,
            paidAt: data.paid_at,
            channel: data.channel,
            authorization: data.authorization,
            customer: data.customer,
          },
        },
        { new: true }
      );

      return {
        success: data.status === 'success',
        transaction: updatedTx,
        reason: data.status !== 'success' ? data.gateway_response : undefined,
      };
    } catch (err: any) {
      console.error('Auto-charge failed:', err?.response?.data || err.message);
      return { success: false, reason: err?.response?.data?.message || err.message };
    }
  }

   /**
   * Verifies a Paystack transaction by reference and updates the DB
   */
  static async verifyPayment(reference: string) {
    try {

      const paystackKey = await PaystackService.getPaystackSecretKey();

      const response = await axios.get(
        `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${paystackKey}`,
          },
        }
      ); 
 
      const data = response.data.data; 

      // Update DB regardless of success or failure
      const updatedTx = await DB.Models.NewTransaction.findOneAndUpdate(
        { reference },
        {
          status: data.status === 'success' ? 'success' : 'failed',
          currency: data.currency,
          paymentMode: data.channel,
          paymentDetails: {
            ...data,
            channel: data.channel,
            paidAt: data.paid_at,
            paymentMethod: data.authorization?.brand,
            authorization: data.authorization,
            customer: data.customer,
          },
        },
        { new: true }
      );

      // Side effects (subscription activation, emails) must not flip verification to "failed" if Paystack already succeeded
      let dynamicResponse: unknown = null;
      try {
        dynamicResponse = await PaystackService.handleTransactionTypeEffect(updatedTx);
      } catch (effectErr: any) {
        console.error(
          "[Paystack] post-verification effect failed (transaction already updated; user paid if status is success):",
          effectErr?.message || effectErr
        );
      }
 
      return {
        verified: data.status === 'success',
        transaction: updatedTx,
        dynamicType: dynamicResponse,
        reason: data.status !== 'success' ? data.gateway_response : undefined,
      };
    } catch (error: any) {
      console.error(
        "Paystack verification error:",
        error?.response?.data ?? error?.message ?? error
      );
      return { verified: false, reason: 'verification_failed' };
    }
  }

   /**
   * Triggers side effects based on the transaction type
   */
  static async handleTransactionTypeEffect(tx: INewTransactionDoc) {
    const { transactionType, status } = tx;
    if (status !== 'success') return null;

    switch (transactionType) {
      case 'inspection':
        return await PaystackService.handleInspectionPaymentEffect(tx);

      case 'shortlet-booking':
        return await PaystackService.handleShortletBookingPaymentEffect(tx);

      case 'document-verification':
        return await PaystackService.handleDocumentVerificationPayment(tx);

      case 'subscription':
        return await PaystackService.handleSubscriptionPayment(tx);

      case 'transaction-registration':
        return await PaystackService.handleTransactionRegistrationPaymentEffect(tx);

      case 'request-to-market':
        return await PaystackService.handleRequestToMarketPaymentEffect(tx);

      default:
        console.warn(`Unhandled transaction type: ${transactionType}`);
        return null;
    }
  }

  /**
   * When processing fee for a transaction registration is paid, mark registration as pending_completion.
   */
  static async handleTransactionRegistrationPaymentEffect(tx: INewTransactionDoc): Promise<null> {
    const registrationId = tx.meta?.registrationId;
    if (!registrationId) return null;
    await DB.Models.TransactionRegistration.findByIdAndUpdate(registrationId, {
      $set: { status: 'pending_completion' },
    });
    return null;
  }

  /**
   * When agent commission for Request To Market is paid by Publisher, link transaction and notify Agent.
   */
  static async handleRequestToMarketPaymentEffect(tx: INewTransactionDoc): Promise<null> {
    const requestToMarketId = tx.meta?.requestToMarketId;
    if (!requestToMarketId) return null;
    await DB.Models.RequestToMarket.findByIdAndUpdate(requestToMarketId, {
      $set: { paymentTransactionId: tx._id },
    });
    try {
      const request = await DB.Models.RequestToMarket.findById(requestToMarketId)
        .populate('requestedByAgentId', 'email firstName lastName fullName')
        .populate('propertyId', 'location')
        .lean();
      if (request?.requestedByAgentId) {
        const agent = (request as any).requestedByAgentId;
        const summary = getPropertyTitleFromLocation((request as any).propertyId?.location) || 'the property';
        const html = generalEmailLayout(`
          <p>Hello ${agent?.fullName || agent?.firstName || 'there'},</p>
          <p>The publisher has completed the agent commission payment of <strong>₦${(tx.amount || 0).toLocaleString()}</strong> for the property at <strong>${summary}</strong>.</p>
          <p>The funds will be settled to your account according to your payment settings.</p>
        `);
        await sendEmail({
          to: agent.email,
          subject: 'Agent commission received – Request To Market',
          html,
          text: `The publisher has paid the agent commission (₦${(tx.amount || 0).toLocaleString()}) for ${summary}.`,
        });
      }
    } catch (e) {
      console.warn('[Paystack] handleRequestToMarketPaymentEffect notify agent failed:', e);
    }
    return null;
  }

  /**
   * Handles the shortlet booking
   */
  static async handleShortletBookingPaymentEffect(transaction: INewTransactionDoc) {
      const bookingRequest = await DB.Models.Booking.findOne({
        transaction: transaction._id,
      })
        .populate("bookedBy") // populate buyer
        .populate({
          path: "propertyId",       // populate property
          populate: {
            path: "owner",          // populate owner inside property
            select: "firstName lastName email phoneNumber", // fields you need
          },
        })
        .lean();
 
      if (!bookingRequest) return;
 
      // 🧩 Helper: Build email template layout with DealSite branding
      const getDealSiteTemplate = async (
        baseHtml: string,
        receiverMode: any
      ): Promise<string> => {
        if (receiverMode?.type !== "dealSite") return generalTemplate(baseHtml);

        const dealSite = await DB.Models.DealSite.findOne({
          _id: receiverMode.dealSiteID,
          status: "running",
        }).lean();

        if (!dealSite) return generalTemplate(baseHtml);

        const {
          paymentDetails,
          logoUrl,
          title,
          footer,
          socialLinks = {},
        } = dealSite;

        const companyName =
          paymentDetails?.businessName || title || "Our Partner";
        const address = footer?.shortDescription || "Lagos, Nigeria";

        return generalTemplate(baseHtml, {
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
      };

      if (bookingRequest.status === "pending") {

          const buyer = bookingRequest.bookedBy as any;
          const property = bookingRequest.propertyId as any;
          const ownerData = property.owner as any;
          const propertyTitle: any = getPropertyTitleFromLocation(property.location); 

          const bookedPrice = bookingRequest.meta.totalPrice?.toLocaleString("en-US") ?? "N/A";

          if (transaction.status === "success") {

            // mark the property as unavailable
            const propertyId = bookingRequest.propertyId._id;

            // ✅ Mark property as unavailable and optionally update status
            const updatedProperty = await DB.Models.Property.findOneAndUpdate(
              { _id: propertyId, isAvailable: true },
              {
                $push: {
                  bookedPeriods: {
                    bookingId: bookingRequest._id,
                    checkInDateTime: bookingRequest.bookingDetails.checkInDateTime,
                    checkOutDateTime: bookingRequest.bookingDetails.checkOutDateTime,
                  },
                },
                $set: {
                  status: "booked", 
                },
              },
              { new: true }
            );


            if (!updatedProperty) {
                // Optional: handle rare case where property was already booked
                console.warn(`Property ${propertyId} was already unavailable`);
            }

            await DB.Models.Booking.updateOne(
              { _id: bookingRequest._id },
              {
                status: "confirmed",
                ownerResponse: {
                  response: "accepted",
                  respondedAt: new Date(),
                  note: null,
                },
              }
            );

            // ✅ Log booking activity
            await BookingLogService.logActivity({
                bookingId: bookingRequest._id.toString(),
                propertyId: property._id.toString(),
                senderId: buyer?._id.toString(),
                senderRole: "buyer",     // "buyer" | "owner" | "admin"
                senderModel: "Buyer",   // "User" | "Buyer" | "Admin"
                message: "Instant Booking request made",
                status: "completed",
                stage: "completed",
                meta: { propertyTitle, bookedPrice },
            });

            const propertyAddress =
              [property?.location?.streetAddress, property?.location?.area, property?.location?.state]
                .filter(Boolean)
                .join(", ") || propertyTitle;
            const buyerLine = (buyer.whatsAppNumber || buyer.phoneNumber || "") as string;
            const ownerLine = (ownerData.phoneNumber || "") as string;
            if (
              isLikelyE164CapableLocalPhone(buyerLine) &&
              isLikelyE164CapableLocalPhone(ownerLine)
            ) {
              void runWhatsapp("shortlet_booking_confirmation", async (wa) => {
                const agentName = [ownerData.firstName, ownerData.lastName].filter(Boolean).join(" ") || "Host";
                await wa.sendBookingConfirmation({
                  booking: {
                    id: String(bookingRequest._id),
                    dateTime: bookingRequest.bookingDetails.checkInDateTime,
                    userPreferences: "",
                    propertyName: propertyTitle,
                  } as any,
                  user: {
                    name: buyer.fullName,
                    phone: buyerLine,
                    id: String(buyer._id),
                  },
                  agent: { name: agentName, phone: ownerLine, id: String(ownerData._id) },
                  property: { name: propertyTitle, address: propertyAddress },
                });
              });
            }

            const buyerEmailHtml = generateSuccessfulBookingReceiptForBuyer({
                buyerName: buyer.fullName,
                bookingCode: bookingRequest.bookingCode,
                propertyTitle: propertyTitle,
                checkInDateTime: bookingRequest.bookingDetails.checkInDateTime,
                checkOutDateTime: bookingRequest.bookingDetails.checkOutDateTime,
                duration: bookingRequest.meta.nights,
                totalAmount: bookedPrice
            });

            const sellerEmailHtml = generateSuccessfulBookingReceiptForSeller({
                sellerName: ownerData.firstName,
                bookingCode: bookingRequest.bookingCode,
                propertyTitle: propertyTitle,
                checkInDateTime: bookingRequest.bookingDetails.checkInDateTime,
                checkOutDateTime: bookingRequest.bookingDetails.checkOutDateTime,
                duration: bookingRequest.meta.nights,
                totalAmount: bookedPrice,
                buyerName: buyer.fullName
            });

            const buyerEmailLayout = await getDealSiteTemplate(
              buyerEmailHtml,
              bookingRequest.receiverMode
            );

            const sellerEmailLayout = await getDealSiteTemplate(
              sellerEmailHtml,
              bookingRequest.receiverMode
            );

            await sendEmail({
                to: buyer.email,
                subject: `Booking Confirmed – ${propertyTitle}`,
                html: buyerEmailLayout,
                text: buyerEmailLayout,
            });

            await sendEmail({
                to: ownerData.email,
                subject: `Booking Confirmed for Your Property – ${propertyTitle}`,
                html: sellerEmailLayout,
                text: sellerEmailLayout,
            });

            await notificationService.createNotification({
                user: ownerData._id,
                title: `Booking Confirmed for Your Property – ${propertyTitle}`,
                message: `${buyer.fullName} has successfully booked your property located at ${propertyTitle}. Please review the booking details.`,
                meta: {
                    propertyId: property._id,
                    bookingId: bookingRequest._id,
                    status: "completed",
                },
            });

          }else{

            // ✅ Log booking activity
            await BookingLogService.logActivity({
                bookingId: bookingRequest._id.toString(),
                propertyId: bookingRequest.propertyId.toString(),
                senderId: buyer?._id.toString(),
                senderRole: "buyer",     // "buyer" | "owner" | "admin"
                senderModel: "Buyer",   // "User" | "Buyer" | "Admin"
                message: "Booking failed due to unsuccessful payment transaction",
                status: "cancelled",
                stage: "payment",
                meta: { propertyTitle, bookedPrice },
            });


          }

      }

      return bookingRequest;
  }


  /**
   * Handles the side effects of a successful or failed inspection payment.
   */
  static async handleInspectionPaymentEffect(transaction: INewTransactionDoc) {
    // Fetch all inspections for this transaction
    const inspections = await DB.Models.InspectionBooking.find({
      transaction: transaction._id,
    })
      .populate("requestedBy")
      .populate("propertyId")
      .populate("owner");

    if (!inspections?.length) return;

    const processedSellers = new Set<string>();

    // 🧩 Helper: Build email template layout with DealSite branding
    const getDealSiteTemplate = async (
      baseHtml: string,
      receiverMode: any
    ): Promise<string> => {
      if (receiverMode?.type !== "dealSite") return generalTemplate(baseHtml);

      const dealSite = await DB.Models.DealSite.findOne({
        _id: receiverMode.dealSiteID,
        status: "running",
      }).lean();

      if (!dealSite) return generalTemplate(baseHtml);

      const {
        paymentDetails,
        logoUrl,
        title,
        footer,
        socialLinks = {},
      } = dealSite;

      const companyName =
        paymentDetails?.businessName || title || "Our Partner";
      const address = footer?.shortDescription || "Lagos, Nigeria";

      return generalTemplate(baseHtml, {
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
    };

    // 🔁 Iterate through all inspections
    for (const inspection of inspections) {
      if (inspection.status !== "pending_transaction") continue;

      const buyer = inspection.requestedBy as any;
      const property = inspection.propertyId as any;
      const owner = inspection.owner as any;

      const location = `${property.location.state}, ${property.location.localGovernment}, ${property.location.area}`;
      const formattedPrice = property.price?.toLocaleString("en-US") ?? "N/A";
      const negotiationPrice =
        inspection.negotiationPrice?.toLocaleString("en-US") ?? "N/A";

      const emailData = {
        propertyType: property.propertyType,
        location,
        price: formattedPrice,
        inspectionDate: inspection.inspectionDate,
        inspectionTime: inspection.inspectionTime,
        isNegotiating: inspection.isNegotiating,
        negotiationPrice,
        letterOfIntention: inspection.letterOfIntention,
        agentName: owner.fullName || owner.firstName,
        inspectionMode: inspection.inspectionMode,
      };

      let updatedStatus: IInspectionBooking["status"];
      let updatedStage: IInspectionBooking["stage"];
      let pendingResponseFrom: IInspectionBooking["pendingResponseFrom"];

      // 🟢 Transaction SUCCESS
      if (transaction.status === "success") {
        const { inspectionType, negotiationPrice, letterOfIntention } =
          inspection;
        const isPrice = inspectionType === "price";
        const isLOI = inspectionType === "LOI";

        const hasNegotiationPrice = negotiationPrice > 0;
        const hasLOIDocument = !!(letterOfIntention && letterOfIntention.trim());

        if (isPrice) {
          inspection.isNegotiating = hasNegotiationPrice;
          updatedStage = hasNegotiationPrice ? "negotiation" : "inspection";
        } else if (isLOI) {
          inspection.isLOI = hasLOIDocument;
          updatedStage = hasLOIDocument ? "negotiation" : "inspection";
        }

        pendingResponseFrom = "seller";
        updatedStatus = inspection.isNegotiating
          ? "negotiation_countered"
          : "active_negotiation";

        // 🔹 Log inspection activity
        await InspectionLogService.logActivity({
          inspectionId: inspection._id.toString(),
          propertyId: property._id.toString(),
          senderId: owner?._id.toString(),
          senderModel: "Buyer",
          senderRole: "buyer",
          message: `Inspection transaction approved successfully - status updated to ${updatedStatus}`,
          status: updatedStatus,
          stage: updatedStage,
        });

        // 🔹 Handle matched preference update
        const metaData = inspection.meta as any;
        if (
          metaData?.requestSource?.page === "matched-properties" &&
          metaData.requestSource.preferenceId
        ) {
          await DB.Models.Preference.findByIdAndUpdate(
            metaData.requestSource.preferenceId,
            { status: "closed" },
            { new: true }
          );
        }

        // 🔹 Build buyer email layout
        const buyerEmailHtml = InspectionRequestWithNegotiation(
          buyer.fullName,
          emailData
        );

        const buyerTemplate = await getDealSiteTemplate(
          buyerEmailHtml,
          inspection.receiverMode
        );

        await sendEmail({
          to: buyer.email,
          subject: `Inspection Request Submitted`,
          html: buyerTemplate,
          text: buyerTemplate,
        });

        // 🔹 Notify agent (seller) that payment was received – email + in-app
        const propertyLocation = `${property.location?.area || ""}, ${property.location?.localGovernment || ""}, ${property.location?.state || ""}`.replace(/^,\s*|,\s*$/g, "").trim() || "Property";
        const paidAmount = transaction.amount ?? property?.inspectionFee ?? 0;
        if (!processedSellers.has(owner._id.toString())) {
          await notifyAgentPaymentReceived({
            ownerId: owner._id.toString(),
            buyerName: buyer?.fullName || buyer?.email || "Buyer",
            propertyLocation,
            amount: paidAmount,
            inspectionId: inspection._id.toString(),
          });
          processedSellers.add(owner._id.toString());
        }
      }

      // 🔴 Transaction FAILED
      else {
        updatedStatus = "transaction_failed";
        updatedStage = "cancelled";
        pendingResponseFrom = "admin";

        const rejectionHtml = InspectionTransactionRejectionTemplate(
          buyer.fullName,
          {
            ...emailData,
            rejectionReason:
              "Your inspection request was not approved. Please contact support for more info.",
          }
        );

        const rejectionTemplate = await getDealSiteTemplate(
          rejectionHtml,
          inspection.receiverMode
        );

        await sendEmail({
          to: buyer.email,
          subject: `Inspection Request Rejected`,
          html: rejectionTemplate,
          text: rejectionTemplate,
        });

        await InspectionLogService.logActivity({
          inspectionId: inspection._id.toString(),
          propertyId: property._id.toString(),
          senderId: owner?._id.toString(),
          senderModel: "Buyer",
          senderRole: "buyer",
          message: `Inspection transaction rejected by payment system.`,
          status: updatedStatus,
          stage: updatedStage,
        });
      }

      // 🧾 Save inspection
      inspection.pendingResponseFrom = pendingResponseFrom;
      inspection.status = updatedStatus;
      inspection.stage = updatedStage;
      await inspection.save();
    }

    return inspections;
  }


  /**
  * Handles the side effects of a subscription payment.
  */ 
  static async handleSubscriptionPayment(transaction: any) { 
    // get user subscription snapshot by transaction id 
    const snapshot = await UserSubscriptionSnapshotService.getSnapshotByTransactionId(transaction._id);
 
    // return false if subscription not found
    if (!snapshot) return;
 
    // make sure only pending snapshot subscription are action on
    if (snapshot.status === "pending") {
      const newStatus = transaction.status === "success" ? "active" : "cancelled";

      // get the plan from snapshot
      const plan = snapshot.plan as any;
      if (!plan) return null;

      let planDuration: number;

      // calculating subscription snapshot dates also confirm if the plan is a discounted plan
      const startDate = new Date();
      const endDate = new Date(startDate);
      
      if (snapshot.meta.planType === "discounted" && snapshot.meta.planCode) {
        // find exact discounted plan under this plan
        const discountedPlan = plan.discountedPlans?.find(
          (p: any) => p.code === snapshot.meta.planCode
        );

        if (!discountedPlan) {
          throw new Error(`Discounted plan with code name ${snapshot.meta.appliedPlanName} not found`);
        }

        planDuration = discountedPlan.durationInDays;
      } else {
        planDuration = plan.durationInDays;
      }

      endDate.setDate(endDate.getDate() + planDuration);
 
      // Map plan features into snapshot
      const planFeatures = plan.features?.map((f: any) => ({
        feature: f.feature?._id || f.feature,
        type: f.type,
        value: f.type === "boolean" || f.type === "count" ? f.value : undefined,
        remaining: f.type === "count" ? f.value : undefined,
      })) || [];

      snapshot.status = newStatus;
      snapshot.startedAt = startDate;
      snapshot.expiresAt = endDate;
      snapshot.features = Array.isArray(planFeatures) ? planFeatures : [];
      await snapshot.save();

      // =======================
      // Subscription Mails
      // =======================
      const user = snapshot.user as any; // populated user
      const fullName = `${user.firstName} ${user.lastName}`;

      if (transaction.status === "success") {

        // create auto renewal authorization
        if (snapshot.autoRenew) {
          const auth = transaction.paymentDetails?.authorization;
          const customer = transaction.paymentDetails?.customer;
          if (auth?.authorization_code && customer?.customer_code) {
            try {
              await PaymentMethodService.createPaymentMethod({
                userId: user._id,
                type: transaction.paymentMode,
                authorizationCode: auth.authorization_code,
                last4: auth.last4,
                expMonth: auth.exp_month,
                expYear: auth.exp_year,
                brand: auth.card_type,
                bank: auth.bank,
                reusable: auth.reusable,
                customerCode: customer.customer_code,
                isDefault: true,
              });
            } catch (pmErr) {
              console.error("[Paystack] createPaymentMethod after subscription failed:", pmErr);
            }
          } else {
            console.warn(
              "[Paystack] autoRenew is true but Paystack did not return reusable card authorization; skipping saved payment method. user may use non-card channel or missing permissions."
            );
          }
        }
        
        // Check if user has ANY past subscription (active or expired), excluding current pending one
        const previousSubscription = await DB.Models.UserSubscriptionSnapshot.exists({
          user: user._id,
          status: { $in: ["active", "inactive", "expired"] },
          _id: { $ne: snapshot._id },
        });
  
        const referralStatusSettings = await SystemSettingService.getSetting("referral_enabled");
        if (referralStatusSettings?.value && user.referredBy) {

          if (!previousSubscription) {
            const referralSubscribedPoints = await SystemSettingService.getSetting("referral_subscribed_agent_point");

            const referrerUser = await DB.Models.User.findOne({
              referralCode: user.referredBy,
              accountStatus: "active",
              isAccountVerified: true,
              isDeleted: false,
            });

            // ✅ Log the referral if valid
            if (referrerUser && user) {
              await referralService.createReferralLog({
                referrerId: new Types.ObjectId(referrerUser._id as Types.ObjectId),
                referredUserId: new Types.ObjectId(user._id as Types.ObjectId),
                rewardType: "subscription",
                triggerAction: "agent_subscribed",
                note: "Referral at subscription on agent account",
                rewardStatus: "granted",
                rewardAmount: referralSubscribedPoints?.value || 0
              });
            } 
          }
        }

        // create public link
        const publicAccessCompleteLink = getClientDashboardUrl();

        const successMailBody = generalEmailLayout(
          generateSubscriptionReceiptEmail({
            fullName,
            planName: plan.name,
            amount: transaction.amount, // if Paystack stores in kobo
            nextBillingDate: endDate.toDateString(),
            transactionRef: transaction.reference,
            publicAccessSettingsLink: publicAccessCompleteLink,
          })
        );

        await sendEmail({
          to: user.email,
          subject: "Subscription made Successfully",
          html: successMailBody,
          text: successMailBody,
        });

      } else { 
        const failureMailBody = generalEmailLayout(
          generateSubscriptionFailureEmail({
            fullName,
            planName: plan.name,
            amount: transaction.amount,
            transactionRef: transaction.reference,
            subscriptionPlansLink: getClientDashboardUrl(),
          })
        );

        await sendEmail({
          to: user.email,
          subject: "Subscription Payment Failed",
          html: failureMailBody,
          text: failureMailBody,
        });
      }
    }

    return snapshot;
  }



  /**
 * Handles the effects of a document verification payment.
 */ 
  static async handleDocumentVerificationPayment(transaction: any) {
    const docVerifications = await DB.Models.DocumentVerification.find({
      transaction: transaction._id,
    }).populate("buyerId");

    if (!docVerifications.length) return;

    for (const docVerification of docVerifications) {
      if (docVerification.status === "pending") {
        const newStatus = transaction.status === "success" ? "payment-approved" : "payment-failed";
        docVerification.status = newStatus;

        const buyerData = docVerification.buyerId as any;
  
        if (transaction.status === "success") {
          // Generate a 6-digit unique code
          const accessCode = Math.floor(100000 + Math.random() * 900000).toString();

          docVerification.accessCode = {
            token: accessCode,
            status: 'pending',
          };
          
          // ✅ SAVE FIRST - This ensures the access code is in the DB before emails are sent
          await docVerification.save();

          // Send confirmation email to buyer
          const emailParams: GenerateVerificationEmailParams = {
            fullName: buyerData?.fullName || "",
            phoneNumber: buyerData?.phoneNumber || "",
            address: buyerData?.address || "",
            amountPaid: docVerification.amountPaid,
            documents: docVerification.documents,
          };

          const buyerMailBody = generalEmailLayout(
            generateVerificationSubmissionEmail(emailParams)
          );

          await sendEmail({
            to: buyerData?.email,
            subject: "Document Verification Submission Received – Under Review",
            html: buyerMailBody,
            text: buyerMailBody,
          });

          const docType = (docVerification.documents.documentType || "")
            .toLowerCase()
            .trim(); // normalize

          // Construct the setting key dynamically
          const settingKey = `${docType}_verification_email`;

          let recipientEmail =
            (await SystemSettingService.getSetting(settingKey))?.value ||
            process.env.GENERAL_VERIFICATION_MAIL; // fallback

          // Prepare third-party email
          const thirdPartyEmailHTML = generalEmailLayout(
            generateThirdPartyVerificationEmail({
              recipientName: docType === "survey-plan"
                ? "Survey Plan Officer"
                : "Verification Officer",
              requesterName: buyerData?.fullName || "",
              message: "Please review the submitted documents and confirm verification status.",
              accessCode: accessCode,
              accessLink: `${process.env.CLIENT_LINK}/third-party-verification/${docVerification._id}`,
            })
          );

          await sendEmail({
            to: recipientEmail,
            subject: docType === "survey-plan"
              ? `New Survey Plan Verification Request - ${buyerData?.fullName}`
              : `New Document Verification Request - ${buyerData?.fullName}`,
            html: thirdPartyEmailHTML,
            text: `A new document verification request has been submitted.\n\nAccess Code: ${accessCode}\nAccess Link: ${process.env.CLIENT_LINK}/third-party-verification/${docVerification._id}`,
          });

        } else {
          // ✅ Save failed status
          await docVerification.save();
        }
      }
    }

    return docVerifications;
  }


  /**
 * Fetch the list of banks supported by Paystack for Nigeria (or other countries)
 */
  static async getBankList(country = 'Nigeria') {
    try {
      const paystackKey = await PaystackService.getPaystackSecretKey();

      const response = await axios.get(
        `https://api.paystack.co/bank?country=${country}`,
        {
          headers: {
            Authorization: `Bearer ${paystackKey}`,
          },
        }
      );

      // response.data.data is the array of banks
      return response.data.data.map((bank: any) => ({
        name: bank.name,
        code: bank.code,
        country: bank.country,
        currency: bank.currency,
        type: bank.type,
      }));
    } catch (err: any) {
      console.error("Error fetching bank list from Paystack:", err?.response?.data || err.message);
      return [];
    }
  }

  /**
 * Create a Paystack subaccount
 */
  static async createSubaccount({
    businessName,
    settlementBank,
    accountNumber,
    percentageCharge,
    primaryContactEmail,
    primaryContactName,
    primaryContactPhone,
  }: {
    businessName: string;
    settlementBank: string; // e.g., '058' for GTBank
    accountNumber: string;   // recipient account number
    percentageCharge: number; // e.g., 10 for 10%
    primaryContactEmail?: string;
    primaryContactName?: string;
    primaryContactPhone?: string;
  }) {
    try {
      const paystackKey = await PaystackService.getPaystackSecretKey();

      const response = await axios.post(
        'https://api.paystack.co/subaccount',
        {
          business_name: businessName,
          settlement_bank: settlementBank,
          account_number: accountNumber,
          percentage_charge: percentageCharge,
          primary_contact_email: primaryContactEmail,
          primary_contact_name: primaryContactName,
          primary_contact_phone: primaryContactPhone,
        },
        {
          headers: {
            Authorization: `Bearer ${paystackKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // returns created subaccount details
      return {
        subAccountCode: response.data.data.subaccount_code,
        accountNumber: response.data.data.account_number,
        accountName: response.data.data.account_name,
        accountBankName: response.data.data.settlement_bank,
        sortCode: settlementBank,
        percentageCharge: response.data.data.percentage_charge,
        isVerified: response.data.data.is_verified,
        active: response.data.data.active,
      };

    } catch (err: any) {
      console.error('Error creating Paystack subaccount:', err?.response?.data || err.message);
      throw new Error(err?.response?.data?.message || 'Failed to create subaccount');
    }
  }




}
