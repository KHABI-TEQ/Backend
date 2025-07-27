import express from "express";
import { postPreference } from "../controllers/public/preference/postPreference";
import { getBuyerPreferenceById } from "../controllers/public/preference/getBuyerSinglePreference";
import { updateBuyerPreferenceById } from "../controllers/public/preference/updatePreference";
import { getPaginatedMatchedProperties } from "../controllers/public/preference/fetchMatchedProperties";
import { getAllApprovedPreferences } from "../controllers/public/preference/getAllApprovedPreferences";

const preferenceRouter = express.Router();

preferenceRouter.post("/submit", postPreference);
preferenceRouter.get(
  "/getApprovedForAgent",
  getAllApprovedPreferences,
);
preferenceRouter.put(
  "/:preferenceId/getOne",
  updateBuyerPreferenceById,
);
preferenceRouter.put(
  "/update/:buyerId/:preferenceId",
  updateBuyerPreferenceById,
);
preferenceRouter.get(
  "/getByBuyer/:buyerId/:preferenceId",
  getBuyerPreferenceById,
);
preferenceRouter.get(
  "/getMatchedProps/:buyerId/:preferenceId",
  getPaginatedMatchedProperties,
);

export { preferenceRouter };
