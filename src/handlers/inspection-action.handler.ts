import {
  InspectionActionData,
  ActionResult,
  EmailData,
  AcceptUpdateData,
  RejectUpdateData,
  CounterUpdateData,
} from "../types/inspection.types";

export class InspectionActionHandler {
  private generateInspectionLinks(
    inspectionId: string,
    buyerId: string,
    ownerId: string,
  ) {
    const clientLink = process.env.CLIENT_LINK || "http://localhost:3000";
    const inspectionIdStr = inspectionId.toString();

    return {
      sellerResponseLink: `${clientLink}/secure-seller-response/${ownerId}/${inspectionIdStr}`,
      buyerResponseLink: `${clientLink}/secure-buyer-response/${buyerId}/${inspectionIdStr}`,
      negotiationResponseLink: `${clientLink}/secure-seller-response/${ownerId}/${inspectionIdStr}`,
      checkLink: `${clientLink}/secure-buyer-response/${buyerId}/${inspectionIdStr}/check`,
      browseLink: `${clientLink}/market-place`,
      rejectLink: `${clientLink}/secure-buyer-response/${buyerId}/${inspectionIdStr}/reject`,
    };
  }

  public handleAction(
    actionData: InspectionActionData,
    inspection: any,
    senderName: string,
    isSeller: boolean,
    dateTimeChanged: boolean,
    inspectionId: string,
    buyerId: string,
    ownerId: string,
  ): ActionResult {
    switch (actionData.action) {
      case "accept":
        return this.handleAccept(
          actionData,
          inspection,
          senderName,
          dateTimeChanged,
          inspectionId,
          buyerId,
          ownerId,
        );

      case "reject":
        return this.handleReject(
          actionData,
          inspection,
          senderName,
          inspectionId,
          buyerId,
          ownerId,
          dateTimeChanged,
        );

      case "counter":
        return this.handleCounter(
          actionData,
          inspection,
          senderName,
          isSeller,
          dateTimeChanged,
          inspectionId,
          buyerId,
          ownerId,
        );

      default:
        throw new Error("Invalid action");
    }
  }

  private handleAccept(
    actionData: InspectionActionData,
    inspection: any,
    senderName: string,
    dateTimeChanged: boolean,
    inspectionId: string,
    buyerId: string,
    ownerId: string,
  ): ActionResult {
    const update: AcceptUpdateData = {
      inspectionType: actionData.inspectionType,
      isLOI: actionData.inspectionType === "LOI",
      status: "negotiation_accepted",
      inspectionStatus: dateTimeChanged ? "countered" : "accepted",
      isNegotiating: false,
      stage: "inspection",
      pendingResponseFrom: actionData.userType === "buyer" ? "seller" : "buyer",
      inspectionMode: actionData.inspectionMode,
    };

    const modeChanged = actionData.inspectionMode && actionData.inspectionMode !== inspection.inspectionMode;

    const baseSubject = `${
      actionData.inspectionType === "price" ? "Price Offer" : "Letter of Intent"
    } Accepted`;

    const emailSubject =
      dateTimeChanged && modeChanged
        ? `${baseSubject} – Inspection Date & Mode Updated`
        : dateTimeChanged
        ? `${baseSubject} – Inspection Date Updated`
        : modeChanged
        ? `${baseSubject} – Inspection Mode Updated`
        : baseSubject;

    const logMessage = `${senderName} accepted the ${actionData.inspectionType} offer${
      dateTimeChanged && modeChanged
        ? " with updated inspection date and mode"
        : dateTimeChanged
        ? " with updated inspection date/time"
        : modeChanged
        ? " with updated inspection mode"
        : ""
    }`;

    const respLink = this.generateInspectionLinks(
      inspectionId,
      buyerId,
      ownerId,
    );

    const emailData: EmailData = {
      propertyType: (inspection.propertyId as any).propertyType,
      location: (inspection.propertyId as any).location,
      price: (inspection.propertyId as any).price,
      negotiationPrice: inspection.negotiationPrice,
      inspectionDateStatus: "available",
      responseLink: actionData.userType == "buyer" ? respLink.sellerResponseLink : respLink.buyerResponseLink,
      inspectionMode: actionData.inspectionMode,
      modeChanged,
      inspectionDateTime: {
        dateTimeChanged,
        newDateTime: {
          newDate: actionData.inspectionDate || inspection.inspectionDate,
          newTime: actionData.inspectionTime || inspection.inspectionTime,
        },
        oldDateTime: dateTimeChanged
          ? {
              newDate: inspection.inspectionDate,
              oldTime: inspection.inspectionTime,
            }
          : undefined,
      },
    };

    return { update, logMessage, emailSubject, emailData };
  }

