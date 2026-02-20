# Application updates

A simple log of changes made across the app. Add new entries at the top.

---

## Transaction Registration & DealSite API alignment (public frontend)

**When:** Feb 2025  
**Where:** Transaction-registration controller, validators, routes; DealSite getData.

**What changed:**  
APIs consumed by the **agent public access page** (DealSite + transaction registration) were aligned with the frontend contract so that API calls do not return 404 and request/response payloads match.

1. **Deal-site getData** — `GET /deal-site/{publicSlug}/getData` now includes `dealSite: { inspectionSettings }` in the response (with `defaultInspectionFee` when present).
2. **Transaction types** — `GET /transaction-registration/types` returns `data` as an array of objects with frontend fields: `id`, `name`, `slug`, `label`, `title`, `mandatoryRegistrationThreshold`, `valueBands` (min, max, feeNaira, label), `eligibilityCriteria`, `regulatoryRequirements`.
3. **Guidelines** — `GET /transaction-registration/guidelines` returns `data` as a flat object: `requiredDocumentation`, `commissionCompliance`, `ownershipVerification`, `titleVerification`, `disputeResolution`, `mandatoryDataDisclosure` (each an array of strings).
4. **Search** — `GET /transaction-registration/search` query params: **one of** `address`, `propertyId`, or **both** `lat` and `lng` (not lpin). Returns `data` as an array. Each item includes `address`, `propertyId`, `lpin`, `lat`, `lng`, `hasRegisteredTransaction`, `registrationStatus` ("Registered" | "Pending"), `propertyStatus`, `soldOrLeasedRegistered`, `inspectionHistoryCount`, and placeholder fields `titleStatus`, `ownershipVerified`, `coordinateVerified`, `egisLandRecordRef`.
5. **Check** — `GET /transaction-registration/check?propertyId=` returns top-level `hasRegistration`, `warning`, and `data` with `hasRegistration`, `warning`, `titleStatus`, `ownershipVerified`, `coordinateVerified`, `egisLandRecordRef`. Warning text: "Transaction registered – Pending completion." when applicable.
6. **E-GIS validate** — New `GET /transaction-registration/egis-validate` (query: `propertyId`, `address`, or `lat`+`lng`). Returns stub `data` with `titleStatus`, `ownershipVerified`, `coordinateVerified`, `egisLandRecordRef` (all null); can be wired to Lagos E-GIS later.
7. **Register** — `POST /transaction-registration/register` now accepts the **frontend payload**: `transactionType` slugs, `propertyIdentification` (type, exactAddress, titleNumber, ownerName, lat, lng, surveyPlanRef, ownerConfirmation), and optional `paymentReceiptFileName`/`paymentReceiptBase64`. When **processing fee > 0**, backend creates a Paystack payment and returns `data.paymentUrl`; the frontend redirects the buyer to complete payment. On successful Paystack verification, the registration status is updated to `pending_completion`. Response always includes `data.registrationId`, `data.processingFee`; `data.paymentUrl` is present when fee > 0 and Paystack init succeeds.

**In short:**  
All listed transaction-registration and DealSite getData responses match the public frontend docs; new egis-validate route added; register accepts frontend slugs and property-identification shape.

**Admin – retrieve all registered transactions:**  
- **GET /api/admin/transaction-registrations** — List all transaction registrations with details. Query: `page`, `limit`, `status` (submitted | pending_completion | completed | rejected), `transactionType` (rental_agreement | outright_sale | off_plan_purchase | joint_venture). Response includes `data` (array with populated `propertyId` and `inspectionId`) and `pagination`.  
- **GET /api/admin/transaction-registrations/stats** — Counts by status and by transaction type, plus total.  
- **GET /api/admin/transaction-registrations/:registrationId** — Single registration with full property and inspection details. All routes require admin auth.

---

## Public Transaction Registration Portal (LASRERA buyer-led compliance)

