import { DB } from "..";
import { RouteError } from "../../common/classes";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { Types } from "mongoose";

interface GetPreferencesQuery {
  page: number;
  limit: number;
  status?: string;
  preferenceType?: string;
  state?: string;
  localGovernment?: string;
  area?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
}

export class AdminPreferencesController {
  public async getPreferencesForBuyers(query: GetPreferencesQuery) {
    const {
      page,
      limit,
      status,
      state,
      localGovernment,
      area,
      buyerName,
      buyerEmail,
      buyerPhone,
    } = query;

    const skip = (page - 1) * limit;
    const preferenceFilter: any = { preferenceType: "buy" }; // <- Restrict to only 'buy'

    if (status) preferenceFilter.status = status;
    if (state) preferenceFilter["location.state"] = state;
    if (localGovernment)
      preferenceFilter["location.localGovernment"] = localGovernment;
    if (area) preferenceFilter["location.area"] = area;

    const queryBuilder = DB.Models.Preference.find(preferenceFilter)
      .populate({
        path: "buyer",
        match: {
          ...(buyerName && {
            fullName: { $regex: new RegExp(buyerName, "i") },
          }),
          ...(buyerEmail && { email: { $regex: new RegExp(buyerEmail, "i") } }),
          ...(buyerPhone && {
            phoneNumber: { $regex: new RegExp(buyerPhone, "i") },
          }),
        },
        select: "fullName email phoneNumber",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const [preferences, total] = await Promise.all([
      queryBuilder,
      DB.Models.Preference.countDocuments(preferenceFilter),
    ]);

    const filtered = preferences
      .filter((p) => p.buyer)
      .map((p) => {
        let formattedFeatures: string[] = [];
        if (Array.isArray(p.features) && p.features.length > 0) {
          formattedFeatures = p.features.slice(0, 2);
          if (p.features.length > 2) {
            formattedFeatures.push("...");
          }
        }

        return {
          _id: p._id,
          buyer: p.buyer,
          // preferenceType: p.preferenceType,
          // location: p.location,
          // budgetMin: p.budgetMin,
          // budgetMax: p.budgetMax,
          // propertyType: p.propertyType,
          // propertyCondition: p.propertyCondition,
          // measurementType: p.measurementType,
          // landSize: p.landSize,
          // noOfBedrooms: p.noOfBedrooms,
          // noOfBathrooms: p.noOfBathrooms,
          // documents: p.documents,
          // features: formattedFeatures,
          status: p.status,
          createdAt: p.createdAt,
        };
      });

    return {
      data: filtered,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        perPage: limit,
      },
    };
  }
 
  public async getPreferencesForBuyer(buyerId: string) {
    if (!Types.ObjectId.isValid(buyerId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid buyer ID");
    }

    const buyer = await DB.Models.Buyer.findById(buyerId).lean();
    if (!buyer) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Buyer not found");
    }

    const preferences = await DB.Models.Preference.find({
      buyer: buyerId,
      preferenceType: "buy", // <- Only preferences with type "buy"
    })
      .populate({
        path: "buyer",
        select: "fullName email phoneNumber",
      })
      .sort({ createdAt: -1 })
      .lean();

    const activeStatuses = ["pending", "approved", "matched"];
    const active: any[] = [];
    const closed: any[] = [];

    preferences.forEach((p) => {
      const result = {
        _id: p._id,
        buyer: p.buyer,
        // propertyType: p.propertyType,
        // propertyCondition: p.propertyCondition,
        // preferenceType: p.preferenceType,
        // location: p.location,
        // measurementType: p.measurementType,
        // landSize: p.landSize,
        // budgetMin: p.budgetMin,
        // budgetMax: p.budgetMax,
        // documents: p.documents,
        // noOfBedrooms: p.noOfBedrooms,
        // noOfBathrooms: p.noOfBathrooms,
        // features: p.features,
        // additionalInfo: p.additionalInfo,
        // assignedAgent: p.assignedAgent,
        // status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };

      if (activeStatuses.includes(p.status)) {
        active.push(result);
      } else {
        closed.push(result);
      }
    });

    return {
      activePreferences: active,
      closedPreferences: closed,
      total: preferences.length,
    };
  }
}
