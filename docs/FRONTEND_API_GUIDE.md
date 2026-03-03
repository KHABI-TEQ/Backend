# Frontend API Guide — LASRERA updates (Developers, Market Place, Request To Market, Transaction fees, Onboarding)

This document is for **frontend developers and Cursor agents** working on the frontend codebase. It describes how to consume the backend APIs for:

- **Developers** (new user type) and **Landlords** (Landowners)
- **LASRERA Market Place** (list and publish properties)
- **Request To Market** (Agent requests; Publisher accepts/rejects)
- **Inspection flow** (buyer requests; Agent/Developer accepts or rejects; optional inspection fee ₦1,000–₦50,000 and payment link — see **Section 8**)
- **Transaction registration fee by price** (₦100k / ₦150k bands)
- **Onboarding**: Registration, email verification, login, social sign-up/login

Use your configured **API base URL** https://khabiteq-realty.onrender.com/api as the prefix for all paths below. Paths are relative to that base.

---

## 1. Onboarding (Landlords and Developers)

Landlords (user type **Landowners**) and **Developers** use the same auth flows as Agents. No separate onboarding product; the backend treats them as account types via `userType`.

### 1.1 Registration (email/password)

**Endpoint:** `POST /auth/register`  
**Auth:** None (public).

**Request body (JSON):**

| Field         | Type   | Required | Description |
|--------------|--------|----------|-------------|
| firstName    | string | Yes      | |
| lastName     | string | Yes      | |
| email        | string | Yes      | Valid email. |
| password     | string | Yes      | Min 6 characters. |
| **userType** | string | Yes      | One of: `"Landowners"`, `"Agent"`, `"FieldAgent"`, `"Developer"`. Use `"Landowners"` for Landlord, `"Developer"` for Developer. |
| phoneNumber  | string | Yes      | |
| address      | string \| object | Yes | |
| referralCode | string | No       | Optional. |

**Success response (200):**

```json
{
  "success": true,
  "message": "Account created successfully. Please verify your email."
}
```

**Notes:**

- Backend sends a verification email. User must open the link to verify.
- After verification, user can log in; no extra admin approval for Landowners or Developers.

---

### 1.2 Email verification

User clicks the link in the email. The link targets the **frontend** (e.g. `{CLIENT_LINK}/auth/verify-account?token=...`). The frontend should call:

**Endpoint:** `GET /auth/verifyAccount?token={token}`  
**Auth:** None (public).  
**Query:** `token` — verification token from the email link.

**Success response (200):**

Returns login-style payload (token + user). Example shape:

```json
{
  "success": true,
  "message": "Email verified successfully!",
  "data": {
    "token": "<JWT>",
    "user": {
      "id": "...",
      "firstName": "...",
      "lastName": "...",
      "email": "...",
      "phoneNumber": "...",
      "userType": "Landowners" | "Agent" | "FieldAgent" | "Developer",
      "isAccountVerified": true,
      "accountApproved": false,
      "accountStatus": "active",
      "address": "...",
      "profile_picture": "...",
      "accountId": "...",
      ...
    }
  }
}
```

For **Developer**, the backend may include `dealSite` and `activeSubscription` in `user` (same pattern as Agent) when implemented on the verify response. For **Agent**, `user` may include `agentData`, `isAccountApproved`, and optionally `dealSite`/`activeSubscription` depending on implementation.

**Error (400):** Token missing, invalid, or expired.

---

### 1.3 Login (email/password)

**Endpoint:** `POST /auth/login`  
**Auth:** None (public).

**Request body (JSON):**

| Field    | Type   | Required | Description |
|----------|--------|----------|-------------|
| email    | string | Yes      | |
| password | string | Yes      | |

