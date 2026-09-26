import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { PaystackService } from "../../services/paystack.service";
import { DB } from "..";
import { generateToken } from "../../common/classes";
import { buyerPublic } from "../BuyerAuth/profile";

const BUYER_SESSION_TRANSACTION_TYPES = new Set([
  "inspection",
  "search-insurance",
]);

async function buyerSessionForPayment(transaction: any) {
  const type = String(transaction?.transactionType || "");
  if (!BUYER_SESSION_TRANSACTION_TYPES.has(type)) return null;

  let buyer: any = null;
  const fromWho = transaction?.fromWho;
  if (fromWho?.kind === "Buyer" && fromWho.item) {
    buyer = await DB.Models.Buyer.findById(fromWho.item);
  }

  if (!buyer && type === "inspection") {
    const inspection = await DB.Models.InspectionBooking.findOne({
      transaction: transaction._id,
    }).populate("requestedBy");
    buyer = (inspection as any)?.requestedBy || null;
    if (buyer && !buyer.email) {
      buyer = await DB.Models.Buyer.findById(buyer._id || buyer);
    }
  }

  if (!buyer && type === "search-insurance") {
    const policyId = transaction?.meta?.policyId;
    const preferenceId = transaction?.meta?.preferenceId;
    const policy = policyId
      ? await DB.Models.SearchInsurancePolicy.findById(policyId)
      : preferenceId
        ? await DB.Models.SearchInsurancePolicy.findOne({ preference: preferenceId })
        : null;
    if (policy?.buyer) {
      buyer = await DB.Models.Buyer.findById(policy.buyer);
    }
  }

  if (!buyer?._id || !buyer.email) return null;

  return {
    token: generateToken({
      id: buyer._id.toString(),
      email: buyer.email,
      userType: "Buyer",
      role: "buyer",
    }),
    buyer: buyerPublic(buyer),
  };
}

/**
 * Controller to verify Paystack payment by transaction reference.
 */
export const paymentVerification = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { reference } = req.query;

    if (!reference || typeof reference !== "string") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Transaction reference is required",
      });
    }

    const verificationResult = await PaystackService.verifyPayment(reference);

    if (!verificationResult.verified) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Transaction verification failed: ${verificationResult.reason || "Unknown error"}`,
        data: verificationResult.transaction || verificationResult,
      });
    }

    const session = await buyerSessionForPayment(verificationResult.transaction);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transaction verified successfully",
      data: {
        transaction: verificationResult.transaction,
        typeEffect: verificationResult.dynamicType,
        ...(session ? { token: session.token, buyer: session.buyer } : {}),
      }
    });

  } catch (err) {
    console.error("Transaction verification controller error:", err);
    next(err);
  }
};
