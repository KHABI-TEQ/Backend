import express from "express";
import buyerAuth from "../middlewares/buyerAuth";
import { validateJoi } from "../middlewares/validateJoi";
import {
  createPetitionSchema,
  respondToCommSchema,
} from "../validators/case.validator";

import {
  createPetition,
  listMyPetitions,
  getMyPetition,
} from "../controllers/Buyer/buyerPetitions";

import {
  listMyCases,
  getMyCaseById,
  respondToInfoRequest,
} from "../controllers/Buyer/buyerCases";

const BuyerRouter = express.Router();

// All buyer case routes require buyer authentication
BuyerRouter.use(buyerAuth);

/**
 * BUYER PETITIONS
 */
BuyerRouter.post(
  "/petitions",
  validateJoi(createPetitionSchema),
  createPetition
);

BuyerRouter.get("/petitions", listMyPetitions);

BuyerRouter.get("/petitions/:id", getMyPetition);

/**
 * BUYER CASES
 */
BuyerRouter.get("/cases", listMyCases);

BuyerRouter.get("/cases/:id", getMyCaseById);

BuyerRouter.post(
  "/cases/:id/communications/:commId/respond",
  validateJoi(respondToCommSchema),
  respondToInfoRequest
);

export default BuyerRouter;
