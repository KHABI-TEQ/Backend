import express, { NextFunction, Response } from "express";
import { AdminController } from "../controllers/Admin";
import { AdminPreferencesController } from "../controllers/Admin/AdminPreferencesController";
import { IAdmin, IAdminDoc } from "../models";
import { authorizeAdmin } from "./admin.authorize";
import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import AdminInspRouter from "./admin.inspections";
import { formatPropertyDataForTable } from "../utils/propertyFormatters";
import multer from "multer";
import { adminAuth } from "../middlewares/adminAuth";
import { loginAdmin } from "../controllers/Admin/Auth/loginAdmin";
import { changeAdminPassword, getAdminProfile, updateAdminProfile } from "../controllers/Admin/profileSettings";
import { createAdmin, deleteAdmin, getAdmins, getSingleAdmin, updateAdmin } from "../controllers/Admin/Account/admins";
import { approveAgentOnboardingStatus, deleteAgentAccount, flagOrUnflagAgentAccount, getAgentDashboardStatistics, getAllAgentProperties, getAllAgents, getAllAgentUpgradeRequests, getSingleAgentProfile, toggleAgentStatus } from "../controllers/Admin/Account/agents";
import { deleteLandlordAction, flagOrUnflagLandownerAccount, getAllLandlordProperties, getAllLandlords, getLandlordDashboardStatistics, getSingleLandlord } from "../controllers/Admin/Account/landlords";
import { getPreferencesByMode, getSinglePreference } from "../controllers/Admin/preference/fetchPreference";
import { findMatchedProperties } from "../controllers/Admin/preference/findMatchProerty";
import { selectMatchedPreferenceProperties } from "../controllers/Admin/preference/submitMatchedProperties";
import { setPropertyApprovalStatus } from "../controllers/Admin/Property/setPropertyApprovalStatus";
import { deleteProperty } from "../controllers/Account/Property/deleteProperty";
import { getAllProperties, getPropertyInspections, getPropertyStats, getSinglePropertyDetails } from "../controllers/Admin/Property/fetchProperties";
import { updatePropertyStatusAsAdmin } from "../controllers/Admin/Property/updatePropertyStatus";
import { approvePreference } from "../controllers/Admin/preference/approvePreference";
import { createTestimonial, deleteTestimonial, getAllTestimonials, getLatestApprovedTestimonials, getTestimonial, updateTestimonial, updateTestimonialStatus } from "../controllers/Admin/ExtralPages/testimonials";
import { createBuyer, deleteBuyer, getAllBuyers, getBuyerPreferences, getSingleBuyer, updateBuyer } from "../controllers/Admin/Account/buyers";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const AdminRouter = express.Router();

// admin management controller
const adminController = new AdminController();

// Preference management controller
const adminPreferencesController = new AdminPreferencesController();

interface Request extends Express.Request {
  body?: any;
  params?: any;
  query?: any;
  admin?: any;
}


// Allow login and create-admin without auth
AdminRouter.post("/login", loginAdmin);


/**
 * **************************************************************************
 * **************************************************************************
 * ************************* AUTHTENTICATED ROUTES **************************
 * **************************************************************************
 * **************************************************************************
 */
AdminRouter.use(adminAuth);

/**
 * ADMIN PROFILE ROUTES
 */
AdminRouter.get("/profile", getAdminProfile);
AdminRouter.get("/profile/update", updateAdminProfile);
AdminRouter.post("/change-password", changeAdminPassword);

/**
 * ADMIN MANAGEMENT ROUTES
 */
AdminRouter.get("/admins/fetchAll", getAdmins);
AdminRouter.post("/admins/create-admin", createAdmin);
AdminRouter.get("/admins/:adminId", getSingleAdmin);
AdminRouter.get("/admins/:adminId/update", updateAdmin);
AdminRouter.delete("/admins/:adminId", deleteAdmin);

/**
 * AGENTS MANAGEMENT ROUTES
 */
