import { Request, Response, NextFunction } from "express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DB } from "..";
import { RouteError } from "../../common/classes";

class PreferencesController {
  public async createPreference(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        preferenceType,
        preferenceMode,
        location,
        budget,
        features,
        propertyDetails,
        bookingDetails,
        developmentDetails,
        contactInfo,
      } = req.body;

      if (!contactInfo?.email || !contactInfo?.phoneNumber || !contactInfo?.fullName) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing buyer contact information.");
      }

      let buyer = await DB.Models.Buyer.findOne({ email: contactInfo.email });

      if (buyer) {
        buyer.fullName = contactInfo.fullName;
        buyer.phoneNumber = contactInfo.phoneNumber;
        buyer.companyName = contactInfo.companyName;
        buyer.contactPerson = contactInfo.contactPerson;
        buyer.cacRegistrationNumber = contactInfo.cacRegistrationNumber;
        await buyer.save();
      } else {
        buyer = await DB.Models.Buyer.create({
          fullName: contactInfo.fullName,
          email: contactInfo.email,
          phoneNumber: contactInfo.phoneNumber,
          companyName: contactInfo.companyName,
          contactPerson: contactInfo.contactPerson,
          cacRegistrationNumber: contactInfo.cacRegistrationNumber,
        });
      }

      const parsedAreas = (location?.selectedAreas || []).map((areaString: string) => {
        const [name, lga] = areaString.split(" - ").map((str) => str.trim());
        return { name, lga };
      });

      const preferencePayload: any = {
        buyer: buyer._id,
        preferenceType,
        preferenceMode,
        location: {
          state: location?.state || '',
          localGovernments: location?.lgas || [],
          areas: parsedAreas,
        },
        budgetMin: parseFloat(budget?.minPrice) || 0,
        budgetMax: parseFloat(budget?.maxPrice) || 0,
        features: [
          ...(features?.baseFeatures || []),
          ...(features?.premiumFeatures || []),
        ],
        status: "pending",
      };

      switch (preferenceType) {
        case "buy":
        case "rent":
          Object.assign(preferencePayload, {
            propertyType: propertyDetails?.propertyType || '',
            propertyCondition: propertyDetails?.propertyCondition || '',
            noOfBedrooms: parseInt(propertyDetails?.minBedrooms) || 0,
            noOfBathrooms: parseInt(propertyDetails?.minBathrooms) || 0,
            additionalInfo: propertyDetails?.purpose || '',
            measurementType: propertyDetails?.buildingType || '',
            documents: propertyDetails?.leaseTerm ? [propertyDetails?.leaseTerm] : [],
          });
          break;

        case "shortlet":
          Object.assign(preferencePayload, {
            propertyType: bookingDetails?.propertyType || '',
            noOfBedrooms: parseInt(bookingDetails?.minBedrooms) || 0,
            documents: [
              `Guests: ${bookingDetails?.numberOfGuests || 0}`,
              `Check-in: ${bookingDetails?.checkInDate || "N/A"}`,
              `Check-out: ${bookingDetails?.checkOutDate || "N/A"}`
            ],
          });
          break;

        case "joint-venture":
          Object.assign(preferencePayload, {
            landSize: parseFloat(developmentDetails?.minLandSize) || 0,
            measurementType: developmentDetails?.jvType || '',
            propertyType: developmentDetails?.propertyType || '',
            additionalInfo: developmentDetails?.expectedStructureType || '',
            documents: developmentDetails?.timeline ? [developmentDetails?.timeline] : [],
          });
          break;
      }

      const newPreference = await DB.Models.Preference.create(preferencePayload);

      return res.status(HttpStatusCodes.CREATED).json({
        message: "Preference created successfully",
        data: newPreference,
      });

    } catch (err) {
      next(err);
    }
  }

}

export default new PreferencesController();
