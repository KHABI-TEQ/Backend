import { RouteError } from '../../common/classes';
import { DB } from '..';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import {
  confirmTemplate,
  CounterBuyerTemplate,
  CounterSellerTemplate,
  declineTemplate,
  generalTemplate,
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
} from '../../common/email.template';
import sendEmail from '../../common/send.email';

interface InspectionRequest {
  propertyId: string;
  // propertyModel: string;
  //   bookedBy: string;
  //   bookedByModel: string;
  inspectionDate: Date;
  inspectionTime: string;
  //   slotId: string;
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

class BuyerController {
  public async requestInspection(inspectionRequestData: InspectionRequest) {
    try {
      const property = await DB.Models.Property.findOne({
        _id: inspectionRequestData.propertyId,
      }).populate('owner', 'email fullName phoneNumber _id');
      if (!property) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Property Not Found');
      }
      let buyer = await DB.Models.Buyer.findOne({
        email: inspectionRequestData.requestedBy.email,
      });
      if (!buyer) {
        buyer = await DB.Models.Buyer.create({
          fullName: inspectionRequestData.requestedBy.fullName,
          email: inspectionRequestData.requestedBy.email,
          phoneNumber: inspectionRequestData.requestedBy.phoneNumber,
        });
      }

      const existingInspection = await DB.Models.InspectionBooking.findOne({
        propertyId: inspectionRequestData.propertyId as any,
        requestedBy: buyer._id,
        status: { $ne: 'unavailable' }, // Exclude unavailable inspections
      });

      if (existingInspection) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'You have already requested an inspection for this property');
      }

      console.log(buyer, 'buyer');

