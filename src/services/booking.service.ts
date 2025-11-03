import { Types } from "mongoose";
import { DB } from '../controllers';
import { IBookingDoc } from "../models";
import { generalEmailLayout } from '../common/emailTemplates/emailLayout';
import sendEmail from '../common/send.email';

export class BookingService {


  
   /**
   * Fetch bookings made by a buyer
   */
  public static async sendBookingRequestMail(
    buyer: any,
    seller: any,
    bookingDetails: any,
    property: any
  ){
    
  }


  /**
   * Fetch bookings where the user is the property owner
   */
  public static async fetchMyBookingRequestsAsOwner(
    ownerId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ data: IBookingDoc[]; total: number; page: number; limit: number }> {
    const query = { propertyOwnerId: new Types.ObjectId(ownerId) };

    const total = await DB.Models.Booking.countDocuments(query);
    const data = await DB.Models.Booking
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total, page, limit };
  }

  /**
   * Fetch bookings made by a buyer
   */
  public static async fetchMyBookingRequestAsBuyer(
    buyerId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ data: IBookingDoc[]; total: number; page: number; limit: number }> {
    const query = { bookedBy: new Types.ObjectId(buyerId) };

    const total = await DB.Models.Booking.countDocuments(query);
    const data = await DB.Models.Booking
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total, page, limit };
  }

  /**
   * Login to see booking request as buyer using bookingCode + passCode
   */
  public static async loginToSeeBookingReuestBuyer(
    bookingCode: string,
    passCode: string
  ): Promise<IBookingDoc | null> {
    const booking = await DB.Models.Booking.findOne({
      bookingCode,
      passCode,
    });

    return booking;
  }

  /**
   * Remind owner of booking request validation
   * (e.g., send notification or trigger email)
   */
  public static async remindOwnerOfRequestValidation(
    bookingId: string
  ): Promise<boolean> {
    const booking = await DB.Models.Booking.findById(bookingId).populate("propertyOwnerId");
    if (!booking) throw new Error("Booking not found");

    // 🔔 Example: send email/notification to propertyOwnerId
    // await NotificationService.sendBookingReminder(booking.propertyOwnerId, booking);

    return true;
  }

  /**
   * Owner accepts or rejects booking request
   */
  public static async acceptOrRejectBookingRequestOwner(
    bookingId: string,
    ownerId: string,
    decision: "accepted" | "declined",
    note?: string
  ): Promise<IBookingDoc> {
    const booking = await DB.Models.Booking.findOne({
      _id: new Types.ObjectId(bookingId),
      propertyOwnerId: new Types.ObjectId(ownerId),
    });

    if (!booking) throw new Error("Booking not found or unauthorized");

    booking.ownerResponse = {
      response: decision,
      respondedAt: new Date(),
      note: note || null,
    };

    booking.status = decision === "accepted" ? "confirmed" : "cancelled";

    await booking.save();
    return booking;
  }
}
