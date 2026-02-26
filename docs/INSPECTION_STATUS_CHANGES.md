# Inspection status changes — request and initiator reference

This document lists **every request (API call) that leads to a change of inspection status** on the server, and the **user type** that initiates each change. Use it to understand the inspection lifecycle and who can move an inspection from one status to another.

**Inspection model:** `InspectionBooking`. Fields that change: `status`, and often `stage` (and sometimes `pendingResponseFrom`, `inspectionReport.status`).

**Possible `status` values:**  
`pending_approval` | `agent_rejected` | `pending_transaction` | `transaction_failed` | `active_negotiation` | `inspection_approved` | `inspection_rescheduled` | `negotiation_countered` | `negotiation_accepted` | `negotiation_rejected` | `negotiation_cancelled` | `completed` | `cancelled`

**Possible `stage` values:**  
`negotiation` | `inspection` | `completed` | `cancelled`

---

## 1. Creation (initial status)

Inspection is **created** with an initial `status` (and `stage`). No prior inspection exists.

| # | Initiator | Request | New status | New stage | Notes |
|---|------------|---------|------------|-----------|--------|
| 1.1 | **Buyer** (unauthenticated) | **POST** `/api/inspections/request-inspection` (general/marketplace) | `pending_approval` | `inspection` or `negotiation` | Buyer submits inspection request; no payment. Agent must accept or reject. |
| 1.2 | **Buyer** (unauthenticated) | **POST** `/api/deal-site/:publicSlug/inspections/makeRequest` (DealSite) | `pending_approval` | `inspection` or `negotiation` | Same as above but from agent’s DealSite; no fee, no payment link on accept. |

---

## 2. Agent (property owner) accept or reject request

Only the **property owner (agent)** can respond to a request that is in `pending_approval`.

| # | Initiator | Request | New status | New stage | Notes |
|---|------------|---------|------------|-----------|--------|
| 2.1 | **Agent** (property owner, authenticated) | **POST** `/api/account/my-inspections/:inspectionId/respond` with `action: "reject"` | `agent_rejected` | (unchanged) | Agent rejects the inspection request. Buyer is notified. |
| 2.2 | **Agent** (property owner, authenticated) | **POST** `/api/account/my-inspections/:inspectionId/respond` with `action: "accept"` **(DealSite inspection)** | `inspection_approved` | (unchanged) | DealSite flow: no payment; buyer is only notified. |
| 2.3 | **Agent** (property owner, authenticated) | **POST** `/api/account/my-inspections/:inspectionId/respond` with `action: "accept"` **(general inspection)** | `pending_transaction` | (unchanged) | Payment link is created and sent to buyer. Buyer must pay; Paystack webhook then updates status (see §4). |

---

## 3. Buyer or agent: negotiation / inspection actions

After payment (or after DealSite accept), the inspection can be in a state where **buyer or agent** can perform **accept**, **reject**, or **counter** (e.g. price/LOI negotiation). The same endpoint is used; the initiator is identified by `userId` in the path.

| # | Initiator | Request | New status | New stage | Notes |
|---|------------|---------|------------|-----------|--------|
| 3.1 | **Buyer** or **Agent** (seller) | **POST** `/api/inspections/:inspectionId/actions/:userId` with body `action: "accept"` | `negotiation_accepted` | `inspection` | Party accepts the offer (price or LOI). |
| 3.2 | **Buyer** or **Agent** (seller) | **POST** `/api/inspections/:inspectionId/actions/:userId` with body `action: "reject"` | `negotiation_rejected` | `inspection` | Party rejects the offer. |
| 3.3 | **Buyer** or **Agent** (seller) | **POST** `/api/inspections/:inspectionId/actions/:userId` with body `action: "counter"` | `negotiation_countered` | `inspection` or `negotiation` | Party counters (e.g. new price). Other side can accept/reject/counter again. |

`userId` in the path is the **logged-in user** (buyer or property owner) performing the action; the backend determines whether they are buyer or seller from the inspection’s `owner` and `requestedBy`.

---

## 4. Paystack webhook (payment success or failure)

When the buyer pays (or payment fails), **Paystack** calls the backend webhook. The **system** applies the status change; no human “user type” initiates it.

| # | Initiator | Request | New status | New stage | Notes |
|---|------------|---------|------------|-----------|--------|
| 4.1 | **System** (Paystack webhook) | Payment **success** for inspection | `active_negotiation` or `negotiation_countered` | `inspection` or `negotiation` | If inspection has negotiation (price/LOI), status is `negotiation_countered` and stage `negotiation`; else `active_negotiation` and stage `inspection`. Buyer and agent notified. |
| 4.2 | **System** (Paystack webhook) | Payment **failed** for inspection | `transaction_failed` | `cancelled` | Buyer is notified; `pendingResponseFrom` set to `admin`. |

Only inspections with `status === "pending_transaction"` are updated by this handler.

---

## 5. Admin: approve or reject inspection (pending_transaction)

Admin can **approve** or **reject** an inspection that is in a state requiring admin action (e.g. after payment or for manual override). This is used for **pending_transaction** and similar flows.

