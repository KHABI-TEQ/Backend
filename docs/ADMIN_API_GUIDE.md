# Admin API Guide — Inspection Tracking, Ratings, Complaints & Transaction Registration

This document lists **admin-only** API routes for **inspection tracking**, **buyer ratings**, **complaints/reports**, and **transaction registration tracking**. It is intended for the frontend team so they can build or extend the admin dashboard.

**Base URL:** All routes below are relative to the admin base path. The full base for admin is **`/api/admin`**. Example: `GET /api/admin/inspections`.

**Authentication:** Every route in this guide requires **admin authentication**. Send the admin session or token (e.g. Bearer token or cookie) as your app normally does for admin endpoints.

---

## 1. Inspection tracking

Use these endpoints to list inspections, view a single inspection with its activity timeline, get inspection stats, and fetch the activity log by inspection or property.

### 1.1 List all inspections

**Purpose:** Get a paginated list of all inspection requests. Use filters to narrow by status, stage, property, or agent (owner). No status is hidden (e.g. pending_approval, pending_transaction, agent_rejected, completed).

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/admin/inspections` |
| **Auth** | Admin required |

**Query parameters (all optional):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number (string in URL) | Page number, default `1`. |
| `limit` | number (string in URL) | Items per page, default `20`. Max 100. |
| `status` | string | Filter by inspection status (e.g. `pending_approval`, `agent_rejected`, `pending_transaction`, `inspection_approved`, `completed`, `cancelled`). |
| `stage` | string | Filter by stage (e.g. `inspection`, `negotiation`, `completed`, `cancelled`). |
| `propertyId` | string | Filter by property ID (MongoDB ObjectId). |
| `owner` | string | Filter by property owner (agent) user ID. |
| `isNegotiating` | string | `"true"` or `"false"` to filter by negotiation flag. |

**Example:**  
`GET /api/admin/inspections?page=1&limit=20&status=pending_approval`

**Response (success, 200):**

```json
{
  "success": true,
  "message": "Inspections fetched successfully",
  "data": [
    {
      "_id": "...",
      "propertyId": { ... },
      "owner": { ... },
      "requestedBy": { ... },
      "transaction": { ... },
      "inspectionDate": "...",
      "inspectionTime": "...",
      "status": "pending_approval",
      "stage": "inspection",
      "inspectionType": "price",
      "inspectionMode": "in_person",
      "isNegotiating": false,
      ...
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

- `data`: array of inspection objects. `propertyId`, `owner`, `requestedBy`, `transaction` (when present) are populated. Sensitive user fields (e.g. password) are excluded.
- Use `pagination.total`, `pagination.page`, `pagination.limit`, `pagination.totalPages` for tables and “Load more”.

---

### 1.2 Get a single inspection (with activity log)

**Purpose:** Get full details for one inspection and the **activity log** (timeline of what happened: request, agent accept/reject, payment, etc.) for auditing.

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/admin/inspections/:id` |
| **Auth** | Admin required |

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Inspection ID (MongoDB ObjectId). |

**Example:**  
`GET /api/admin/inspections/507f1f77bcf86cd799439011`

**Response (success, 200):**

```json
{
  "success": true,
  "message": "Inspection details fetched successfully",
  "data": {
    "_id": "...",
    "propertyId": { ... },
    "owner": { ... },
    "requestedBy": { ... },
    "transaction": { ... },
    "assignedFieldAgent": null,
    "inspectionDate": "...",
    "inspectionTime": "...",
    "status": "completed",
    "stage": "completed",
    "inspectionReport": { ... },
    "activityLog": [
      {
        "_id": "...",
        "inspectionId": "...",
        "propertyId": "...",
        "senderId": { ... },
        "senderRole": "buyer",
        "message": "...",
        "status": "...",
        "createdAt": "...",
        "senderName": "...",
        "senderEmail": "..."
      }
    ],
    "activityLogPagination": {
      "total": 5,
      "page": 1,
      "limit": 50,
      "totalPages": 1
    }
  }
}
```

- **activityLog:** Last 50 entries for this inspection. Each entry has sender info, role, message, status, and timestamp.
- **activityLogPagination:** Total count and pagination for the activity log (so you can show “View all” or link to the logs endpoint).

---

### 1.3 Inspection stats

**Purpose:** Get counts for dashboard cards (total inspections, approved, completed, cancelled, active negotiations).

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/admin/inspections/stats` |
| **Auth** | Admin required |

**Query:** None.

**Response (success, 200):**

```json
{
  "success": true,
  "data": {
    "totalInspections": 120,
    "totalApprovedInspections": 45,
    "totalCompletedInspections": 80,
    "totalCancelledInspections": 10,
    "totalActiveNegotiations": 12
  }
}
```

---

### 1.4 Inspection activity logs (by inspection or property)

**Purpose:** Fetch the raw activity log for a specific inspection or for all activity linked to a property. Use when you need more than the last 50 entries or a logs-only view.

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/admin/inspection/logs` |
| **Auth** | Admin required |

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inspectionId` | string | One of these required | Inspection ID (MongoDB ObjectId). |
| `propertyId` | string | One of these required | Property ID to get logs for all inspections on that property. |
| `page` | number (string) | No | Page number, default `1`. |
| `limit` | number (string) | No | Items per page, default `10`. |

You must send **either** `inspectionId` **or** `propertyId` (or both). If neither is sent, the API returns 400.

**Example:**  
`GET /api/admin/inspection/logs?inspectionId=507f1f77bcf86cd799439011&page=1&limit=20`

**Response (success, 200):**

```json
{
  "success": true,
  "message": "Inspection logs fetched successfully",
  "data": [
    {
      "_id": "...",
      "inspectionId": "...",
      "propertyId": "...",
      "senderId": { "_id": "...", "firstName": "...", "lastName": "...", "fullName": "...", "email": "..." },
      "senderRole": "seller",
      "message": "Agent accepted the inspection request.",
      "status": "...",
      "createdAt": "...",
      "senderName": "...",
      "senderEmail": "..."
    }
  ],
  "pagination": {
    "total": 8,
    "currentPage": 1,
    "totalPages": 1,
    "perPage": 20
  }
}
```

---

### 1.5 Inspections for a specific property

**Purpose:** List all inspections for one property (e.g. from the property detail page in admin).

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/admin/properties/:propertyId/inspections` |
| **Auth** | Admin required |

**Path parameters:** `propertyId` — Property ID (MongoDB ObjectId).

**Response:** Same shape as **1.1** (list of inspections with pagination), filtered by that property.

---

## 2. Ratings (buyer feedback on agents)

After a completed inspection, buyers can rate the agent. These endpoints let admins list and review ratings.

### 2.1 List all ratings

**Purpose:** Paginated list of all agent ratings for investigation or dashboards. Filter by agent or by inspection.

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/admin/ratings` |
| **Auth** | Admin required |

**Query parameters (all optional):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | string | Filter by agent (user) ID. Must be a valid ObjectId. |
| `inspectionId` | string | Filter by inspection ID. Must be a valid ObjectId. |
| `page` | number (string) | Page number, default `1`. |
| `limit` | number (string) | Items per page, default `20`. Max 100. |

**Example:**  
`GET /api/admin/ratings?agentId=507f1f77bcf86cd799439011&page=1&limit=20`

**Response (success, 200):**

```json
{
  "success": true,
  "message": "Ratings fetched successfully",
  "data": [
    {
      "_id": "...",
      "agentId": { "_id": "...", "firstName": "...", "lastName": "...", "fullName": "...", "email": "..." },
      "buyerId": { "_id": "...", "fullName": "...", "email": "...", "phoneNumber": "..." },
      "inspectionId": { "inspectionDate": "...", "inspectionTime": "...", "status": "...", "stage": "..." },
      "rating": 5,
      "comment": "Very professional.",
      "createdAt": "..."
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## 3. Complaints / reports

Buyers can submit reports (complaints) about an inspection or agent. Admins list reports, open one for detail, and update status/notes.

### 3.1 List all reports

**Purpose:** Paginated list of all complaints for investigation. Filter by status or by reported agent.

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/admin/reports` |
| **Auth** | Admin required |

**Query parameters (all optional):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by report status: `pending`, `reviewed`, `resolved`, `dismissed`. |
| `reportedAgentId` | string | Filter by the agent who was reported. Must be a valid ObjectId. |
| `page` | number (string) | Page number, default `1`. |
| `limit` | number (string) | Items per page, default `20`. Max 100. |

**Example:**  
`GET /api/admin/reports?status=pending&page=1&limit=20`

**Response (success, 200):**

```json
{
  "success": true,
  "message": "Reports fetched successfully",
  "data": [
    {
      "_id": "...",
      "reportedAgentId": { "_id": "...", "firstName": "...", "lastName": "...", "fullName": "...", "email": "..." },
      "reportedBy": { "_id": "...", "fullName": "...", "email": "...", "phoneNumber": "..." },
      "inspectionId": { "inspectionDate": "...", "inspectionTime": "...", "status": "...", "stage": "...", "propertyId": "..." },
      "category": "no_show_or_late",
      "subject": "...",
      "description": "...",
      "status": "pending",
      "adminNotes": null,
      "createdAt": "..."
    }
  ],
  "pagination": {
    "total": 8,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Report categories (from buyer submission):**  
`unprofessional_conduct`, `property_misrepresentation`, `no_show_or_late`, `payment_issue`, `safety_concern`, `communication_issue`, `other`.

---

### 3.2 Get a single report

**Purpose:** Full details for one report (including populated agent, reporter, inspection, and property) for the investigation view.

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/admin/reports/:id` |
| **Auth** | Admin required |

**Path parameters:** `id` — Report ID (MongoDB ObjectId).

**Example:**  
`GET /api/admin/reports/507f1f77bcf86cd799439011`

**Response (success, 200):**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "reportedAgentId": { "_id": "...", "firstName": "...", "lastName": "...", "fullName": "...", "email": "...", "phoneNumber": "..." },
    "reportedBy": { "_id": "...", "fullName": "...", "email": "...", "phoneNumber": "..." },
    "inspectionId": {
      "_id": "...",
      "inspectionDate": "...",
      "inspectionTime": "...",
      "status": "...",
      "stage": "...",
      "propertyId": { "title": "...", "location": { ... }, "propertyType": "...", "price": ... }
    },
    "category": "no_show_or_late",
    "subject": "...",
    "description": "...",
    "status": "pending",
    "adminNotes": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error (404):** Report not found — `{ "success": false, "message": "Report not found" }` (or similar).

---

### 3.3 Update a report (status and/or admin notes)

**Purpose:** Update the report’s status (e.g. mark as reviewed or resolved) and/or set internal admin notes for the investigation workflow.

| Item | Value |
|------|--------|
| **Method** | `PATCH` |
| **Path** | `/admin/reports/:id` |
| **Auth** | Admin required |
| **Content-Type** | `application/json` |

**Path parameters:** `id` — Report ID (MongoDB ObjectId).

**Request body (all fields optional, but at least one required):**

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | New status. Must be one of: `pending`, `reviewed`, `resolved`, `dismissed`. |
| `adminNotes` | string | Internal notes for the team (e.g. “Spoke with agent; buyer refunded.”). |

**Example:**

```json
{
  "status": "resolved",
  "adminNotes": "Agent provided evidence of attendance. Case closed."
}
```

**Response (success, 200):**

```json
{
  "success": true,
  "message": "Report updated successfully",
  "data": {
    "_id": "...",
    "reportedAgentId": { ... },
    "reportedBy": { ... },
    "category": "...",
    "subject": "...",
    "description": "...",
    "status": "resolved",
    "adminNotes": "Agent provided evidence of attendance. Case closed.",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error (400):** Invalid `status` or missing both `status` and `adminNotes` — e.g. “Provide status and/or adminNotes to update”.

---

## 4. Transaction registration tracking

These endpoints support the LASRERA-style transaction registration feature: list registrations, filter by status/type, get stats, and open a single registration with full property and inspection details.

### 4.1 List all transaction registrations

**Purpose:** Paginated list of all registered transactions (rentals, outright sales, off-plan, joint ventures). Filter by status or transaction type for dashboards and tables.

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/admin/transaction-registrations` |
| **Auth** | Admin required |

**Query parameters (all optional):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number (string) | Page number, default `1`. |
| `limit` | number (string) | Items per page, default `20`. Max 100. |
| `status` | string | Filter by registration status: `submitted`, `pending_completion`, `completed`, `rejected`. |
| `transactionType` | string | Filter by type: `rental_agreement`, `outright_sale`, `off_plan_purchase`, `joint_venture`. |

**Example:**  
`GET /api/admin/transaction-registrations?page=1&limit=20&status=submitted`

**Response (success, 200):**

```json
{
  "success": true,
  "message": "Transaction registrations fetched successfully",
  "data": [
    {
      "_id": "...",
      "transactionType": "rental_agreement",
      "propertyId": {
        "_id": "...",
        "location": { ... },
        "price": 5000000,
        "briefType": "Rent",
        "propertyType": "...",
        "status": "transaction_registered_pending",
        "pictures": [ ... ],
        "additionalFeatures": { ... }
      },
      "inspectionId": {
        "_id": "...",
        "inspectionDate": "...",
        "inspectionTime": "...",
        "status": "completed",
        "stage": "completed"
      },
      "buyer": { "email": "...", "fullName": "...", "phoneNumber": "..." },
      "transactionValue": 5000000,
      "processingFee": 150000,
      "status": "submitted",
      "propertyIdentification": { "type": "building", "exactAddress": "...", ... },
      "paymentTransactionId": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "totalPages": 2,
    "limit": 20
  }
}
```

- **propertyId** and **inspectionId** are populated; inspection may be `null` if the registration was not linked to an inspection.

---

### 4.2 Transaction registration stats

**Purpose:** Counts for dashboard cards: total registrations, and counts by status and by transaction type.

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/admin/transaction-registrations/stats` |
| **Auth** | Admin required |

**Query:** None.

**Response (success, 200):**

```json
{
  "success": true,
  "message": "Transaction registration stats",
  "data": {
    "total": 42,
    "byStatus": {
      "submitted": 10,
      "pending_completion": 8,
      "completed": 20,
      "rejected": 4
    },
    "byTransactionType": {
      "rental_agreement": 15,
      "outright_sale": 18,
      "off_plan_purchase": 5,
      "joint_venture": 4
    }
  }
}
```

---

### 4.3 Get a single transaction registration

**Purpose:** Full details for one registration: buyer, full property, full inspection (if any), property identification, payment receipt fields, and timestamps. Use for the “View details” or “Follow up” screen.

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/admin/transaction-registrations/:registrationId` |
| **Auth** | Admin required |

**Path parameters:** `registrationId` — Registration ID (MongoDB ObjectId).

**Example:**  
`GET /api/admin/transaction-registrations/507f1f77bcf86cd799439011`

**Response (success, 200):**

```json
{
  "success": true,
  "message": "Transaction registration details",
  "data": {
    "_id": "...",
    "transactionType": "rental_agreement",
    "propertyId": { ... },
    "inspectionId": { ... },
    "buyer": { "email": "...", "fullName": "...", "phoneNumber": "..." },
    "transactionValue": 5000000,
    "processingFee": 150000,
    "status": "submitted",
    "propertyIdentification": { "type": "building", "exactAddress": "...", "lpin": null, "titleReference": "...", "ownerVerification": "...", "gpsCoordinates": { ... } },
    "paymentReceiptFileName": "receipt.pdf",
    "paymentReceiptBase64": "...",
    "paymentTransactionId": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**propertyId** and **inspectionId** are fully populated (no field restriction). **Error (404):** Registration not found — `{ "success": false, "message": "Transaction registration not found", "data": null }`.

---

## 5. Summary table

| Area | Method | Path | Purpose |
|------|--------|------|---------|
| Inspections | GET | `/admin/inspections` | List all inspections (with filters) |
| Inspections | GET | `/admin/inspections/stats` | Inspection counts for dashboard |
| Inspections | GET | `/admin/inspections/:id` | Single inspection + activity log |
| Inspections | GET | `/admin/inspection/logs` | Activity logs by `inspectionId` or `propertyId` |
| Inspections | GET | `/admin/properties/:propertyId/inspections` | Inspections for one property |
| Ratings | GET | `/admin/ratings` | List all ratings (filter by agent/inspection) |
| Reports | GET | `/admin/reports` | List all reports (filter by status/agent) |
| Reports | GET | `/admin/reports/:id` | Single report details |
| Reports | PATCH | `/admin/reports/:id` | Update report status and/or admin notes |
| Transaction registrations | GET | `/admin/transaction-registrations` | List all registrations (with filters) |
| Transaction registrations | GET | `/admin/transaction-registrations/stats` | Registration counts for dashboard |
| Transaction registrations | GET | `/admin/transaction-registrations/:registrationId` | Single registration details |

---

## 6. General notes for the frontend

- **Base path:** If your API base is `https://your-api.com/api`, then admin routes are `https://your-api.com/api/admin/...`. Adjust if you use a different base (e.g. from env).
- **Auth:** Send the same admin auth (e.g. Bearer token or session cookie) you use for other admin endpoints. Unauthorized requests will receive 401 (or your server’s standard).
- **IDs:** All `:id`, `:registrationId`, `:propertyId` are MongoDB ObjectIds (24-character hex strings).
- **Errors:** On validation or not-found errors, the backend typically returns appropriate status codes (400, 404) and a JSON body with `success: false` and a `message` (and sometimes `errorCode`). Use these for toast messages or inline error UI.
- **Pagination:** For list endpoints, always use the returned `pagination` object (`total`, `page`, `limit`, `totalPages`) to drive tables and “Load more” or page controls.

This guide is derived from the behaviour described in **UPDATES.md** and the current admin routes and controllers in the codebase.
