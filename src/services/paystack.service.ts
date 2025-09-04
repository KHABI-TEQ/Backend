import axios from 'axios';
import { Types } from 'mongoose';
import { DB } from '../controllers';
import { IInspectionBooking, INewTransactionDoc } from '../models';
import notificationService from './notification.service';
import { InspectionLogService } from './inspectionLog.service';
import { generalTemplate, InspectionRequestWithNegotiation, InspectionRequestWithNegotiationSellerTemplate, InspectionTransactionRejectionTemplate } from '../common/email.template';
import sendEmail from '../common/send.email';
import { generalEmailLayout } from '../common/emailTemplates/emailLayout';
import { generateThirdPartyVerificationEmail, GenerateVerificationEmailParams, generateVerificationSubmissionEmail } from '../common/emailTemplates/documentVerificationMails';
import { generateSubscriptionFailureEmail, generateSubscriptionSuccessEmail } from '../common/emailTemplates/subscriptionMails';
import { SystemSettingService } from './systemSetting.service';
import { AccountService } from './account.service';
import { PaymentMethodService } from './paymentMethod.service';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export class PaystackService {
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
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
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
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
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
      const response = await axios.get(
        `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
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

      // Execute type-specific logic (send mail, etc.)
      const dynamicResponse = await PaystackService.handleTransactionTypeEffect(updatedTx);
 
      return {
        verified: data.status === 'success',
        transaction: updatedTx,
        dynamicType: dynamicResponse,
        reason: data.status !== 'success' ? data.gateway_response : undefined,
      };
    } catch (error: any) {
      console.error('Paystack verification error:', error?.response?.data || error.message);
      return { verified: false, reason: 'verification_failed' };
    }
  }

   /**
   * Triggers side effects based on the transaction type
   */
  static async handleTransactionTypeEffect(tx: INewTransactionDoc) {
    const { transactionType, status, fromWho, amount } = tx;

    switch (transactionType) {
      case 'inspection':
        return await PaystackService.handleInspectionPaymentEffect(tx);

      case 'document-verification':
        return await PaystackService.handleDocumentVerificationPayment(tx);

      case 'subscription':
        return await PaystackService.handleSubscriptionPayment(tx);

      // Add more transaction types here...
      default:
        console.warn(`Unhandled transaction type: ${transactionType}`);
        return null;
    }
  }

  /**
   * Handles the side effects of a successful or failed inspection payment.
   */
  static async handleInspectionPaymentEffect(transaction: INewTransactionDoc) {
      const inspection = await DB.Models.InspectionBooking.findOne({
        transaction: transaction._id,
      }).populate("requestedBy").populate("propertyId").populate("owner");
 
      if (!inspection) return;

      if (inspection.status === "pending_transaction") {

          let updatedStatus: IInspectionBooking["status"];
          let updatedStage: IInspectionBooking["stage"];
          let pendingResponseFrom: IInspectionBooking["pendingResponseFrom"];

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
          };

          if (transaction.status === "success") {

              const isPrice = inspection.inspectionType === "price";
              const isLOI = inspection.inspectionType === "LOI";
              const hasNegotiationPrice = inspection.negotiationPrice > 0;
              const hasLOIDocument =
                  inspection.letterOfIntention &&
                  inspection.letterOfIntention.trim() !== "";

              if (isPrice) {
                  inspection.isNegotiating = hasNegotiationPrice;
                  updatedStage = hasNegotiationPrice ? "negotiation" : "inspection";
              } else if (isLOI) {
                  inspection.isLOI = !!hasLOIDocument;
                  updatedStage = hasLOIDocument ? "negotiation" : "inspection";
              }

              pendingResponseFrom = "seller";
              updatedStatus = inspection.isNegotiating
                  ? "negotiation_countered"
                  : "active_negotiation";
              
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
              
              const buyerEmailHtml = InspectionRequestWithNegotiation(
                  buyer.fullName,
                  emailData,
              );
              
              const sellerEmailHtml = InspectionRequestWithNegotiationSellerTemplate(
                  owner.fullName || owner.firstName,
                  {
                      ...emailData,
                      responseLink: `${process.env.CLIENT_LINK}/secure-seller-response/${owner._id}/${inspection._id.toString()}`,
                  },
              );
              
              await sendEmail({
                  to: buyer.email,
                  subject: `Inspection Request Submitted`,
                  html: generalTemplate(buyerEmailHtml),
                  text: generalTemplate(buyerEmailHtml),
              });

              await sendEmail({
                  to: owner.email,
                  subject: `New Offer Received – Action Required`,
                  html: generalTemplate(sellerEmailHtml),
                  text: generalTemplate(sellerEmailHtml),
              });

              const propertyLocation = `${property.location.area}, ${property.location.localGovernment}, ${property.location.state}`;
              
              await notificationService.createNotification({
                  user: owner._id,
                  title: "New Inspection Request",
                  message: `${buyer.fullName} has requested an inspection for your property at ${propertyLocation}.`,
                  meta: {
                      propertyId: property._id,
                      inspectionId: inspection._id,
                      status: updatedStatus,
                  },
              });
              

          } else {

              updatedStatus = "transaction_failed";
              updatedStage = "cancelled";
              pendingResponseFrom = "admin";
              // send mail to buyer only
              const buyerRejectionHtml = InspectionTransactionRejectionTemplate(
                  buyer.fullName,
                  {
                      ...emailData,
                      rejectionReason:
                      "Your inspection request was not approved. Please contact support for more info.",
                  },
              );
              
              await sendEmail({
                  to: buyer.email,
                  subject: `Inspection Request Rejected`,
                  html: generalTemplate(buyerRejectionHtml),
                  text: generalTemplate(buyerRejectionHtml),
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

          inspection.pendingResponseFrom = pendingResponseFrom;
          inspection.status = updatedStatus;
          inspection.stage = updatedStage;

          await inspection.save();
      }

      return inspection;
  }

  /**
 * Handles the side effects of a subscription payment.
 */
  static async handleSubscriptionPayment(transaction: any) {
    const subscription = await DB.Models.Subscription.findOne({
      transaction: transaction._id,
    }).populate("user"); // so we can get user email, name

    if (!subscription) return;

    if (subscription.status === "pending") {
      const newStatus = transaction.status === "success" ? "active" : "cancelled";

      const plan = await DB.Models.SubscriptionPlan.findOne({ code: subscription.plan });
      if (!plan) return null;

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + plan.durationInDays);

      subscription.status = newStatus;
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      await subscription.save();

      // =======================
      // Subscription Mails
      // =======================
      const user = subscription.user as any; // populated user
      const fullName = `${user.firstName} ${user.lastName}`;

      if (transaction.status === "success") {

        // create auto renewal authorization
        if (subscription.autoRenew) {
          await PaymentMethodService.createPaymentMethod({
            userId: user._id,
            type: transaction.paymentMode,
            authorizationCode: transaction.paymentDetails.authorization.authorization_code,
            last4: transaction.paymentDetails.authorization.last4,
            expMonth: transaction.paymentDetails.authorization.exp_month,
            expYear: transaction.paymentDetails.authorization.exp_year,
            brand: transaction.paymentDetails.authorization.card_type,
            bank: transaction.paymentDetails.authorization.bank,
            reusable: transaction.paymentDetails.authorization.reusable,
            customerCode: transaction.paymentDetails.customer.customer_code,
            isDefault: true,
          });
        }
        
        // create public link
        const userPublicURL = await AccountService.createPublicUrl(user._id);
        const publicAccessCompleteLink = `${process.env.FRONTEND_URL}/pv-account/${userPublicURL}`;

        const successMailBody = generalEmailLayout(
          generateSubscriptionSuccessEmail({
            fullName,
            planName: plan.name,
            amount: transaction.amount / 100, // if Paystack stores in kobo
            nextBillingDate: endDate.toDateString(),
            transactionRef: transaction.reference,
            publicAccessLink: publicAccessCompleteLink,
          })
        );

        await sendEmail({
          to: user.email,
          subject: "Subscription Renewed Successfully",
          html: successMailBody,
          text: successMailBody,
        });

      } else {
        const failureMailBody = generalEmailLayout(
          generateSubscriptionFailureEmail({
            fullName,
            planName: plan.name,
            amount: transaction.amount / 100,
            transactionRef: transaction.reference,
            retryLink: `${process.env.FRONTEND_URL}/billing/retry?subId=${subscription._id}`,
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

    return subscription;
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
        const newStatus =
          transaction.status === "success" ? "payment-approved" : "payment-failed";
        docVerification.status = newStatus;

        const buyerData = docVerification.buyerId as any;

        if (transaction.status === "success") {
          // Generate a 6-digit unique code
          const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
          docVerification.accessCode.token = accessCode;

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
            subject:
              "Document Verification Submission Received – Under Review",
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
              message:
                "Please review the submitted documents and confirm verification status.",
              accessCode: accessCode,
              accessLink: `${process.env.CLIENT_LINK}/third-party-verification/${docVerification._id}`,
            })
          );

          await sendEmail({
            to: recipientEmail,
            subject: docType === "survey-plan"
              ? "New Survey Plan Verification Request"
              : "New Document Verification Request",
            html: thirdPartyEmailHTML,
            text: `A new document verification request has been submitted.\n\nAccess Code: ${accessCode}\nAccess Link: ${process.env.CLIENT_LINK}/third-party-verification/${docVerification._id}`,
          });
        }

        await docVerification.save();
      }
    }

    return docVerifications;
  }


}
