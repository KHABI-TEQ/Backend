import express from "express";
import { postPreference } from "../controllers/Public/preference/postPreference";
import { getBuyerPreferenceById } from "../controllers/Public/Preference/getBuyerSinglePreference";
import { updateBuyerPreferenceById } from "../controllers/Public/Preference/updatePreference";

const preferenceRouter = express.Router();

preferenceRouter.post("/submit", postPreference);
preferenceRouter.put(
  "/update/:buyerId/:preferenceId",
  updateBuyerPreferenceById,
);
preferenceRouter.get(
  "/getByBuyer/:buyerId/:preferenceId",
  getBuyerPreferenceById,
);

export { preferenceRouter };
