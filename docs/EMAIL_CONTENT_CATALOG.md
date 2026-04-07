# Email content catalog (verbatim templates)

This document lists **actual email body copy** used by the backend. **Dynamic values** use angle brackets. Where you see `<BuyerName>`, `<AmountNaira>`, `<VerificationLink>`, etc., read each as a **`<****>`-style slot** filled at send time (descriptive names are used so reviewers know what appears there).

**Wrappers (not repeated on every entry):**

- **`generalEmailLayout(body)`** — Wraps the inner HTML in a branded layout: logo, main white card, inner `body`, then “Best regards,” / “**Khabi-Teq**”, social icons, copyright “Copyright © \<CurrentYear> Khabi-Teq Limited…”, address Block B, Suite 8SF Goldrim Plaza, Yaya Abatan, Ogba Lagos.  
- **`generalTemplate(body, dealSiteBranding?)`** — Alternate wrapper used for some flows (e.g. user registration, Deal Site–styled messages): partner logo, company name, footer links.

Unless stated **“Inner HTML only”**, entries below are the **inner** fragment; production email is typically **layout + inner**.

---

## 1. Authentication & password

### 1.1 Email verification (register, login unverified, resend, social)

**Subject:** `Verify Your Email Address`  
**Template:** `verifyEmailTemplate` — often wrapped with `generalTemplate`.

**Body:**

```html
<div style="font-family: Arial, sans-serif; color: #333; padding: 20px; line-height: 1.6;">
  <h2 style="color: #0F52BA;">Welcome to Khabi-Teq, <FirstName> 👋</h2>

  <p>We're excited to have you on board. To secure your account and complete your registration, please verify your email address:</p>

  <div style="margin: 20px 0;">
    <a href="<VerificationLink>" style="display: inline-block; padding: 12px 20px; background-color: #0F52BA; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">
      ✅ Verify Email
    </a>
  </div>

  <p>If the button above doesn’t work, copy and paste the link below into your browser:</p>
  <p style="word-break: break-all;"><a href="<VerificationLink>"><VerificationLink></a></p>

  <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />

  <p>If you did not request this verification or believe this was sent in error, you can safely ignore this email.</p>
  
  <p style="font-size: 12px; color: #888;">This is an automated message, please do not reply to this email.</p>
</div>
```

**Plain text (some routes):** `Verify Your Email Address`

---

### 1.2 Password reset — link style

**Subject:** `Reset Password` (legacy user controller)  
**Template:** `ForgotPasswordVerificationTemplate`

```html
<div>
  <p>Dear <UserEmail>,</p>
  <p>You requested to reset your password. Please click the link below to reset your password:</p>
  <p>🔗 <a href="<ResetLink>">Reset Password</a></p>
  <p>Best regards,<br/>
  Khabi-Teq</p>
</div>
```

---

### 1.3 Password reset — OTP / code

**Subject:** `Your Password Reset Code`  
**Template:** `ForgotPasswordTokenTemplate`

```html
<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
  <p>Dear <strong><UserName></strong>,</p>

  <p>You requested to reset your password. Use the verification code below to complete the process:</p>

  <div style="margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #2c3e50;">
    🔐 <ResetCode>
  </div>

  <p>This code will expire in <strong>20 minutes</strong>. If you did not make this request, please ignore this email.</p>

</div>
```

---

## 2. Profile & account settings

### 2.1 Account updated (profile, picture, email changed uses same body with different subject)

**Subjects:**  
`Your Account Information Has Been Updated` | `Your Account Email Has Been Changed` | `Your Account Password Has Been Changed`  

**Template:** `generateAccountUpdatedEmail` + `generalEmailLayout`

```html
<div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
  <p>Dear <FullName>,</p>

  <p>This is to confirm that your account information has been successfully updated.</p>

  <p>The following details were updated:</p>
  <ul style="padding-left: 20px;">
    <li><strong><UpdatedFieldName></strong></li>
    <!-- repeated per field -->
  </ul>
  <!-- OR if no field list: -->
  <!-- <p>Some details of your account have been updated.</p> -->

  <p>If you made these changes, you can ignore this email.</p>
  <p>If you did NOT make these changes, please contact our support team immediately to secure your account:</p>

  <p style="text-align: center; margin-top: 25px;">
    <a href="<SettingsLink>"
      style="display:inline-block; padding:12px 20px; background:#1a73e8; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">
      Review Account Settings
    </a>
  </p>

  <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

  <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
</div>
```

---

### 2.2 Account deletion requested

**Subject:** `Your Account Deletion Request`  
**Template:** `generateAccountDeletionRequestEmail` + `generalEmailLayout`

