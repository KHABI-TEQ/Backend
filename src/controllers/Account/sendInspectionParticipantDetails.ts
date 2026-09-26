import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { generalEmailLayout } from "../../common/emailTemplates/emailLayout";
import {
  BuyerDetailsToSellerTemplate,
  SellerDetailsToBuyerTemplate,
} from "../../common/emailTemplates/inspectionMails";
import sendEmail from "../../common/send.email";

export const sendInspectionParticipantDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { inspectionId } = req.params;
    const { send } = req.body;

    if (!["buyer-to-seller", "seller-to-buyer", "send-both"].includes(send)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid send direction");
    }

    const inspection = await DB.Models.InspectionBooking.findOne({
      _id: inspectionId,
    })
      .populate("propertyId")
      .populate("owner")
      .populate("requestedBy");

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    const property = inspection.propertyId as any;
    const buyer = inspection.requestedBy as any;
    const seller = inspection.owner as any;

    if (!buyer || !seller) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing buyer or seller info");
    }

    const buyerToSeller = {
      to: seller.email,
      subject: "Seller details for your property inspection",
      html: generalEmailLayout(
        BuyerDetailsToSellerTemplate(seller, buyer, inspection, property)
      ),
      text: generalEmailLayout(
        BuyerDetailsToSellerTemplate(seller, buyer, inspection, property)
      ),
    };

    const sellerToBuyer = {
      to: buyer.email,
      subject: "Buyer details for your property inspection",
      html: generalEmailLayout(
        SellerDetailsToBuyerTemplate(buyer, seller, inspection, property)
      ),
      text: generalEmailLayout(
        SellerDetailsToBuyerTemplate(buyer, seller, inspection, property)
      ),
    };

    if (send === "buyer-to-seller") {
      await sendEmail(buyerToSeller);
    } else if (send === "seller-to-buyer") {
      await sendEmail(sellerToBuyer);
    } else if (send === "send-both") {
      await Promise.all([sendEmail(buyerToSeller), sendEmail(sellerToBuyer)]);
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message:
        send === "send-both"
          ? "Both buyer and seller details sent successfully"
          : `Details sent successfully from ${send.replace("-", " ")}`,
    });
  } catch (err) {
    next(err);
  }
};
