# Frontend API Guide — LASRERA updates (Developers, Market Place, Request To Market, Transaction fees, Onboarding)

This document is for **frontend developers and Cursor agents** working on the frontend codebase. It describes how to consume the backend APIs for:

- **Developers** (new user type) and **Landlords** (Landowners)
- **LASRERA Market Place** (list and publish properties)
- **Request To Market** (Agent requests; Publisher accepts/rejects)
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

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/transaction-registration/types` | List transaction types with value bands, eligibility, etc. |
| GET | `/transaction-registration/guidelines` | Safe transaction guidelines (required docs, commission, ownership, etc.). |
| GET | `/transaction-registration/search` | Search by `address`, or `propertyId`, or both `lat` and `lng`. |
| GET | `/transaction-registration/check?propertyId=...` | Check registration status for a property. |
| GET | `/transaction-registration/egis-validate` | E-GIS validation stub (query: propertyId, address, or lat+lng). |
| POST | `/transaction-registration/register` | Submit registration; backend returns `processingFee` and optionally `paymentUrl` (Paystack). |

**Register request body** (summary): includes `transactionType` (slug), `propertyIdentification` (type, exactAddress, titleNumber, ownerName, lat, lng, surveyPlanRef, ownerConfirmation), and optional payment receipt fields. **Processing fee** is computed by the backend from transaction value using the bands in **Section 5**; response includes `data.registrationId`, `data.processingFee`, and when applicable `data.paymentUrl`.

Full request/response shapes are documented in `docs/UPDATES.md` (Transaction Registration & DealSite API alignment).

---

## 7. DealSite and subscription (Developers / Agents)

- **Developers** can create and manage a **DealSite** (public access page) and have the same **subscription** obligation as Agents (required to create/maintain DealSite and to post properties).
- DealSite and subscription APIs are under **`/account`** (e.g. `/account/dealSite/setUp`, `/account/subscriptions/...`). Same as for Agents; use `user.dealSite` and `user.activeSubscription` from login (and verify) to drive UI (e.g. show DealSite link, subscription status, or prompt to subscribe).

---

## 8. Quick reference — base paths and auth

| Area | Base path | Auth |
|------|-----------|------|
| Auth (register, login, verify, social) | `/auth` | None for these endpoints |
| Account (profile, properties, request-to-market, dealSite, subscriptions) | `/account` | Bearer token (account) |
| LASRERA Market Place list | `/lasrera-marketplace/properties` | None |
| Transaction registration (types, guidelines, search, check, register) | `/transaction-registration` | None (public) |

Use this guide together with `docs/UPDATES.md` for full backend context. For admin-only APIs (e.g. transaction registration list), see `docs/ADMIN_API_GUIDE.md`.