```html
<div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
  <p>Dear <FullName>,</p>

  <p>This email confirms that we have received your request to delete your account, submitted on <strong><DeletionRequestDate></strong>.</p>

  <p>Your account is scheduled to be permanently deleted on <strong><CancellationDate></strong>. Until then, your account will remain active, and you can continue to use our services as normal.</p>

  <p>If you change your mind and wish to cancel this deletion request, you can do so at any time before <CancellationDate> by clicking the link below:</p>

  <p style="text-align: center; margin-top: 25px;">
    <a href="<RevertDeletionLink>"
      style="display:inline-block; padding:12px 20px; background:#f44336; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">
      Revert Account Deletion Request
    </a>
  </p>

  <p style="margin-top: 25px;">After <CancellationDate>, your account and all associated data will be permanently removed and cannot be recovered.</p>

  <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

  <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
</div>
```

---

### 2.3 Account permanently deleted

**Subject:** `User Account Permanently Deleted`  
**Template:** `generateAccountDeletedEmail` + `generalEmailLayout`

```html
<div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
  <p>Dear <FullName>,</p>

  <p>This is to confirm that your account has been successfully and permanently deleted as per your request on <strong><DeletionDate></strong>.</p>

  <p>All your data associated with this account has been removed from our systems.</p>

  <p>We're sorry to see you go and hope you had a good experience with us. If you ever wish to return, you are welcome to create a new account.</p>

  <p style="margin-top: 25px;">Thank you for being with us.</p>

  <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

  <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
</div>
```

---

## 3. Property preferences (buyer)

### 3.1 Preference submitted (public & Deal Site use same core template; Deal Site may use `generalTemplate` wrapper)

**Subject:** `Preference Submitted Successfully`  
**Template:** `preferenceMail` (from `preference.ts` — often full HTML block without `generalEmailLayout`)

```html
<div style="font-family: Arial, sans-serif; background-color: white; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p style="font-size: 16px;">Hi <strong><BuyerDisplayName></strong>,</p>

  <p style="font-size: 16px;">Thank you for sharing your preferences with <strong>Khabi-Teq</strong>!<br>
  We'll match you with property briefs tailored to your needs.</p>

  <div style="background-color: #e9f3ee; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p style="font-weight: bold; margin: 0 0 10px;">Submitted Preference</p>
    <ul style="padding-left: 20px; margin: 0; font-size: 15px; list-style-type: disc;">
      <li style="margin-bottom: 8px;">Property Type: <strong><PropertyType></strong></li>
      <li style="margin-bottom: 8px;">Location: <strong><StateAndLgas></strong></li>
      <li style="margin-bottom: 8px;">Custom Location: <strong><CustomLocation></strong></li>
      <li style="margin-bottom: 8px;">Price Range: <strong><MinPrice> - <MaxPrice> <Currency></strong></li>
      <li style="margin-bottom: 8px;">Usage Options: <strong><PreferenceMode></strong></li>
      <li style="margin-bottom: 8px;">Property Features: <strong><FeaturesListOrNotSpecified></strong></li>
      <li style="margin-bottom: 0;">Land Size: <strong><LandSize> <MeasurementUnit></strong></li>
    </ul>
  </div>

  <p style="font-size: 16px;">Our team will get back to you with the necessary feedback.<br>
  Thank you for trusting <strong>Khabi-Teq</strong> with your property listing.</p>

  <p style="font-size: 16px;">Best regards,<br>
  <strong>The Khabi-Teq Team</strong></p>
</div>
```

---

### 3.2 Matched properties found (admin or auto match)

**Subject:** `🎯 <MatchCount> Property Match` / `Matches` `Found for Your Preference`  
**Template:** `matchedPropertiesMail` + `generalEmailLayout`

```html
<div style="font-family: Arial, sans-serif; background-color: #ffffff; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p style="font-size: 16px;">Hi <strong><BuyerDisplayName></strong>,</p>

  <p style="font-size: 16px;">
    Great news! We’ve found <strong><MatchCount></strong> property match(es) based on your submitted preferences on <strong>Khabi-Teq</strong>.
  </p>

  <div style="background-color: #f0f8f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p style="font-weight: bold; margin: 0 0 10px;">Your Submitted Preference</p>
    <ul style="padding-left: 20px; margin: 0; font-size: 15px; list-style-type: disc;">
      <li><strong>Property Type:</strong> <PropertyType></li>
      <li><strong>Location:</strong> <LocationString></li>
      <li><strong>Price Range:</strong> <PriceRange></li>
      <li><strong>Usage Option:</strong> <UsageOption></li>
      <li><strong>Property Features:</strong> <PropertyFeatures></li>
      <li><strong>Land Size:</strong> <LandSize></li>
    </ul>
  </div>

  <p style="font-size: 16px;">To view the matched properties, please click the button below:</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="<MatchLink>" style="background-color: #007B55; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-size: 16px;">
      View <MatchCount> Matched Property
    </a>
    <!-- Button label is singular “… Property” or plural “… Properties” depending on <MatchCount> -->
  </div>

  <p style="font-size: 16px;">If these matches don’t meet your expectations, feel free to update your preferences or reach out for assistance.</p>

  <p style="font-size: 16px;">Best regards,<br>
  <strong>The Khabi-Teq Team</strong></p>
</div>
```

