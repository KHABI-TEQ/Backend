# Platform Overview — What Can Be Done on the Website

**Prepared for:** Head of Operations  
**Purpose:** Strategy and marketing material — a detailed overview of everything that can be done on the platform, by user type and by Admin.  
**Source:** Backend features and product behaviour as reflected in the API and product flows (see FRONTEND_API_GUIDE.md and related docs).

---

## 1. Introduction

The platform serves **multiple user types** and **administrators**. Each has distinct capabilities: from browsing and registering, to posting properties, managing inspections and bookings, subscribing to plans, and (for Admin) overseeing the entire system. This document lists, in one place, **what each actor can do** on the website.

**User types:**

- **Visitors / Public** — Not logged in; browse, search, submit forms, use public pages.
- **Landowners (Landlords)** — Own properties; list for sale, rent, shortlet, or joint venture; no subscription required.
- **Developers** — Similar to Landlords plus public page (DealSite), subscription, and inspection flows; first **5** properties free, then subscription required.
- **Agents** — List properties, manage DealSite, subscriptions, inspections, and “Request To Market”; first **5** properties free, then subscription required.
- **Buyers / Tenants / End users** — Submit preferences, request inspections, complete bookings, register transactions (often via DealSite or main site as visitors or identified by email).
- **Admin** — Full oversight: users, properties, inspections, ratings, reports, transaction registrations, DealSites, subscriptions, content, and settings.

Below, each group is broken down into **what they can do** on the website.

---

## 2. Visitors (Public / Unauthenticated)

Anyone can do the following without creating an account or logging in:

- **Register** — Create an account as Landowner, Agent, or Developer (email/password or social sign-in). They receive a verification email and must verify before full access.
- **Log in** — Email/password or Google/Facebook (where enabled).
- **Browse KHABITEQ Market Place** — View a paginated list of properties published to the Market Place (no contact details shown). Filter by type, state, price range. If an Agent is logged in, the list can show which properties they have already requested to market.
- **Browse and use DealSites** — Visit an Agent’s or Developer’s public page (e.g. `slug.khabiteq.com`) to see their profile, listed properties, and contact options.
- **Request an inspection from a DealSite** — From a DealSite property page, submit an inspection request (name, email, phone, preferred date/time, mode). No login required. The Agent/Developer can then accept or reject and optionally set an inspection fee (₦1,000–₦50,000); if set, the buyer receives a payment link by email.
- **Use the Transaction Registration portal** — View transaction types (rental, outright sale, off-plan, joint venture), read safe-transaction guidelines, search by address/property, check if a property is already registered, and submit a new registration with buyer and property details. Processing fee is determined by transaction value (below ₦5M: no fee; ₦5M–₦50M: ₦100,000; above ₦50M: ₦150,000). When a fee applies, the user can pay via a link returned by the system.
- **Submit contact form** — Send messages via the site’s contact form.
- **View testimonials** — See approved testimonials on the main site.
- **View subscription plans and features** — See available plans and features (e.g. for Agents/Developers) on the public site.
- **Rate an agent (after inspection)** — After a completed inspection, a buyer can submit a rating (and optionally a report/complaint) linked to that inspection, typically via a link or form that identifies them by email.
- **AI-assisted preference form** — When submitting a property preference (buy, rent, shortlet, joint venture), the buyer can optionally describe what they are looking for in natural language. The platform uses AI (OpenAI) to suggest form fields from that description, which the user can then review and edit before submitting. This is in addition to the standard option of filling the form manually.

---

## 3. Landowners (Landlords)

Landlords have an account with **userType: Landowners**. They do **not** need a subscription to post properties.

**Account and profile**

- Complete registration and email verification; log in (email/password or social).
- Update profile, profile picture, password, email, notification settings.
- Request account deletion or cancel a deletion request.

**Properties**

- **Create properties** — Post properties for Sale, Rent, Shortlet, or Joint Venture. Provide type, category, location, price, features, description, documents, photos, etc. When creating or editing a listing, they can **optionally use AI (OpenAI)** to fill the form: they describe the property in natural language (e.g. “3-bed duplex in Lekki for 50M, fully furnished”) and the platform suggests form fields they can review and edit before posting. This is in addition to typing into the form directly.
- **Publish to KHABITEQ Market Place** — When creating or editing a property, they can set it to “Market Place only” so it appears only on the public Market Place list (no contact details shown). Only Landlords and Developers can do this; Agents cannot.
- **Set agent commission** — For Sale, Rent, JV, or Shortlet, they can set an agent commission percentage (0–5%) and/or amount (Naira). This is stored and used when an Agent later “Requests To Market” the property (the Publisher pays this amount to the Agent on accept).
- **Edit and update** — Edit property details, update status (e.g. available, sold), delete properties.
- **View their listings** — List and view all their properties.

