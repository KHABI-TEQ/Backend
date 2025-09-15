import {
  InspectionActionData,
  SubmitInspectionPayload,
} from "../types/inspection.types";

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
      rejectionReason,
      inspectionMode,
    } = data;

    if (!["accept", "reject", "counter"].includes(action)) {
      return {
        success: false,
        error:
          "Action must be one of: accept, reject, counter",
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

    if (!["in_person", "virtual"].includes(inspectionMode)) {
      return {
        success: false,
        error:
          "Inspection Mode must be one of: In Person, Virtual",
      };
    }


    if (inspectionDate && typeof inspectionDate !== "string") {
      return { success: false, error: "Inspection date must be a string" };
    }

    if (inspectionTime && typeof inspectionTime !== "string") {
      return { success: false, error: "Inspection time must be a string" };
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
        rejectionReason,
        inspectionMode,
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
      requestedBy,
      inspectionDetails,
      inspectionAmount,
      properties,
    } = data;

    // Validate requestedBy
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

    // Validate inspectionDetails
    if (!inspectionDetails || typeof inspectionDetails !== "object") {
      return { success: false, error: "InspectionDetails object is required" };
    }
    if (
      typeof inspectionDetails.inspectionDate !== "string" ||
      inspectionDetails.inspectionDate.trim() === ""
    ) {
      return {
        success: false,
        error: "Inspection date is required and must be a string",
      };
    }
    if (
      typeof inspectionDetails.inspectionTime !== "string" ||
      inspectionDetails.inspectionTime.trim() === ""
    ) {
      return {
        success: false,
        error: "Inspection time is required and must be a string",
      };
    }
    if (
      inspectionDetails.inspectionMode &&
      !["in_person", "virtual", "developer_visit"].includes(
        inspectionDetails.inspectionMode,
      )
    ) {
      return {
        success: false,
        error: "Invalid inspection mode for inspectionDetails",
      };
    }


    // Validate inspectionAmount
    if (
      inspectionAmount === undefined ||
      typeof inspectionAmount !== 'number' ||
      isNaN(inspectionAmount)
    ) {
      return { success: false, error: 'Valid inspection amount (number) is required' };
    }

    // Validate properties
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
      if (!["price", "LOI"].includes(prop.inspectionType)) {
        return {
          success: false,
          error: "Inspection type must be either price or LOI for each property",
        };
      }
      if (
        prop.negotiationPrice !== undefined &&
        typeof prop.negotiationPrice !== "number"
      ) {
        return {
          success: false,
          error: "Negotiation price must be a number if provided for a property",
        };
      }
      if (
        prop.letterOfIntention !== undefined &&
        (typeof prop.letterOfIntention !== "string" ||
          !/^https?:\/\/\S+$/.test(prop.letterOfIntention))
      ) {
        return {
          success: false,
          error: "Letter of intention must be a valid URL if provided for a property",
        };
      }
      // Validate inspectionMode within each property (optional, as it can default from inspectionDetails)
      if (
        prop.inspectionMode &&
        ![
          "in_person",
          "virtual",
          "developer_visit",
        ].includes(
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
        requestedBy,
        inspectionDetails,
        inspectionAmount,
        properties,
      },
    };
  }

  static validateActionRequirements(actionData: InspectionActionData) {
    
  }
}