---

### 3.3 Preference rejected (admin)

**Subject:** `Update on Your Property Preference Submission`  
**Template:** `rejectedPreferenceMail` + `generalEmailLayout`

```html
<div style="font-family: Arial, sans-serif; background-color: #ffffff; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p style="font-size: 16px;">Hi <strong><BuyerDisplayName></strong>,</p>

  <p style="font-size: 16px;">
    Thank you for submitting your property preference on <strong>Khabi-Teq</strong>.
    After reviewing your request, we’re unable to proceed with this preference at this time.
  </p>

  <!-- If rejection reason: -->
  <div style="background-color: #fdecea; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p style="margin: 0; font-size: 15px;">
      <strong>Reason:</strong> <RejectionReason>
    </p>
  </div>

  <div style="background-color:#f1f3f5;padding:12px;border-radius:5px;margin:20px 0;">
    <p style="margin:0;font-size:14px;">
      <strong>Email:</strong> <BuyerEmail><br/>
      <strong>Phone:</strong> <BuyerPhone>
    </p>
  </div>

  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p style="font-weight: bold; margin: 0 0 10px;">
      Submitted Preference Summary
    </p>
    <ul style="padding-left: 20px; margin: 0; font-size: 15px;">
      <li><strong>Property Type:</strong> <PropertyType></li>
      <li><strong>Location:</strong> <LocationString></li>
      <li><strong>Price Range:</strong> <PriceRange></li>
      <li><strong>Usage Option:</strong> <UsageOption></li>
      <li><strong>Property Features:</strong> <PropertyFeatures></li>
      <li><strong>Land Size:</strong> <LandSize></li>
    </ul>
  </div>

  <p style="font-size: 16px;">
    You may update your preferences to help us find better matches.
  </p>

  <!-- Optional: Update Preference button if link provided -->
  <p style="font-size: 16px;">
    Best regards,<br/>
    <strong>The Khabi-Teq Team</strong>
  </p>
</div>
```

---

## 4. Property listings (owner / admin)

### 4.1 Owner: new property brief submitted

**Subject:** `New Property Created`  
**Template:** `generatePropertyBriefEmail` + `generalTemplate`

```html
<p>Hi <OwnerFirstName>,</p>
<p>Thank you for submitting your property brief to Khabi-Teq. We have received your brief with the following details:</p>
<ul class="" style="background-color: #E4EFE7; padding-top: 25px; padding-right: 20px; padding-bottom: 25px; padding-left: 20px; gap: 10px; border-radius: 10px;">
  <!-- Conditional lines, e.g.: -->
  <p><strong>Brief Type:</strong> <BriefType></p>
  <p><strong>Property Type:</strong> <PropertyType></p>
  <p><strong>Property Condition:</strong> <PropertyCondition></p>
  <p><strong>Location:</strong> <State>, <LGA>, <Area></p>
  <p><strong>Price:</strong> ₦<Price></p>
  <!-- … land size, bedrooms, features, tenant criteria, etc. … -->
  <p><strong>Under Review:</strong>Yes</p>
  <!-- Optional property pictures -->
</ul>
```

---

### 4.2 Admin: new property brief

**Subject:** `New Property Created`  
**Template:** `generatePropertySellBriefEmail` + `generalTemplate`

```html
<div class="container">
  <h2>New Property Brief Created</h2>
  <p>A new property brief has been submitted for sale. Here are the details:</p>
  <div class="details">
    <p><strong>Property Type:</strong> <PropertyType></p>
    <p><strong>Location:</strong> <State>, <LGA>, <Area></p>
    <p><strong>Price:</strong> ₦<PriceOrRental></p>
    <p><strong>Number of Bedrooms:</strong> <Bedrooms></p>
    <p><strong>Features:</strong> <FeaturesList></p>
    <!-- tenant criteria, documents, owner email/name/phone, etc. -->
    <p>Admin, please review and take the necessary actions.</p>
  </div>
</div>
```

---

### 4.3 Property approved / rejected (admin actions)

**Subject:** `Property Approved` / `Property Rejected`  
**Template:** `PropertyApprovedOrDisapprovedTemplate`

```html
<div class="">
  <h1> Hello <Name>,</h1>
  <h2>Property <ApprovedOrRejected></h2>
  <p>Your property was <Status>. Here are the details:</p>
  <div class="details">
    <p><strong>Property Type:</strong> <PropertyType></p>
    <p><strong>Location:</strong> <State>, <LGA>, <Area></p>
    <p><strong>Price:</strong> ₦<Price></p>
    <!-- … additional fields … -->
  </div>
  <!-- Optional pictures section -->
</div>
```

