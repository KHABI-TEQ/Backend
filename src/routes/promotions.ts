import express from "express";
import { getActivePromotions, getFeaturedPromotions, getPromotionDetails, getPromotionsByType, logPromotionClick, logPromotionViews, searchPromotions } from "../controllers/public/promotion/promotionController";

const PromotionRouter = express.Router();

// Get Active Promotions (for display)
// Optional: Use optionalAuth to track logged-in users
PromotionRouter.get("/active", getActivePromotions);

// Get Promotions by Type (banner, sidebar, popup, carousel, inline)
PromotionRouter.get("/type/:type", getPromotionsByType);

// Get Featured Promotions
PromotionRouter.get("/featured", getFeaturedPromotions);

// Get Single Promotion Details (public view)
PromotionRouter.get("/:id/details", getPromotionDetails);

// Search Promotions
PromotionRouter.get("/search", searchPromotions);

// Log Promotion Click (POST for security)
PromotionRouter.post("/click", logPromotionClick);

// Log Promotion Views (Batch)
PromotionRouter.post("/views", logPromotionViews);

export default PromotionRouter;