  private handleReject(
    actionData: InspectionActionData,
    inspection: any,
    senderName: string,
    inspectionId: string,
    buyerId: string,
    ownerId: string,
    dateTimeChanged: boolean,
  ): ActionResult {
    const update: RejectUpdateData = {
      inspectionType: actionData.inspectionType,
      isLOI: actionData.inspectionType === "LOI",
      status: "negotiation_rejected",
      inspectionStatus: dateTimeChanged ? "countered" : "accepted",
      isNegotiating: false,
      stage: "inspection",
      reason: actionData.rejectionReason,
      pendingResponseFrom: actionData.userType === "buyer" ? "seller" : "buyer",
      inspectionMode: actionData.inspectionMode,
    };

    const modeChanged = actionData.inspectionMode && actionData.inspectionMode !== inspection.inspectionMode;

    const baseSubject = actionData.inspectionType === "price" ? "Price Offer Rejected" : "Letter of Intent Rejected";

    const emailSubject =
      dateTimeChanged && modeChanged
        ? `${baseSubject} – Inspection Date & Mode Updated`
        : dateTimeChanged
        ? `${baseSubject} – Inspection Date Updated`
        : modeChanged
        ? `${baseSubject} – Inspection Mode Updated`
        : baseSubject;

    const reasonSuffix = update.reason ? `: ${update.reason}` : "";

    const logMessage = `${senderName} rejected the ${actionData.inspectionType} offer${reasonSuffix}${
      dateTimeChanged || modeChanged ? ` and updated inspection ${dateTimeChanged && modeChanged ? "date and mode" : dateTimeChanged ? "date" : "mode"}` : ""
    }`;


    const respLink = this.generateInspectionLinks(
      inspectionId,
      buyerId,
      ownerId,
    );

    const emailData: EmailData = {
      propertyType: (inspection.propertyId as any).propertyType,
      location: (inspection.propertyId as any).location,
      price: (inspection.propertyId as any).price,
      reason: update.reason,
      checkLink: this.generateInspectionLinks(inspectionId, buyerId, ownerId)
        .checkLink,
      responseLink: actionData.userType == "buyer" ? respLink.sellerResponseLink : respLink.buyerResponseLink,
      rejectLink: this.generateInspectionLinks(inspectionId, buyerId, ownerId)
        .rejectLink,
      browseLink: this.generateInspectionLinks(inspectionId, buyerId, ownerId)
        .browseLink,
      inspectionMode: actionData.inspectionMode,
      modeChanged,
      inspectionDateTime: {
        dateTimeChanged,
        newDateTime: {
          newDate: actionData.inspectionDate || inspection.inspectionDate,
          newTime: actionData.inspectionTime || inspection.inspectionTime,
        },
        oldDateTime: dateTimeChanged
          ? {
              newDate: inspection.inspectionDate,
              oldTime: inspection.inspectionTime,
            }
          : undefined,
      },
    };

    return { update, logMessage, emailSubject, emailData };
  }

  private handleCounter(
    actionData: InspectionActionData,
    inspection: any,
    senderName: string,
    isSeller: boolean,
    dateTimeChanged: boolean,
    inspectionId: string,
    buyerId: string,
    ownerId: string,
  ): ActionResult {
    // Increment the counterCount. If it doesn't exist, initialize to 1.
    const newCounterCount = (inspection.counterCount || 0) + 1;
 
    const update: CounterUpdateData = {
      inspectionType: actionData.inspectionType,
      isLOI: false,
      status: "negotiation_countered",
      inspectionStatus: dateTimeChanged ? "countered" : "accepted",
      isNegotiating: true,
      pendingResponseFrom: isSeller ? "buyer" : "seller",
      stage:
      inspection.stage === "inspection"
      ? "inspection"
      : typeof actionData.counterPrice === "number" &&
        !isNaN(actionData.counterPrice) &&
        actionData.counterPrice > 0
      ? "negotiation"
      : inspection.stage || "inspection",
      counterCount: newCounterCount,
      inspectionMode: actionData.inspectionMode,
    };

    let logMessage = "";

    const modeChanged = actionData.inspectionMode && actionData.inspectionMode !== inspection.inspectionMode;

    if (actionData.inspectionType === "price") {
      if (typeof actionData.counterPrice === "number" && !isNaN(actionData.counterPrice)) {
        update.negotiationPrice = actionData.counterPrice;
        logMessage = `${senderName} made counter offer #${newCounterCount} of ₦${actionData.counterPrice.toLocaleString()}${dateTimeChanged ? " and updated inspection date/time" : ""}${modeChanged ? " and changed inspection mode" : ""}`;
      } else if (dateTimeChanged || modeChanged) {
        logMessage = `${senderName} countered with${dateTimeChanged ? " updated inspection date/time" : ""}${modeChanged ? (dateTimeChanged ? " and" : "") + " changed inspection mode" : ""}`;
      } else {
        logMessage = `${senderName} initiated a counter without price or schedule change`; // fallback
      }
    }

    const baseSubject = `Counter Offer #${newCounterCount} Received`;

    const emailSubject =
      dateTimeChanged && modeChanged
        ? `${baseSubject} – New Inspection Time & Mode Proposed`
        : dateTimeChanged
        ? `${baseSubject} – New Inspection Time Proposed`
        : modeChanged
        ? `${baseSubject} – New Inspection Mode Proposed`
        : baseSubject;

    const respLink = this.generateInspectionLinks(
      inspectionId,
      buyerId,
      ownerId,
    );

    const emailData: EmailData = {
      propertyType: (inspection.propertyId as any).propertyType,
      location: (inspection.propertyId as any).location,
      price: (inspection.propertyId as any).price,
      negotiationPrice: inspection.negotiationPrice,
      sellerCounterOffer: actionData.counterPrice,
      inspectionDateStatus: "available",
      inspectionMode: actionData.inspectionMode,
      modeChanged,
      responseLink:
        actionData.userType == "buyer"
          ? respLink.sellerResponseLink
          : respLink.buyerResponseLink,
      inspectionDateTime: {
        dateTimeChanged,
        newDateTime: {
          newDate: actionData.inspectionDate || inspection.inspectionDate,
          newTime: actionData.inspectionTime || inspection.inspectionTime,
        },
        oldDateTime: dateTimeChanged
          ? {
              newDate: inspection.inspectionDate,
              oldTime: inspection.inspectionTime,
            }
          : undefined,
      },
      counterCount: newCounterCount, // Pass the counter count to email data
    };

    return { update, logMessage, emailSubject, emailData };
  }
}
