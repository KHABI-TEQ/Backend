import { RouteError } from "../../common/classes";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import {
  confirmTemplate,
  CounterBuyerTemplate,
  CounterSellerTemplate,
  declineTemplate,
  generalTemplate,
  generatePropertPreferenceBriefEmail,
  generatePropertyPreferenceBriefEmail,
  InspectionAcceptedTemplate,
  InspectionRequestWithNegotiation,
  InspectionRequestWithNegotiationSellerTemplate,
  LOIAcceptedSellerTemplate,
  LOICounterBuyerTemplate,
  LOICounterSellerTemplate,
  LOINegotiationAcceptedTemplate,
  LOIRejectedBuyerTemplate,
  NegotiationAcceptedSellerTemplate,
  NegotiationAcceptedTemplate,
  NegotiationLOIAcceptedSellerTemplate,
  NegotiationLOIRejectedSellerTemplate,
  NegotiationRejectedBuyerTemplate,
  NegotiationRejectedSellerTemplate,
  unavailableTemplate,
} from "../../common/email.template";
import sendEmail from "../../common/send.email";
import mongoose from "mongoose";
import { IInspectionBooking } from "../../models/inspection.booking";


interface UpdateInspectionRequest {
  propertyId: string;
  inspectionDate: Date;
  inspectionTime: string;
  requestedBy: {
    fullName: string;
    phoneNumber: string;
    email: string;
  };
  transaction: {
    bank: string;
    accountNumber: string;
    accountName: string;
    transactionReference: string;
    transactionReceipt: string;
  };
  isNegotiating: boolean;
  negotiationPrice: number;
  letterOfIntention: string;
  sellerCounterOffer?: number;
}


 type UpdateInspectionInput = {
  propertyId?: any;
  inspectionDate?: Date;
  inspectionTime?: string;
  requestedBy?:any;
  transaction?:any;
  isNegotiating?:Boolean;
  negotiationPrice?:Number;
  letterOfIntention?:String;
  status: IInspectionBooking['status']; // strictly typed to valid values
  counterOffer?: number;
  countering?: boolean;
  negotiationRejected?: boolean;
};


class BuyerController {

  public async submitPreference(data: any) {
    try {
      const { email, fullName, phoneNumber, ...preferenceData } = data;

      let buyer = await DB.Models.Buyer.findOne({ email });

      if (!buyer) {
        buyer = await DB.Models.Buyer.create({ email, fullName, phoneNumber });
      }

      const preference = await DB.Models.Preference.create({
        ...preferenceData,
        buyer: buyer._id,
      });


      const mailBody = generatePropertyPreferenceBriefEmail(
        fullName,
        preference
			);

			const generalMailTemplate = generalTemplate(mailBody);

			const adminEmail = process.env.ADMIN_EMAIL || "";

			await sendEmail({
				to:email,
				subject: "New Property Preference",
				text: generalMailTemplate,
				html: generalMailTemplate,
			});
			const mailBody1 = generalTemplate(
				generatePropertPreferenceBriefEmail(data)
			);

      
			await sendEmail({
				to: adminEmail,
				subject: "New Property Preference",
				text: mailBody1,
				html: mailBody1,
			});

      return {
        message: "Preference submitted successfully",
        preference,
      };
    } catch (error) {
      throw new RouteError(
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
        error.message
      );
    }
  }

  public async getBriefMatchesByPreference(preferenceId: string) {
    try {
      const preferenceObjectId = new mongoose.Types.ObjectId(preferenceId);
      const preference = await DB.Models.Preference.findById(
        preferenceObjectId
      );
      if (!preference) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found");
      }

      const briefMatches = await DB.Models.BriefMatch.find({
        preference: preferenceId,
        status: "sent",
      })
        .populate("brief")
        .populate("preference");

    return {
      briefMatches,
    };
  } catch (error) {
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
}
 