**Request To Market (as Publisher)**

- **Receive notifications** — When an Agent requests to market one of their Market Place properties, they receive an email and in-app notification with agent details and the agent commission amount.
- **View requests in dashboard** — See a list of “Request To Market” requests for their properties (pending, accepted, rejected).
- **Accept or reject** — For each pending request, accept or reject. If they accept, the property appears on that Agent’s public page (DealSite). If the agent commission amount is greater than zero and the Agent has payment set up, the Landlord receives a payment link (by email and optionally in the API response) to pay the agent commission; payment is completed on the payment provider’s page.

**Inspections (if they own the property)**

- Landlords can receive inspection requests from buyers (e.g. via main app flows). They can list “My inspections,” view each request, and accept or reject. On accept, they can optionally set an inspection fee (₦1,000–₦50,000); the buyer then receives a payment link. (Implementation may align with Agent/Developer inspection flows where the property owner is the respondent.)

**Other**

- View and manage their **notifications**.
- No DealSite and no subscription: Landlords do not have a public “DealSite” page and are not required to subscribe to post properties.

---

## 4. Developers

Developers have an account with **userType: Developer**. They combine **property publishing** (like Landlords) with **DealSite and subscription** (like Agents).

**Account and profile**

- Same as Landlords: register, verify, log in, update profile, password, email, notifications, account deletion flows.

**Properties**

- **Create and manage properties** — Same as Landlords: Sale, Rent, Shortlet, Joint Venture; full details, photos, documents. When posting a property or brief, they can **optionally use AI (OpenAI)** to fill the form by describing the property in natural language; the platform suggests form fields they can review and edit before posting.
- **Publish to KHABITEQ Market Place** — Can set `listingScope` to Market Place only so the listing appears only there (no contact shown).
- **Set agent commission** — For Sale, Rent, JV, or Shortlet, set agent commission percentage (0–5%) and amount (Naira); used when an Agent “Requests To Market” and the Developer accepts.
- **First property free** — The first property can be posted without a subscription. From the **second** property onward, an **active subscription** is required (and for **Agents**, **KYC approved**); otherwise the system blocks the post.
- Edit, update status, delete, and list their properties.

**Subscription**

- **Subscribe to a plan** — To post beyond the first property and to create/maintain a DealSite (user flow), they need an active subscription. They can view plans, subscribe, view their subscriptions, cancel or toggle auto-renewal, and see transaction history related to subscriptions.

**DealSite (public page)**

- **Create and set up a DealSite** — Choose a public slug (e.g. `companyname.khabiteq.com`), set up profile, bank details for receiving payments (e.g. agent commission, inspection fees), and configure sections.
- **Manage DealSite** — Update content, sections, contact visibility, inspection settings (e.g. default fee), preferences for property matching.
- **Pause, resume, or delete** — Pause or resume the public page; delete the DealSite.
- **Contact and marketing** — View and manage contact form messages; view and manage email subscribers; export subscriber lists (e.g. CSV).
- **DealSite preferences** — Create and manage “preferences” (e.g. property criteria) so the system can match and show relevant properties to visitors; view matched properties.

**Request To Market (as Publisher)**

- Same as Landlords: receive notifications when an Agent requests to market a Market Place property; view requests in dashboard; accept or reject; on accept, pay agent commission via link when applicable.

**Inspections**

- **List “My inspections”** — See inspection requests for their properties (from main app or from their DealSite).
- **Respond** — Accept or reject each request. On accept, they can optionally set an inspection fee (₦1,000–₦50,000); the buyer receives a payment link by email (and optionally in the API response). If no fee is set, the buyer is only notified of acceptance.

**Other**

- **Broadcast (if applicable)** — If the product supports it, broadcast messages to their DealSite subscribers.
- **Notifications** — View and manage in-app notifications.
- **Referrals** — View referral stats and records if the platform supports referrals for Developers.

---

## 5. Agents

