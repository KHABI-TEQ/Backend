import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { PaystackService } from "../../services/paystack.service";

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

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transaction verified successfully",
      data: {
        transaction: verificationResult.transaction,
        typeEffect: verificationResult.dynamicType,
      }
    });

  } catch (err) {
    console.error("Transaction verification controller error:", err);
    next(err);
  }
};