**When:** Feb 2025  
**Where:** TransactionRegistration model, property status enum, config, public routes, inspection request flow, docs.

**What changed:**  
A dedicated **Transaction Registration** feature was added so parties can register regulated transactions (Rental Agreements, Outright Property Sales, Off-Plan Purchases, Joint Venture Arrangements) with defined eligibility, regulatory requirements, and **fixed tiered processing fees** by transaction type and value band. Only transactions above designated thresholds require mandatory registration. The flow supports **inspection-to-transaction conversion**: after a completed inspection, the buyer can confirm intent to proceed and then review Safe Transaction Guidelines before registering. Once a transaction is registered, the property is tagged in the central registry and its status is set to **Transaction Registered – Pending Completion** (or **Sold / Leased – Registered** when the registration is later marked completed). If another user attempts to book an inspection or register the same property, the system returns a **warning** (“This property has an active or completed registered transaction”) but does **not** block viewings. Public **due-diligence search** by property address, LPIN, or GPS returns whether a transaction is registered, sold/leased status, and limited inspection history (e.g. count).

**New routes (base path: `/api/transaction-registration`):**

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/transaction-registration/types` | Returns all transaction types with eligibility criteria, regulatory requirements, value bands (tiered processing fees in Naira), and mandatory registration thresholds. |
| GET | `/transaction-registration/guidelines` | Returns Safe Transaction Guidelines: required documentation checklist, commission compliance rules, ownership verification standards, title verification recommendations, dispute resolution procedures, mandatory data disclosure requirements. |
| POST | `/transaction-registration/intent` | Buyer confirms “I wish to proceed with this transaction” after a completed inspection. Body: `{ inspectionId, email, wishToProceed: true }`. Email must match the inspection’s buyer. Activates the Transaction Registration Guidance (next: review guidelines and register). |
| POST | `/transaction-registration/register` | Registers a transaction. Body: `transactionType`, `propertyId`, optional `inspectionId`, `buyer` (email, fullName, phoneNumber), `transactionValue`, `propertyIdentification` (building: exactAddress required, LPIN/title/owner optional, GPS optional; land: GPS required, exactAddress/surveyPlan/ownerConfirmation optional). Computes processing fee from config, creates registration, updates property status to `transaction_registered_pending`. Returns 409 if property already has an active or completed registration. |
| GET | `/transaction-registration/search` | Public due-diligence search. Query: **one of** `address`, `propertyId`, or **both** `lat` and `lng`. Returns matches with: `hasRegisteredTransaction`, `registrationStatus`, `propertyStatus`, `soldOrLeasedRegistered`, `inspectionHistoryCount` (limited disclosure), and minimal property identification (address, propertyId, LPIN, GPS). |
| GET | `/transaction-registration/check` | Query: `propertyId`. Returns whether the property has an active or completed registration and, if so, a `warning` message. Used to show due-diligence warning when booking an inspection or starting registration; does not block. |

**Other behaviour:**  
- **Property status enum** extended with `transaction_registered_pending` and `sold_leased_registered`.  
- **Inspection request (general and DealSite):** When submitting an inspection request, if any of the selected properties have an active or completed registered transaction, the response includes a `warnings` object (keyed by propertyId) with the message above; viewings are not blocked.  
- **Config:** Transaction types, value bands, fees, and thresholds live in `src/config/transactionRegistration.config.ts`. Guidelines content is in the same file.  
- **Model:** `TransactionRegistration` stores transaction type, property, optional inspection, buyer info, value, fee, status (`submitted` | `pending_completion` | `completed` | `rejected`), and property identification (building vs land with required fields as per spec).  

**In short:**  
Buyer-led compliance: register transactions (rental, sale, off-plan, JV) with tiered fees and thresholds; intent after completed inspection → guidelines → register; property locked in registry with status; public search by address/LPIN/GPS; inspection and registration flows show a warning when a property already has a registered transaction but do not block viewings.

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