Agents have **userType: Agent**. They list properties, run a public DealSite, and use “Request To Market” to market Landlords’/Developers’ Market Place properties. They need a subscription for the **second** property onward (and **approved KYC** for a second listing) and for DealSite in the normal user flow.

**Account and profile**

- Register, verify, log in (email/password or social). Complete **onboarding** and **KYC** as required; Admin may approve before they can use certain features (e.g. post property, my preferences, my listings).
- Update profile, picture, password, email, notification settings, account deletion.

**Properties**

- **Create and manage properties** — Post Sale, Rent, Shortlet, or Joint Venture (same structure as Landlords/Developers). Properties are listed under their account and, when applicable, on their DealSite. When posting a property or brief, they can **optionally use AI (OpenAI)** to fill the form by describing the property in natural language; the platform suggests form fields they can review and edit before posting.
- **First property free** — The first property can be posted without a subscription. From the **second** property, an **active subscription** is required.
- Edit, update status, delete, and list their properties. They **cannot** set `listingScope` to “Market Place only”; that is only for Landlords and Developers.

**Subscription**

- **Subscribe to a plan** — Required for posting beyond the first property and for DealSite. View plans, subscribe, view/cancel/toggle subscriptions, see subscription-related transactions.

**DealSite (public page)**

- **Create and set up** — Same idea as Developers: public slug, profile, bank/payment details (for receiving agent commission and inspection fees), sections.
- **Manage** — Update content, sections, contact visibility, inspection settings, preferences.
- **Pause, resume, delete** — Control visibility of the public page.
- **Contact and subscribers** — View contact messages and email subscribers; export subscribers (e.g. CSV).
- **DealSite preferences** — Create and manage preferences; view matched properties for their DealSite.

**Request To Market (as requester)**

- **Browse Market Place** — View KHABITEQ Market Place properties (when logged in, the list can show which ones they have already requested to market).
- **Request to market** — For any Market Place property, submit a “Request To Market.” The Landlord/Developer (Publisher) is notified by email and in-app.
- **View their requests** — List all their requests (pending, accepted, rejected) with property and publisher details and agent commission amount.
- **After accept** — When the Publisher accepts, the property appears on the Agent’s DealSite. The Publisher pays the agent commission (via link or offline); when payment is completed via the platform, the Agent is notified (e.g. by email) that the commission was received.

**Inspections**

- **List “My inspections”** — See inspection requests for their properties (from main app or from their DealSite).
- **Respond** — Accept or reject. On accept, optionally set an inspection fee (₦1,000–₦50,000); the buyer gets a payment link when a fee is set. Stats and filters (status, type, mode, etc.) are available for the dashboard.

**Bookings**

- View and manage **my bookings** (e.g. shortlet or similar); respond to booking requests; view booking stats.

**Other**

- **Broadcast** — Send messages to their subscribers (if supported).
- **Notifications** — View and manage notifications.
- **Referrals** — Referral stats and records (if enabled for Agents).
- **Transactions** — View their transaction history (e.g. subscriptions, payments received).

---

## 6. Buyers / Tenants / End Users

“Buyers” here means anyone seeking to **rent, buy, or inspect** properties — whether they have an account or are identified only by email (e.g. when submitting from a DealSite).

**Without an account (or as visitor)**

- **Browse Market Place** — See Market Place properties (no contact).
- **Use a DealSite** — View an Agent’s or Developer’s page; submit an **inspection request** (name, email, phone, date, time, mode). They may later receive an acceptance (with optional inspection fee and payment link) or rejection by email.
- **Transaction registration** — Use the public transaction registration flow: choose type, enter buyer and property details, submit; pay processing fee when applicable via the returned link.
- **Contact and testimonials** — Submit contact form; view testimonials.

**With preferences (e.g. tenant/buyer profile)**

- **Create preferences** — Set search criteria (e.g. location, type, budget). Admin or the system can match properties to preferences; Agents/Developers may have “preferences” linked to their DealSite for matching.
- **View matched properties** — See properties matched to their preference(s).
- **Request inspection (main app)** — Submit inspection requests for specific properties (e.g. from main site or matched list). They receive emails when the Agent/Developer accepts (with optional fee and payment link) or rejects.
- **Pay inspection fee** — When an inspection is accepted with a fee, they receive a payment link (email or in-app); they pay on the payment provider’s page to confirm the inspection.
- **Bookings** — Where applicable, request or confirm bookings (e.g. shortlet); respond to booking requests.
- **Rate and report** — After a completed inspection, rate the agent and optionally submit a report/complaint (e.g. no-show, unprofessional conduct). These are visible to Admin for review.

