import { PaystackService } from "./paystack.service";
import {
  CHANNEL_PAYMENT_TIERS,
  DEFAULT_PAYSTACK_USSD_BANK,
} from "../config/channelAccess.config";
import { findOrCreateChannelBuyer } from "./channelBuyer.service";

export interface ChannelPaymentInitResult {
  success: boolean;
  reference?: string;
  amountNaira?: number;
  displayText?: string;
  ussdCode?: string;
  error?: string;
}

export function getChannelPaymentTierByChoice(choice: string) {
  return CHANNEL_PAYMENT_TIERS.find((t) => t.choice === String(choice).trim()) ?? null;
}

/**
 * Initialize a Paystack USSD charge for channel self-service (USSD / WhatsApp).
 * User completes payment by dialling the returned USSD string on their phone.
 */
export async function initializeChannelRegistrationFeePayment(
  phone: string,
  tierChoice: string,
  channel: "ussd" | "whatsapp"
): Promise<ChannelPaymentInitResult> {
  const tier = getChannelPaymentTierByChoice(tierChoice);
  if (!tier) {
    return { success: false, error: "Invalid fee selection" };
  }

  try {
    const buyerId = await findOrCreateChannelBuyer(phone);
    const email = `channel+${buyerId.toString().slice(-8)}@khabiteq.com`;

    const result = await PaystackService.initializeUssdCharge({
      email,
      amount: tier.amountNaira,
      ussdBankCode: DEFAULT_PAYSTACK_USSD_BANK,
      transactionType: "channel-registration-fee",
      paymentMode: "ussd",
      metadata: {
        channel,
        phone,
        feeTier: tier.key,
        feeLabel: tier.label,
      },
      fromWho: {
        kind: "Buyer",
        item: buyerId,
      },
    });

    return {
      success: true,
      reference: result.reference,
      amountNaira: tier.amountNaira,
      displayText: result.display_text,
      ussdCode: result.ussd_code,
    };
  } catch (err: any) {
    console.warn("[ChannelPayment] Paystack USSD init failed:", err?.message || err);
    return {
      success: false,
      error: err?.message || "Payment could not be started",
    };
  }
}
