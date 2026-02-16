# Application updates

A simple log of changes made across the app. Add new entries at the top.

---

## Buyer rating and reporting after inspection (revised: no buyer auth)

**When:** Feb 2025  
**Where:** AgentRating model, AgentReport model, public inspection routes, admin routes, agentRatingReport controller.

**What changed:**  
1. **Buyers are not authenticated** — They are identified only by the email stored on the inspection (`requestedBy`). Rating and report submission are **public** (no login). The buyer proves identity by providing the **email** that matches the inspection’s buyer.
2. **Rating (public)** — After an inspection is **fully completed** (status and stage both `"completed"`), the buyer submits **POST /api/inspections/:inspectionId/rate** with body `{ email, rating: 1–5, comment?: string }`. One rating per inspection. Email must match `requestedBy` for that inspection. **Applies to both general and DealSite inspections** (same InspectionBooking model).
3. **Report/Complaint (public)** — **POST /api/inspections/:inspectionId/report** with body `{ email, category, subject?, description }`. Same email check. **Applies to both general and DealSite inspections.** Categories: `unprofessional_conduct`, `property_misrepresentation`, `no_show_or_late`, `payment_issue`, `safety_concern`, `communication_issue`, `other`. Reports start as `pending` for admin review.
4. **Admin: view ratings and complaints** — **GET /api/admin/ratings** (query: `agentId`, `inspectionId`, `page`, `limit`) and **GET /api/admin/reports** (query: `status`, `reportedAgentId`, `page`, `limit`) list all ratings and reports for investigation. **GET /api/admin/reports/:id** returns a single report with full details. **PATCH /api/admin/reports/:id** with body `{ status?, adminNotes? }` updates report status (`pending` | `reviewed` | `resolved` | `dismissed`) and/or admin notes.
5. **Public rating for prospective buyers** — **GET /api/agent/:agentId/rating-summary** (no auth) returns aggregate rating (average, total, star distribution). **GET /api/agent/:agentId/ratings** (no auth, query: `page`, `limit`) returns recent ratings (rating, comment, createdAt only; no buyer PII) for landing page or agent profile.

**In short:**  
Buyers rate and report using their **email** (no account). Admin can list and investigate all ratings and reports and update report status. Agent ratings are **public** so prospective buyers can see them on the landing page.

---

## Admin inspection audit / tracking

**When:** Feb 2025  
**Where:** Admin inspection routes, inspection respond controller, InspectionLogService.

**What changed:**  
1. **Agent accept/reject is logged** — When an agent accepts or rejects an inspection request (POST /account/my-inspections/:inspectionId/respond), the action is recorded in the inspection activity log (seller role, with message and status) for audit.
2. **Admin sees all inspection statuses** — The admin list **GET /admin/inspections** no longer excludes `pending_transaction`. Admins can see every status (e.g. pending_approval, agent_rejected, pending_transaction, etc.) for full workflow auditing. Optional query params: `status`, `stage`, `propertyId`, `owner`, `isNegotiating`, `page`, `limit`.
3. **Single inspection includes activity log** — **GET /admin/inspections/:id** now returns the inspection details plus an **activityLog** (last 50 entries) and **activityLogPagination**, so admins can audit the full timeline (buyer request, agent accept/reject, payment, etc.) in one call.
4. **Inspection logs by ID** — Admins can still fetch logs for an inspection via **GET /admin/inspection/logs?inspectionId=:id** (or by propertyId) with optional `page` and `limit`.

**In short:**  
Admin can list all inspections (all statuses), open any inspection to see full details + activity log, and optionally query logs by inspection or property for auditing the buyer/agent inspection workflow.

---

## Inspection workflow: request → approval → payment

**When:** Feb 2025  
**Where:** Inspection model, DealSite + public submit, agent respond, Paystack handler, notifications.

**What changed:**  
1. **Buyer submits inspection request (no payment)** — Submitting an inspection no longer creates a payment or payment link. Inspections are created with status **pending_approval** and no transaction.
2. **Agent notified (email + in-app)** — When a request is submitted, each property owner (agent) receives an email and an in-app notification with details and a link to respond.
3. **Agent accepts or rejects** — Agent uses **POST /account/my-inspections/:inspectionId/respond** with body `{ action: "accept" | "reject", note?: string }`. Only the property owner can respond.
4. **Buyer notified to pay (after accept)** — If the agent accepts, a payment link is generated, saved on the inspection, and the buyer is emailed the link. Inspection status becomes **pending_transaction**. If the agent rejects, the buyer is emailed and status becomes **agent_rejected**.
5. **Payment only after acceptance** — Payment links are created only when the agent accepts. The buyer cannot pay before acceptance.
6. **Agent receives payment confirmation** — When the buyer pays successfully, the agent (property owner) receives an email and an in-app notification that payment was received.

**In short:**  
Request (no payment) → Agent notified → Agent accept/reject → If accept, buyer gets payment link → Buyer pays → Agent gets payment confirmation.

---

## Property data governance

**When:** Feb 2025  
**Where:** Property validation, model, formatters, post flow, inspection flow, admin approval.

**What changed:**  
1. **Validation at creation** — Property data is validated at creation via a validation engine (`propertyValidation.service.ts` and `propertyValidationSchema`). Invalid payloads return clear validation errors.  
2. **Auto-publish** — New listings are no longer pending admin approval. After validation they are created with `status: "approved"`, `isApproved: true`, and `isAvailable: true`. Admin can still **unpublish** a property (e.g. `PUT /admin/properties/:propertyId/approval` with body `{ action: "unpublish" }` or use changeStatus).  
3. **Inspection fee per property** — Agents can set an inspection fee per property. Allowed range: **₦1,000 minimum**, **₦50,000 maximum** (default ₦5,000). Stored on the Property model as `inspectionFee`.  
4. **Multi-property inspection** — Buyers can select multiple properties in one inspection request. The total inspection amount is the **sum of each selected property’s inspection fee**. The request can omit `inspectionAmount` (server computes it) or send it; if sent, it must match the computed total.

**In short:**  
Strict validation at creation; listings go live after validation; admin can unpublish; inspection fee per property (₦1k–₦50k); multi-property inspection with total = sum of fees.

---

## Agent subscribers: unauthenticated DealSite guests, email-only

**When:** Feb 2025  
**Where:** Services, controllers, routes; AgentSubscriber model removed.

**What changed:**  
- Agent subscribers are **unauthenticated** guests/buyers on the DealSite. They subscribe using the existing endpoint that only takes their **email**: `POST /deal-site/:publicSlug/newsletter/subscribe` (body: `{ email }`).
- When an agent edits a property or changes its status, all their subscribers receive an **email** (no in-app notifications for these subscribers, since they are not logged-in users).
- Agents can send a **broadcast email** to all their subscribers via `POST /account/agent/broadcast` (body: `subject`, `body`).
- In-app notification types (e.g. property_update, agent_broadcast) remain available for other flows; agent-subscriber notifications are email-only.

**In short:**  
Guests subscribe with email on the agent’s DealSite → they get emails when the agent updates a property or sends a broadcast. No login required.

---

## Property status: only owner or admin can change it

**When:** Feb 2025  
**Where:** `src/controllers/Account/Property/editProperty.ts` — inside the function that updates a property’s status.

**What changed:**  
When someone tries to mark a property as available, unavailable, sold, etc., we now check that they are either the property owner or an admin. Before this, any logged-in user could change any property’s status.

**In short:**  
Only the person who posted the property (or an admin) can update its status.

---