---

## 5. Inspections & payments (core flows)

### 5.1 New inspection request (seller / agent owner)

**Subject:** `New inspection request – action required`  
**Inner HTML** (`generalEmailLayout`):

```html
<p>Hello <OwnerFirstNameOrThere>,</p>
<p><strong><BuyerName></strong> has requested an inspection for your property at <strong><PropertyLocation></strong>.</p>
<!-- If fee > 0: -->
<p>Inspection fee: ₦<AmountNaira></p>
<!-- If fee > 0: -->
<p>Please accept or reject this request. If you accept, the buyer will receive a payment link.</p>
<!-- If fee is 0 (e.g. Deal Site): -->
<p>Please accept or reject this request. If you accept, the buyer will be notified.</p>
<p>Preferred date: <InspectionDate> at <InspectionTime></p>
<p><a href="<DashboardUrl>" style="display:inline-block;background:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;">View and respond</a></p>
```

**Plain text:** `<BuyerName> has requested an inspection for <PropertyLocation> (₦…).` or without amount.

---

### 5.2 Inspection accepted — buyer must pay

**Subject:** `Inspection accepted – complete your payment`

```html
<p>Hello <BuyerName>,</p>
<p>Your inspection request for <strong><PropertyLocation></strong> has been accepted by the agent.</p>
<p>Amount to pay: ₦<AmountNaira></p>
<p>Complete your payment to confirm the inspection:</p>
<p><a href="<PaymentUrl>" style="display:inline-block;background:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;">Pay now</a></p>
<p>This link may expire after a period of time.</p>
```

**Plain text:** `Your inspection was accepted. Pay ₦… here: <PaymentUrl>`

---

### 5.3 Inspection accepted — no payment (e.g. Deal Site)

**Subject:** `Inspection accepted – <PropertyTitleOrLocation>`

```html
<p>Hello <BuyerName>,</p>
<p>Your inspection request for <strong><PropertyLocation></strong> has been accepted by the agent.</p>
<!-- Optional "Property details" box with title, address, price, type, beds, baths, image, View property link -->
<p><strong>Scheduled:</strong> <InspectionDate> at <InspectionTime></p>
<p>The agent will coordinate with you for the scheduled date and time.</p>
```

---

### 5.4 Inspection request declined (buyer)

**Subject:** `Inspection request declined`

```html
<p>Hello <BuyerName>,</p>
<p>Unfortunately, the agent has declined your inspection request for <strong><PropertyLocation></strong>.</p>
<!-- Optional: --><p>Message: <Note></p>
<p>You can browse other properties or submit a new request.</p>
```

---

### 5.5 Inspection payment received (agent)

**Subject:** `Inspection payment received`

```html
<p>Hello <OwnerFirstName>,</p>
<p><strong><BuyerName></strong> has completed payment for the inspection at <strong><PropertyLocation></strong>.</p>
<p>Amount received: ₦<AmountNaira></p>
<p>The inspection is confirmed. Please coordinate with the buyer for the scheduled date and time.</p>
```

---

### 5.6 Inspection completed — rate / report

**Subject:** `Inspection completed – rate your experience`

```html
<p>Hello <BuyerName>,</p>
<p>Your inspection has been completed. We’d love to hear about your experience.</p>
<p><strong>Rate your experience:</strong> <a href="<RateLink>"><RateLink></a></p>
<p><strong>To report the agent for this inspection:</strong> <a href="<ReportLink>"><ReportLink></a></p>
<p>Thank you for using our platform.</p>
```

---

### 5.7 Buyer: inspection scheduled after payment (with optional LOI / negotiation)

**Subject:** `Inspection Request Submitted` (Paystack success path)  
**Template:** `InspectionRequestWithNegotiation`

```html
<p>Dear <BuyerName>,</p>
<!-- One of three intros: LOI / negotiating / standard inspection -->
<p style="margin-top: 10px;">… (LOI: 48h seller response; or negotiation offer; or standard 48h patience) …</p>

<ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
  <p><strong>Property Details:</strong></p>
  <li><strong>Property Type:</strong> <PropertyType></li>
  <li><strong>Location:</strong> <LocationString></li>
  <li><strong>Price:</strong> ₦<Price></li>
</ul>
<!-- Optional LOI document link -->
<!-- Optional negotiation: Seller's Asking Price / Your Offer -->
<ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
  <p><strong>Inspection Details:</strong></p>
  <li><strong>Date:</strong> <InspectionDate></li>
  <li><strong>Time:</strong> <InspectionTime></li>
  <li><strong>Mode:</strong> In Person | Virtual</li>
</ul>

<p style="margin-top: 15px;">
  If you have any questions or need to reschedule, please let us know in advance.
</p>
```

