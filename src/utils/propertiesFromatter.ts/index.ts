import { IProperty } from "../../models";
import { formatBuyProperty } from "./formatBuyProperty";
import { formatRentProperty } from "./formatRentProperty";
import { formatJointVentureProperty } from "./formatJointVentureProperty";
import { formatShortletProperty } from "./formatShortletProperty";
import { formatOffPlanProperty } from "./formatOffPlanProperty";

export const formatPropertyPayload = (
  payload: any,
  ownerId: string,
  createdByRole: "user" | "admin",
  ownerModel: "User" | "Admin",
): Partial<IProperty> => {
  switch (payload.propertyType?.toLowerCase()) {
    case "buy":
    case "sell": // map sell → buy
      return formatBuyProperty(payload, ownerId, createdByRole, ownerModel);

    case "rent":
      return formatRentProperty(payload, ownerId, createdByRole, ownerModel);

    case "jv":
    case "joint-venture":
      return formatJointVentureProperty(payload, ownerId, createdByRole, ownerModel);

    case "shortlet":
      return formatShortletProperty(payload, ownerId, createdByRole, ownerModel);

    case "off-plan":
    case "off_plan":
      return formatOffPlanProperty(payload, ownerId, createdByRole, ownerModel);

    default:
      throw new Error(`Unsupported property type: ${payload.propertyType}`);
  }
};
