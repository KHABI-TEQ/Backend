# Admin in-app notifications — frontend integration

Base URL (same as other admin APIs):

```http
{{BASE_URL}}/api/admin
```

All endpoints below require authentication:

```http
Authorization: Bearer <admin_jwt>
```

The JWT is returned from `POST /api/admin/login` (same token used for the admin dashboard).

---

## Behaviour overview

- When important events occur (KYC submitted, document verification requests, transaction registrations, agent reports, syndication applications, DealSite reports, transaction-registration fee paid), the backend creates **one notification row per active admin** (`isActive: true`). Each admin has their own **read/unread** state.
- The logged-in admin only sees **their own** rows (`admin` = their Admin `_id`).
- `meta` is a JSON object for deep-linking in the UI (IDs, suggested paths). Keys vary by `type`.

---

## Notification `type` values

| `type` | Meaning |
|--------|---------|
| `kyc_submitted` | Agent submitted KYC for review |
| `document_verification_submitted` | Public document verification batch created |
| `transaction_registration_submitted` | Buyer submitted transaction registration |
| `transaction_registration_fee_paid` | Paystack confirmed processing fee for a registration |
| `agent_report_submitted` | Buyer filed an agent report after a completed inspection |
| `syndication_application_submitted` | External listing platform application submitted |
| `dealsite_reported` | Public report filed against a DealSite |
| `general` | Reserved / fallback |

---

## 1. List notifications

**Request**

```http
GET /api/admin/notifications?page=1&limit=20&isRead=false&type=kyc_submitted
```

| Query | Required | Description |
|-------|----------|-------------|
| `page` | No | Default `1` |
| `limit` | No | Default `20`, max `100` |
| `isRead` | No | `true` or `false` — filter by read state |
| `type` | No | One of the types in the table above |

**Response `200`**

```json
{
  "success": true,
  "message": "Admin notifications",
  "data": [
    {
      "_id": "674a1b2c3d4e5f6789012345",
      "admin": "674901234567890123456789",
      "title": "New KYC verification request",
      "message": "Jane (jane@example.com) submitted KYC for review.",
      "isRead": false,
      "type": "kyc_submitted",
      "meta": {
        "userId": "674901234567890123456789",
        "reviewPath": "/agents/674901234567890123456789"
      },
      "createdAt": "2026-05-11T10:15:30.000Z",
      "updatedAt": "2026-05-11T10:15:30.000Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

Notes:

- `data` items are plain JSON (`lean()`); use `_id` as the notification id for read/delete.
- Sort order is **newest first** (`createdAt` descending).

---

## 2. Unread count

**Request**

```http
GET /api/admin/notifications/unread-count
```

**Response `200`**

```json
{
  "success": true,
  "message": "Unread count",
  "data": {
    "unreadCount": 7
  }
}
```

Typical use: badge on the bell icon; poll or refresh after login.

---

## 3. Mark one notification as read

**Request**

```http
PUT /api/admin/notifications/:notificationId/read
```

**Response `200`**

```json
{
  "success": true,
  "message": "Marked as read",
  "data": {
    "notificationId": "674a1b2c3d4e5f6789012345"
  }
}
```

**Response `404`** — id does not exist or belongs to another admin.

---

## 4. Mark all as read

**Request**

```http
PUT /api/admin/notifications/read-all
```

**Response `200`**

```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "modifiedCount": 12
  }
}
```

`modifiedCount` is how many rows were unread and updated.

---

## 5. Delete one notification

**Request**

```http
DELETE /api/admin/notifications/:notificationId
```

**Response `200`**

```json
{
  "success": true,
  "message": "Notification deleted",
  "data": {
    "notificationId": "674a1b2c3d4e5f6789012345"
  }
}
```

**Response `404`** — not found or not owned by this admin.

---

## Route registration note

Specific paths are registered **before** parameterized routes:

- `GET /notifications/unread-count` is registered so it is not captured as a generic `notificationId` segment.

---

## UI suggestions

1. **Inbox** — `GET /notifications` with infinite scroll using `page` / `limit`.
2. **Tabs or filters** — `type` and `isRead` query params.
3. **Deep links** — read `meta` (e.g. `registrationId`, `reportId`, `reviewPath`) and navigate to the matching admin screen.
4. **Optimistic read** — call `PUT .../read` when the user opens a notification row.

---

## Events that create notifications (reference)

| Event | `type` |
|-------|--------|
| Agent submits KYC | `kyc_submitted` |
| Public document verification documents submitted (after Paystack init + DB create) | `document_verification_submitted` |
| Transaction registration form submitted | `transaction_registration_submitted` |
| Paystack webhook: transaction-registration fee paid | `transaction_registration_fee_paid` |
| Buyer submits agent report (post-inspection) | `agent_report_submitted` |
| Syndication platform application API | `syndication_application_submitted` |
| DealSite reported | `dealsite_reported` |

Additional event types can be added server-side by extending `AdminNotificationType` and calling `notifyAllActiveAdmins`.