| # | Initiator | Request | New status | New stage | Notes |
|---|------------|---------|------------|-----------|--------|
| 5.1 | **Admin** (authenticated) | **PATCH** `/api/admin/inspections/:id/status` with body `{ status: "reject" }` | `transaction_failed` | `cancelled` | Admin rejects the inspection; buyer is notified. |
| 5.2 | **Admin** (authenticated) | **PATCH** `/api/admin/inspections/:id/status` with body `{ status: "approve" }` | `active_negotiation` or `negotiation_countered` | `inspection` or `negotiation` | Same logic as payment success: depends on negotiation/LOI. Buyer and agent notified. |

Applicable when inspection is e.g. `pending_transaction` (or in negotiation). Not allowed if inspection is already `active_negotiation` or `negotiation_countered`.

---

## 6. Admin: approve or reject LOI document

When the inspection involves a **Letter of Intent (LOI)**, admin can approve or reject the LOI document. Rejecting sets inspection status/stage; approving only updates LOI approval flag.

| # | Initiator | Request | New status | New stage | Notes |
|---|------------|---------|------------|-----------|--------|
| 6.1 | **Admin** (authenticated) | **PATCH** `/api/admin/inspections/:id/approveOrRejectLOI` with body `{ status: "reject", reason?: string }` | `negotiation_cancelled` | `cancelled` | LOI rejected; buyer notified. |
| 6.2 | **Admin** (authenticated) | **PATCH** `/api/admin/inspections/:id/approveOrRejectLOI` with body `{ status: "approve" }` | (unchanged) | (unchanged) | Only `approveLOI` is set to `true`; inspection status/stage unchanged. |

---

## 7. Field agent: submit inspection report (mark completed)

The **field agent** (assigned to the inspection) submits the physical inspection report (buyer/seller presence, interest, notes). If both buyer and seller were present, the inspection is marked **completed**.

| # | Initiator | Request | New status | New stage | Notes |
|---|------------|---------|------------|-----------|--------|
| 7.1 | **Field agent** (authenticated) | **POST** `/api/account/inspectionsFieldAgent/:inspectionId/submitReport` with e.g. `buyerPresent`, `sellerPresent`, `buyerInterest`, `notes` | `completed` (only if both present) | `completed` (only if both present) | If either party is absent, only `inspectionReport` is updated (e.g. `status: "absent"`); inspection `status`/`stage` stay unchanged. When both present, buyer receives rate/report email. |

Field agent must be the one assigned to that inspection (`assignedFieldAgent`).

---

## 8. Field agent: start and stop inspection (inspectionReport only)

These do **not** change the main inspection `status` or `stage`; they only update `inspectionReport.status` for workflow (e.g. in-progress → awaiting report).

| # | Initiator | Request | Effect |
|---|------------|--------|--------|
| 8.1 | **Field agent** (authenticated) | **POST** `/api/account/inspectionsFieldAgent/:inspectionId/startInspection` | Sets `inspectionReport.status = "in-progress"`, `inspectionReport.inspectionStartedAt`. |
| 8.2 | **Field agent** (authenticated) | **POST** `/api/account/inspectionsFieldAgent/:inspectionId/stopInspection` | Sets `inspectionReport.status = "awaiting-report"`, `inspectionReport.inspectionCompletedAt`. After this, field agent submits the report via §7.1. |

---

## 9. Admin: delete inspection (no status change)

Admin can **delete** an inspection (and its linked transaction). This **removes** the document; it is not a status change. Completed inspections cannot be deleted.

| # | Initiator | Request | Effect |
|---|------------|--------|--------|
| 9.1 | **Admin** (authenticated) | **DELETE** `/api/admin/inspections/:id/delete` | Inspection document (and linked transaction) are deleted. If a field agent was assigned, they are notified and assignment is removed. |

---

## 10. Summary by user type

| User type | Requests that change inspection status |
|-----------|----------------------------------------|
| **Buyer** | Create inspection (1.1, 1.2); negotiation actions accept/reject/counter (3.1–3.3). |
| **Agent (property owner)** | Accept or reject request (2.1–2.3); negotiation actions accept/reject/counter (3.1–3.3). |
| **Admin** | Approve/reject inspection status (5.1–5.2); approve/reject LOI (6.1–6.2). Delete inspection (9.1) removes the record. |
| **Field agent** | Submit report (7.1) can set status `completed` and stage `completed`; start/stop (8.1–8.2) only change `inspectionReport.status`. |
| **System (Paystack)** | Webhook on payment success (4.1) or failure (4.2) updates status/stage for inspections in `pending_transaction`. |

---

## 11. Status flow overview (simplified)

```
[Buyer] submit request
    → status: pending_approval

[Agent] reject
    → status: agent_rejected

[Agent] accept (general)
    → status: pending_transaction
    → [Buyer pays] → [Paystack webhook]
        → success: active_negotiation | negotiation_countered
        → failure: transaction_failed, stage: cancelled

[Agent] accept (DealSite)
    → status: inspection_approved
    (no payment step)

[Buyer or Agent] accept/reject/counter (negotiation)
    → status: negotiation_accepted | negotiation_rejected | negotiation_countered

[Admin] approve/reject (e.g. pending_transaction)
    → status: transaction_failed (reject) or active_negotiation/negotiation_countered (approve)

[Admin] reject LOI
    → status: negotiation_cancelled, stage: cancelled

[Field agent] submit report (both present)
    → status: completed, stage: completed
```

This document is derived from the implementation in `src/controllers` and `src/services/paystack.service.ts`. For route paths and auth, see `src/routes` (e.g. `inspectionRouter.ts`, `account.ts`, `admin.inspections.ts`).