  // public async updateInspection(
  //   inspectionId: string,
  //   updateData:UpdateInspectionInput
  // ) {
  //   try {
  //     const inspection = await DB.Models.InspectionBooking.findById(
  //       inspectionId
  //     )
  //       .populate("owner", "email firstName lastName phoneNumber _id")
  //       .populate("propertyId", "title location price propertyType")
  //       .populate("requestedBy", "email fullName phoneNumber _id");

  //     console.log(inspection, "inspection");

  //     if (!inspection) {
  //       throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
  //     }
  //     let buyerTemplate, sellerTemplate;
  //     const sellerName =
  //       (inspection.owner as any)?.fullName ||
  //       (inspection.owner as any)?.firstName;
  //     const buyerName =
  //       (inspection.requestedBy as any)?.fullName ||
  //       (inspection.requestedBy as any)?.firstName;

  //     const formatPrice = (price: number) => price.toLocaleString("en-US");
  //     const mailPayload = {
  //       ...inspection.toObject(),
  //       location: `${(inspection.propertyId as any).location.state}, ${
  //         (inspection.propertyId as any).location.localGovernment
  //       }, ${(inspection.propertyId as any).location.area}`,
  //       price: formatPrice((inspection.propertyId as any).price),
  //       propertyType: (inspection.propertyId as any).propertyType,
  //       sellerCounterOffer: updateData.counterOffer,
  //       newDate: updateData.inspectionDate,
  //       acceptLink: `${
  //         process.env.CLIENT_LINK
  //       }/property/inspection/${inspection._id.toString()}`,
  //       checkLink: `${
  //         process.env.CLIENT_LINK
  //       }/property/inspection/${inspection._id.toString()}`,
  //       browse: `${process.env.CLIENT_LINK}/property/${(
  //         inspection.propertyId as any
  //       )._id.toString()}`,
  //       rejectLink: `${
  //         process.env.CLIENT_LINK
  //       }/property/inspection/${inspection._id.toString()}`,
  //     };

  //     if (updateData.status === "unavailable") {
  //       await DB.Models.InspectionBooking.updateOne(
  //         {
  //           _id: inspectionId,
  //         },
  //         {
  //           status: "unavailable",
  //         }
  //       );

  //       sellerTemplate = unavailableTemplate(sellerName);
  //       buyerTemplate = declineTemplate(buyerName, {
  //         ...inspection.toObject(),
  //       });
  //     } else {
  //       if (inspection.isNegotiating) {
  //         if (!updateData.countering) {
  //           if (updateData.negotiationRejected) {
  //             if (inspection.letterOfIntention) {
  //               sellerTemplate = NegotiationLOIRejectedSellerTemplate(
  //                 (inspection.owner as any)?.firstName,
  //                 mailPayload
  //               );
  //               buyerTemplate = LOIRejectedBuyerTemplate(
  //                 buyerName,
  //                 mailPayload
  //               );
  //             } else {
  //               sellerTemplate = NegotiationRejectedSellerTemplate(
  //                 sellerName || sellerName,
  //                 mailPayload
  //               );
  //               buyerTemplate = NegotiationRejectedBuyerTemplate(
  //                 buyerName,
  //                 mailPayload
  //               );
  //             }
  //           } else {
  //             sellerTemplate = NegotiationAcceptedSellerTemplate(
  //               (inspection.owner as any)?.firstName,
  //               mailPayload
  //             );

  //             buyerTemplate = NegotiationAcceptedTemplate(
  //               buyerName,
  //               mailPayload
  //             );
  //           }
  //         } else {
  //           if (!inspection.letterOfIntention) {
  //             sellerTemplate = CounterSellerTemplate(sellerName, mailPayload);

  //             buyerTemplate = CounterBuyerTemplate(buyerName, mailPayload);
  //           } else {
  //             sellerTemplate = LOICounterSellerTemplate(
  //               sellerName,
  //               mailPayload
  //             );

