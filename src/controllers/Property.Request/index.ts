import { agentNotificationTemplate, generalTemplate, inspectionScheduledTemplate } from '../../common/email.template';
import { DB } from '..';
import sendEmail from '../../common/send.email';
import path from 'path';
import { propertyRequestTemplate } from '../../common/email.template';
import { RouteError } from '../../common/classes';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { ObjectId } from 'mongoose';

interface IPropertyRequest {
  propertyId: any;
  requestFrom: {
    fullName: string;
    phoneNumber: string;
    email: string;
  };
  propertyType: 'PropertySell' | 'PropertyRent';
}

export interface IPropertRequestController {
  requestProperty: (PropertyRequest: IPropertyRequest) => Promise<void>;
}

export class PropertyRequestController implements IPropertRequestController {
  public async requestProperty(PropertyRequest: IPropertyRequest): Promise<void> {
    const { propertyId, requestFrom, propertyType } = PropertyRequest;

    if (propertyType !== 'PropertySell' && propertyType !== 'PropertyRent') {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid property type');
    }
    const property = await DB.Models[propertyType]
      .findById(propertyId)
      .populate({
        path: 'owner',
        select: 'email fullName firstName',
      })
      .exec();
    if (!property) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Property not found');
    }

    if (property.ownerModel === 'BuyerOrRenter') {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'You cannot request this property');
    }

    if (!property.isAvailable) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Property not available');
    }

    let requestFrm = await DB.Models.BuyerOrRent.findOne({ email: requestFrom.email }).exec();
    let request;

    if (!requestFrm) {
      requestFrm = await DB.Models.BuyerOrRent.create({
        ...requestFrom,
        ownerType: propertyType === 'PropertySell' ? 'Buyer' : 'Rent',
      });
    }

    request = await DB.Models.PropertyRequest.findOne({ propertyId, requestFrom: requestFrm._id }).exec();
    console.log(request);

    if (request) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'You have already requested an inspection for this property');
    }

    await DB.Models.PropertyRequest.create({
      propertyId,
      requestFrom: requestFrm._id,
      status: 'Pending',
      propertyModel: propertyType,
    });

    const mailBodyAgent = agentNotificationTemplate(
      ((property?.owner as any)?.firstName as string) || (property?.owner as any)?.fullName,
      `${property.location.area}, ${property?.location?.localGovernment}, ${property?.location?.state}`
    );

    const mailBodyRequester = propertyRequestTemplate(
      requestFrom?.fullName,
      `${property?.location?.area}, ${property?.location?.localGovernment}, ${property?.location?.state}`
    );

    // const adminMailBody =

    const mailAgent = generalTemplate(mailBodyAgent);
    const mailRequester = generalTemplate(mailBodyRequester);

    await sendEmail({
      to: (property.owner as any)?.email,
      subject: 'Inspection Request Confirmed – Action Required',
      text: 'Inspection Request Confirmed – Action Required',
      html: mailAgent,
    });

    await sendEmail({
      to: requestFrom?.email,
      subject: 'Your Inspection Request is Being Processed',
      text: 'Your Inspection Request is Being Processed',
      html: mailRequester,
    });
  }

  public async scheduleInspection(
    propertyRequestId: string,
    inspectionDate: Date,
    slotId: ObjectId,
    inspectionTime: string
  ): Promise<any> {
    const propertyRequest = await DB.Models.PropertyRequest.findById(propertyRequestId).exec();
    if (!propertyRequest) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Property Request not found');
    }

    const property = await DB.Models[propertyRequest.propertyModel]
      .findById(propertyRequest.propertyId)
      .populate({
        path: 'owner',
        select: 'email fullName',
      })
      .exec();

    if (!property || !property.isAvailable) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Property not available');
    }

    const slot = await DB.Models.InspectionSlot.findById(slotId).exec();

    if (!slot) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid slot');
    }

    // If the same slot is already booked, return
    console.log(propertyRequest.slotId?.toString() === slotId.toString());
    if (propertyRequest.slotId?.toString() === slotId.toString()) {
      return { success: true, message: 'You have already booked this slot.' };
    }

    // Prevent slot overbooking (Ensure bookedCount < 6)
    if (slot.bookedCount >= 6) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Slot is full');
    }

    // If there was a previously booked slot, mark it as available again
    if (propertyRequest.slotId) {
      const previousSlot = await DB.Models.InspectionSlot.findById(propertyRequest.slotId).exec();
      if (previousSlot) {
        await DB.Models.InspectionSlot.findByIdAndUpdate(propertyRequest.slotId, {
          slotStatus: 'available',
          bookedCount: Math.max(0, previousSlot.bookedCount - 1), // Ensure it doesn't go below 0
        }).exec();
      }
    }

    // Update the new slot as booked
    await DB.Models.InspectionSlot.findByIdAndUpdate(slotId, {
      slotStatus: slot.bookedCount + 1 === 6 ? 'full' : 'booked', // If it reaches 6, mark it full
      $inc: { bookedCount: 1 },
    }).exec();

    // Update PropertyRequest
    propertyRequest.inspectionDate = inspectionDate;
    propertyRequest.slotId = slotId;
    propertyRequest.inspectionTime = inspectionTime;
    await propertyRequest.save();

    // Send Email Notification
    const mailBody = generalTemplate(
      inspectionScheduledTemplate(
        (property.owner as any).email as string,
        `${property.location.area}, ${property.location.localGovernment}, ${property.location.state}`,
        inspectionDate as any
      )
    );

    await sendEmail({
      to: (property.owner as any).email,
      subject: `Inspection Scheduled for ${property.location.area}, ${property.location.localGovernment}, ${property.location.state}`,
      text: `Inspection Scheduled for ${property.location.area}, ${property.location.localGovernment}, ${property.location.state}`,
      html: mailBody,
    });

    return { success: true, message: 'Inspection scheduled successfully' };
  }
}