**Transaction registration (buyer-led)**

- After or alongside an inspection, they can register the transaction (rental, sale, off-plan, JV), provide property identification and buyer details, and pay the processing fee (when value is ₦5M+) via the link provided. This supports compliance and record-keeping.

---

## 7. Admin

Administrators have a dedicated admin dashboard and APIs. They oversee the entire platform and enforce policies.

**Dashboard and stats**

- **Overview stats** — High-level metrics (e.g. users, properties, inspections, transactions) with filters (e.g. 7 days, 30 days, 365 days, custom range).
- **Export** — Export dashboard data (e.g. JSON, CSV) for reporting.
- **Stats by type** — Drill down by stats type (e.g. inspections, properties, revenue).

**User management**

- **Admins** — List, create, update, delete admins; change admin status.
- **Agents** — List all agents (with filters); view single agent profile and dashboard stats; approve KYC; toggle status; flag/unflag account; delete account; view all agent properties; manage upgrade requests.
- **Landlords** — List all landlords; view single landlord and dashboard stats; flag/unflag account; delete; view all landlord properties.
- **Developers** — Typically managed under agents or a dedicated segment; similar oversight (properties, status, flag, etc.).
- **Buyers** — List all buyers; create, update, delete; view single buyer and all their preferences.

**Property management**

- **List all properties** — With filters and pagination.
- **Property stats** — Counts and aggregates for dashboard.
- **Single property** — View full details; edit; delete; change status; set approval status (approve/reject listing).
- **Inspections per property** — List all inspections for a given property.

**Preference and matching**

- **Preferences** — List by mode (e.g. developers, tenants, shortlets, buyers); stats per mode; view single preference with all buyer preference data; find matched properties; approve or reject preference; submit/select matched properties; delete preference.

**Inspection tracking**

- **List inspections** — All inspections with filters (status, stage, property, owner, negotiation).
- **Inspection stats** — Total, approved, completed, cancelled, active negotiations.
- **Single inspection** — Full details plus **activity log** (timeline of actions and messages).
- **Activity logs** — Logs by inspection ID or by property ID (for audit).
- **Inspections for a property** — List inspections for one property.
- **Field agent assignment** — Assign an inspection to a field agent; view assignments.

**Ratings and reports (complaints)**

- **Ratings** — List all agent ratings (filter by agent or inspection) for quality and trust oversight.
- **Reports** — List all complaints/reports (filter by status or reported agent); view single report with full context; update report status (e.g. pending, reviewed, resolved, dismissed) and add admin notes for internal follow-up.

**Transaction registration**

- **List registrations** — All transaction registrations with filters (status, type).
- **Stats** — Counts by status and by transaction type.
- **Single registration** — Full details (buyer, property, inspection, identification, payment, receipts) for support and compliance.

**Transactions (payments)**

- **List transactions** — All payment transactions; stats; view single transaction; validate transaction; delete details where allowed.

**DealSite management**

- **List DealSites** — All DealSites; stats.
- **Single DealSite** — View by slug; view reports (e.g. user reports against the page); view activities and stats.
- **Controls** — Activate, pause, or put on hold a DealSite.

**Subscriptions and plans**

- **Subscription plans** — Create, read, update, delete plans.
- **Plan features** — Create, read, update, delete features linked to plans.
- **User subscriptions** — List all subscriptions; cancel or update user subscription; add subscription (e.g. manual grant); change status; delete.
- **Email subscriptions** — Admin management of email subscription product (e.g. newsletters) if applicable.

**Content and marketing**

- **Testimonials** — Create, update, delete testimonials; update status (e.g. approve for display); list all; view latest approved for frontend.
- **Referrals** — List referrals; view details and stats; update; delete.
- **Promotions / campaigns** — Create, update, delete promotions; list with filters; view single promotion and analytics; update status.

**Document verification**

- **Verification docs** — List all verification documents; view single; stats; delete; upload or send to verification provider; mark verification outcome.

**Settings and permissions**