---

### 5.8 Seller: new inspection / offer context

**Template:** `InspectionRequestWithNegotiationSellerTemplate` (opening paragraphs vary for LOI / negotiation / standard; then property details list similar to buyer template.)

---

### 5.9 Inspection transaction rejected (buyer)

**Subject:** `Inspection Request Rejected`  
**Template:** `InspectionTransactionRejectionTemplate`

```html
<p>Dear <BuyerName>,</p>
<p style="margin-top: 10px;">
  We regret to inform you that your recent inspection request for the property below <strong>could not be approved</strong> by our team.
  This may be due to issues related to the property listing or internal verification processes.
</p>
<p style="margin-top: 10px;">
  Kindly review the property details and consider reaching out to support if you believe this was in error or would like to try again.
</p>
<ul style="background-color: #FDEDED; …">
  <p><strong>Property Details:</strong></p>
  <li><strong>Property Type:</strong> <PropertyType></li>
  <li><strong>Location:</strong> <LocationString></li>
  <li><strong>Price:</strong> ₦<Price></li>
</ul>
<!-- Optional LOI link, negotiation summary, attempted schedule -->
<p style="margin-top: 15px;">
  For further assistance or clarification, feel free to contact our support team.
</p>
<p style="margin-top: 10px;">Warm regards,<br/>The Khabiteq Team</p>
```

---

### 5.10 LOI rejected (buyer)

**Subject:** `LOI Document Rejected`  
**Template:** `InspectionLoiRejectionTemplate`

```html
<p>Dear <BuyerName>,</p>
<p style="margin-top: 10px;">
  We appreciate your interest in collaborating with us on the following property. However, after reviewing the submitted <strong>Letter of Intention (LOI)</strong>, we regret to inform you that it has not been approved at this time.
</p>
<p style="margin-top: 10px;">
  The rejection may be due to missing, incomplete, or incorrect information in the LOI document. We encourage you to review the requirements and re-upload a corrected version for further consideration.
</p>
<!-- Property details, LOI link, attempted schedule -->
<p style="margin-top: 15px;">
  If you have questions about the rejection or need guidance on preparing a valid LOI, our support team is available to assist you.
</p>
<p style="margin-top: 10px;">Warm regards,<br/>The Khabiteq Team</p>
```

---

### 5.11 Inspection reminders (buyer)

**Subjects:**  
`Reminder: inspection tomorrow — <PropertySummary>`  
`Reminder: inspection in <3|1> hour(s) — <PropertySummary>`

**Template:** `inspectionReminderBuyerEmail`

```html
<p>Hello <BuyerName>,</p>
<p><LeadSentenceFor24hOr3hOr1h></p>
<ul>
  <li><strong>Property:</strong> <PropertySummary></li>
  <li><strong>When:</strong> <WhenLabel></li>
  <li><strong>Mode:</strong> <VirtualOrInPerson></li>
</ul>
<p style="margin:20px 0;">
  <a href="<DashboardUrl>" style="display:inline-block;background:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;">Open dashboard</a>
</p>
<p style="font-size:13px;color:#666;">If you are not logged in, you will be asked to sign in first.</p>
```

---

### 5.12 Inspection reminders (seller)

**Template:** `inspectionReminderSellerEmail` — same structure; list includes **Buyer:** `<BuyerName>`.

---

### 5.13 Buyer details → seller / Seller details → buyer

**Subjects:** `Seller details for your property inspection` / `Buyer details for your property inspection`  
**Templates:** `BuyerDetailsToSellerTemplate` / `SellerDetailsToBuyerTemplate` + `generalEmailLayout`

Example (buyer → seller):

```html
<p>Dear <SellerName>,</p>
<p style="margin-top: 10px;">
  Below are the details of the <strong>buyer</strong> interested in inspecting your property.
</p>
<ul style="background-color: #E6F7FF; …">
  <p><strong>Buyer Information:</strong></p>
  <li><strong>Name:</strong> <BuyerFullName></li>
  <li><strong>Email:</strong> <BuyerEmail></li>
  <li><strong>Phone:</strong> <BuyerPhoneOrNotProvided></li>
</ul>
<!-- Property details + inspection schedule blocks -->
<p style="margin-top: 15px;">
  Kindly reach out to the buyer to confirm any further details regarding this inspection.
</p>
<p style="margin-top: 10px;">Warm regards,<br/>The Khabiteq Team</p>
```

---

### 5.14 Field agent: assigned / removed

**Subjects:** `New Inspection Assigned` / `Inspection Assignment Removed`  
**Templates:** `FieldAgentAssignmentTemplate` / `FieldAgentRemovalTemplate` + `generalEmailLayout` (see `fieldAgentMails.ts` for full HTML with date/time/mode).

