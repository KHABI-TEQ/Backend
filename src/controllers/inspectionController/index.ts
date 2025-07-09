import { Request, Response, NextFunction } from 'express';
import { RouteError } from "../../common/classes";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { NewInspectionRequest } from 'inspection.types';

class InspectionController {

    private generateInspectionLinks(
            inspectionId: string,
            buyerId: string,
            sellerId: string
            ): {
            sellerResponseLink: string;
            buyerResponseLink: string;
            negotiationResponseLink: string;
            checkLink: string;
            browseLink: string;
            rejectLink: string;
        } {
            const clientLink = process.env.CLIENT_LINK;
            const inspectionIdStr = inspectionId.toString();

            return {
                // Secure seller response page
                sellerResponseLink: `${clientLink}/secure-seller-response/${sellerId}/${inspectionIdStr}`,

                // Secure buyer response page
                buyerResponseLink: `${clientLink}/secure-buyer-response/${buyerId}/${inspectionIdStr}`,

                // Alias for seller response (for clarity)
                negotiationResponseLink: `${clientLink}/secure-seller-response/${sellerId}/${inspectionIdStr}`,

                // Utility links
                checkLink: `${clientLink}/secure-buyer-response/${buyerId}/${inspectionIdStr}/check`,
                browseLink: `${clientLink}/market-place`,
                rejectLink: `${clientLink}/secure-buyer-response/${buyerId}/${inspectionIdStr}/reject`,
            };
    }

    public async getInspectionDetails(req: Request, res: Response, next: NextFunction) {
        try {
            const { userID, inspectionID, userType } = req.params;

            const inspection = await DB.Models.InspectionBooking.findById(inspectionID)
            .populate('propertyId', 'title location price propertyType briefType pictures _id owner')
            .populate('owner', 'firstName lastName email _id phoneNumber userType')
            .populate('requestedBy', 'fullName email phoneNumber')
            .populate('transaction', 'bank accountNumber accountName transactionReference transactionReceipt');

            if (!inspection) {
            throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
            }

            // Authorization check based on user type
            if (userType === 'seller' && (inspection.propertyId as any).owner.toString() !== userID) {
            throw new RouteError(HttpStatusCodes.FORBIDDEN, "Seller not authorized for this inspection");
            }

            if (userType === 'buyer' && (inspection.requestedBy as any)._id.toString() !== userID) {
            throw new RouteError(HttpStatusCodes.FORBIDDEN, "Buyer not authorized for this inspection");
            }

            // Add thumbnail from property pictures
            const property = inspection.propertyId as any;
            const thumbnail = property?.pictures?.length ? property.pictures[0] : null;

            const responseData = {
            ...inspection.toObject(),
            propertyId: {
                ...property.toObject(),
                thumbnail,
            },
            };

            return res.status(HttpStatusCodes.OK).json({
            success: true,
            data: responseData,
            });

        } catch (error) {
            next(error);
        }
    }


    public async validateInspectionAccess(req: Request, res: Response, next: NextFunction) {
        try {
        const { userId, inspectionId } = req.params;

        const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
            .select('requestedBy owner')
            .lean();

        if (!inspection) {
            return res.status(HttpStatusCodes.NOT_FOUND).json({
            status: 'error',
            message: 'Inspection not found',
            });
        }

        const isBuyer = inspection.requestedBy?.toString() === userId;
        const isSeller = inspection.owner?.toString() === userId;

        if (isBuyer || isSeller) {
            return res.status(HttpStatusCodes.OK).json({
            status: 'success',
            role: isBuyer ? 'buyer' : 'seller',
            message: 'Access granted',
            });
        } else {
            return res.status(HttpStatusCodes.FORBIDDEN).json({
            status: 'error',
            message: 'Access denied. You are not associated with this inspection.',
            });
        }
        } catch (error) {
        console.error("Validation error:", error);
        return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
            status: 'error',
            message: 'Server error during access validation',
        });
        }
    }

   public  async requestInspection(req: Request, res: Response, next: NextFunction) {
        try {
        const {
            briefType,
            properties,
            inspectionDate,
            inspectionTime,
            requestedBy,
            transaction,
        }: NewInspectionRequest = req.body;

        if (!briefType || !['Outright Sales', 'Rent', 'Shortlet', 'Joint Venture'].includes(briefType)) {
            return res.status(HttpStatusCodes.BAD_REQUEST).json({ error: 'Invalid or missing briefType' });
        }

        const buyerEmail = requestedBy.email;
        let buyer = await DB.Models.Buyer.findOne({ email: buyerEmail });

        if (!buyer) {
            buyer = await DB.Models.Buyer.create({
            fullName: requestedBy.fullName,
            email: buyerEmail,
            phoneNumber: requestedBy.phoneNumber,
            });
        }

        const inspectionResponses = [];
        const isNegotiableType = ['Outright Sales', 'Rent', 'Shortlet'].includes(briefType);
        const isJV = briefType === 'Joint Venture';

        for (const property of properties) {
            const { propertyId, negotiationPrice, letterOfIntention } = property;

            const foundProperty = await DB.Models.Property.findOne({ _id: propertyId }).populate(
            'owner',
            'email firstName lastName fullName phoneNumber _id'
            );

            if (!foundProperty) continue;

            const existingInspection = await DB.Models.InspectionBooking.findOne({
            propertyId,
            requestedBy: buyer._id,
            status: { $ne: 'cancelled' },
            });
            if (existingInspection) continue;

            const dateCheck = new Date(inspectionDate);
            if (dateCheck < new Date()) {
            throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Inspection date cannot be in the past');
            }

            if (isJV && negotiationPrice) {
            throw new RouteError(400, 'Joint Venture properties must not include negotiationPrice');
            }

            if (!isJV && letterOfIntention) {
            throw new RouteError(400, 'letterOfIntention is only allowed for Joint Venture');
            }

            const newTransaction = await DB.Models.Transaction.create({
            buyerId: buyer._id,
            transactionReceipt: transaction.transactionReceipt,
            fullName: transaction.fullName,
            propertyId,
            });

            const isNegotiating = isNegotiableType && typeof negotiationPrice === 'number' && negotiationPrice > 0;

            const inspection = await DB.Models.InspectionBooking.create({
            propertyId,
            inspectionDate,
            inspectionTime,
            status: 'pending_transaction',
            pendingResponseFrom: 'seller',
            requestedBy: buyer._id,
            transaction: newTransaction._id,
            isNegotiating,
            negotiationPrice: isNegotiating ? negotiationPrice : undefined,
            letterOfIntention: isJV ? letterOfIntention : undefined,
            owner: (foundProperty.owner as any)._id,
            });

            inspectionResponses.push(inspection);
        }

        return res.status(HttpStatusCodes.OK).json({
            success: true,
            message: 'Inspection requests created successfully',
            inspectionIds: inspectionResponses,
        });
        } catch (error) {
        console.error('Error in requestInspection:', error);
        next(error);
        }
    }
}

export default new InspectionController();