AdminRouter.get("/agents", getAllAgents);
AdminRouter.get("/agents/dashboard", getAgentDashboardStatistics);
AdminRouter.get("/agents/upgrade-requests", getAllAgentUpgradeRequests);
AdminRouter.post("/agents/approve-agent", approveAgentOnboardingStatus);
AdminRouter.get("/agents/:userId", getSingleAgentProfile);
AdminRouter.post("/agents/:userId/status", toggleAgentStatus);
AdminRouter.delete("/agents/:userId/delete", deleteAgentAccount);
AdminRouter.put("/agents/:userId/flag-account", flagOrUnflagAgentAccount);
AdminRouter.put("/agents/:userId/allProperties", getAllAgentProperties);


// LANDOWNERS MANAGEMENT ROUTES
AdminRouter.get("/landowners", getAllLandlords);
AdminRouter.get("/landowners/:userId", getSingleLandlord);
AdminRouter.get("/landowners/dashboard", getLandlordDashboardStatistics);
AdminRouter.put("/landowners/:userId/flag-account", flagOrUnflagLandownerAccount);
AdminRouter.delete("/landowners/:userId/delete", deleteLandlordAction);
AdminRouter.put("/landowners/:userId/flag-account", flagOrUnflagLandownerAccount);
AdminRouter.get("/landowners/:userId/allProperties", getAllLandlordProperties);


// PREFERENCE MANAGEMENT ROUTES
// this is for "developers" or "tenants" or "shortlets" or "buyers"
AdminRouter.get("/preferences/:preferenceMode", getPreferencesByMode);
AdminRouter.get("/preferences/:preferenceId/approvePreference", approvePreference);
AdminRouter.get("/preferences/:preferenceId/withAllBuyerPreferences", getSinglePreference);
AdminRouter.get("/preferences/:preferenceId/findMatchesProperties", findMatchedProperties);
AdminRouter.post("/preferences/submitMatched", selectMatchedPreferenceProperties);


// PROPERTY MANAGEMENT ROUTES
AdminRouter.get("/properties/", getAllProperties);
AdminRouter.get("/properties/stats", getPropertyStats);
AdminRouter.get("/properties/:propertyId/getOne", getSinglePropertyDetails);
AdminRouter.patch("/properties/:propertyId/update", updatePropertyStatusAsAdmin);
AdminRouter.delete("/properties/:propertyId/delete", deleteProperty);
AdminRouter.post("/properties/:propertyId/approval-status", setPropertyApprovalStatus);
AdminRouter.get("/properties/:propertyId/inspections", getPropertyInspections);


// TESTIMONIALS MANAGEMENT ROUTES
AdminRouter.get("/testimonials", getAllTestimonials);
AdminRouter.get("/testimonials/latestApproved", getLatestApprovedTestimonials);
AdminRouter.get("/testimonials/:testimonialId", getTestimonial);
AdminRouter.post("/testimonials/create", createTestimonial);
AdminRouter.put("/testimonials/:testimonialId/update", updateTestimonial);
AdminRouter.put("/testimonials/:testimonialId/updateStatus", updateTestimonialStatus);
AdminRouter.delete("/testimonials/:testimonialId/delete", deleteTestimonial);


// BUYERS MANAGEMENT ROUTES
AdminRouter.get("/buyers", getAllBuyers);
AdminRouter.get("/buyers/:buyerId", getSingleBuyer);
AdminRouter.post("/buyers/create", createBuyer);
AdminRouter.put("/buyers/:buyerId/update", updateBuyer);
AdminRouter.delete("/buyers/:buyerId/delete", deleteBuyer);
AdminRouter.get("/buyers/:buyerId/allPreferences", getBuyerPreferences);






AdminRouter.get(
  "/users/:userId/properties",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { page = "1", limit = "10" } = req.query;

      const result = await adminController.getPropertiesByUser(
        userId,
        Number(page),
        Number(limit),
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  },
);



/**
 * BUYERS MANAGEMENT ROUTES
 */


AdminRouter.get("/buyers/:id/inspections", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const data = await adminController.getBuyerInspections(
      id,
      Number(page),
      Number(limit),
    );
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});