---

### 5.15 Admin approves inspection payment: buyer subject quirk

When admin approves transaction, **buyer** may receive **Subject:** `New Offer Received – Action Required` with body from `InspectionRequestWithNegotiation` (same template as §5.7).

---

## 6. Transaction confirmation (cron)

### 6.1 Confirm transaction took place

**Subject:** `Confirm your property transaction – Khabiteq`  
**Template:** `transactionConfirmationRequestMail` + `generalEmailLayout`

```html
<p>Hello <BuyerName>,</p>
<p>Your property inspection was scheduled for <strong><InspectionDateFormatted></strong>. We hope it went well.</p>
<p>If you have proceeded with a transaction (rental, purchase, or other) with the agent or developer, please confirm this to us by clicking the button below. This helps us keep our records accurate and support you with transaction registration.</p>
<p style="margin: 24px 0;">
  <a href="<ConfirmUrl>" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Confirm transaction took place</a>
</p>
<p>If you have not completed a transaction, you may ignore this email.</p>
```

---

### 6.2 After confirmation — register transaction

**Subject:** `Register your transaction – Khabiteq`  
**Template:** `transactionConfirmationFollowUpMail` + `generalEmailLayout`

```html
<p>Hello <BuyerName>,</p>
<p>Thank you for confirming that your transaction took place.</p>
<p><strong>Next step – register your transaction</strong></p>
<p>Please go to the public transaction registration page to register your transaction. Registration has several benefits:</p>
<ul style="margin: 16px 0; padding-left: 24px;">
  <li>Creates an official record of your transaction for your protection.</li>
  <li>Supports compliance with KHABITEQ and regulatory requirements.</li>
  <li>Helps with dispute resolution and ownership verification if needed.</li>
  <li>Provides a verifiable trail for future reference (e.g. for loans or resale).</li>
</ul>
<p style="margin: 24px 0;">
  <a href="<RegisterUrl>" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Register my transaction</a>
</p>
<p>You can use the same page whether you are the buyer or the agent/developer. If you have any questions, please contact our support team.</p>
```

---

## 7. Shortlet / bookings

**Templates:** `bookingMails.ts` — see full strings for:

- `generateSuccessfulBookingReceiptForBuyer` / `ForSeller`
- `generateBookingRequestAcknowledgementForBuyer`
- `generateBookingRequestReceivedForSeller` (includes button “Review Booking Request” → `<PageLink>`)
- `generateBookingRequestReviewedForBuyer` (includes “Check Booking Details” → `<PaymentLink>`; optional “property is available” paragraph)

**Subjects (examples):**  
`Booking Request Submitted – <PropertyTitle>`  
`New Booking Request Received for Your Property – <PropertyTitle>`  
`Booking Confirmed – <PropertyTitle>`  
`Your booking request on <PropertyTitle> is available` / `is not available`

---

## 8. Subscriptions & billing

### 8.1 Subscription receipt (success)

**Subject:** `Subscription made Successfully`  
**Template:** `generateSubscriptionReceiptEmail`

```html
<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6; max-width: 650px; margin: auto; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
  <div style="background: #1a73e8; color: #fff; padding: 20px; text-align: center;">
    <h2 style="margin: 0;">Payment Receipt</h2>
    <p style="margin: 0; font-size: 13px;">Transaction Confirmation</p>
  </div>
  <div style="padding: 20px;">
    <p>Hi <FullName>,</p>
    <p>Thank you for your payment. Below are the details of your subscription:</p>
    <table>… Plan, Amount Paid ₦…, Transaction Reference, Next Billing Date …</table>
    <p style="margin-top: 20px;">
      Your account is now <strong>public</strong>. You can access it or share your public profile link:
    </p>
    <p><a href="<PublicAccessSettingsLink>"><PublicAccessSettingsLink></a></p>
    <p style="margin-top: 20px;">We appreciate your continued trust in us.</p>
  </div>
  <div style="background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
    <p style="margin: 0;">This is an automated receipt. Please do not reply to this email.</p>
  </div>
</div>
```

---

### 8.2 Subscription payment failed

**Subject:** `Subscription Payment Failed`  
**Template:** `generateSubscriptionFailureEmail` — “Unfortunately, we were unable to process your subscription payment.” + plan/amount/ref + button “Choose Subscription Plan”.

---

### 8.3 Subscription cancelled / auto-renew stopped / expiring / expired / auto-renew receipt

Full verbatim copy in `subscriptionMails.ts` for:

- `generateSubscriptionCancellationEmail`
- `generateAutoRenewalStoppedEmail`
- `generateSubscriptionExpiredEmail`
- `generateSubscriptionExpiringSoonEmail`
- `generateAutoRenewReceiptEmail` (HTML + separate plain-text body)