  //             buyerTemplate = LOICounterBuyerTemplate(buyerName, mailPayload);
  //           }
  //         }
  //       } else {
  //         if (inspection.letterOfIntention) {
  //           sellerTemplate = LOIAcceptedSellerTemplate(sellerName, {
  //             ...inspection.toObject(),
  //           });
  //           buyerTemplate = LOINegotiationAcceptedTemplate(
  //             buyerName,
  //             mailPayload
  //           );
  //         } else {
  //           sellerTemplate = confirmTemplate(sellerName, mailPayload);
  //           buyerTemplate = InspectionAcceptedTemplate(buyerName, mailPayload);
  //         }
  //       }

  //       await DB.Models.InspectionBooking.updateOne(
  //         {
  //           _id: inspectionId,
  //         },
  //         {
  //           inspectionDate: updateData.inspectionDate,
  //           inspectionTime: updateData.inspectionTime,
  //           status: updateData.status,
  //           sellerCounterOffer: updateData.countering
  //             ? updateData.counterOffer
  //             : inspection.sellerCounterOffer,
  //         }
  //       );
  //     }

  //     const sellerEmailTemplate = generalTemplate(sellerTemplate);
  //     const buyerEmailTemplate = generalTemplate(buyerTemplate);
  //     console.log(inspection.requestedBy, "requestedBy");
  //     console.log((inspection.owner as any)?.email, "owner email");

  //     await sendEmail({
  //       to: (inspection.requestedBy as any)?.email,
  //       subject: `Inspection Request Update`,
  //       html: buyerEmailTemplate,
  //       text: buyerEmailTemplate,
  //     });

  //     await sendEmail({
  //       to: (inspection.owner as any)?.email,
  //       subject: `Inspection Request Update`,
  //       html: sellerEmailTemplate,
  //       text: sellerEmailTemplate,
  //     });
  //   } catch (error) {
  //     throw new RouteError(
  //       HttpStatusCodes.INTERNAL_SERVER_ERROR,
  //       error.message
  //     );
  //   }
  // }


  // public async counterOffer(
  //   inspectionId: string,
  //   counterOffer: number,
  //   userId: string,
  //   userType: string,
  //   inspectionDateStatus?: string,
  //   inspectionDate?: string,
  //   inspectionTime?: string,
  //   message?: string,
  // ) {
  //   try {
  //     const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
  //       .populate('owner', 'email firstName lastName phoneNumber _id')
  //       .populate('propertyId', 'title location price propertyType')
  //       .populate('requestedBy', 'email fullName phoneNumber _id');

  //     if (!inspection) {
  //       throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Inspection not found');
  //     }
    
  //     const ownerId = (inspection.owner as any)?._id.toString();
  //     const requestedById = (inspection.requestedBy as any)?._id.toString();
  
  //     // Verify user is either the buyer or seller on this inspection
  //     if (
  //       (userType === 'seller' && ownerId !== userId) ||
  //       (userType === 'buyer' && requestedById !== userId)
  //     ) {
  //       throw new RouteError(HttpStatusCodes.FORBIDDEN, 'You are not authorized to make this counter offer.');
  //     }
  
  //     // Only the party expected to respond can send a counter
  //     if (inspection.pendingResponseFrom !== userType) {
  //       throw new RouteError(HttpStatusCodes.FORBIDDEN, `It is not the ${userType}'s turn to respond.`);
  //     }
 
  //     const originalInspectionDate = inspection.inspectionDate ? new Date(inspection.inspectionDate).toLocaleDateString() : 'N/A';
  //     const originalInspectionTime = inspection.inspectionTime || 'N/A';

  //     const isDateTimeUpdated = (inspectionDate && inspectionDate !== originalInspectionDate) ||
  //                               (inspectionTime && inspectionTime !== originalInspectionTime);

  //     const updateFields: any = {
  //       negotiationPrice: counterOffer,
  //       sellerCounterOffer: userType === 'seller' ? counterOffer : 0,
  //       isNegotiating: true,
  //       status: 'negotiation_countered',
  //       pendingResponseFrom: userType === 'seller' ? 'buyer' : 'seller',
  //       stage: 'negotitation',
  //     };