/**
 * PREFERENCES MANAGEMENT ROUTES
 */
AdminRouter.get(
  "/preferences/buyers",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        preferenceType,
        state,
        localGovernment,
        area,
        buyerName,
        buyerEmail,
        buyerPhone,
      } = req.query;

      const result = await adminPreferencesController.getPreferencesForBuyers({
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        preferenceType: preferenceType as string,
        state: state as string,
        localGovernment: localGovernment as string,
        area: area as string,
        buyerName: buyerName as string,
        buyerEmail: buyerEmail as string,
        buyerPhone: buyerPhone as string,
      });

      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
);

AdminRouter.get(
  "/preferences/buyers/:buyerId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { buyerId } = req.params;

      const result =
        await adminPreferencesController.getPreferencesForBuyer(buyerId);

      return res.status(200).json({
        success: true,
        message: "Preferences fetched successfully",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },
);





// not using
AdminRouter.get(
  "/agent/:agentId/properties",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      const { page, limit } = req.query;
      console.log(agentId, page, limit);
      const properties = await DB.Models.PropertySell.find({ owner: agentId })
        .populate("owner")
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .exec();

      const total = await DB.Models.PropertySell.countDocuments({
        owner: agentId,
      }).exec();

      return res.status(200).json({
        success: true,
        properties,
        page: Number(page),
        limit: Number(limit),
        total,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Not using
AdminRouter.get(
  "/all-users",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = "1", limit = "10", ...filters } = req.query;

      const result = await adminController.getAllUsers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        filters,
      });

      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
);

// not using
AdminRouter.post(
  "/properties",
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { briefType, ownerType, page, limit } = req.body;
      console.log(briefType, ownerType, page, limit);
      const properties = await adminController.getProperties(
        briefType,
        ownerType,
        page,
        limit,
      );
      return res.status(200).json({ success: true, properties });
    } catch (error) {
      next(error);
    }
  },
);