      // check the date and time of the inspection if valid
      const inspectionDate = new Date(inspectionRequestData.inspectionDate);
      const currentDate = new Date();
      if (inspectionDate < currentDate) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Inspection date cannot be in the past');
      }

      const transaction = await DB.Models.Transaction.create({
        buyerId: buyer._id, // ObjectId of the buyer
        bank: inspectionRequestData.transaction.bank,
        accountNumber: inspectionRequestData.transaction.accountNumber,
        accountName: inspectionRequestData.transaction.accountName,
        transactionReference: inspectionRequestData.transaction.transactionReference,
        transactionReceipt: inspectionRequestData.transaction.transactionReceipt,
        propertyId: inspectionRequestData.propertyId, // ObjectId of the property
      });

      const inspection = await DB.Models.InspectionBooking.create({
        propertyId: inspectionRequestData.propertyId,
        inspectionDate: inspectionRequestData.inspectionDate,
        inspectionTime: inspectionRequestData.inspectionTime,
        status: 'pending',
        requestedBy: buyer._id,
        transaction: transaction._id,
        isNegotiating: inspectionRequestData.isNegotiating,
        negotiationPrice: inspectionRequestData.negotiationPrice,
        letterOfIntention: inspectionRequestData.letterOfIntention,
        owner: (property.owner as any)._id, // ObjectId of the property owner
      });

      const mailTemplate = InspectionRequestWithNegotiation(inspectionRequestData.requestedBy.fullName, {
        ...inspectionRequestData,
        location: `${property.location.state}, ${property.location.localGovernment}, ${property.location.area}`,
        price: property.price,
        propertyType: property.propertyType,
        agentName: (property.owner as any).fullName,
      });

      const sellerTemplate = InspectionRequestWithNegotiationSellerTemplate((property.owner as any).fullName, {
        ...inspectionRequestData,
        location: `${property.location.state}, ${property.location.localGovernment}, ${property.location.area}`,
        price: property.price,
        propertyType: property.propertyType,
        responseLink: `${process.env.CLIENT_LINK}/seller-negotiation-inspection/${inspection._id.toString()}`,
      });

      const sellerEmailTemplate = generalTemplate(sellerTemplate);

      const generalEmailTemplate = generalTemplate(mailTemplate);

      await sendEmail({
        to: inspectionRequestData.requestedBy.email,
        // cc: property.owner.email,
        subject: `New Offer Received – Action Required`,
        html: generalEmailTemplate,
        text: generalEmailTemplate,
      });

      await sendEmail({
        to: (property.owner as any).email,
        subject: `Inspection Request submitted`,
        html: sellerEmailTemplate,
        text: sellerEmailTemplate,
      });

      return {
        message: 'Inspection request created successfully',
        inspectionId: inspection._id.toString(),
      };
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async getInspection(inspectionId: string, userId?: string) {
    const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
      .populate('propertyId', 'title location price propertyType briefType _id owner')
      .populate('requestedBy', 'fullName email phoneNumber')
      .populate('transaction', 'bank accountNumber accountName transactionReference transactionReceipt');

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Inspection not found');
    }

    console.log(inspection, 'inspection details');

    if (userId && (inspection.propertyId as any).owner.toString() !== userId.toString()) {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, 'You do not have permission to view this inspection');
    }

    return inspection;
  }

  public async updateInspection(
    inspectionId: string,
    updateData: Partial<InspectionRequest> & {
      status: string;
      counterOffer?: number;
      countering?: boolean;
      negotiationRejected?: boolean;
    }
  ) {
    try {
      const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
        .populate('owner', 'email firstName lastName phoneNumber _id')
        .populate('propertyId', 'title location price propertyType')
        .populate('requestedBy', 'email fullName phoneNumber _id');

      console.log(inspection, 'inspection');

      if (!inspection) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Inspection not found');
      }
      let buyerTemplate, sellerTemplate;
      const sellerName = (inspection.owner as any)?.fullName || (inspection.owner as any)?.firstName;
      const buyerName = (inspection.requestedBy as any)?.fullName || (inspection.requestedBy as any)?.firstName;

      const mailPayload = {
        ...inspection.toObject(),
        location: `${(inspection.propertyId as any).location.state}, ${
          (inspection.propertyId as any).location.localGovernment
        }, ${(inspection.propertyId as any).location.area}`,
        price: (inspection.propertyId as any).price,
        propertyType: (inspection.propertyId as any).propertyType,
        sellerCounterOffer: updateData.counterOffer,
        newDate: updateData.inspectionDate,
        acceptLink: `${process.env.CLIENT_LINK}/property/inspection/${inspection._id.toString()}`,
        checkLink: `${process.env.CLIENT_LINK}/property/inspection/${inspection._id.toString()}`,
        browse: `${process.env.CLIENT_LINK}/property/${(inspection.propertyId as any)._id.toString()}`,
        rejectLink: `${process.env.CLIENT_LINK}/property/inspection/${inspection._id.toString()}`,
      };

      if (updateData.status === 'unavailable') {
        await DB.Models.InspectionBooking.updateOne(
          {
            _id: inspectionId,
          },
          {
            status: 'unavailable',
          }
        );

        sellerTemplate = unavailableTemplate(sellerName);
        buyerTemplate = declineTemplate(buyerName, {
          ...inspection.toObject(),
        });
      } else {
        if (inspection.isNegotiating) {
          if (!updateData.countering) {
            if (updateData.negotiationRejected) {
              if (inspection.letterOfIntention) {
                sellerTemplate = NegotiationLOIRejectedSellerTemplate(
                  (inspection.owner as any)?.firstName,
                  mailPayload
                );
                buyerTemplate = LOIRejectedBuyerTemplate(buyerName, mailPayload);
              } else {
                sellerTemplate = NegotiationRejectedSellerTemplate(sellerName || sellerName, mailPayload);
                buyerTemplate = NegotiationRejectedBuyerTemplate(buyerName, mailPayload);
              }
            } else {
              sellerTemplate = NegotiationAcceptedSellerTemplate((inspection.owner as any)?.firstName, mailPayload);

              buyerTemplate = NegotiationAcceptedTemplate(buyerName, mailPayload);
            }
          } else {
            if (!inspection.letterOfIntention) {
              sellerTemplate = CounterSellerTemplate(sellerName, mailPayload);

              buyerTemplate = CounterBuyerTemplate(buyerName, mailPayload);
            } else {
              sellerTemplate = LOICounterSellerTemplate(sellerName, mailPayload);

              buyerTemplate = LOICounterBuyerTemplate(buyerName, mailPayload);
            }
          }
        } else {
          if (inspection.letterOfIntention) {
            sellerTemplate = LOIAcceptedSellerTemplate(sellerName, {
              ...inspection.toObject(),
            });
            buyerTemplate = LOINegotiationAcceptedTemplate(buyerName, mailPayload);
          } else {
            sellerTemplate = confirmTemplate(sellerName, mailPayload);
            buyerTemplate = InspectionAcceptedTemplate(buyerName, mailPayload);
          }
        }

        await DB.Models.InspectionBooking.updateOne(
          {
            _id: inspectionId,
          },
          {
            inspectionDate: updateData.inspectionDate,
            inspectionTime: updateData.inspectionTime,
            status: updateData.status,
            sellerCounterOffer: updateData.countering ? updateData.counterOffer : inspection.sellerCounterOffer,
          }
        );
      }

      const sellerEmailTemplate = generalTemplate(sellerTemplate);
      const buyerEmailTemplate = generalTemplate(buyerTemplate);
      console.log(inspection.requestedBy, 'requestedBy');
      console.log((inspection.owner as any)?.email, 'owner email');

      await sendEmail({
        to: (inspection.requestedBy as any)?.email,
        subject: `Inspection Request Update`,
        html: buyerEmailTemplate,
        text: buyerEmailTemplate,
      });

      await sendEmail({
        to: (inspection.owner as any)?.email,
        subject: `Inspection Request Update`,
        html: sellerEmailTemplate,
        text: sellerEmailTemplate,
      });
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }
}

export const buyerController = new BuyerController();