**Cron subjects:**  
`Your Subscription Has Expired`  
`Your subscription expires in <DaysLeft> day(s)`  
`Your subscription has been renewed automatically`  
`Auto-renewal failed for your subscription`

---

### 8.4 User cancelled subscription / stopped auto-renew

**Subjects:** `Your Subscription Has Been Cancelled` | `Auto-Renewal Stopped for Your Subscription`  
(Bodies use templates above.)

---

## 9. Request To Market

**Subjects & bodies** — see `requestToMarketEmail.service.ts` (all use `generalEmailLayout`):

- **Publisher:** `Request To Market – action required` — agent name, property, optional public page URL, contact lines, commission amount, “View and respond” button.
- **Agent:** `Request To Market declined` / `Request To Market accepted`
- **Publisher:** `Request accepted – <AgentName> – <PropertySummary>` — commission based on actual sale price; register sale on dashboard.
- **Agent:** `Sale registered – <PropertySummary> – confirm details` — sale price, commission %, amount.
- **Publisher:** `Pay agent commission – <AgentName> – <PropertySummary>` — payment link paragraph.

### 9.1 Agent commission paid (Paystack)

**Subject:** `Agent commission received – Request To Market`

```html
<p>Hello <AgentName>,</p>
<p>The publisher has completed the agent commission payment of <strong>₦<AmountNaira></strong> for the property at <strong><PropertySummary></strong>.</p>
<p>The funds will be settled to your account according to your payment settings.</p>
```

---

## 10. Document verification

### 10.1 Buyer: submission received

**Subject:** `Document Verification Submission Received – Under Review`  
**Template:** `generateVerificationSubmissionEmail` + `generalEmailLayout`

```html
<div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
  <p>Dear <FullName>,</p>
  <p>Thank you for submitting your documents for verification.</p>
  <p>We have received the following details:</p>
  <ul>… full name, phone, address, amount paid, receipt uploaded …</ul>
  <p><strong>Document Details:</strong></p>
  <ul><li><strong>Document 1:</strong> <DocumentType> (No: <DocumentNumber>)</li></ul>
  <p>Your submission is currently under review. We’ll notify you once the process is completed or if any clarification is needed.</p>
  <p>Thank you for choosing our service.</p>
  <hr … />
  <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
</div>
```

---

### 10.2 Third-party verifier

**Subject:** `New Survey Plan Verification Request - <RequesterName>` or `New Document Verification Request - <RequesterName>`  
**Template:** `generateThirdPartyVerificationEmail` + `generalEmailLayout`

```html
<p>Dear <RecipientName>,</p>
<p><RequesterName> has requested you to review and verify a submitted document.</p>
<p><strong>Message from <RequesterName>:</strong></p>
<blockquote>… <MessageText> …</blockquote>
<p><strong>Access Details:</strong></p>
<ul>
  <li><strong>Access Code:</strong> <AccessCode></li>
  <li><strong>Access Link:</strong> <a href="<AccessLink>">Click here to access the verification page</a></li>
</ul>
<p>Please use the above access code when prompted …</p>
<p>This link and code are for your use only …</p>
<p>Thank you for assisting in the verification process.</p>
```

---

### 10.3 Admin verification result to buyer

**Subject:** `Document Verification Result - <STATUS>`  

```html
<p>Dear <BuyerFullName>,</p>
<p>Your submitted document has been reviewed and marked as <strong><STATUS></strong> by our Admin team.</p>
<!-- Optional: --><p><strong>Verification Report:</strong> <Description></p>
```

---

### 10.4 Admin / API report emails

`generateAdminVerificationReportEmail` and `generateBuyerVerificationReportForBuyer` in `documentVerificationMails.ts` — full HTML with report list and optional supporting documents (see source file).

---

## 11. Deal Site contact form

**Subjects:**  
`Your message to <CompanyName> has been received`  
`New Contact Message from <SenderName> via <CompanyName> Page`

**Templates:** `generateDealSiteContactUserMail` / `generateDealSiteContactOwnerMail` — summary lists (email, optional phone/WhatsApp/subject) + message in grey box.

---

## 12. Email list / newsletter

### 12.1 General subscribe

**Subject:** `✅ Subscription Confirmed`

```html
<p>Hello <FirstName>,</p>
<p>Thank you for subscribing! You’ll now receive updates from us.</p>
<p>If you ever wish to unsubscribe, click below:</p>
<a href="<UnsubscribeUrl>" style="color:#ff0000;">Unsubscribe here</a>
```

---

### 12.2 Deal Site subscribe

**Subject:** `🎉 You’re Subscribed to <CompanyName> Updates!`  
**Body** (wrapped in `generalTemplate`): welcome, thanks for subscribing, “new deals, exclusive property listings…”, “Best regards, The \<CompanyName> Team”.