AdminRouter.get(
  "/query-locations",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query } = req.query;

      const locations = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${query}&key=AIzaSyComsDDl4oIXcxZc5wmw-6QSDyuiQrxLdA&types=geocode`,
      );
      const locationsData = await locations.json();
      return res.status(200).json({ success: true, locationsData });
    } catch (error) {
      next(error);
    }
  },
);

// not using
AdminRouter.get(
  "/request/all",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, propertyType } = req.query;

      if (!propertyType) {
        return res
          .status(400)
          .json({ success: false, message: "Property type is required" });
      }

      if (propertyType !== "PropertySell" && propertyType !== "PropertyRent") {
        return res
          .status(400)
          .json({ success: false, message: "Invalid property type" });
      }
      const requests = await adminController.getPropertyRequests(
        propertyType as "PropertySell" | "PropertyRent",
        Number(page),
        Number(limit),
      );
      return res.status(200).json({ success: true, requests });
    } catch (error) {
      next(error);
    }
  },
);


AdminRouter.post(
  "/property/new",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        propertyType,
        propertyCondition,
        location,
        briefType,
        price,
        landSize,
        features,
        tenantCriteria,
        areYouTheOwner,
        isAvailable,
        budgetRange,
        pictures,
        isApproved,
        isRejected,
        docOnProperty,
        additionalFeatures,
        buildingType,
        owner,
        additionalInfo,
        isPremium,
      } = req.body;
      const response = await adminController.add({
        propertyType,
        propertyCondition,
        location,
        briefType,
        price,
        landSize,
        features,
        tenantCriteria,
        areYouTheOwner,
        isAvailable,
        budgetRange,
        pictures,
        isApproved,
        isRejected,
        docOnProperty,
        additionalFeatures,
        buildingType,
        owner: {
          email: owner.email,
          fullName: owner.fullName,
          phoneNumber: owner.phoneNumber,
        },
        additionalInfo,
        isPremium,
      });
      return res.status(HttpStatusCodes.CREATED).json(response);
    } catch (error) {
      next(error);
    }
  },
);


AdminRouter.put(
  "/property/:propertyId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { propertyId } = req.params;
      const { propertyType, propertyData } = req.body;
      const response = await adminController.updateProperty(
        propertyId,
        propertyType,
        propertyData,
      );
      return res.status(200).json({ success: true, response });
    } catch (error) {
      next(error);
    }
  },
);

//====================================================================
AdminRouter.get(
  "/buyers-with-preferences",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filterStatus: string = req.query.filterStatus || "pending";
      const result =
        await adminController.getAllBuyersWithPreferences(filterStatus);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);


AdminRouter.get(
  "/preferences/:buyerId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminController.getPreferencesByBuyerId(
        req.params.buyerId,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

AdminRouter.post(
  "/update-preference/:preferenceId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminController.updatePreferenceByAdmin(
        req.params.preferenceId,
        req.body,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

AdminRouter.post(
  "/delete-preference/:preferenceId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminController.deletePreference(
        req.params.preferenceId,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

AdminRouter.get(
  "/submitted-briefs",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userType, isApproved, isRejected, isAvailable, page, limit } =
        req.query;

      const filters = {
        isApproved: isApproved as string,
        isRejected: isRejected as string,
        isAvailable: isAvailable as string,
        page: page as string,
        limit: limit as string,
      };

      const briefs = await adminController.getSubmittedBriefs(
        userType as string,
        filters,
      );

      return res.status(200).json({
        success: true,
        data: briefs.data,
        pagination: {
          total: briefs.total,
          currentPage: briefs.currentPage,
          totalPages: briefs.totalPages,
          perPage: briefs.perPage,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

AdminRouter.post(
  "/approve-brief/:briefId",
  async (req: Request, res: Response) => {
    try {
      const { briefId } = req.params;
      const result = await adminController.approveBrief(briefId);

      res.status(200).json(result);
    } catch (error) {
      console.error(error);
      res
        .status(error.status || 500)
        .json({ message: error.message || "Internal Server Error" });
    }
  },
);

AdminRouter.post(
  "/reject-brief/:briefId",
  async (req: Request, res: Response) => {
    try {
      const { briefId } = req.params;
      const result = await adminController.rejectBrief(briefId);

      res.status(200).json(result);
    } catch (error) {
      console.error(error);
      res
        .status(error.status || 500)
        .json({ message: error.message || "Internal Server Error" });
    }
  },
);

AdminRouter.get(
  "/approved-briefs",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const briefs = await adminController.getApprovedBriefs();
      return res.status(200).json({ success: true, data: briefs });
    } catch (error) {
      next(error);
    }
  },
);

AdminRouter.get(
  "/rejected-briefs",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const briefs = await adminController.getRejectedBriefs();
      return res.status(200).json({ success: true, data: briefs });
    } catch (error) {
      next(error);
    }
  },
);

// =======================DOCUMENT VERIFICATION FUNCTIONALITIES==================================

AdminRouter.get(
  "/verification-docs",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filter = (req.query.status as string) || "pending";
      const searchQuery = req.query.customId;

      const result = await adminController.getVerificationsDocuments(
        page,
        limit,
        filter,
        // searchQuery,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

AdminRouter.get(
  "/verification-doc/:documentId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminController.getVerificationById(
        req.params.documentId,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Approve a submitted verification
AdminRouter.post(
  "/confirm-verification-payment/:documentId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminController.confirmVerificationPayment(
        req.params.documentId,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Approve a submitted verification
AdminRouter.post(
  "/reject-verification-payment/:documentId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminController.rejectVerificationPayment(
        req.params.documentId,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Send documents to third-party verification service provider
AdminRouter.post(
  "/send-to-provider/:documentId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      const { documentId } = req.params;
      const result = await adminController.sendToVerificationProvider(
        documentId,
        email,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Upload verification result document(s)
AdminRouter.post(
  "/upload-result/:documentId",
  upload.array("resultDocuments"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminController.uploadVerificationResult(
        req.params.documentId,
        req?.files,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

AdminRouter.use(AdminInspRouter);

export default AdminRouter;
