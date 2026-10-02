import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { checkoutSearchInsurance } from "../../../services/searchInsurance.service";

/**
 * @swagger
 * /preferences/{preferenceId}/search-insurance/checkout:
 *   post:
 *     tags:
 *       - Public
 *     summary: Submit
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */


export const checkoutPreferenceSearchInsurance = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const buyer = req.buyer;
    if (!buyer?._id) {
      throw new RouteError(
        HttpStatusCodes.UNAUTHORIZED,
        "Buyer account required to insure a search."
      );
    }
    const result = await checkoutSearchInsurance({
      buyerId: String(buyer._id),
      buyerEmail: String(buyer.email),
      preferenceId: String(req.params.preferenceId),
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Redirect to complete your search insurance payment.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
