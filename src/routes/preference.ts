import express from "express";
import { postPreference } from "../controllers/public/preference/postPreference";
import { getBuyerPreferenceById } from "../controllers/public/preference/getBuyerSinglePreference";
import { updateBuyerPreferenceById } from "../controllers/public/preference/updatePreference";

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
preferenceRouter.get(
  "/getMatchedProps/:buyerId/:preferenceId",
  getBuyerPreferenceById,
);

export { preferenceRouter };