  //     if (inspectionDate) {
  //       updateFields.inspectionDate = inspectionDate;
  //     }
  //     if (inspectionTime) {
  //       updateFields.inspectionTime = inspectionTime;
  //     }

  //     await DB.Models.InspectionBooking.updateOne(
  //       { _id: inspectionId },
  //       { $set: updateFields }
  //     );

  //     const sellerName = (inspection.owner as any)?.fullName || (inspection.owner as any)?.firstName;
  //     const buyerName = (inspection.requestedBy as any)?.fullName || (inspection.requestedBy as any)?.firstName;
  //     const formatPrice = (price: number) => price.toLocaleString('en-US');

  //     // Generate all links for this inspection
  //     const allLinks = {};

  //     const mailPayload = {
  //       ...inspection.toObject(),
  //       location: `${(inspection.propertyId as any).location.state}, ${
  //         (inspection.propertyId as any).location.localGovernment
  //       }, ${(inspection.propertyId as any).location.area}`,
  //       price: (inspection.propertyId as any).price,
  //       propertyType: (inspection.propertyId as any).propertyType,
  //       sellerCounterOffer: counterOffer,
  //       inspectionDateTime: {
  //         newDateTime: {
  //           newDate: inspectionDate,
  //           newTime: inspectionTime,
  //         },
  //         oldDateTime: {
  //           newDate:  originalInspectionDate,
  //           newTime:  originalInspectionTime,
  //         }
  //       },
  //       isDateTimeUpdated: isDateTimeUpdated,
  //       inspectionDateStatus: inspectionDateStatus,
  //       ...allLinks,
  //     };

  //     let sellerTemplate, buyerTemplate;

  //     if (!inspection.letterOfIntention) {
  //       sellerTemplate = CounterSellerTemplate(sellerName, { ...mailPayload, recipientType: 'seller' });
  //       buyerTemplate = CounterBuyerTemplate(buyerName, { ...mailPayload, recipientType: 'buyer' });
  //     } else {
  //       sellerTemplate = LOICounterSellerTemplate(sellerName, { ...mailPayload, recipientType: 'seller' });
  //       buyerTemplate = LOICounterBuyerTemplate(buyerName, { ...mailPayload, recipientType: 'buyer' });
  //     }

  //     await sendEmail({
  //       to: (inspection.requestedBy as any)?.email, // Email to Buyer
  //       subject: `New Counter Offer Received for Inspection Request`, // Subject for Buyer
  //       html: generalTemplate(buyerTemplate),
  //       text: generalTemplate(buyerTemplate),
  //     });

  //     await sendEmail({
  //       to: (inspection.owner as any)?.email, // Email to Seller (who just made the counter)
  //       subject: `Your Counter Offer Has Been Sent Successfully`, // Subject for Seller
  //       html: generalTemplate(sellerTemplate),
  //       text: generalTemplate(sellerTemplate),
  //     });

  //     return {
  //       message: 'Counter offer submitted successfully.',
  //       inspectionData: {
  //         status: 'negotiation_countered',
  //         pendingResponseFrom: userType === 'seller' ? 'buyer' : 'seller'
  //       },
  //     };

  //   } catch (error: any) {
  //     throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
  //   }
  // }

  // public async acceptOffer(
  //   inspectionId: string,
  //   userId: string,
  //   userType: string,
  //   inspectionDateStatus?: string,
  //   inspectionDate?: string,
  //   inspectionTime?: string,
  // ) {
  //   try {
  //     const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
  //       .populate('owner', 'email firstName lastName phoneNumber _id')
  //       .populate('propertyId', 'title location price propertyType')
  //       .populate('requestedBy', 'email fullName phoneNumber _id');

  //     if (!inspection) {
  //       throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Inspection not found');
  //     }

  //     const ownerId = (inspection.owner as any)?._id.toString();
  //     const requestedById = (inspection.requestedBy as any)?._id.toString();

