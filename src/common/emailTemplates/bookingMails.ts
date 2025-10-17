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
  pageLink?: string;
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
    <p>Your booking request has been submitted successfully. The host will review the availability of the property.</p>
    <ul>
      <li><strong>Booking Code:</strong> ${bookingCode}</li>
      <li><strong>Property:</strong> ${propertyTitle}</li>
      <li><strong>Check-in:</strong> ${new Date(checkInDateTime).toLocaleString()}</li>
      <li><strong>Check-out:</strong> ${new Date(checkOutDateTime).toLocaleString()}</li>
    </ul>
    <p>You will be notified once the host reviews the property.</p>
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
  pageLink,
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
    <p>
      <a href="${pageLink}" target="_blank" 
         style="display:inline-block;padding:10px 18px;background-color:#007BFF;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;">
        Review Booking Request
      </a>
    </p>
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
  // Payment message only if property is available
  const paymentMessage =
    status === "available"
      ? `<p>The property is available! You can find the payment link on the booking details page.</p>`
      : "";

  return `
  <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">
    <p>Dear ${buyerName},</p>
    <p>Your booking request has been reviewed for the property <strong>${propertyTitle}</strong>:</p>
    <ul>
      <li><strong>Booking Code:</strong> ${bookingCode}</li>
      <li><strong>Check-in:</strong> ${new Date(checkInDateTime).toLocaleString()}</li>
      <li><strong>Check-out:</strong> ${new Date(checkOutDateTime).toLocaleString()}</li>
    </ul>

    ${paymentMessage}

    <p>To view your booking status and payment details, please visit the following page and enter your booking code:</p>
    <p><a href="${paymentLink} style="color:#0066cc;text-decoration:none;">Check Booking Details</a></p>

    <hr />
    <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply.</p>
  </div>
  `;
};
