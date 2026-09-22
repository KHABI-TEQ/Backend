import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { propertyValidationSchema } from "../../../utils/formValidation/propertyValidationSchema";
import { listingCommissionFields } from "../../../common/constants/listingCommission";
import { notifySubscribersOfPropertyUpdate } from "../../../services/agentSubscriber.service";
import { Types } from "mongoose";
import { notifyPriceDropToMatchedPreferences } from "../../../services/whatsappPropertyPrice.service";
import { enqueuePropertySyndicationJobs } from "../../../services/propertySyndication.service";
import {
  isLivePropertyStatus,
  isRemovedPropertyStatus,
} from "../../../utils/liveListingFilter";
import { normalizeIsTenantedForDb } from "../../../utils/normalizeIsTenanted";
import {
  assertPropertyPriceChangeAllowed,
  listingPriceFieldsChanged,
  userCanEditListedProperty,
} from "../../../services/propertyPriceLock.service";
import {
  assertAgentListingPriceConsistent,
  pictureUrlsChanged,
} from "../../../services/propertyDuplicatePrice.service";
import {
  resolveEmbeddingsForUrls,
  syncPropertyImageEmbeddings,
} from "../../../services/propertyImageEmbedding.service";
import {
  assertCanListOffPlanIfRequested,
  isOffPlanListingType,
} from "../../../services/developerPlanEntitlement.service";

export const editProperty = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { propertyId } = req.params;

    // Validate payload
    const payload = await propertyValidationSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    // Fetch property from DB
    const property = await DB.Models.Property.findById(propertyId);
    if (!property) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found");
    }

    // Owner, marketing agent, or admin
    if (!userCanEditListedProperty(req.user._id, property, req.user.role)) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "You do not have permission to edit this property",
      );
    }

    const priceChanged = listingPriceFieldsChanged(property as any, payload);
    if (priceChanged) {
      await assertPropertyPriceChangeAllowed(propertyId);
    }

    const userType = (req.user as any)?.userType;
    const nextListingType = payload.propertyType || (property as any).propertyType;
    const alreadyOffPlan = isOffPlanListingType((property as any).propertyType);
    if (isOffPlanListingType(nextListingType) && !alreadyOffPlan) {
      await assertCanListOffPlanIfRequested({
        userId: String(req.user._id),
        userType,
        propertyType: nextListingType,
      });
    }
    const picsChanged = pictureUrlsChanged((property as any).pictures, payload.pictures);
    if (userType === "Agent" && (priceChanged || picsChanged)) {
      const proposed = {
        ...(typeof (property as any).toObject === "function"
          ? (property as any).toObject()
          : property),
        ...payload,
      };
      let incomingEmbeddings: Awaited<ReturnType<typeof resolveEmbeddingsForUrls>> = [];
      try {
        incomingEmbeddings = await resolveEmbeddingsForUrls(
          Array.isArray(proposed.pictures) ? proposed.pictures : [],
        );
      } catch (embedErr) {
        console.warn("[editProperty] image embedding failed (identity check still runs):", embedErr);
      }
      await assertAgentListingPriceConsistent({
        property: proposed,
        excludePropertyId: property._id,
        incomingEmbeddings,
      });
    }

    const oldPrice = Number((property as any).price);
    const mergedForCommission = {
      ...payload,
      propertyType: payload.propertyType || (property as any).propertyType,
      price: payload.price ?? (property as any).price,
      publisherType: userType,
    };
    const canSetCommission =
      userType === "Landowners" || userType === "Developer";
    const listingHasCommission = (property as any).agentCommissionPercent != null;
    if (canSetCommission || listingHasCommission) {
      Object.assign(payload, listingCommissionFields(mergedForCommission));
    } else {
      delete payload.agentCommissionPercent;
      delete payload.agentCommissionAmount;
    }

    // Merge and save updates (normalize isTenanted for Mongoose enum)
    Object.assign(property, {
      ...payload,
      isTenanted: normalizeIsTenantedForDb(payload.isTenanted),
    });
    if (userType === "PropertyScout") {
      const nextStatus = payload.status || property.status;
      if (nextStatus === "approved" || nextStatus === "available") {
        property.status = property.status === "approved" ? property.status : "pending";
        property.isApproved = property.status === "approved";
        property.isAvailable = property.status === "approved" && property.isAvailable;
      } else {
        property.status = nextStatus;
      }
    } else {
      property.status = payload.status || property.status;
    }

    await property.save();

    if (picsChanged || payload.pictures !== undefined) {
      void syncPropertyImageEmbeddings(
        String(property._id),
        Array.isArray((property as any).pictures) ? (property as any).pictures : [],
      ).catch((embedPersistErr) => {
        console.warn("[editProperty] persist image embeddings failed:", embedPersistErr);
      });
    }

    const newPrice = Number((property as any).price);
    if (
      Number.isFinite(oldPrice) &&
      Number.isFinite(newPrice) &&
      newPrice < oldPrice
    ) {
      void notifyPriceDropToMatchedPreferences({
        propertyId: property._id as Types.ObjectId,
        oldPrice,
        newPrice,
      });
    }

    // Notify agent's subscribers (email + in-app)
    try {
      await notifySubscribersOfPropertyUpdate(property as any);
    } catch (notifyErr) {
      console.warn("[editProperty] Notify subscribers failed:", notifyErr);
    }

    try {
      void enqueuePropertySyndicationJobs({
        propertyId: property._id.toString(),
        userId: property.owner.toString(),
        eventType: "property.updated",
      });
    } catch (syndicationErr) {
      console.warn("[editProperty] enqueue syndication failed:", syndicationErr);
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property updated successfully",
      data: property,
    });
  } catch (err: any) {
    if (err?.isJoi) {
      const message = err.details?.map((e: any) => e.message).join(", ");
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, message));
    }
    next(err);
  }
};

export const updatePropertyStatus = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { propertyId } = req.params;
    const { status, reason } = req.body;

    if (!status) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Status is required");
    }

    if (isRemovedPropertyStatus(status)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Listing status 'active'/'inactive' is not used. On-market listings use status 'approved' with isAvailable true.",
      );
    }

    // Fetch property from DB
    const property = await DB.Models.Property.findById(propertyId);
    if (!property) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found");
    }

    // Check ownership or admin privilege
    if (
      property.owner.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "You do not have permission to change this property's status",
      );
    }

    // Restrict updates for pending or deleted properties
    if (["pending", "deleted", "rejected", "hold", "flagged", "draft"].includes(property.status)) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        `You cannot change the status of a ${property.status} property.`
      );
    }

    if (
      (req.user as any)?.userType === "PropertyScout" &&
      (status === "approved" || status === "available")
    ) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Property Scout listings go live only after Khabiteq review.",
      );
    }

    property.isAvailable = isLivePropertyStatus(status);

    // Update other fields
    property.status = status;
    if (reason) property.reason = reason;

    await property.save();

    // Notify agent's subscribers (email + in-app)
    try {
      await notifySubscribersOfPropertyUpdate(property as any);
    } catch (notifyErr) {
      console.warn("[updatePropertyStatus] Notify subscribers failed:", notifyErr);
    }

    try {
      void enqueuePropertySyndicationJobs({
        propertyId: property._id.toString(),
        userId: property.owner.toString(),
        eventType: status === "deleted" || status === "withdrawn" ? "property.unpublished" : "property.status_changed",
      });
    } catch (syndicationErr) {
      console.warn("[updatePropertyStatus] enqueue syndication failed:", syndicationErr);
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property status updated successfully",
      data: property,
    });
  } catch (err) {
    next(err);
  }
};