  //     // Authorization Check
  //     let expectingResp: 'buyer' | 'seller';
  //     if (userType === 'buyer') {
  //       expectingResp = 'seller';
  //         if (requestedById !== userId) {
  //             throw new RouteError(HttpStatusCodes.FORBIDDEN, 'You are not authorized to accept this offer.');
  //         }
  //     } else if (userType === 'seller') {
  //       expectingResp = 'buyer';
  //         if (ownerId !== userId) {
  //             throw new RouteError(HttpStatusCodes.FORBIDDEN, 'You are not authorized to accept this offer.');
  //         }
  //     } else {
  //         throw new RouteError(HttpStatusCodes.FORBIDDEN, 'Unauthorized user type.');
  //     }


  //     const originalInspectionDate = inspection.inspectionDate ? new Date(inspection.inspectionDate).toLocaleDateString() : 'N/A';
  //     const originalInspectionTime = inspection.inspectionTime || 'N/A';

  //     const isDateTimeUpdated = (inspectionDate && inspectionDate !== originalInspectionDate) ||
  //                               (inspectionTime && inspectionTime !== originalInspectionTime);

  //     const updateFields: any = {
  //       status: inspectionDateStatus === 'available' ? 'completed' : 'negotiation_accepted',
  //       isNegotiating: false,
  //       pendingResponseFrom: expectingResp,
  //       stage: inspectionDateStatus !== 'available' ? 'inspection' : 'LOI',
  //     };

  //     if (inspectionDate) {
  //       updateFields.inspectionDate = inspectionDate;
  //     }
  //     if (inspectionTime) {
  //       updateFields.inspectionTime = inspectionTime;
  //     }

  //     await DB.Models.InspectionBooking.updateOne(
  //       { _id: inspectionId },
  //       { $set: updateFields }
  //     );

  //     const sellerName = (inspection.owner as any)?.fullName || (inspection.owner as any)?.firstName;
  //     const buyerName = (inspection.requestedBy as any)?.fullName || (inspection.requestedBy as any)?.firstName;
  //     const formatPrice = (price: number) => price.toLocaleString('en-US');

  //     // Generate all links
  //     const allLinks = {};

  //     const mailPayload = {
  //       ...inspection.toObject(),
  //       location: `${(inspection.propertyId as any).location.state}, ${
  //         (inspection.propertyId as any).location.localGovernment
  //       }, ${(inspection.propertyId as any).location.area}`,
  //       price: formatPrice((inspection.propertyId as any).price),
  //       propertyType: (inspection.propertyId as any).propertyType,
  //       inspectionDateTime: {
  //         newDateTime: {
  //           newDate: inspectionDate,
  //           newTime: inspectionTime,
  //         },
  //         oldDateTime: {
  //           newDate:  originalInspectionDate,
  //           newTime:  originalInspectionTime,
  //         }
  //       },
  //       isDateTimeUpdated: isDateTimeUpdated,
  //       inspectionDateStatus: inspectionDateStatus,
  //       ...allLinks,
  //     };

  //     let sellerTemplate, buyerTemplate;

  //     // Logic based on WHO accepted the offer
  //     if (userType === 'buyer') {
  //         if (inspection.letterOfIntention) {
  //             buyerTemplate = LOINegotiationAcceptedTemplate(buyerName, { ...mailPayload, recipientType: 'buyer' });
  //             sellerTemplate = LOIAcceptedSellerTemplate(sellerName, { ...mailPayload, recipientType: 'seller' });
  //         } else {
  //             buyerTemplate = NegotiationAcceptedTemplate(buyerName, { ...mailPayload, recipientType: 'buyer' });
  //             sellerTemplate = NegotiationAcceptedSellerTemplate(sellerName, { ...mailPayload, recipientType: 'seller' });
  //         }
  //     } else if (userType === 'seller') {
  //         if (inspection.letterOfIntention) {
  //           // This case might be more complex if seller accepts LOI specifically
  //           sellerTemplate = LOIAcceptedSellerTemplate(sellerName, { ...mailPayload, recipientType: 'seller' });
  //           buyerTemplate = LOINegotiationAcceptedTemplate(buyerName, { ...mailPayload, recipientType: 'buyer' });
  //         } else {
  //           sellerTemplate = confirmTemplate(sellerName, { ...mailPayload, recipientType: 'seller' }); // Seller confirms acceptance of buyer's request
  //           buyerTemplate = InspectionAcceptedTemplate(buyerName, { ...mailPayload, recipientType: 'buyer' }); // Buyer is notified of acceptance
  //         }
  //     }

