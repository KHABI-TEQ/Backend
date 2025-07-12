import { InspectionActionData, ActionResult, EmailData, UpdateData, AcceptUpdateData, RejectUpdateData, CounterUpdateData, RequestChangesUpdateData } from "../types/inspection.types";

export class InspectionActionHandler {
  private generateInspectionLinks(
    inspectionId: string,
    buyerId: string,
    ownerId: string
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
    ownerId: string
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

      case "request_changes":
        return this.handleRequestChanges(
          actionData,
          inspection,
          senderName,
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
    // Determine stage based on current stage and date/time presence
    let stage: "inspection" | "completed";
    
    if (inspection.stage === "inspection") {
      // If already in inspection stage, move to completed
      stage = "completed";
    } else {
      // For both price and LOI: if no date/time in payload, go to completed; otherwise go to inspection
      const hasDateTime = actionData.inspectionDate || actionData.inspectionTime;
      stage = hasDateTime ? "inspection" : "completed";
    }

    const update: AcceptUpdateData = {
      inspectionType: actionData.inspectionType,
      isLOI: actionData.inspectionType === "LOI",
      status: "negotiation_accepted",
      inspectionStatus: "accepted",
      isNegotiating: false,
      stage,
      pendingResponseFrom: undefined,
    };

    const baseSubject = `${actionData.inspectionType === "price" ? "Price Offer" : "Letter of Intent"} Accepted`;
    const emailSubject = dateTimeChanged ? `${baseSubject} – Inspection Date Updated` : baseSubject;
    const logMessage = `${senderName} accepted the ${actionData.inspectionType} offer${dateTimeChanged ? " with updated inspection date/time" : ""}`;

    const emailData: EmailData = {
      propertyType: (inspection.propertyId as any).propertyType,
      location: (inspection.propertyId as any).location,
      price: (inspection.propertyId as any).price,
      negotiationPrice: inspection.negotiationPrice,
      inspectionDateStatus: "available",
      buyerResponseLink: this.generateInspectionLinks(inspectionId, buyerId, ownerId).buyerResponseLink,
      inspectionDateTime: {
        dateTimeChanged,
        newDateTime: {
          newDate: actionData.inspectionDate || inspection.inspectionDate,
          newTime: actionData.inspectionTime || inspection.inspectionTime,
        },
        oldDateTime: dateTimeChanged ? {
          newDate: inspection.inspectionDate,
          oldTime: inspection.inspectionTime,
        } : undefined,
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
      inspectionStatus: "rejected",
      isNegotiating: false,
      stage: "cancelled",
      reason: actionData.reason || actionData.rejectionReason,
      pendingResponseFrom: undefined,
    };

    const baseSubject = `${actionData.inspectionType === "price" ? "Price Offer" : "Letter of Intent"} Rejected`;
    const emailSubject = dateTimeChanged ? `${baseSubject} – Inspection Date Updated` : baseSubject;
    const logMessage = `${senderName} rejected the ${actionData.inspectionType} offer${update.reason ? `: ${update.reason}` : ""}`;

    const emailData: EmailData = {
      propertyType: (inspection.propertyId as any).propertyType,
      location: (inspection.propertyId as any).location,
      price: (inspection.propertyId as any).price,
      reason: update.reason,
      checkLink: this.generateInspectionLinks(inspectionId, buyerId, ownerId)
        .checkLink,
      buyerResponseLink: this.generateInspectionLinks(inspectionId, buyerId, ownerId).buyerResponseLink,
      rejectLink: this.generateInspectionLinks(inspectionId, buyerId, ownerId)
        .rejectLink,
      browseLink: this.generateInspectionLinks(inspectionId, buyerId, ownerId)
        .browseLink,
      inspectionDateTime: {
        dateTimeChanged,
        newDateTime: {
          newDate: actionData.inspectionDate || inspection.inspectionDate,
          newTime: actionData.inspectionTime || inspection.inspectionTime,
        },
        oldDateTime: dateTimeChanged ? {
          newDate: inspection.inspectionDate,
          oldTime: inspection.inspectionTime,
        } : undefined,
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
    const update: CounterUpdateData = {
      inspectionType: actionData.inspectionType,
      isLOI: actionData.inspectionType === "LOI",
      status: "negotiation_countered",
      inspectionStatus: "countered",
      isNegotiating: true,
      pendingResponseFrom: isSeller ? "buyer" : "seller",
      stage: "negotiation", // Always negotiation for counter offers
    };

    let logMessage = "";
    if (actionData.inspectionType === "price") {
      update.negotiationPrice = actionData.counterPrice;
      logMessage = `${senderName} made a counter offer of ₦${actionData.counterPrice?.toLocaleString()}${dateTimeChanged ? " and updated inspection date/time" : ""}`;
    } else {
      update.letterOfIntention = actionData.documentUrl;
      logMessage = `${senderName} uploaded a new LOI document${dateTimeChanged ? " and updated inspection date/time" : ""}`;
    }

    const baseSubject = "Counter Offer Received";
    const emailSubject = dateTimeChanged ? `${baseSubject} – New Inspection Time Proposed` : baseSubject;
    const emailData: EmailData = {
      propertyType: (inspection.propertyId as any).propertyType,
      location: (inspection.propertyId as any).location,
      price: (inspection.propertyId as any).price,
      negotiationPrice: inspection.negotiationPrice,
      sellerCounterOffer: actionData.counterPrice,
      documentUrl: actionData.documentUrl,
      inspectionDateStatus: "available",
      buyerResponseLink: this.generateInspectionLinks(
        inspectionId,
        buyerId,
        ownerId,
      ).buyerResponseLink,
      inspectionDateTime: {
        dateTimeChanged,
        newDateTime: {
          newDate: actionData.inspectionDate || inspection.inspectionDate,
          newTime: actionData.inspectionTime || inspection.inspectionTime,
        },
        oldDateTime: dateTimeChanged ? {
          newDate: inspection.inspectionDate,
          oldTime: inspection.inspectionTime,
        } : undefined,
      },
    };

    return { update, logMessage, emailSubject, emailData };
  }

  private handleRequestChanges(
    actionData: InspectionActionData,
    inspection: any,
    senderName: string,
    dateTimeChanged: boolean,
    inspectionId: string,
    buyerId: string,
    ownerId: string,
  ): ActionResult {
    const update: RequestChangesUpdateData = {
      inspectionType: actionData.inspectionType,
      isLOI: actionData.inspectionType === "LOI",
      status: "negotiation_countered",
      inspectionStatus: "requested_changes",
      reason: actionData.reason,
      isNegotiating: false,
      stage: "negotiation", // Changed from "LOI" to "negotiation" as per requirements
      pendingResponseFrom: "buyer",
    };

    const baseSubject = "Changes Requested for Letter of Intent";
    const emailSubject = dateTimeChanged ? `${baseSubject} – Inspection Date Updated` : baseSubject;
    const logMessage = `${senderName} requested changes to the LOI: ${actionData.reason}${dateTimeChanged ? " and updated inspection date/time" : ""}`;

    const emailData: EmailData = {
      propertyType: (inspection.propertyId as any).propertyType,
      location: (inspection.propertyId as any).location,
      reason: actionData.reason,
      buyerResponseLink: this.generateInspectionLinks(inspectionId, buyerId, ownerId).buyerResponseLink,
      inspectionDateTime: {
        dateTimeChanged,
        newDateTime: {
          newDate: actionData.inspectionDate || inspection.inspectionDate,
          newTime: actionData.inspectionTime || inspection.inspectionTime,
        },
        oldDateTime: dateTimeChanged ? {
          newDate: inspection.inspectionDate,
          oldTime: inspection.inspectionTime,
        } : undefined,
      },
    };

    return { update, logMessage, emailSubject, emailData };
  }
}