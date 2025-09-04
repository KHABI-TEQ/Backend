import { DB } from "../controllers";
import { Types } from "mongoose";

export class PaymentMethodService {
  /**
   * Create a new payment method for a user
   * If isDefault is true, unset other defaults
   */
  static async createPaymentMethod(params: {
    userId: string | Types.ObjectId;
    type: "card" | "bank";
    authorizationCode: string;
    last4: string;
    expMonth: string | number;
    expYear: string | number;
    bank?: string;
    brand?: string;
    reusable?: boolean;
    customerCode: string;
    isDefault?: boolean;
  }) {
    const paymentMethod = await DB.Models.PaymentMethod.create({
      user: params.userId,
      type: params.type,
      authorizationCode: params.authorizationCode,
      last4: params.last4,
      expMonth: params.expMonth,
      expYear: params.expYear,
      bank: params.bank,
      brand: params.brand,
      reusable: params.reusable ?? true,
      customerCode: params.customerCode,
      isDefault: params.isDefault ?? false,
    });

    // If marked default, unset other defaults
    if (paymentMethod.isDefault) {
      await DB.Models.PaymentMethod.updateMany(
        { user: params.userId, _id: { $ne: paymentMethod._id } },
        { $set: { isDefault: false } }
      );
    }

    return paymentMethod;
  }

  /**
   * Get all payment methods for a user
   */
  static async getUserPaymentMethods(userId: string | Types.ObjectId) {
    return DB.Models.PaymentMethod.find({ user: userId }).sort({ createdAt: -1 });
  }

  /**
   * Get a specific payment method by ID
   */
  static async getPaymentMethodById(paymentMethodId: string | Types.ObjectId) {
    return DB.Models.PaymentMethod.findById(paymentMethodId);
  }

  /**
   * Update a payment method
   * e.g., set isDefault, update card info
   */
  static async updatePaymentMethod(
    paymentMethodId: string | Types.ObjectId,
    updates: Partial<{
      type: "card" | "bank";
      last4: string;
      expMonth: string | number;
      expYear: string | number;
      bank: string;
      brand: string;
      reusable: boolean;
      isDefault: boolean;
    }>
  ) {
    const method = await DB.Models.PaymentMethod.findById(paymentMethodId);
    if (!method) throw new Error("Payment method not found");

    Object.assign(method, updates);

    // If marking default, unset other defaults for user
    if (updates.isDefault) {
      await DB.Models.PaymentMethod.updateMany(
        { user: method.user, _id: { $ne: method._id } },
        { $set: { isDefault: false } }
      );
    }

    await method.save();
    return method;
  }

  /**
   * Delete a payment method
   */
  static async deletePaymentMethod(paymentMethodId: string | Types.ObjectId) {
    const deleted = await DB.Models.PaymentMethod.findByIdAndDelete(paymentMethodId);
    return deleted;
  }

  /**
   * Set a payment method as default
   */
  static async setDefaultPaymentMethod(paymentMethodId: string | Types.ObjectId) {
    const method = await DB.Models.PaymentMethod.findById(paymentMethodId);
    if (!method) throw new Error("Payment method not found");

    await DB.Models.PaymentMethod.updateMany(
      { user: method.user, _id: { $ne: method._id } },
      { $set: { isDefault: false } }
    );

    method.isDefault = true;
    await method.save();

    return method;
  }
}
