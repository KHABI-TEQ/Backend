export interface GenerateSubscriptionSuccessEmailParams {
  fullName: string;
  planName: string;
  amount: number;
  publicAccessLink: string;
  nextBillingDate: string; // formatted date e.g. "Sept 5, 2025"
  transactionRef: string;
}

export const generateSubscriptionSuccessEmail = ({
  fullName,
  planName,
  amount,
  nextBillingDate,
  transactionRef,
  publicAccessLink,
}: GenerateSubscriptionSuccessEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>Your subscription has been successfully renewed.</p>

      <p><strong>Subscription Details:</strong></p>
      <ul style="padding-left: 20px;">
        <li><strong>Plan:</strong> ${planName}</li>
        <li><strong>Amount Paid:</strong> ₦${amount.toLocaleString()}</li>
        <li><strong>Transaction Reference:</strong> ${transactionRef}</li>
        <li><strong>Next Billing Date:</strong> ${nextBillingDate}</li>
      </ul>

      <p>Your account is now <strong>public</strong>. You can access it here or share the link with others:</p>
      <p><a href="${publicAccessLink}" target="_blank" style="color: #1a73e8;">${publicAccessLink}</a></p>

      <p>Thank you for staying with us! Your access to premium features remains uninterrupted.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};


// ----------------- SUBSCRIPTION FAILURE EMAIL -----------------

export interface GenerateSubscriptionFailureEmailParams {
  fullName: string;
  planName: string;
  amount: number;
  transactionRef: string;
  retryLink: string; // link to retry or update payment method
}

export const generateSubscriptionFailureEmail = ({
  fullName,
  planName,
  amount,
  transactionRef,
  retryLink
}: GenerateSubscriptionFailureEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>Unfortunately, we were unable to process your subscription payment.</p>

      <p><strong>Subscription Attempt:</strong></p>
      <ul style="padding-left: 20px;">
        <li><strong>Plan:</strong> ${planName}</li>
        <li><strong>Amount:</strong> ₦${amount.toLocaleString()}</li>
        <li><strong>Transaction Reference:</strong> ${transactionRef}</li>
      </ul>

      <p>Please update your payment details or retry your payment to continue enjoying uninterrupted service.</p>

      <p><a href="${retryLink}" style="display:inline-block; padding:10px 16px; background:#0066cc; color:#fff; text-decoration:none; border-radius:4px;">Update Payment / Retry</a></p>

      <p>If you’ve already updated your payment method, kindly ignore this message.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};



// ----------------- SUBSCRIPTION CANCELLATION EMAIL -----------------

export interface GenerateSubscriptionCancellationEmailParams {
  fullName: string;
  planName: string;
  amount: number;
  transactionRef: string;
  cancelledDate: string; // e.g., "Sept 5, 2025"
}

export const generateSubscriptionCancellationEmail = ({
  fullName,
  planName,
  amount,
  transactionRef,
  cancelledDate
}: GenerateSubscriptionCancellationEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>Your subscription has been successfully <strong>cancelled</strong> as of ${cancelledDate}.</p>

      <p><strong>Subscription Details:</strong></p>
      <ul style="padding-left: 20px;">
        <li><strong>Plan:</strong> ${planName}</li>
        <li><strong>Amount Paid:</strong> ₦${amount.toLocaleString()}</li>
        <li><strong>Transaction Reference:</strong> ${transactionRef}</li>
      </ul>

      <p>You will no longer be billed for this subscription. Any remaining access period may still be valid depending on your plan.</p>

      <p>If this cancellation was a mistake or you wish to resubscribe, you can reactivate your subscription at any time.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};

// ----------------- AUTO-RENEWAL STOPPED EMAIL -----------------

export interface GenerateAutoRenewalStoppedEmailParams {
  fullName: string;
  planName: string;
  lastBillingDate: string; // e.g., "Sept 5, 2025"
}

export const generateAutoRenewalStoppedEmail = ({
  fullName,
  planName,
  lastBillingDate
}: GenerateAutoRenewalStoppedEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>The auto-renewal for your subscription <strong>${planName}</strong> has been <strong>stopped</strong> as of ${lastBillingDate}.</p>

      <p>This means your subscription will not automatically renew in the next billing cycle. You will need to manually renew if you wish to continue enjoying premium access.</p>

      <p>If you want to re-enable auto-renewal or update your subscription, you can do so at any time in your account settings.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};

// ----------------- SUBSCRIPTION EXPIRED EMAIL -----------------

export interface GenerateSubscriptionExpiredEmailParams {
  fullName: string;
  planName: string;
  expiredDate: string; // formatted date, e.g., "Sept 5, 2025"
  publicAccessLink?: string; // optional, may be empty if access is disabled
}

export const generateSubscriptionExpiredEmail = ({
  fullName,
  planName,
  expiredDate,
  publicAccessLink,
}: GenerateSubscriptionExpiredEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>We wanted to let you know that your subscription has <strong>expired</strong> as of ${expiredDate}.</p>

      <p><strong>Subscription Details:</strong></p>
      <ul style="padding-left: 20px;">
        <li><strong>Plan:</strong> ${planName}</li>
        <li><strong>Expired Date:</strong> ${expiredDate}</li>
      </ul>

      ${
        publicAccessLink
          ? `<p>Your public access link is still available: <a href="${publicAccessLink}" target="_blank" style="color: #1a73e8;">${publicAccessLink}</a></p>`
          : `<p>Your account is no longer publicly accessible as your subscription has expired.</p>`
      }

      <p>To continue enjoying premium features, please renew your subscription.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};


// ----------------- SUBSCRIPTION EXPIRING SOON EMAIL -----------------


export interface GenerateSubscriptionExpiringSoonEmailParams {
  fullName: string;
  planName: string;
  expiryDate: string; // formatted date, e.g., "Sept 5, 2025"
  daysLeft: number; // number of days left before expiry
  publicAccessLink?: string; // optional, for quick access
  autoRenewEnabled: boolean;
}

export const generateSubscriptionExpiringSoonEmail = ({
  fullName,
  planName,
  expiryDate,
  daysLeft,
  publicAccessLink,
  autoRenewEnabled = false,
}: GenerateSubscriptionExpiringSoonEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>Just a friendly reminder that your subscription is set to <strong>expire in ${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>, on ${expiryDate}.</p>

      <p><strong>Subscription Details:</strong></p>
      <ul style="padding-left: 20px;">
        <li><strong>Plan:</strong> ${planName}</li>
        <li><strong>Expiry Date:</strong> ${expiryDate}</li>
        <li><strong>Days Remaining:</strong> ${daysLeft}</li>
      </ul>

      ${
        publicAccessLink
          ? `<p>You can continue to enjoy your account and premium features here: <a href="${publicAccessLink}" target="_blank" style="color: #1a73e8;">${publicAccessLink}</a></p>`
          : ''
      }

      ${
        autoRenewEnabled
          ? `<p><strong>Auto-renewal is enabled:</strong> Your account will be automatically charged to renew your subscription before expiry, so you don’t lose access to premium features.</p>`
          : ''
      }

      <p>To avoid interruption of services, please consider renewing your subscription before the expiry date.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};

