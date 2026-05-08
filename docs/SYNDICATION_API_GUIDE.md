# Syndication API Guide (Frontend)

This document explains how frontend should consume the new syndication APIs.

## Overview

Syndication is now split into:

1. `SyndicationPlatform` (admin-owned global catalog)
2. `PlatformConnection` (user-owned link to an approved platform)

Flow:

1. External platform can submit a public onboarding application.
2. Admin reviews and approves/rejects applications.
3. On approval, backend auto-creates a `SyndicationPlatform` blueprint.
4. User fetches approved platforms.
5. User connects to one approved platform.
6. User can enable/disable each connection.
7. Property events enqueue jobs and dispatcher pushes to connected platforms.

---

## Base URL

- All endpoints are under `/api`
- Admin endpoints require admin auth token/cookie.
- Account endpoints require authenticated user session.
- Public platform-application endpoint does not require auth.

---

## Public API (Partner Onboarding)

## 1) Submit platform application

- **Method:** `POST`
- **URL:** `/api/third-party/syndication/platform-applications`

### Request body

```json
{
  "companyName": "PropertyPro Nigeria Ltd",
  "contactName": "Integration Team",
  "contactEmail": "api@propertypro.ng",
  "contactPhone": "+2348000000000",
  "platformName": "PropertyPro",
  "platformKeySuggestion": "propertypro",
  "authType": "api_key",
  "baseUrl": "https://api.propertypro.ng/v1",
  "webhookSupport": true,
  "docsUrl": "https://docs.propertypro.ng/api",
  "notes": "Please onboard us to Khabiteq syndication network."
}
```

### Success response (`201`)

```json
{
  "success": true,
  "message": "Platform application submitted successfully",
  "data": {
    "_id": "681d01094fbc8e53a4c5e001",
    "companyName": "PropertyPro Nigeria Ltd",
    "platformName": "PropertyPro",
    "platformKeySuggestion": "propertypro",
    "status": "pending",
    "createdAt": "2026-05-08T15:45:00.000Z"
  }
}
```

---

## Admin APIs

## 1) Create approved platform

- **Method:** `POST`
- **URL:** `/api/admin/syndication/platforms`

### Request body

```json
{
  "platformKey": "propertypro",
  "platformName": "PropertyPro",
  "description": "PropertyPro marketplace integration",
  "authType": "api_key",
  "config": {
    "baseUrl": "https://api.propertypro.ng/v1",
    "outboundEnabled": true,
    "inboundWebhookEnabled": true
  }
}
```

### Success response (`201`)

```json
{
  "success": true,
  "message": "Syndication platform created successfully",
  "data": {
    "_id": "681cd6cc4fbc8e53a4c5d001",
    "platformKey": "propertypro",
    "platformName": "PropertyPro",
    "description": "PropertyPro marketplace integration",
    "status": "approved",
    "authType": "api_key",
    "config": {
      "baseUrl": "https://api.propertypro.ng/v1",
      "outboundEnabled": true,
      "inboundWebhookEnabled": true
    },
    "createdAt": "2026-05-08T14:00:00.000Z",
    "updatedAt": "2026-05-08T14:00:00.000Z"
  }
}
```

---

## 2) Edit platform blueprint

- **Method:** `PATCH`
- **URL:** `/api/admin/syndication/platforms/:id`

### Request body (partial update allowed)

```json
{
  "platformName": "PropertyPro NG",
  "description": "Updated blueprint",
  "config": {
    "baseUrl": "https://api.propertypro.ng/v2",
    "outboundEnabled": true,
    "inboundWebhookEnabled": false
  }
}
```

### Success response (`200`)

```json
{
  "success": true,
  "message": "Syndication platform updated successfully",
  "data": {
    "_id": "681cd6cc4fbc8e53a4c5d001",
    "platformKey": "propertypro",
    "platformName": "PropertyPro NG",
    "status": "approved",
    "authType": "api_key",
    "config": {
      "baseUrl": "https://api.propertypro.ng/v2",
      "outboundEnabled": true,
      "inboundWebhookEnabled": false
    }
  }
}
```

---

## 3) Approve or disable platform

- **Method:** `PATCH`
- **URL:** `/api/admin/syndication/platforms/:id/status`

### Request body

```json
{
  "status": "disabled"
}
```

Allowed values: `approved`, `disabled`

### Success response (`200`)

```json
{
  "success": true,
  "message": "Syndication platform disabled successfully",
  "data": {
    "_id": "681cd6cc4fbc8e53a4c5d001",
    "status": "disabled"
  }
}
```

---

## 4) List all catalog platforms (admin)

- **Method:** `GET`
- **URL:** `/api/admin/syndication/platforms`
- Optional query: `?status=approved` or `?status=disabled`

### Success response (`200`)

```json
{
  "success": true,
  "message": "Syndication platforms fetched successfully",
  "data": [
    {
      "_id": "681cd6cc4fbc8e53a4c5d001",
      "platformKey": "propertypro",
      "platformName": "PropertyPro",
      "status": "approved",
      "authType": "api_key",
      "config": {
        "baseUrl": "https://api.propertypro.ng/v1",
        "outboundEnabled": true,
        "inboundWebhookEnabled": true
      }
    }
  ]
}
```

---

## 5) List platform applications (admin)

- **Method:** `GET`
- **URL:** `/api/admin/syndication/platform-applications`
- Optional query: `?status=pending|under_review|approved|rejected`

### Success response (`200`)