---

### 12.3 Unsubscribe

**Subject:** `❌ You Have Unsubscribed`

```html
<p>Hello <FirstName>,</p>
<p>You have successfully unsubscribed from our mailing list.</p>
<p>If this was a mistake, you can resubscribe anytime on our website.</p>
```

---

### 12.4 Property update to Deal Site subscribers

**Subject:** `Property update: <PropertyTitle>`

```html
<p>Hello <FirstNameOrThere>,</p>
<p>An agent you follow has updated a listing.</p>
<p><strong><PropertyTitle></strong></p>
<p>Status: <PropertyStatus>.</p>
<p>Visit the agent's page to see the latest details.</p>
```

---

### 12.5 Broadcast to subscribers

**Subject:** `<ChosenByAgent>`  
**Body:** `generalEmailLayout` with `<p>Hello …</p>` + **agent-supplied HTML/text** `<CustomBody>`.

---

## 13. Agent KYC & account (admin)

### 13.1 KYC submitted — agent

**Subject:** `KYC Verification Request Received – Khabi-Teq`  
**Template:** `kycSubmissionAcknowledgement` + `generalEmailLayout`

```html
<p>Dear <Name>,</p>
<p>Thank you for submitting your KYC verification request with <strong>Khabi-Teq</strong>.</p>
<p>We have successfully received your request and our team will process it shortly. 
You can expect a wonderful feedback once the review has been completed.</p>
<p>We appreciate your patience and cooperation as we ensure compliance and the highest standards for all our agents.</p>
<p>Best regards,<br/>The Khabi-Teq Team</p>
```

---

### 13.2 KYC submitted — admin queue

**Subject:** `New KYC Verification Request Pending – Khabi-Teq`  
(Separate recipient; body from onboarding controller / template.)

---

### 13.3 Agent approved / not approved

**Subjects:**  
`Welcome to Khabi-Teq – Your Partnership Opportunity Awaits!`  
`Update on Your Khabi-Teq KYC Application`  
**Templates:** `accountApproved` / `accountDisapproved` from `agentMails.ts` (long HTML with bullet lists and next steps, or rejection with reason and support email).

---

### 13.4 Welcome gift free subscription

**Subject:** `Welcome Gift - Free Subscription made Successfully`  
Uses `generateSubscriptionReceiptEmail` structure (§8.1).

---

### 13.5 Agent activate / deactivate / delete

**Templates:** `DeactivateOrActivateAgent`, `DeleteAgent` from `agentMails.ts` (simple HTML with h1/h2 and optional reason).

---

## 14. Landlord / field agent

**Landlord deleted:** `deleteLandlordMail` — “Landlord Account Deleted” + reason.  
**Field agent welcome:** `FieldAgentCreated` — email + temporary password + login button (hard-coded login URL in template).  
**Field agent delete / toggle:** `DeleteFieldAgent`, `ToggleFieldAgentStatus`.

---

## 15. Negotiation / offer emails (buyer & seller)

**Source:** `src/utils/emailTemplates/generateNegotiationEmailTemplate.ts`  
**Behavior:** For each action (**accept**, **reject**, **counter**, **request_changes**) and for **LOI** vs normal flow, the service builds **different** HTML blocks (property summary, inspection schedule, price tables, initiator vs recipient wording).

**Example excerpt (reject, recipient not initiator):**

> The \<buyer|seller> has \<rejected> your offer for the property at \<LocationString>.

**Subjects** are produced by `generateNegotiationEmailSubject` (and used in `InspectionEmailService`), e.g.  
`❌ Your Offer has been Rejected - <Location>`,  
`💰 New Counter Offer Received - <Location>`,  
`🎉 Great News! Your LOI has been Accepted - <Location>`, etc.

For **full** negotiation email HTML, refer to the source file (1000+ lines of conditional blocks).

---

## 16. Admin-only / misc.

- **Inspection deleted** (`AdminInspectionController`): subject `Inspection Deleted` — body built in controller (see source).  
- **Property status update** (`updatePropertyStatus`): same family as `PropertyApprovedOrDisapprovedTemplate`.  
- **Document verification rejected** (`verifyPaymentHandlers`): subject `Document Verification Rejected`.  
- **Legacy `Property` service** “New Property” / “New Property Preference”: uses `generatePropertyBriefEmail`, `generatePropertyPreferenceBriefEmail`, `generatePropertPreferenceBriefEmail` — see `email.template.ts`.  
- **Paystack document path** third-party subject may include buyer full name in subject line (see `paystack.service.ts`).

---

## Maintenance note

When templates change in code, update this file or regenerate from source. Dynamic values are indicated as `<Placeholder>` throughout; replace mentally with real data at send time.
