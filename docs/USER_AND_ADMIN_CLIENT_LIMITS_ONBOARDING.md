# Client integration: listing limits, admin onboarding, KYC, notifications

Base path: **`/api`** (prepend your gateway prefix if any).

All JSON bodies use `Content-Type: application/json`. User routes use **`Authorization: Bearer <userJwt>`**. Admin routes use **`Authorization: Bearer <adminJwt>`** (after `POST /api/admin/login`).

---

## Shared rules (backend-enforced)

| User type | 1st listing | 2nd+ listings |
|-----------|-------------|----------------|
| **Agent** | No subscription | Active subscription **and** `Agent.kycStatus === "approved"` |
| **Developer** | No subscription | Active subscription only |
| **Landowners** | Unlimited | Unlimited |

Listings where **`owner`** is the user count the same whether **`createdByRole`** is `user` or `admin`.

**403** messages (exact strings may vary slightly):

- `You have reached the free limit of 1 property. Please subscribe to a plan to post more properties.`
- `Complete KYC verification and obtain approval before listing more than one property.` (Agent only)

---

## End-user app

### Login

**`POST /api/auth/login`**

Body: `{ "email": string, "password": string }`

**200** `data`:

```json
{
  "token": "<jwt>",
  "user": {
    "id": "...",
    "firstName": "...",
    "lastName": "...",
    "email": "...",
    "phoneNumber": "...",
    "userType": "Agent" | "Developer" | "Landowners" | "FieldAgent",
    "mustChangePassword": false,
    "...": "other existing user fields"
  }
}
```

- **`mustChangePassword`** — `true` when an admin created the account until the user changes password. **Agent** responses may still include `agentData`, `activeSubscription`, `dealSite` as today.

If `mustChangePassword === true`, restrict the app to **change password** (and sign-out) until cleared.

### Change password (clears forced change)

**`PUT /api/account/changePassword`**

Auth: user Bearer.

Body: `{ "oldPassword": string, "newPassword": string }`

**200:** `{ "success": true, "message": "Password changed successfully" }`

Email: **“Your Account Password Has Been Changed”** is sent on success. After success, **`mustChangePassword`** is stored as `false`; next login returns `mustChangePassword: false`.

### Create property (logged-in owner)

**`POST /api/account/properties/create`**

**`POST /api/account/preferences/:preferenceId/properties`** — same listing rules; on subscription quota failure uses feature **`AGENT_MARKETPLACE`** instead of **`LISTINGS`**.

**201:** `{ "success": true, "message": "Property created successfully", "data": <property document> }`

**403:** subscription / KYC / free-limit errors as above.

### AI suggest property form (logged-in owner)

**`POST /api/account/ai/suggest-property`**

Body: `{ "userInput": string }`

**200:** `{ "success": true, "message": "...", "data": <suggested fields object> }`

### DealSite (self-service, unchanged)

**`POST /api/account/dealSite/setUp`** — still requires the target user’s **active subscription** (unless admin sets up on their behalf; see below).

---

## Admin app

### Register Agent, Developer, or Landowner

**`POST /api/admin/users/register`**

Body:

```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "userType": "Agent" | "Developer" | "Landowners",
  "phoneNumber": "optional string",
  "address": { "street": "optional", "state": "optional", "localGovtArea": "optional" },
  "password": "optional; if omitted a random password is generated and emailed"
}
```

**201:**

```json
{
  "success": true,
  "message": "User created. Credentials were sent by email (and WhatsApp when configured).",
  "data": {
    "id": "<mongo id>",
    "email": "...",
    "firstName": "...",
    "lastName": "...",
    "userType": "Agent" | "Developer" | "Landowners",
    "mustChangePassword": true
  }
}
```

Side effects: **`mustChangePassword: true`** on user; **`isAccountVerified: true`**, **`accountStatus: "active"`**, **`accountApproved: true`** so they can sign in immediately with the emailed temporary password. **Agent** also gets an **Agent** profile with **`kycStatus: "none"`**.

