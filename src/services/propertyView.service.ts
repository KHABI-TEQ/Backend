import { Types } from "mongoose";
import { DB } from "../controllers";
import notificationService from "./notification.service";

export const logPropertyView = async ({
  propertyId,
  viewerId, // Optional: could be null for guests
  ipAddress,
  userAgent,
}: {
  propertyId: string;
  viewerId?: string | null;
  ipAddress: string;
  userAgent: string;
}) => {
  const property = await DB.Models.Property.findById(propertyId);
  if (!property) throw new Error("Property not found");

  // Create view log
  await DB.Models.PropertyView.create({
    property: new Types.ObjectId(propertyId),
    viewer: viewerId ? new Types.ObjectId(viewerId) : undefined,
    ipAddress,
    userAgent,
    viewedAt: new Date(),
  });

  // Notify the property owner
  await notificationService.createNotification({
    user: property.owner.toString(),
    title: "Your property was just viewed",
    message: `Your property at ${property.location.state}, ${property.location.localGovernment}, ${property.location.area} was just viewed.`,
    meta: {
      propertyId: property._id,
    },
  });
};