**Success response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<JWT>",
    "user": {
      "id": "...",
      "firstName": "...",
      "lastName": "...",
      "email": "...",
      "phoneNumber": "...",
      "userType": "Landowners" | "Agent" | "FieldAgent" | "Developer",
      "isAccountVerified": true,
      "accountApproved": false,
      "accountStatus": "active",
      "address": "...",
      "profile_picture": "...",
      "accountId": "...",
      "isAccountApproved": false,
      "activeSubscription": { ... } | null,
      "dealSite": { ... } | null
    }
  }
}
```

**Developer-specific:** When `userType === "Developer"`, `user` includes:

- `activeSubscription` — same shape as Agent (subscription snapshot with features); `null` if none.
- `dealSite` — same shape as Agent (public page details); `null` if not created.

Use these to show public page and subscription state (e.g. show DealSite link, prompt to subscribe if needed).

**Agent-specific:** When `userType === "Agent"`, `user` may include `agentData`, `isAccountApproved`, `activeSubscription`, `dealSite`.

**Errors:**

- 403 — Email not verified: backend may resend verification email; message indicates this.
- 403 — Account inactive or deleted.

---

### 1.4 Social sign-up / login (Google)

**Endpoint:** `POST /auth/googleAuth`  
**Auth:** None (public).

**Request body (JSON):**

| Field        | Type   | Required | Description |
|-------------|--------|----------|-------------|
| idToken     | string | Yes      | Google ID token. |
| userType    | string | No*      | *Required for **new** users. One of: `"Landowners"`, `"Agent"`, `"Developer"`. |
| referralCode| string | No       | Optional. |

If the email is not found, backend creates a new user; **for new users `userType` must be sent** so the account is created as Landowner, Agent, or Developer. For existing users, `userType` is ignored.

**Success response (200):** Same shape as login: `data.token`, `data.user` (with `userType`, and for Developer: `activeSubscription`, `dealSite`).

**Error (404):** Account not found and `userType` not provided — message: *"Account not found. If you are a new user, please register first, specifying your account type (Landowners, Agent, or Developer)."*

---

### 1.5 Social sign-up / login (Facebook)

**Endpoint:** `POST /auth/facebookAuth`  
**Auth:** None (public).

**Request body (JSON):** Same as Google: `idToken` (Facebook access token), optional `userType` (required for new users), optional `referralCode`.  
**Success / errors:** Same idea as Google (login payload or 404 if new user without `userType`).

---

### 1.6 Other auth-related routes (same as before)

- Resend verification: `POST /auth/resendVerificationToken` (body as required by backend).
- Reset password request: `POST /auth/resetPasswordRequest`
- Verify reset code: `POST /auth/verifyPasswordResetCode`
- Reset password: `POST /auth/resetPassword`

---

## 2. User types and capabilities

| userType     | Can set listingScope to lasrera_marketplace | Can use "Request To Market" (as requester) | DealSite / subscription |
|-------------|---------------------------------------------|--------------------------------------------|--------------------------|
| Landowners  | Yes                                          | No (can be Publisher)                       | No                       |
| Developer   | Yes                                          | No (can be Publisher)                       | Yes (same as Agent)      |
| Agent       | No (forced to agent_listing)                 | Yes                                         | Yes                      |
| FieldAgent  | No                                           | No                                          | No                       |

- **Landowners** and **Developer** can **publish to LASRERA Market Place** by creating/editing a property with `listingScope: "lasrera_marketplace"`.
- **Agents** can **request to market** a marketplace property (see Request To Market below).
- **Developers** get `dealSite` and `activeSubscription` in login (and optionally verify) response; subscription is required to create/maintain DealSite and to post properties (same as Agent).

---

## 3. LASRERA Market Place

### 3.1 List marketplace properties (public)

**Endpoint:** `GET /lasrera-marketplace/properties`  
**Auth:** None (public).

**Query parameters:**

| Param    | Type   | Required | Description |
|----------|--------|----------|-------------|
| page     | string | No       | Default `1`. |
| limit    | string | No       | Default `20`, max 100. |
| briefType| string | No       | Filter by brief type. |
| state    | string | No       | Filter by location state (regex). |
| minPrice | string | No       | Min price (number as string). |
| maxPrice | string | No       | Max price (number as string). |

**Success response (200):**

```json
{
  "success": true,
  "message": "LASRERA Market Place properties. Contact is not shown; use 'Request To Market' (Agents only).",
  "data": [
    {
      "_id": "...",
      "propertyType": "...",
      "propertyCategory": "...",
      "price": 1234567,
      "location": { ... },
      "additionalFeatures": { ... },
      "pictures": [ ... ],
      "briefType": "...",
      "description": "...",
      "createdAt": "..."
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

**Note:** Contact details of landlord/developer are **not** returned. Each listing should show a **"Request To Market"** button; only **Agents** (authenticated) can call the create request API.

---

### 3.2 Publish property to LASRERA Market Place (Landlord / Developer)

Use the **existing account property create/update** API. Ensure the user is authenticated (Bearer token) and is **Landowners** or **Developer**.

**Create property:** `POST /account/properties/create`  
**Auth:** Bearer token (account auth).

Include in the request body:

| Field         | Type   | Required | Description |
|---------------|--------|----------|-------------|
| listingScope  | string | No       | Use `"lasrera_marketplace"` to publish only to LASRERA Market Place. Default `"agent_listing"`. Only **Landowners** and **Developer** can set `"lasrera_marketplace"`; Agents are forced to `agent_listing`. |

Plus all other required property fields (propertyType, propertyCategory, price, location, etc.) as per existing property schema.

**Edit property:** `PATCH /account/properties/:propertyId/edit` — same rules; only Landowners/Developer can set or keep `listingScope: "lasrera_marketplace"`.

---

## 4. Request To Market

Only **Agents** can create a request. **Publishers** (Landlord or Developer who own the property) accept or reject.

### 4.1 Create request (Agent only)

**Endpoint:** `POST /account/request-to-market`  
**Auth:** Bearer token (Agent).

**Request body (JSON):**

| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| propertyId | string | Yes      | Property `_id` (must be a LASRERA Market Place property). |

**Success response (201):**

```json
{
  "success": true,
  "message": "Request to market submitted. The publisher will be notified to accept or reject.",
  "data": {
    "requestId": "...",
    "propertyId": "...",
    "status": "pending",
    "marketingFeeNaira": 50000
  }
}
```

**Errors:**

- 403 — Only Agents can request.
- 400 — propertyId missing; or property not marketplace; or property not owned by Landlord/Developer.
- 409 — Already a pending request for this property by this agent.

---

### 4.2 List requests (Agent or Publisher)

**Endpoint:** `GET /account/request-to-market`  
**Auth:** Bearer token (Agent, Landowners, or Developer).

**Query parameters:**

| Param  | Type   | Required | Description |
|--------|--------|----------|-------------|
| role   | string | No       | `agent` — my requests; `publisher` — requests for my properties. If omitted, backend infers from userType (Agent → agent, Landowners/Developer → publisher). |
| status | string | No       | Filter: `pending`, `accepted`, `rejected`. |
| page   | string | No       | Default `1`. |
| limit  | string | No       | Default `20`, max 100. |

**Success response (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "propertyId": { "_id": "...", "location": {...}, "price": ..., "briefType": "...", "pictures": [...], "listingScope": "...", ... },
      "requestedByAgentId": { "firstName": "...", "lastName": "...", "fullName": "...", "email": "..." },
      "publisherId": { "firstName": "...", "lastName": "...", "fullName": "...", "email": "..." },
      "status": "pending" | "accepted" | "rejected",
      "marketingFeeNaira": 50000,
      "rejectedReason": "...",
      "acceptedAt": "...",
      "rejectedAt": "...",
      "createdAt": "..."
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 4.3 Respond to request (Publisher only)

**Endpoint:** `POST /account/request-to-market/:requestId/respond`  
**Auth:** Bearer token (must be the Publisher of the property).

**Request body (JSON):**

| Field          | Type   | Required | Description |
|----------------|--------|----------|-------------|
| action         | string | Yes      | `"accept"` or `"reject"`. |
| rejectedReason | string | No       | Optional; use when `action === "reject"`. |

**Success response (200) — reject:**

```json
{
  "success": true,
  "message": "Request rejected. The agent has been notified.",
  "data": { "status": "rejected" }
}
```

**Success response (200) — accept:**

When the Agent has a Paystack sub-account, the backend creates a split payment and may return a payment URL and send the payment link by email to the Publisher.

```json
{
  "success": true,
  "message": "Request accepted. The property is now visible on the agent's public page. A payment link has been sent to your email to pay the marketing fee to the agent.",
  "data": {
    "status": "accepted",
    "propertyId": "...",
    "marketingFeeNaira": 50000,
    "paymentUrl": "https://checkout.paystack.com/..."
  }
}
```

If no payment link could be generated (e.g. Agent has no sub-account), `data.paymentUrl` may be undefined and the message will ask the Publisher to arrange payment directly with the Agent.

**Errors:**

- 403 — Only the property publisher can respond.
- 400 — Request already responded to; or invalid `action`.

---

## 5. Transaction registration fee by price

Processing fee for transaction registration is **no longer a percentage**. It is determined only by **transaction/property value** (same bands for all transaction types):

| Property/transaction value | Processing fee (Naira) |
|----------------------------|-------------------------|
| Below ₦5M                  | No fee (0)              |
| ₦5M – ₦50M                 | ₦100,000                |
| Above ₦50M                 | ₦150,000                |

The **register** endpoint returns `data.processingFee` (in Naira). Use it (and optional `data.paymentUrl`) when building the transaction registration UI. No frontend fee calculation is required; the backend uses the value band logic above.

---

## 6. Transaction registration APIs (summary)

These are used by the **public/DealSite** frontend for the transaction registration portal. Base path: **`/transaction-registration`** (relative to API base URL).

### 6.1 Processing fee logic (how the backend determines the fee)

The **processing fee** is determined **only by the transaction value** (in Naira) you send when registering. **Transaction type does not change the fee.** The backend uses a single set of value bands:

| Transaction value (Naira) | Processing fee (Naira) |
|---------------------------|-------------------------|
| **Below ₦5,000,000**      | **₦0** (no fee)        |
| **₦5,000,000 – ₦50,000,000** | **₦100,000**       |
| **Above ₦50,000,000**    | **₦150,000**           |

- **Do not calculate the fee on the frontend.** Send `transactionValue` in the register request; the backend returns `data.processingFee` in the response.
- When **`data.processingFee` is 0**: no payment is required; `data.paymentUrl` will not be present.
- When **`data.processingFee` > 0**: the backend may return `data.paymentUrl` (Paystack). Show the payment link so the user can pay the processing fee; after successful payment, registration moves to the appropriate status (e.g. pending completion).

### 6.2 Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/transaction-registration/types` | List transaction types with labels, eligibility, regulatory requirements, and **display** value bands (for UI only; actual fee at register time uses the bands in 6.1). |
| GET | `/transaction-registration/guidelines` | Safe transaction guidelines (required docs, commission, ownership, etc.). |
| GET | `/transaction-registration/search` | Search by `address`, or `propertyId`, or both `lat` and `lng`. |
| GET | `/transaction-registration/check?propertyId=...` | Check registration status for a property. |
| GET | `/transaction-registration/egis-validate` | E-GIS validation stub (query: propertyId, address, or lat+lng). |
| POST | `/transaction-registration/register` | Submit registration. Backend computes `processingFee` from `transactionValue` (see 6.1) and returns `data.registrationId`, `data.processingFee`, and when fee > 0 optionally `data.paymentUrl`. |

### 6.3 Register request and response (summary)

**Request body** must include (among other fields):

- **`transactionType`** — slug (e.g. `rental_agreement`, `outright_sale`, `off_plan_purchase`, `joint_venture`).
- **`transactionValue`** — number (Naira). This is the value used to determine `processingFee` (see 6.1).
- **`propertyId`** — property ID.
- **`buyer`** — e.g. `{ email, fullName, phoneNumber }`.
- **`propertyIdentification`** — type, exactAddress, titleNumber, ownerName, lat, lng, surveyPlanRef, ownerConfirmation, etc., as per schema.

Optional: payment receipt fields (e.g. `paymentReceiptFileName`, `paymentReceiptBase64`) when the user has already paid elsewhere.

**Success response (200):**

```json
{
  "success": true,
  "data": {
    "registrationId": "...",
    "processingFee": 100000,
    "paymentUrl": "https://checkout.paystack.com/..."
  }
}
```

- **`processingFee`** — Always present; 0 when transaction value is below ₦5M, otherwise ₦100,000 or ₦150,000 per the table in 6.1.
- **`paymentUrl`** — Present when `processingFee` > 0 and the backend generated a Paystack link. Direct the user to this URL to pay the processing fee.

### 6.4 How the frontend should handle it

1. **Before submit:** Collect `transactionValue` (and all other required fields). You can show the user the **possible** fee ranges from Section 5 (or from `/transaction-registration/types` for display), but do **not** compute the final fee yourself.
2. **On submit:** Send the full register payload including `transactionValue`. Use the response `data.processingFee` and `data.paymentUrl`.
3. **After submit:** If `data.processingFee === 0`, show a success message (no payment step). If `data.processingFee > 0`, show the amount and, if present, a “Pay now” button/link using `data.paymentUrl`; after payment, the backend will update the registration status via webhook.

Full request/response shapes are documented in `docs/UPDATES.md` (Transaction Registration & DealSite API alignment).

---

## 7. DealSite and subscription (Developers / Agents)

- **Developers** can create and manage a **DealSite** (public access page) and have the same **subscription** obligation as Agents (required to create/maintain DealSite and to post properties).
- DealSite and subscription APIs are under **`/account`** (e.g. `/account/dealSite/setUp`, `/account/subscriptions/...`). Same as for Agents; use `user.dealSite` and `user.activeSubscription` from login (and verify) to drive UI (e.g. show DealSite link, subscription status, or prompt to subscribe).

---

## 8. Inspection flow (Agent/Developer & Buyer)

This section describes how the **inspection request** flow works from the frontend’s perspective: how a **buyer** submits a request, how an **Agent or Developer** (property owner) lists and responds to it, and when a **payment link** is sent to the buyer.

### 8.1 Flow overview

| Step | Who | Action |
|------|-----|--------|
| 1 | Buyer | Submits an inspection request (main app or DealSite). |
| 2 | Agent/Developer | Sees the request in “My inspections”, opens it, and **accepts** or **rejects**. |
| 3a | On **accept** | Optionally sets an **inspection fee** (₦1,000–₦50,000). If set, backend creates a Paystack payment link and emails the buyer; buyer pays to confirm. |
| 3b | On **reject** | Buyer is notified (email); no payment. |

Inspections can come from:

- **Main app** — buyer uses `POST /inspections/request-inspection` (see your existing inspection docs).
- **DealSite** — buyer uses `POST /deal-site/:publicSlug/inspections/makeRequest`. No fee is required at request time; the Agent/Developer can set the fee when **accepting**.

The **same respond endpoint** is used for both: `POST /account/my-inspections/:inspectionId/respond`. The backend detects DealSite vs main app from the inspection’s `receiverMode`.

---

### 8.2 Agent/Developer: list and view inspections

**List inspections (paginated)**  
**Endpoint:** `GET /account/my-inspections/fetchAll`  
**Auth:** Bearer token (Agent or Developer; must be the property owner).

**Query parameters (optional):**

| Param | Type | Description |
|-------|------|-------------|
| page | number | Default `1`. |
| limit | number | Default `10`. |
| status | string | Filter by booking status (e.g. `pending_approval`, `inspection_approved`, `pending_transaction`, `agent_rejected`). |
| inspectionType | string | e.g. `price`, `LOI`. |
| inspectionMode | string | e.g. `in_person`, `virtual`. |
| inspectionStatus | string | e.g. `new`, `accepted`, `rejected`. |
| stage | string | e.g. `inspection`, `negotiation`. |
| propertyId | string | Filter by property ID. |

**Success response (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "propertyId": { ... },
      "requestedBy": { ... },
      "owner": "...",
      "status": "pending_approval",
      "inspectionDate": "...",
      "inspectionTime": "...",
      "inspectionType": "price",
      "inspectionMode": "in_person",
      "receiverMode": { "type": "dealSite", "dealSiteID": "..." },
      "transaction": null,
      ...
    }
  ],
  "pagination": { "total": 5, "page": 1, "limit": 10, "totalPages": 1 }
}
```

Use `receiverMode.type === "dealSite"` to show a “DealSite” badge or to enable the **optional inspection fee** when accepting (see below).

**Get one inspection**  
**Endpoint:** `GET /account/my-inspections/:inspectionId`  
**Auth:** Bearer token (must be the owner of the inspection’s property).

**Success response (200):** Single inspection object (with populated `propertyId`, `requestedBy`, `transaction`).

**Inspection stats**  
**Endpoint:** `GET /account/my-inspections/stats`  
**Auth:** Bearer token.  
Returns counts (e.g. pending, completed, cancelled) for dashboard widgets.

---

### 8.3 Agent/Developer: respond (accept or reject)

**Endpoint:** `POST /account/my-inspections/:inspectionId/respond`  
**Auth:** Bearer token (Agent or Developer; must be the property owner).  
Only inspections with `status === "pending_approval"` can be responded to.

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| action | string | Yes | `"accept"` or `"reject"`. |
| note | string | No | Optional message (e.g. shown to buyer on reject). |
| inspectionFee | number | No | **Accept only.** Inspection fee in Naira. Allowed range: **₦1,000 – ₦50,000**. |

**Inspection fee behaviour:**

- **Main-app inspections:** The property may already have an `inspectionFee`. If the owner sends `inspectionFee` in the request body, it **overrides** that value (must still be 1,000–50,000). Payment link is created and sent to the buyer.
- **DealSite inspections:** There is no fee at request time. When **accepting**, the owner can **optionally** send `inspectionFee` (1,000–50,000).  
  - If **inspectionFee is sent and in range** → backend creates a Paystack payment link, saves the transaction on the inspection, and emails the buyer with the payment link.  
  - If **inspectionFee is omitted or out of range** → acceptance only; buyer gets an “accepted” email with no payment link.

**Reject — success response (200):**

```json
{
  "success": true,
  "message": "Inspection request rejected. The buyer has been notified.",
  "data": { "status": "agent_rejected" }
}
```

**Accept without payment link (e.g. DealSite accept with no fee) — success response (200):**

```json
{
  "success": true,
  "message": "Inspection accepted. The buyer has been notified.",
  "data": { "status": "inspection_approved" }
}
```

**Accept with payment link — success response (200):**

```json
{
  "success": true,
  "message": "Inspection accepted. The buyer has been sent a payment link for the inspection fee.",
  "data": {
    "status": "pending_transaction",
    "paymentUrl": "https://checkout.paystack.com/...",
    "inspectionFee": 5000
  }
}
```

**Frontend implementation tips:**

- On the “Respond to inspection” screen, show:
  - **Accept** and **Reject** buttons.
  - For **Accept**, an optional **“Inspection fee (₦)”** input. Validate: number, 1,000–50,000 (or leave empty for “no fee” on DealSite).
- For **DealSite** inspections (`receiverMode.type === "dealSite"`), you can show a short note: “You can optionally set an inspection fee (₦1,000–₦50,000). If set, the buyer will receive a payment link.”
- After a successful accept with `data.paymentUrl`, you can show: “Inspection accepted. A payment link has been sent to the buyer’s email.” Optionally show the link for support/copy.

**Errors:**

- **400** — `action` not `"accept"` or `"reject"`; or inspection not in `pending_approval`; or `inspectionFee` not in 1,000–50,000 when provided.
- **403** — User is not the property owner.
- **404** — Inspection not found.

---

### 8.4 Buyer: submission (DealSite)

**Endpoint:** `POST /deal-site/:publicSlug/inspections/makeRequest`  
**Auth:** None (public).  
**Path:** `publicSlug` = the DealSite’s public slug (e.g. from the DealSite URL).

**Request body (JSON):** Same shape as the main-app inspection request (see validator): `requestedBy` (fullName, phoneNumber, email, optional whatsAppNumber), `inspectionDetails` (inspectionDate, inspectionTime, inspectionMode), and `properties` array with `propertyId`, `inspectionType`, and optional `negotiationPrice` / `letterOfIntention`.

**Success response (200):**

```json
{
  "success": true,
  "message": "Inspection request submitted. The agent will respond shortly.",
  "data": {
    "inspections": [ { "_id": "...", ... } ],
    "warnings": { "<propertyId>": "This property has an active or completed registered transaction." }
  }
}
```

After submission, the buyer receives emails when the Agent/Developer **accepts** (with or without payment link) or **rejects**. If a payment link is sent, the email subject is “Inspection accepted – complete your payment” and contains the Paystack link.

---

### 8.5 Summary for frontend

| Actor | Endpoint | Purpose |
|-------|----------|---------|
| Buyer (DealSite) | `POST /deal-site/:publicSlug/inspections/makeRequest` | Submit inspection request (no auth). |
| Agent/Developer | `GET /account/my-inspections/fetchAll` | List my inspections (filters: status, etc.). |
| Agent/Developer | `GET /account/my-inspections/:inspectionId` | Get one inspection details. |
| Agent/Developer | `POST /account/my-inspections/:inspectionId/respond` | Accept (optional `inspectionFee` 1000–50000) or Reject. |

- **Accept + inspectionFee in range** → Buyer gets email with **payment link**; response includes `paymentUrl` and `inspectionFee`.
- **Accept + no fee (or fee omitted)** → Buyer gets “accepted” email only; no payment link.

---

## 9. Quick reference — base paths and auth

| Area | Base path | Auth |
|------|-----------|------|
| Auth (register, login, verify, social) | `/auth` | None for these endpoints |
| Account (profile, properties, my-inspections, request-to-market, dealSite, subscriptions) | `/account` | Bearer token (account) |
| LASRERA Market Place list | `/lasrera-marketplace/properties` | None (optional Bearer for currentUserHasRequested) |
| DealSite public (e.g. inspection request) | `/deal-site/:publicSlug/...` | None |
| Transaction registration (types, guidelines, search, check, register) | `/transaction-registration` | None (public) |

Use this guide together with `docs/UPDATES.md` for full backend context. For admin-only APIs (e.g. transaction registration list), see `docs/ADMIN_API_GUIDE.md`.
