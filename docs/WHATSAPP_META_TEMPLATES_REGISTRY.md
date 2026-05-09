# WhatsApp template keys vs Meta (WhatsApp Manager)

This backend sends **template messages** using the **Graph API**. The **template name** Meta receives is the template key **lowercased** (see `WhatsAppNotificationService.sendMessage`: `template.name = templateKey.toLowerCase()` unless overridden).

The strings in `src/common/WhatsAppMessageTemplates.ts` are **not** synced to Meta. They define:

- Which **keys** exist in the app.
- Which **variables** must be supplied, in **first appearance order** in the template string (same order as `{{var}}` occurrences).

On Meta you must create a **message template** whose:

- **Name** equals the key below (already lowercase for all current keys).
- **Language** matches what you configure (env `WHATSAPP_TEMPLATE_LANGUAGE`, default `en`; use `en_US` if your Meta templates use that locale).
- **Body** placeholders must match how this backend sends parameters (see next section).

### Positional vs named body variables

**Default (`WHATSAPP_TEMPLATE_BODY_PARAMETER_MODE` unset or `positional`):** Meta body uses numbered placeholders only — `{{1}}`, `{{2}}`, … — in the **same order** as the variables listed in the table below. The Graph payload sends parameters **without** `parameter_name` (order only).

**Named mode (`WHATSAPP_TEMPLATE_BODY_PARAMETER_MODE=named`):** Meta’s “Name” variable type only allows **lowercase letters, digits, and underscores** inside `{{…}}` (e.g. `{{user_name}}`, not `{{userName}}`). The app still uses camelCase keys in code (`userName`, `bookingId`, …); at send time each key is converted to Meta’s `parameter_name` by inserting underscores before capitals and lowercasing (e.g. `userName` → `user_name`, `bookingId` → `booking_id`). Your Meta template body must use those exact snake_case names in the **same order** as the table.

Use **one** mode consistently per environment: if the template in Meta is positional, keep the default; if you registered named placeholders in Meta, set `named` or sends will fail.

### Header variables

This service currently builds **body** components only. If you add a **header** with a variable in Meta, approval may succeed but sends can fail until header parameters are implemented — prefer **no header**, or a fixed header text with no variables, until then.

---

## Built-in template keys and variables (send order)

| Template key (Meta name) | Variables in order (positional: `{{1}}`…`{{n}}`; named: snake_case of each key, same order) |
|---------------------------|--------------------------------------------------------|
| `booking_confirmation` | `userName`, `propertyName`, `propertyAddress`, `date`, `time`, `agentName`, `agentPhone`, `bookingId` |
| `preferences_updated` | `userName`, `preferencesSummary` |
| `property_matches` | `userName`, `matchCount`, `propertyList`, `bookingLink`, `morePropertiesLink` |
| `new_listing_match` | `userName`, `propertyDetails`, `matchScore`, `bookingLink` |
| `price_drop_alert` | `userName`, `propertyName`, `propertyLocation`, `oldPrice`, `newPrice`, `savings`, `bookingLink` |
| `agent_assigned` | `userName`, `agentName`, `agentPhone`, `agentSpecialty`, `propertyName`, `reason` |
| `client_assigned` | `agentName`, `userName`, `userPhone`, `userPreferences`, `assignmentReason` |
| `follow_up_reminder` | `userName`, `daysSince`, `searchLink` |
| `hello_world` | *(none — Meta’s sample; usually no variables)* |
| `test_message` | `timestamp` |
| `welcome_message` | `userName` |
| `admin_provisioned_account` | `firstName`, `userType`, `email`, `loginUrl` |
| `property_created_by_admin` | `firstName`, `summaryLine` |
| `maintenance_notice` | `userName`, `maintenanceDate`, `maintenanceTime`, `estimatedDuration` |
| `property_inquiry` | `agentName`, `userName`, `userPhone`, `propertyName`, `propertyLocation`, `inquiryMessage` |
| `viewing_completed` | `userName`, `propertyName`, `agentName`, `agentPhone` |
| `offer_submitted` | `userName`, `propertyName`, `offerAmount`, `submissionDate` |
| `offer_accepted` | `userName`, `propertyName`, `acceptedAmount`, `propertyAddress`, `agentName` |
| `offer_rejected` | `userName`, `propertyName`, `offerAmount`, `sellerFeedback`, `agentName` |
| `market_update` | `location`, `userName`, `averagePrice`, `priceTrend`, `newListings`, `marketActivity`, `marketInsight`, `agentName`, `agentPhone` |
| `document_request` | `userName`, `propertyName`, `documentList`, `agentName`, `agentPhone`, `agentEmail`, `deadline` |
| `inspection_scheduled` | `userName`, `propertyName`, `inspectorName`, `inspectorPhone`, `inspectionDate`, `inspectionTime`, `estimatedDuration`, `agentName` |
| `inspection_request_alert` | `recipientName`, `buyerName`, `propertySummary`, `scheduleSummary`, `feeSummary`, `actionNote` |
| `mortgage_reminder` | `userName`, `propertyName`, `lenderList`, `deadline`, `agentName`, `agentPhone` |
| `closing_date` | `userName`, `propertyName`, `closingDate`, `closingTime`, `closingLocation`, `walkThroughDate` |
| `welcome_new_homeowner` | `userName`, `propertyName`, `agentName` |
| `birthday_message` | `userName`, `propertyName`, `agentName` |
| `anniversary_message` | `userName`, `yearsInHome`, `propertyName`, `agentName` |
| `referral_request` | `userName`, `propertyName`, `agentName`, `referralBonus` |
| `market_alert` | `userName`, `alertType`, `location`, `alertMessage`, `agentName`, `agentPhone` |
| `seasonal_tips` | `season`, `userName`, `propertyName`, `seasonalTips`, `agentName`, `agentPhone` |
| `emergency_contact` | `userName`, `propertyName`, `waterEmergency`, `electricEmergency`, `gasEmergency`, `maintenanceContact`, `agentName`, `agentPhone` |
| `payment_reminder` | `userName`, `paymentType`, `propertyName`, `dueDate`, `paymentAmount`, `paymentLink`, `agentName`, `agentPhone` |
| `survey_request` | `userName`, `agentName`, `surveyLink`, `surveyIncentive` |
| `promotional_message` | `promotionTitle`, `userName`, `promotionDetails`, `preferredLocation`, `budget`, `validUntil`, `agentName`, `agentPhone` |
| `agent_new_booking` | `agentName`, `userName`, `userPhone`, `propertyName`, `propertyAddress`, `date`, `time`, `userPreferences`, `bookingId` |
| `viewing_reminder_24h` | `userName`, `propertyName`, `propertyAddress`, `time`, `agentName`, `agentPhone` |
| `viewing_reminder_2h` | `userName`, `propertyName`, `time`, `agentName`, `agentPhone` |
| `inspection_time_reminder` | `timeUntil`, `userName`, `propertyName`, `whenLabel`, `modeLabel`, `otherPartyName`, `otherPartyPhone` |
| `booking_cancelled` | `userName`, `propertyName`, `date`, `cancellationReason` |
| `booking_rescheduled` | `userName`, `propertyName`, `newDate`, `newTime`, `agentName`, `rescheduleReason` |
| `booking_cancelled_agent` | `agentName`, `userName`, `propertyName`, `date`, `reason` |
| `preferences_saved` | `userName`, `preferencesSummary` |
| `no_matches_yet` | `userName`, `appLink` |