```json
{
  "success": true,
  "message": "Syndication platform applications fetched successfully",
  "data": [
    {
      "_id": "681d01094fbc8e53a4c5e001",
      "companyName": "PropertyPro Nigeria Ltd",
      "contactEmail": "api@propertypro.ng",
      "platformName": "PropertyPro",
      "platformKeySuggestion": "propertypro",
      "status": "pending"
    }
  ]
}
```

---

## 6) Review application (under review/reject)

- **Method:** `PATCH`
- **URL:** `/api/admin/syndication/platform-applications/:id/review`

### Request body

```json
{
  "status": "under_review",
  "reviewNotes": "Security checklist in progress."
}
```

Allowed review statuses: `under_review`, `rejected`

### Success response (`200`)

```json
{
  "success": true,
  "message": "Application marked as under_review",
  "data": {
    "_id": "681d01094fbc8e53a4c5e001",
    "status": "under_review",
    "reviewNotes": "Security checklist in progress."
  }
}
```

---

## 7) Approve application (auto-create platform)

- **Method:** `POST`
- **URL:** `/api/admin/syndication/platform-applications/:id/approve`

### Request body (optional overrides)

```json
{
  "reviewNotes": "Approved after compliance checks.",
  "platformKey": "propertypro",
  "platformName": "PropertyPro",
  "authType": "api_key",
  "config": {
    "baseUrl": "https://api.propertypro.ng/v1",
    "outboundEnabled": true,
    "inboundWebhookEnabled": true
  }
}
```

### Success response (`200`)

```json
{
  "success": true,
  "message": "Application approved and platform created successfully",
  "data": {
    "application": {
      "_id": "681d01094fbc8e53a4c5e001",
      "status": "approved",
      "approvedPlatformId": "681d022d4fbc8e53a4c5e101"
    },
    "platform": {
      "_id": "681d022d4fbc8e53a4c5e101",
      "platformKey": "propertypro",
      "platformName": "PropertyPro",
      "status": "approved"
    }
  }
}
```

---

## Account/User APIs

## 1) List approved platforms (for connection UI)

- **Method:** `GET`
- **URL:** `/api/account/syndication/platforms`

### Success response (`200`)

```json
{
  "success": true,
  "message": "Approved syndication platforms fetched successfully",
  "data": [
    {
      "_id": "681cd6cc4fbc8e53a4c5d001",
      "platformKey": "propertypro",
      "platformName": "PropertyPro",
      "description": "PropertyPro marketplace integration",
      "status": "approved",
      "authType": "api_key",
      "config": {
        "baseUrl": "https://api.propertypro.ng/v1",
        "outboundEnabled": true,
        "inboundWebhookEnabled": true
      }
    }
  ]
}
```

---

## 2) Connect to approved platform

- **Method:** `POST`
- **URL:** `/api/account/syndication/connections`

### Request body

```json
{
  "platformId": "681cd6cc4fbc8e53a4c5d001",
  "credentials": {
    "apiKey": "pp_live_xxxxx",
    "accessToken": null,
    "refreshToken": null,
    "tokenExpiresAt": null
  }
}
```

### Success response (`201`)

```json
{
  "success": true,
  "message": "Platform connection created successfully",
  "data": {
    "_id": "681cd7aa4fbc8e53a4c5d101",
    "userId": "681aa11f67fbf8df66e01111",
    "platformId": "681cd6cc4fbc8e53a4c5d001",
    "platformKey": "propertypro",
    "platformName": "PropertyPro",
    "authType": "api_key",
    "status": "active",
    "config": {
      "baseUrl": "https://api.propertypro.ng/v1",
      "outboundEnabled": true,
      "inboundWebhookEnabled": true
    }
  }
}
```

---

## 3) Enable/disable a user connection

- **Method:** `PATCH`
- **URL:** `/api/account/syndication/connections/:id/toggle`

### Request body

```json
{
  "enabled": false
}
```

### Success response (`200`)

```json
{
  "success": true,
  "message": "Platform connection disabled successfully",
  "data": {
    "_id": "681cd7aa4fbc8e53a4c5d101",
    "status": "inactive",
    "config": {
      "outboundEnabled": false
    }
  }
}
```

---

## 4) List my connections

- **Method:** `GET`
- **URL:** `/api/account/syndication/connections`

### Success response (`200`)

```json
{
  "success": true,
  "message": "Syndication connections fetched successfully",
  "data": [
    {
      "_id": "681cd7aa4fbc8e53a4c5d101",
      "platformKey": "propertypro",
      "platformName": "PropertyPro",
      "status": "active",
      "platformId": {
        "_id": "681cd6cc4fbc8e53a4c5d001",
        "platformKey": "propertypro",
        "platformName": "PropertyPro",
        "status": "approved",
        "config": {
          "baseUrl": "https://api.propertypro.ng/v1",
          "outboundEnabled": true,
          "inboundWebhookEnabled": true
        }
      }
    }
  ]
}
```

---

## Frontend notes

- Keep `platformId` from approved platform list and use it when creating a connection.
- Do not hardcode base URLs on frontend; backend controls all blueprints.
- Use `enabled` toggle to pause/resume syndication per user connection.
- If a platform is disabled by admin, its user connections will not dispatch outbound jobs.
- Public website should submit partner applications through `/api/third-party/syndication/platform-applications`.
- Admin portal should process applications before users can connect to those platforms.

---

## Common error patterns

- `400`: invalid payload or platform not approved.
- `401`: user/admin not authenticated.
- `404`: record not found.
- `409`: duplicate connection or duplicate platform key.

