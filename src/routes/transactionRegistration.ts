import express from "express";
import {
  getRegistrationTypes,
  getGuidelines,
  submitBuyerIntent,
  registerTransaction,
  publicSearch,
  checkPropertyRegistration,
} from "../controllers/public/transactionRegistration/transactionRegistrationController";

const TransactionRegistrationRouter = express.Router();

/** Transaction types with eligibility, requirements, tiered fees, and thresholds */
TransactionRegistrationRouter.get("/types", getRegistrationTypes);

/** Safe Transaction Guidelines (documentation, commission, ownership, title, dispute, disclosure) */
TransactionRegistrationRouter.get("/guidelines", getGuidelines);

/** Buyer intent: "I wish to proceed with this transaction" after completed inspection */
TransactionRegistrationRouter.post("/intent", submitBuyerIntent);

/** Register a transaction (rental, outright sale, off-plan, JV) */
TransactionRegistrationRouter.post("/register", registerTransaction);

/** Public due-diligence search by address, LPIN, or GPS */
TransactionRegistrationRouter.get("/search", publicSearch);

/** Check if property has active/completed registration (returns warning, does not block) */
TransactionRegistrationRouter.get("/check", checkPropertyRegistration);

export default TransactionRegistrationRouter;