**Dynamic keys:** `setTemplate()` can add more keys at runtime; those must also exist in Meta before sending.

---

## Practical notes for Meta registration

1. **Category:** Choose an appropriate Meta category (Utility, Marketing, Authentication) per template content; Marketing has stricter rules and opt-in.
2. **Variable count:** Templates with many variables are harder to maintain and may hit Meta limits; you may simplify body text in Meta to fewer variables and then adjust this codebase to match (or combine values in fewer parameters).
3. **`hello_world`:** Usually pre-created by Meta for testing; admin test uses it by default.
4. **Language:** Set `WHATSAPP_TEMPLATE_LANGUAGE` (e.g. `en` or `en_US`) to match the **approved language code** of each template in Meta.
5. **Body parameter mode:** Set `WHATSAPP_TEMPLATE_BODY_PARAMETER_MODE` to `named` only if Meta templates use named snake_case placeholders; omit or use `positional` for `{{1}}`…`{{n}}` templates.
6. **Emojis / markdown:** Meta template bodies may not match our internal formatting exactly; only **variable count and order** must align with what `sendMessage` sends.

---

## How to register templates on Meta (navigation)

Use a browser logged into the Facebook account that administers the **WhatsApp Business Account** linked to your app.

### Path A — From Meta Business Suite (common)

1. Open **[business.facebook.com](https://business.facebook.com)**.
2. Open your **business portfolio** / **Business settings** (gear icon).
3. Go to **Accounts** → **WhatsApp accounts** → select your **WhatsApp Business Account**.
4. Find **Message templates** or **WhatsApp Manager** (wording varies) → open **WhatsApp Manager**.
5. In WhatsApp Manager, go to **Account tools** → **Message templates** (or **Templates**).
6. Click **Create template**.
7. Set **name** exactly to the template key (e.g. `booking_confirmation`).
8. Choose **category**, **language** (must match app env).
9. Edit **body**: add static text and insert variables so the **number and order** of variables match the table above (`{{1}}` = first variable in the row, etc.).
10. Submit for **approval**; wait until status is **Approved** before production sends.

### Path B — From developers.facebook.com (your app)

1. Open **[developers.facebook.com](https://developers.facebook.com)** → **My Apps** → select **Khabiteq WP** (your app).
2. In the left sidebar, open **WhatsApp** → **Getting started** or **Configuration**.
3. Look for a link to **WhatsApp Manager** or **Message templates** (opens the same template UI as above).
4. Follow steps 6–10 from Path A.

### After templates exist

- Ensure **System User** token used in `.env` has `whatsapp_business_messaging` (and management if you manage templates via API).
- `WHATSAPP_PHONE_NUMBER_ID` must belong to the same WABA where templates were created.

---

## Quick reference: env vars (this repo)

| Variable | Role |
|----------|------|
| `WHATSAPP_ACCESS_TOKEN` | Long-lived system user token for Graph API sends |
| `WHATSAPP_PHONE_NUMBER_ID` | Sender phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | Must match Meta webhook verify token |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Default language code for templates (e.g. `en`, `en_US`) |
| `WHATSAPP_TEST_TEMPLATE_KEY` | Optional; default test template key (default `hello_world`) |
| `WHATSAPP_TEST_TEMPLATE_LANGUAGE` | Optional; overrides language for admin test only |
