import { RouteError } from '../../common/classes';
import { DB } from '..';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { generalTemplate, InspectionRequestWithNegotiation } from '../../common/email.template';
import sendEmail from '../../common/send.email';

interface InspectionRequest {
  propertyId: string;
  // propertyModel: string;
  //   bookedBy: string;
  //   bookedByModel: string;
  inspectionDate: Date;
  inspectionTime: string;
  status: string;
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
}

class BuyerController {
  public async requestInspection(inspectionRequestData: InspectionRequest) {
    try {
      const property = await DB.Models.Property.findOne({
        _id: inspectionRequestData.propertyId,
      }).populate('owner', 'email fullName phoneNumber');
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
        status: inspectionRequestData.status,
        requestedBy: buyer._id,
        transaction: transaction._id,
        isNegotiating: inspectionRequestData.isNegotiating,
        negotiationPrice: inspectionRequestData.negotiationPrice,
        letterOfIntention: inspectionRequestData.letterOfIntention,
      });

      const mailTemplate = InspectionRequestWithNegotiation(inspectionRequestData.requestedBy.fullName, {
        ...inspectionRequestData,
        location: `${property.location.state}, ${property.location.localGovernment}, ${property.location.area}`,
        price: property.price,
        propertyType: property.propertyType,
        agentName: (property.owner as any).fullName,
      });

      const generalEmailTemplate = generalTemplate(mailTemplate);

      await sendEmail({
        to: inspectionRequestData.requestedBy.email,
        // cc: property.owner.email,
        subject: ` Inspection Request for ${property.propertyType} in ${property.location.state}`,
        html: generalEmailTemplate,
        text: generalEmailTemplate,
      });

      return {
        message: 'Inspection request created successfully',
        inspectionId: inspection._id.toString(),
      };
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }
}

export const buyerController = new BuyerController();