  //     await sendEmail({
  //       to: (inspection.requestedBy as any)?.email,
  //       subject: `Offer Accepted for Inspection Request`,
  //       html: generalTemplate(buyerTemplate),
  //       text: generalTemplate(buyerTemplate),
  //     });

  //     await sendEmail({
  //       // to: "gatukurh1+4@gmail.com",
  //       to: (inspection.owner as any)?.email, // Send to actual owner
  //       subject: `Your Offer Has Been Accepted`,
  //       html: generalTemplate(sellerTemplate),
  //       text: generalTemplate(sellerTemplate),
  //     });

  //     return {
  //       message: 'Offer accepted successfully.',
  //       inspectionData: {
  //         status: inspectionDateStatus === 'available' ? 'completed' : 'negotiation_accepted',
  //         pendingResponseFrom: expectingResp
  //       },
  //     };
  //   } catch (error: any) {
  //     throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
  //   }
  // }

  // public async rejectOffer(
  //   inspectionId: string,
  //   userId: string,
  //   userType: string,
  //   inspectionDateStatus?: string,
  //   inspectionDate?: string,
  //   inspectionTime?: string,
  //   rejectionReason?: string,
  // ) {
  //   try {
  //     const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
  //       .populate('owner', 'email firstName lastName phoneNumber _id')
  //       .populate('propertyId', 'title location price propertyType')
  //       .populate('requestedBy', 'email fullName phoneNumber _id');

  //     if (!inspection) {
  //       throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Inspection not found');
  //     }

  //     const ownerId = (inspection.owner as any)?._id.toString();
  //     const requestedById = (inspection.requestedBy as any)?._id.toString();

  //     let expectingResp: 'buyer' | 'seller';

  //     // Authorization Check
  //     if (userType === 'buyer') {
  //       expectingResp = 'seller';
  //         if (requestedById !== userId) {
  //             throw new RouteError(HttpStatusCodes.FORBIDDEN, 'You are not authorized to reject this offer.');
  //         }
  //     } else if (userType === 'seller') {
  //       expectingResp = 'buyer';
  //         if (ownerId !== userId) {
  //             throw new RouteError(HttpStatusCodes.FORBIDDEN, 'You are not authorized to reject this offer.');
  //         }
  //     } else {
  //         throw new RouteError(HttpStatusCodes.FORBIDDEN, 'Unauthorized user type.');
  //     }


  //     const originalInspectionDate = inspection.inspectionDate ? new Date(inspection.inspectionDate).toLocaleDateString() : 'N/A';
  //     const originalInspectionTime = inspection.inspectionTime || 'N/A';

  //     const isDateTimeUpdated = (inspectionDate && inspectionDate !== originalInspectionDate) ||
  //                               (inspectionTime && inspectionTime !== originalInspectionTime);

  //     const updateFields: any = {
  //       isNegotiating: false,
  //       status: inspectionDateStatus === 'unavailable' ? 'cancelled' : 'offer_rejected',
  //       stage: 'inspection',
  //       pendingResponseFrom: expectingResp
  //     };

  //     if (inspectionDate) {
  //       updateFields.inspectionDate = inspectionDate;
  //     }
  //     if (inspectionTime) {
  //       updateFields.inspectionTime = inspectionTime;
  //     }

  //     await DB.Models.InspectionBooking.updateOne(
  //       { _id: inspectionId },
  //       { $set: updateFields }
  //     );