- **System settings** — Create, read, update, delete settings; bulk upsert for configuration.
- **Roles and permissions** — Create/update/delete roles and permissions; assign permissions to admin; assign roles to admin; seed default roles and permissions; list all roles and permissions.

**Other**

- **File upload/delete** — Upload single file (e.g. to cloud storage); delete file (used across admin flows).
- **Login** — Admin login for dashboard access.

---

## 9. Summary Table (Who Can Do What)

| Capability | Visitor | Landlord | Developer | Agent | Buyer* | Admin |
|------------|---------|----------|-----------|-------|--------|-------|
| Register / Login | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (admin) |
| Browse Market Place | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Post properties | — | ✓ (unlimited) | ✓ (2 free, then subscription) | ✓ (2 free, then subscription) | — | — |
| Publish to Market Place only | — | ✓ | ✓ | — | — | — |
| Set agent commission | — | ✓ | ✓ | — | — | — |
| Request To Market (request) | — | — | — | ✓ | — | — |
| Request To Market (accept/reject, pay commission) | — | ✓ | ✓ | — | — | — |
| DealSite (public page) | Browse | — | ✓ | ✓ | Browse / submit | Manage all |
| Subscription | View plans | — | ✓ | ✓ | — | Manage all |
| Inspections (respond, set fee) | — | ✓** | ✓ | ✓ | — | — |
| Inspections (submit request) | ✓ (DealSite) | — | — | — | ✓ | — |
| Bookings | — | — | — | ✓ | ✓ | — |
| Transaction registration (submit) | ✓ | — | — | — | ✓ | — |
| Transaction registration (track) | — | — | — | — | — | ✓ |
| Rate / report agent | — | — | — | — | ✓ (post-inspection) | Review all |
| Preferences, matches | — | — | DealSite prefs | DealSite prefs | ✓ | Manage all |
| AI-assisted form (property) | — | ✓ | ✓ | ✓ | — | — |
| AI-assisted form (preference) | ✓ | — | — | — | ✓ | — |
| Manage users, properties, content, settings | — | — | — | — | — | ✓ |

\* Buyer: may use site as visitor or with a preference/buyer profile.  
\** Landlords may have inspection-respond capability where they own the property (product-dependent).

---

## 10. Fees and Limits (Quick Reference)

- **Landlords:** No subscription; unlimited property posts; can set agent commission (0–5%, and/or amount in Naira) for Market Place listings.
- **Agents & Developers:** First **1 property** free; from the **2nd** property, **subscription required**; **Agents** also need **KYC approved** for a second listing. **Landlords:** no listing limit; subscription not required for posting. Can set inspection fee on accept (₦1,000–₦50,000). Agent commission for Request To Market is set by the Publisher (Landlord/Developer) on the property.
- **Transaction registration processing fee:** Below ₦5M: ₦0; ₦5M–₦50M: ₦100,000; above ₦50M: ₦150,000 (by transaction value).
- **Request To Market:** Publisher pays the **agent commission amount** (set on the property) to the Agent when they accept; payment via link when Agent has payment set up.

---

## 11. AI-assisted form filling (OpenAI)

The platform offers **optional AI-assisted form filling** so users can describe what they want in natural language instead of (or in addition to) filling fields manually.

- **Property form (post a listing)** — **Agent, Landlord, and Developer** can call an API with a short description of the property (e.g. “4-bed duplex in Victoria Island, 120M, 5 bathrooms, parking”). The backend uses OpenAI to return suggested form fields (type, category, location, price, features, description, etc.). The user reviews and edits the suggestion, then submits the property as usual. This does not replace validation: the final submission is still validated and stored by the existing property APIs.
- **Preference form (buyer looking for a property)** — **Anyone** (including visitors) can call a public API with a description of what they are looking for (e.g. “3-bed apartment in Lagos under 5M yearly, prefer Lekki”). The backend uses OpenAI to return suggested preference fields (preference type, location, budget, property details, features, etc.). The user reviews and edits, then submits the preference via the existing preference API.

AI suggestions are **optional** and **additive**: users can always fill forms manually. The backend requires a configured OpenAI API key; if it is not set, the AI endpoints return a clear error so the frontend can hide or disable the “Fill with AI” option.

---

This overview is derived from the current backend behaviour and the FRONTEND_API_GUIDE. For technical details (endpoints, request/response shapes), refer to FRONTEND_API_GUIDE.md and ADMIN_API_GUIDE.md.
