# Agent marketplace: general preferences & “Match preference” (client integration)

This describes how the **dashboard / marketplace UI** should call the backend after the change where **general preference submit** no longer auto-pairs. DealSite submit is unchanged.

## Auth

All endpoints below require the **same authenticated session** as the rest of the agent account API (e.g. `Authorization: Bearer <token>` on `GET/POST /api/account/...`).

## 1. List general (main-site) preferences

Buyers who used **`POST /api/preferences/submit`** have `receiverMode.type` **not** equal to `dealSite`. Those rows are listed here for the agent marketplace.

**Request**

- `GET /api/account/marketplace/general-preferences`
- Query (optional): `page`, `limit`, `keyword`, `preferenceMode`, `preferenceType`, `documentType`, `propertyCondition` (same ideas as the legacy public list).

**Response**

- `data[]`: each item is the usual formatted preference **plus** `receiverMode`.
- **`contactInfo`** includes client name, email, phone (and JV company fields where applicable).
- **`buyer`**: populated buyer document when present.

**UI**

- Render this list on the agent **marketplace** screen.
- Show **name + contact** from `contactInfo` (and/or `buyer`) so the agent can follow up.

## 2. “Match preference” button

When the agent clicks **Match preference** for a given row:

**Request**

- `POST /api/account/marketplace/preferences/:preferenceId/match`
- No body required.
- `:preferenceId` = the preference’s MongoDB id (e.g. `data[i].preferenceId` from the list response).

** Preconditions (backend)**

- The logged-in user must own a **DealSite** with **`status: "running"`**. Otherwise the API returns **400** with a clear message (agent must activate their public page first).
- The preference must be a **general** submission (`receiverMode.type` ≠ `dealSite`). Otherwise **400**.
- Preference **`status`** must be **`approved`** or **`matched`**.

**Success (200)**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "matchedCount": 0,
    "matchEmailBaseUrl": "https://<your-slug>.khabiteq.com"
  }
}
```

- **`matchedCount > 0`**: matches were saved and the **buyer** was emailed; the **“view matches”** link in that email uses **`matchEmailBaseUrl`** (the agent’s public access origin), same idea as DealSite submit flows.
- **`matchedCount === 0`**: the buyer may receive the **no-match** email (same behavior as the previous auto-pair path).

**Client handling**

1. **Disable or hide** the button while the request is in flight (`loading` state).
2. On **401**: redirect to login or refresh token.
3. On **400** with “active public access page”: show a CTA to **enable / resume** the DealSite in settings.
4. On **400** “submitted on an agent DealSite”: hide this action for that row in the future (optional: filter list to `receiverMode.type !== 'dealSite'` only — the list API already does).
5. On **200**: show a toast using `message`; optionally show `matchedCount` and avoid duplicate clicks if you want to prevent multiple runs (product decision).

## 3. General submit (buyer) — client expectation

- **`POST /api/preferences/submit`** no longer triggers auto-pairing or match/no-match emails at submit time.
- The buyer still receives the **preference submitted** confirmation email only.
- Matching happens only when an agent calls **`POST .../match`** (or other future admin/tools flows).

## 4. DealSite submit (unchanged)

- **`POST /api/deal-site/:publicSlug/submit-preference`** still runs auto-pairing after submit (and sets `receiverMode.type` to `dealSite`).