  //     const sellerName = (inspection.owner as any)?.fullName || (inspection.owner as any)?.firstName;
  //     const buyerName = (inspection.requestedBy as any)?.fullName || (inspection.requestedBy as any)?.firstName;
  //     const formatPrice = (price: number) => price.toLocaleString('en-US');

  //     // Generate all links
  //     const allLinks = {};

  //     const mailPayload = {
  //       ...inspection.toObject(),
  //       location: `${(inspection.propertyId as any).location.state}, ${
  //         (inspection.propertyId as any).location.localGovernment
  //       }, ${(inspection.propertyId as any).location.area}`,
  //       price: formatPrice((inspection.propertyId as any).price),
  //       propertyType: (inspection.propertyId as any).propertyType,
  //       inspectionDateTime: {
  //         newDateTime: {
  //           newDate: inspectionDate,
  //           newTime: inspectionTime,
  //         },
  //         oldDateTime: {
  //           newDate:  originalInspectionDate,
  //           newTime:  originalInspectionTime,
  //         }
  //       },
  //       rejectionReason: rejectionReason,
  //       isDateTimeUpdated: isDateTimeUpdated,
  //       inspectionDateStatus: inspectionDateStatus,
  //       ...allLinks,
  //     };

  //     let sellerTemplate, buyerTemplate;

  //     // Logic based on WHO rejected the offer
  //     if (userType === 'buyer') {
  //         // Buyer rejected (likely a seller's counter-offer)
  //         // Buyer gets confirmation, Seller gets notification
  //         if (inspection.letterOfIntention) {
  //             buyerTemplate = LOIRejectedBuyerTemplate(buyerName, { ...mailPayload, recipientType: 'buyer' });
  //             sellerTemplate = NegotiationLOIRejectedSellerTemplate(sellerName, { ...mailPayload, recipientType: 'seller' });
  //         } else {
  //             buyerTemplate = NegotiationRejectedBuyerTemplate(buyerName, { ...mailPayload, recipientType: 'buyer' });
  //             sellerTemplate = NegotiationRejectedSellerTemplate(sellerName, { ...mailPayload, recipientType: 'seller' });
  //         }
  //     } else if (userType === 'seller') {
  //         // Seller rejected (likely the buyer's initial offer)
  //         // Seller gets confirmation, Buyer gets notification
  //         if (inspection.letterOfIntention) {
  //             sellerTemplate = NegotiationLOIRejectedSellerTemplate(sellerName, { ...mailPayload, recipientType: 'seller' });
  //             buyerTemplate = LOIRejectedBuyerTemplate(buyerName, { ...mailPayload, recipientType: 'buyer' });
  //         } else {
  //             sellerTemplate = NegotiationRejectedSellerTemplate(sellerName, { ...mailPayload, recipientType: 'seller' });
  //             buyerTemplate = NegotiationRejectedBuyerTemplate(buyerName, { ...mailPayload, recipientType: 'buyer' });
  //         }
  //     }

  //     await sendEmail({
  //       to: (inspection.requestedBy as any)?.email,
  //       subject: `Offer Rejected for Inspection Request`,
  //       html: generalTemplate(buyerTemplate),
  //       text: generalTemplate(buyerTemplate),
  //     });

  //     await sendEmail({
  //       // to: "gatukurh1+4@gmail.com",
  //       to: (inspection.owner as any)?.email, // Send to actual owner
  //       subject: `Your Offer Has Been Rejected`,
  //       html: generalTemplate(sellerTemplate),
  //       text: generalTemplate(sellerTemplate),
  //     });

  //     return {
  //       message: 'Offer rejected successfully.',
  //       inspectionData: {
  //         status: inspectionDateStatus === 'unavailable' ? 'cancelled' : 'offer_rejected',
  //         pendingResponseFrom: expectingResp
  //       },
  //     };
  //   } catch (error: any) {
  //     throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
  //   }
  // }

}

export const buyerController = new BuyerController();
