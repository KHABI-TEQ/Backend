import axios from 'axios';
import { Types } from 'mongoose';
import { DB } from '../controllers';
import { IInspectionBooking, INewTransactionDoc } from '../models';
import notificationService from './notification.service';
import { InspectionLogService } from './inspectionLog.service';
import { generalTemplate, InspectionRequestWithNegotiation, InspectionRequestWithNegotiationSellerTemplate, InspectionTransactionRejectionTemplate } from '../common/email.template';
import sendEmail from '../common/send.email';
import { generalEmailLayout } from '../common/emailTemplates/emailLayout';
import { GenerateVerificationEmailParams, generateVerificationSubmissionEmail } from '../common/emailTemplates/documentVerificationMails';

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

      console.log(data, "verify data resp....")

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
        });

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
    });

    if (!subscription) return;

    if (subscription.status === "pending") {
      const newStatus = transaction.status === "success" ? "active" : "cancelled";

      subscription.status = newStatus
      subscription.save();

      if (transaction.status === "success") {
        
      } else {
        
      }
    }

    return subscription;
  }

   /**
   * Handles the effects of a document verification payment.
   */
  static async handleDocumentVerificationPayment(transaction: any) {
    const docVerification = await DB.Models.DocumentVerification.findOne({
      transaction: transaction._id,
    });

    if (!docVerification) return;

    if (docVerification.status === "pending") {
      const newStatus = transaction.status === "success" ? "successful" : "payment-failed";

      docVerification.status = newStatus;
      docVerification.save();

      if (transaction.status === "success") {
        
        const emailPrams: GenerateVerificationEmailParams = {
            fullName: docVerification.fullName,
            phoneNumber: docVerification.phoneNumber,
            address: docVerification.address,
            amountPaid: docVerification.amountPaid,
            documents: docVerification.documents
        };

        // Send mail
        const mailBody = generalEmailLayout(
            generateVerificationSubmissionEmail(emailPrams)
        )

        await sendEmail({
            to: docVerification.email,
            subject: "Document Verification Submission Received – Under Review",
            html: mailBody,
            text: mailBody,
        });

      } else {
        
      }
    }

    return docVerification;
  }


}
