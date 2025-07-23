import {
  InspectionActionData,
  SubmitInspectionPayload,
} from "../types/inspection.types";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";

export class InspectionValidator {
  // Pure validation function for InspectionActionData
  static validateInspectionActionData(data: any): {
    success: boolean;
    data?: InspectionActionData;
    error?: string;
  } {
    const {
      action,
      inspectionType,
      userType,
      counterPrice,
      inspectionDate,
      inspectionTime,
      reason,
      rejectionReason,
      documentUrl,
    } = data;

    if (!["accept", "reject", "counter", "request_changes"].includes(action)) {
      return {
        success: false,
        error:
          "Action must be one of: accept, reject, counter, request_changes",
      };
    }

    if (!["price", "LOI"].includes(inspectionType)) {
      return {
        success: false,
        error: "Inspection type must be either price or LOI",
      };
    }

    if (!["buyer", "seller"].includes(userType)) {
      return {
        success: false,
        error: "User type must be either buyer or seller",
      };
    }

    if (
      action === "counter" &&
      inspectionType === "price" &&
      typeof counterPrice !== "number"
    ) {
      return {
        success: false,
        error: "Counter price is required for price negotiations",
      };
    }

    if (
      action === "counter" &&
      inspectionType === "LOI" &&
      (!documentUrl || typeof documentUrl !== "string")
    ) {
      return {
        success: false,
        error: "Document URL is required for LOI counter offers",
      };
    }

    // Basic URL format check, can be expanded for stricter validation
    if (
      documentUrl &&
      typeof documentUrl === "string" &&
      !/^https?:\/\/\S+$/.test(documentUrl)
    ) {
      return {
        success: false,
        error: "Document URL must be a valid URL format",
      };
    }

    if (action === "request_changes" && inspectionType !== "LOI") {
      return {
        success: false,
        error: "Request changes action is only available for LOI inspections",
      };
    }

    if (action === "request_changes" && !reason) {
      return {
        success: false,
        error: "Reason is required when requesting changes",
      };
    }

    if (inspectionDate && typeof inspectionDate !== "string") {
      return { success: false, error: "Inspection date must be a string" };
    }

    if (inspectionTime && typeof inspectionTime !== "string") {
      return { success: false, error: "Inspection time must be a string" };
    }

    if (reason && typeof reason !== "string") {
      return { success: false, error: "Reason must be a string" };
    }

    if (rejectionReason && typeof rejectionReason !== "string") {
      return { success: false, error: "Rejection reason must be a string" };
    }

    return {
      success: true,
      data: {
        action,
        inspectionType,
        userType,
        counterPrice,
        inspectionDate,
        inspectionTime,
        reason,
        rejectionReason,
        documentUrl,
      },
    };
  }

  // Pure validation function for SubmitInspectionPayload
  static validateSubmitInspectionPayload(data: any): {
    success: boolean;
    data?: SubmitInspectionPayload;
    error?: string;
  } {
    const {
      inspectionType,
      inspectionDate,
      inspectionTime,
      requestedBy,
      transaction,
      properties,
    } = data;

    if (!["price", "LOI"].includes(inspectionType)) {
      return {
        success: false,
        error: "Inspection type must be either price or LOI",
      };
    }

    if (typeof inspectionDate !== "string" || inspectionDate.trim() === "") {
      return {
        success: false,
        error: "Inspection date is required and must be a string",
      };
    }

    if (typeof inspectionTime !== "string" || inspectionTime.trim() === "") {
      return {
        success: false,
        error: "Inspection time is required and must be a string",
      };
    }

    if (!requestedBy || typeof requestedBy !== "object") {
      return { success: false, error: "RequestedBy object is required" };
    }
    if (
      typeof requestedBy.fullName !== "string" ||
      requestedBy.fullName.trim() === ""
    ) {
      return { success: false, error: "RequestedBy fullName is required" };
    }
    if (
      typeof requestedBy.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedBy.email)
    ) {
      return {
        success: false,
        error: "RequestedBy email is required and must be a valid email format",
      };
    }
    if (
      typeof requestedBy.phoneNumber !== "string" ||
      requestedBy.phoneNumber.trim() === ""
    ) {
      return { success: false, error: "RequestedBy phoneNumber is required" };
    }

    if (!transaction || typeof transaction !== "object") {
      return { success: false, error: "Transaction object is required" };
    }
    if (
      typeof transaction.fullName !== "string" ||
      transaction.fullName.trim() === ""
    ) {
      return { success: false, error: "Transaction fullName is required" };
    }
    if (
      typeof transaction.transactionReceipt !== "string" ||
      !/^https?:\/\/\S+$/.test(transaction.transactionReceipt)
    ) {
      return {
        success: false,
        error: "Transaction receipt is required and must be a valid URL",
      };
    }

    if (!Array.isArray(properties) || properties.length === 0) {
      return {
        success: false,
        error: "Properties array is required and cannot be empty",
      };
    }

    for (const prop of properties) {
      if (!prop || typeof prop !== "object") {
        return {
          success: false,
          error: "Each property in the array must be an object",
        };
      }
      if (
        typeof prop.propertyId !== "string" ||
        prop.propertyId.trim() === ""
      ) {
        return {
          success: false,
          error: "Property ID is required for each property",
        };
      }
      if (
        prop.negotiationPrice !== undefined &&
        typeof prop.negotiationPrice !== "number"
      ) {
        return {
          success: false,
          error: "Negotiation price must be a number if provided",
        };
      }
      if (
        prop.letterOfIntention !== undefined &&
        (typeof prop.letterOfIntention !== "string" ||
          !/^https?:\/\/\S+$/.test(prop.letterOfIntention))
      ) {
        return {
          success: false,
          error: "Letter of intention must be a valid URL if provided",
        };
      }
      // Validate inspectionMode
      if (
        prop.inspectionMode &&
        !["in_person", "virtual", "developer_visit"].includes(
          prop.inspectionMode,
        )
      ) {
        return {
          success: false,
          error: "Invalid inspection mode for a property",
        };
      }
    }

    return {
      success: true,
      data: {
        inspectionType,
        inspectionDate,
        inspectionTime,
        requestedBy,
        transaction,
        properties,
      },
    };
  }

  static validateActionRequirements(actionData: InspectionActionData) {
    if (
      actionData.action === "counter" &&
      actionData.inspectionType === "price" &&
      !actionData.counterPrice
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Counter price is required for price negotiations",
      );
    }

    if (
      actionData.action === "counter" &&
      actionData.inspectionType === "LOI" &&
      !actionData.documentUrl
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Document URL is required for LOI counter offers",
      );
    }

    if (
      actionData.action === "request_changes" &&
      actionData.inspectionType !== "LOI"
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Request changes action is only available for LOI inspections",
      );
    }

    if (actionData.action === "request_changes" && !actionData.reason) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Reason is required when requesting changes",
      );
    }
  }
}