Notifications: **email** (HTML) with temporary password and login URL; **WhatsApp** template **`admin_provisioned_account`** when `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and user **`phoneNumber`** are set (password is **not** sent on WhatsApp).

### Create property on behalf of a user

**`POST /api/admin/properties/create`**

Body: same validated shape as user create, and must include **`owner`**: Mongo id string of the **User** who will own the listing.

Optional: **`status`** — if `"approved"`, listing is approved and available; otherwise defaults to **`pending`** with `isApproved` / `isAvailable` false.

**201:** `{ "success": true, "message": "Property created successfully by admin", "data": <property document> }`

Same **403** listing rules as the user endpoint (counts admin-created rows).

Subscription: when a snapshot applies, **one** unit of feature **`LISTINGS`** is consumed (no `preferenceId` branch on this route).

Notifications: **email** to owner and configured **admin** address; **WhatsApp** **`property_created_by_admin`** when WA env + **`phoneNumber`** present.

### AI suggest property for a target user (admin console)

**`POST /api/admin/users/:userId/ai/suggest-property`**

Body: `{ "userInput": string }`

**200:**

```json
{
  "success": true,
  "message": "Suggested property form fields from description (admin on behalf of user).",
  "data": {},
  "meta": { "targetUserId": "<userId>", "targetUserType": "Agent" | "Developer" | "Landowners" }
}
```

`data` matches **`POST /api/account/ai/suggest-property`** for that user type.

### Developers directory (admin)

**`GET /api/admin/developers`** — paginated **`User`** rows with **`userType: "Developer"`** (password / OAuth ids omitted).

**Query parameters** (all optional unless noted):

| Parameter | Description |
|-----------|-------------|
| **`page`** | Page number, default `1`. |
| **`limit`** | Page size, default `10`, maximum `100`. |
| **`search`** | Case-insensitive substring on **`email`**, **`firstName`**, **`lastName`**, **`phoneNumber`**, **`accountId`**. |
| **`isAccountVerified`** | `true` or `false`. |
| **`isInActive`** | `true` or `false`. |
| **`isFlagged`** | `true` or `false`. |
| **`accountApproved`** | `true` or `false`. |
| **`accountStatus`** | Exact status string; omit or send `null` to apply no filter. |
| **`excludeInactive`** | Defaults to **active-only** (`isInActive: false`). Pass `false` to include inactive users. |
| **`mustChangePassword`** | `true` or `false` (admin-provisioned accounts). |
| **`sortBy`** | One of: `createdAt`, `updatedAt`, `email`, `firstName`, `lastName`, `accountStatus`, `accountApproved`, `isAccountVerified`. Invalid values fall back to **`createdAt`**. |
| **`sortOrder`** | `asc` or `desc` (default **`desc`**). |

**200:**

```json
{
  "success": true,
  "message": "Developers fetched successfully",
  "data": [],
  "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
}
```

**`GET /api/admin/developers/:userId`** — one developer; **404** if not found or not `Developer`.

**`GET /api/admin/developers/:userId/allProperties`** — that user’s listings (non-deleted), paginated with **`page`**, **`limit`** (same defaults/cap as above).

**`DELETE /api/admin/developers/:userId`** — soft-delete the developer (aligned with agent soft-delete, plus DealSite cleanup):

- Sets **`isDeleted: true`**, **`accountStatus: "deleted"`**, **`isInActive: true`**, **`accountApproved: false`**.
- Sets any **DealSite** with **`createdBy`** = this user to **`status: "deleted"`**.
- Sends a **closure email** to the user including the admin **`reason`**.

**Body (JSON, required):** `{ "reason": "Non-empty string explaining the deletion" }`  
*(Some HTTP clients omit bodies on `DELETE`; if yours does, use a client that sends a JSON body or add a `POST`-alias route later.)*

**200:** `{ "success": true, "message": "Developer account deleted successfully." }`  
**400:** Missing or empty `reason`.  
**404:** Developer not found or already deleted.

### Create DealSite (public page) on behalf of Agent / Developer

**`POST /api/admin/users/:userId/deal-site/setup`**

- **`:userId`** — Mongo id of the **Agent** or **Developer** user who will **own** the DealSite (`createdBy` is set to this id).
- **Subscription** — not required for this route (admin path bypasses the user DealSite subscription check).
- **Server-side rules** — `publicSlug` must be **globally unique**; the target user must **not** already have a DealSite; the server calls **Paystack** to create a **subaccount**, then persists the DealSite with **`status: "paused"`** (same as user self-service create).

#### Paystack bank list (admin console)

**`GET /api/admin/deal-sites/bank-list`** — **`Authorization: Bearer <adminJwt>`**. Returns the same Paystack settlement bank list as **`GET /api/account/dealSite/bankList`** (user JWT).

**200:** `{ "success": true, "data": <Paystack bank list> }` — use each bank’s code as **`paymentDetails.sortCode`** when calling **`POST /api/admin/users/:userId/deal-site/setup`**.

#### Request body (JSON)

Send one JSON object. Fields below match what **`DealSiteService.setUpPublicAccess`** and the **DealSite** Mongoose model accept.

**Required (enforced before save)**

| Field | Type | Description |
|-------|------|-------------|
| **`publicSlug`** | `string` | URL segment for the public page (e.g. `jane-doe-homes`). Unique across all DealSites. |
| **`title`** | `string` | Site / brand title shown on the page. |
| **`description`** | `string` | Meta / SEO-style description (model requires it). |
| **`paymentDetails`** | `object` | **Input** bank + contact data for Paystack subaccount creation (see table below). After success, the API **replaces** this object with Paystack’s response fields (`subAccountCode`, resolved `accountName`, etc.). |

**`paymentDetails` (required nested fields — input only)**

These six are read from `paymentDetails` and passed to **`PaystackService.createSubaccount`**. Use the same **bank `sortCode`** values as the Paystack bank list from **`GET /api/account/dealSite/bankList`** (user JWT) or **`GET /api/admin/deal-sites/bank-list`** (admin JWT); both return the same `data` shape.

| Field | Type | Description |
|-------|------|-------------|
| **`businessName`** | `string` | Business or trading name for the subaccount. |
| **`sortCode`** | `string` | Bank sort / settlement code from Paystack bank list. |
| **`accountNumber`** | `string` | Naira settlement account number. |
| **`primaryContactEmail`** | `string` | Contact email for the subaccount. |
| **`primaryContactName`** | `string` | Contact person name. |
| **`primaryContactPhone`** | `string` | Contact phone (E.164 or local format as Paystack accepts). |

Do **not** send `subAccountCode`, `accountName`, etc. on create; the server fills those after Paystack returns.

**Optional (common UX)**

| Field | Type | Notes |
|-------|------|--------|
| **`keywords`** | `string[]` | SEO keywords; default `[]`. |
| **`logoUrl`** | `string` | Public URL of logo image. |
| **`theme`** | `{ "primaryColor"?: string, "secondaryColor"?: string }` | Defaults exist in the model if omitted. |
| **`publicPage`** | `object` | Hero: `heroTitle`, `heroSubtitle`, `ctaText`, `ctaLink`, optional `ctaText2`, `ctaLink2`, `heroImageUrl`. |
| **`homeSettings`** | `object` | e.g. `testimonials`, `whyChooseUs` blocks (see `IDealSite` in `src/models/dealSite.ts`). |
| **`footer`** | `{ "shortDescription"?: string, "copyrightText"?: string }` | |
| **`featureSelection`** | `{ "mode"?: "auto" \| "manual", "propertyIds"?: string, "featuredListings"?: string[] }` | |
| **`support`** | `object` | Support section + `supportCards[]`. |
| **`socialLinks`** | `{ "website"?, "twitter"?, "instagram"?, "facebook"?, "linkedin"? }` | |
| **`about`** | `object` | Who we are, mission, team `profile.members[]`, etc. |
| **`inspectionSettings`** | `{ "defaultInspectionFee"?: number }` | |
| **`contactVisibility`** | `{ "showEmail"?, "showPhone"?, "enableContactForm"?, "showWhatsAppButton"?, "whatsappNumber"? }` | Booleans default true/false per model. |
| **`contactUs`** | `object` | Title, description, optional `location`. |
| **`subscribeSettings`** | `object` | Newsletter block copy and toggles. |

Omit any optional block to rely on schema defaults (often empty strings / sensible defaults).

#### Minimal example body

```json
{
  "publicSlug": "acme-properties-lagos",
  "title": "ACME Properties",
  "description": "Residential sales and lettings across Lagos.",
  "paymentDetails": {
    "businessName": "ACME Properties Ltd",
    "sortCode": "058",
    "accountNumber": "0123456789",
    "primaryContactEmail": "ops@acme.example",
    "primaryContactName": "Jane Doe",
    "primaryContactPhone": "+2348012345678"
  },
  "publicPage": {
    "heroTitle": "Find your next home",
    "heroSubtitle": "Trusted listings and inspections.",
    "ctaText": "View listings",
    "ctaLink": "/buy"
  }
}
```

#### **201** response shape

```json
{
  "success": true,
  "message": "Public access page created successfully",
  "data": {}
}
```

`data` is the full **DealSite** document as stored (including Paystack-populated **`paymentDetails`**, **`createdBy`**, **`status`: `"paused"`**, timestamps). Use it to confirm `publicSlug` and subaccount fields.

---

## WhatsApp templates (keys)

| Key | When |
|-----|------|
| `admin_provisioned_account` | After **`POST /api/admin/users/register`** (no password in WA body) |
| `property_created_by_admin` | After **`POST /api/admin/properties/create`** |

---

## Errors (common)

| HTTP | Meaning |
|------|--------|
| 400 | Validation / missing `owner` on admin create |
| 401/403 | Auth / inactive account / email not verified (unchanged) |
| 403 | Listing limit, missing subscription, or Agent KYC not approved |
| 404 | Unknown `userId` / owner |

---

*Last updated to match backend implementation in this repository.*
