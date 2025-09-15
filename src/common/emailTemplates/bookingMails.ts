// bookingMails.ts
import { kebabToTitleCase } from "../../utils/helper";

export interface BookingDetails {
  bookingCode: string;
  propertyTitle: string;
  checkInDateTime: string | Date;
  checkOutDateTime: string | Date;
  duration?: number;
  totalAmount?: number;
  buyerName?: string;
  sellerName?: string;
  status?: "available" | "not-available";
  paymentLink?: string; // Only if booking is available
}

/**
 * 1️⃣ Successful Booking Receipt — Buyer
 */
export const generateSuccessfulBookingReceiptForBuyer = ({
  buyerName,
  bookingCode,
  propertyTitle,
  checkInDateTime,
  checkOutDateTime,
  duration,
  totalAmount,
}: BookingDetails): string => {
  return `
  <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">
    <p>Dear ${buyerName},</p>
    <p>Your booking has been successfully confirmed! Here are the details:</p>
    <ul>
      <li><strong>Booking Code:</strong> ${bookingCode}</li>
      <li><strong>Property:</strong> ${propertyTitle}</li>
      <li><strong>Check-in:</strong> ${new Date(checkInDateTime).toLocaleString()}</li>
      <li><strong>Check-out:</strong> ${new Date(checkOutDateTime).toLocaleString()}</li>
      <li><strong>Duration:</strong> ${duration} night(s)</li>
      <li><strong>Total Amount:</strong> ₦${totalAmount?.toLocaleString()}</li>
    </ul>
    <p>Thank you for choosing our service.</p>
    <hr />
    <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply.</p>
  </div>
  `;
};

/**
 * 2️⃣ Successful Booking Receipt — Seller
 */
export const generateSuccessfulBookingReceiptForSeller = ({
  sellerName,
  bookingCode,
  propertyTitle,
  checkInDateTime,
  checkOutDateTime,
  duration,
  totalAmount,
  buyerName,
}: BookingDetails): string => {
  return `
  <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">
    <p>Dear ${sellerName},</p>
    <p>A booking has been successfully made for your property. Here are the details:</p>
    <ul>
      <li><strong>Booking Code:</strong> ${bookingCode}</li>
      <li><strong>Property:</strong> ${propertyTitle}</li>
      <li><strong>Check-in:</strong> ${new Date(checkInDateTime).toLocaleString()}</li>
      <li><strong>Check-out:</strong> ${new Date(checkOutDateTime).toLocaleString()}</li>
      <li><strong>Duration:</strong> ${duration} night(s)</li>
      <li><strong>Total Amount:</strong> ₦${totalAmount?.toLocaleString()}</li>
      <li><strong>Booked By:</strong> ${buyerName}</li>
    </ul>
    <p>Please prepare the property for the incoming guest.</p>
    <hr />
    <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply.</p>
  </div>
  `;
};

/**
 * 3️⃣ Booking Request Acknowledgement — Buyer
 */
export const generateBookingRequestAcknowledgementForBuyer = ({
  buyerName,
  bookingCode,
  propertyTitle,
  checkInDateTime,
  checkOutDateTime,
}: BookingDetails): string => {
  return `
  <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">
    <p>Dear ${buyerName},</p>
    <p>Your booking request has been submitted successfully. The seller will review the availability of the property.</p>
    <ul>
      <li><strong>Booking Code:</strong> ${bookingCode}</li>
      <li><strong>Property:</strong> ${propertyTitle}</li>
      <li><strong>Check-in:</strong> ${new Date(checkInDateTime).toLocaleString()}</li>
      <li><strong>Check-out:</strong> ${new Date(checkOutDateTime).toLocaleString()}</li>
    </ul>
    <p>You will be notified once the seller reviews the property.</p>
    <hr />
    <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply.</p>
  </div>
  `;
};

/**
 * 4️⃣ Booking Request Received — Seller
 */
export const generateBookingRequestReceivedForSeller = ({
  sellerName,
  bookingCode,
  propertyTitle,
  checkInDateTime,
  checkOutDateTime,
  buyerName,
}: BookingDetails): string => {
  return `
  <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">
    <p>Dear ${sellerName},</p>
    <p>A new booking request has been submitted. Please review the property availability:</p>
    <ul>
      <li><strong>Booking Code:</strong> ${bookingCode}</li>
      <li><strong>Property:</strong> ${propertyTitle}</li>
      <li><strong>Check-in:</strong> ${new Date(checkInDateTime).toLocaleString()}</li>
      <li><strong>Check-out:</strong> ${new Date(checkOutDateTime).toLocaleString()}</li>
      <li><strong>Requested By:</strong> ${buyerName}</li>
    </ul>
    <p>Kindly review and update the status so the buyer can proceed.</p>
    <hr />
    <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply.</p>
  </div>
  `;
};

/**
 * 5️⃣ Booking Request Reviewed — Buyer
 */
export const generateBookingRequestReviewedForBuyer = ({
  buyerName,
  bookingCode,
  propertyTitle,
  checkInDateTime,
  checkOutDateTime,
  status,
  paymentLink,
}: BookingDetails): string => {
  const statusMessage =
    status === "available"
      ? `The property is available! You can now proceed to make the payment.${
          paymentLink
            ? ` <br /><a href="${paymentLink}" style="color:#0066cc;text-decoration:none;">Click here to pay</a>`
            : ""
        }`
      : "Unfortunately, the property is not available for the requested dates.";

  return `
  <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">
    <p>Dear ${buyerName},</p>
    <p>Your booking request has been reviewed:</p>
    <ul>
      <li><strong>Booking Code:</strong> ${bookingCode}</li>
      <li><strong>Property:</strong> ${propertyTitle}</li>
      <li><strong>Check-in:</strong> ${new Date(checkInDateTime).toLocaleString()}</li>
      <li><strong>Check-out:</strong> ${new Date(checkOutDateTime).toLocaleString()}</li>
      <li><strong>Status:</strong> ${statusMessage}</li>
    </ul>
    <hr />
    <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply.</p>
  </div>
  `;
};
