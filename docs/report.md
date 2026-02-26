# Transaction Registration — What It Does (Plain-English Guide)

This guide explains the **Transaction Registration** feature in a way that anyone can understand: what it is for, what you see on the screen, and what happens when you use it. No technical jargon.

---

## What is Transaction Registration?

Transaction Registration is the part of the platform where **buyers and tenants** can:

1. **Read the rules and fees** — What LASRERA (Lagos State Real Estate Regulatory Authority) requires and what fees apply.
2. **Check a property's status** — See if a property already has a registered transaction (e.g. sold or leased) before you commit.
3. **Register your own transaction** — Submit your rental, purchase, or other deal so it is recorded with the system and, when required, pay the processing fee.

The goal is to support **LASRERA's buyer-led compliance**: transparency, fewer fraud or double-sales, and a clear link between inspections, registrations, and payments.

---

## When you open the page

- You land on the **"Guidelines & fees"** tab first. That is on purpose: read the rules and fees before you search or register.
- At the top you see three tabs you can switch between at any time:
  1. **Guidelines & fees**
  2. **Check property status**
  3. **Register transaction**
- At the bottom of the content there are **Previous** and **Next** buttons to move between these three sections in order.

If you arrived from a link that includes an **inspection ID** (after a property inspection), you may first see a short **"Confirm intent to proceed"** box: enter the email you used for the inspection and click **"I wish to proceed"**. After that, you can use the three tabs as normal.

---

## 1. Guidelines & fees

**What it's for:** To understand what the law requires and what you will pay before you register a transaction.

**What you see:**

- A short notice that **only transactions of ₦5,000,000 or more** are subject to mandatory registration and a **processing fee of 3%** of the property/transaction value (under LASRERA and the Digital Enforcement Framework).

- **Transaction types and fees**  
  For each transaction type there is a block that explains:
  - **Transaction type:** e.g. Rental Agreement, Outright Property Purchase, Off-Plan Purchases, Joint Venture Agreement, Contract of Sale.
  - **What it is** — A short description (e.g. tenancy, sale of completed property, off-plan, etc.).
  - **When registration is required** — When the value is at or above ₦5,000,000.
  - **A table of "value bands"** — Ranges of property value (e.g. ₦5M–₦10M, ₦10M–₦25M, …) and the **processing fee** for each band (shown as 3% with example amounts in Naira).
  - **Eligibility and requirements** — A bullet list of what must be in place (e.g. valid property identification, confirmation from buyer/owner, etc.).

- **Safe transaction guidelines**  
  Several short sections based on LASRERA and the framework, including:
  - **Legal foundation** — Why registration exists (e.g. protect buyers/tenants, limit fraud, commission caps, disputes, fines).
  - **Property identification** — What is needed for buildings (e.g. exact address) and for land (e.g. GPS, survey, owner confirmation).
  - **Inspection-to-transaction flow** — When inspections must be logged and how that connects to registration.
  - **Transaction locking and public visibility** — Once a transaction is registered, the property is tagged and others may see that it has an active or completed registration.
  - **Check property status** — You can look up by address, Property Id, or GPS to see if something is already registered and limited inspection history.
  - **Permit conditions and enforcement** — What practitioners must do and what happens if they don't comply.

- If the system has extra **guidelines from the backend** (e.g. required documentation, commission compliance, ownership/title verification, dispute resolution, data disclosure), those appear in separate subsections.

**In short:** This tab is your **reference**: rules, fees (3% from ₦5M upward), and how to transact safely.

---

## 2. Check property status

**What it's for:** To see whether a property already has a registered transaction (and, when available, limited inspection history or land-record information), so you can do due diligence before committing.

**What you do:**

1. Choose how you want to search:
   - **Property Id** — The unique ID for the property (e.g. from the property listing page or URL).
   - **Address** — Full or partial address (e.g. street, area, Lagos).
   - **GPS (lat/lng)** — Latitude and longitude of the property.
2. Enter the value(s) in the box(es) that appear (e.g. Property Id, or Address, or Latitude and Longitude).
3. Click **Search**.

**What you see:**

- A short note that results are based on **LASRERA transaction registration data** and, where the system is linked to **Lagos State E-GIS**, may include title/land record information.
- If the search finds something, a **results table** with columns such as:
  - **Address / Property Id** — How the property was identified.
  - **Registered** — Whether a transaction is registered (Yes/No).
  - **Status** — e.g. Registered, Pending.
  - **Sold/Leased** — Whether it is marked as sold or leased (Yes/No).
  - **Inspections** — Number of inspections linked to that property (when available).
  - **Title status** and **E-GIS** — Only if the backend returns this (e.g. ownership/coordinates verified, land record reference).
- If nothing is found, a message like **"No matches found."**
- A link to the **Lagos State e-GIS portal** (landonline.lagosstate.gov.ng) for official land record and title verification.

**In short:** You look up a property by **Property Id**, **address**, or **GPS** and see whether a transaction is already registered and related information, so you can make a more informed decision.

---

## 3. Register transaction

**What it's for:** To submit your transaction (rental, purchase, off-plan, joint venture, or contract of sale) so it is recorded, and—when the value is ₦5,000,000 or above—to pay the 3% processing fee (usually via a payment link).

**What you do:**

1. Fill in the **Register a transaction** form. Fields include:
   - **Transaction type** — Choose one: Rental Agreement, Outright Property Purchase, Off-Plan Purchases, Joint Venture Agreement, Contract of Sale.
   - **Property ID** — The property's unique ID (e.g. from the listing). If you opened the page from a property page, this may already be filled.
   - **Inspection ID** — Optional; use it if you are registering after an inspection.
   - **Buyer details** — Full name, email, phone (all required).
   - **Transaction value (NGN)** — The amount in Naira. The form formats it with commas (e.g. 5,000,000). If the value is ₦5,000,000 or more, a line appears showing the **processing fee (3% of value)**.
   - **Payment receipt** — You must upload a file (e.g. PDF or image) as proof of payment/receipt.
   - **Property identification type** — Choose: Land, Residential, Commercial, or Duplex.
   - Depending on that choice:
     - For **Land:** You must enter **Latitude** and **Longitude**; you may add address, survey plan reference, and an "owner confirmation" checkbox.
     - For **Residential, Commercial, or Duplex:** You must enter the **Exact address**; you may add title number, owner name, and optional latitude/longitude.

2. If the system already knows something about that property (e.g. an existing registration), a **warning message** may appear in an amber box above the form. Read it before submitting.

3. Click **Register transaction**.

**What happens next:**

- Your details are sent to the system. The system checks the property and may create a registration record.
- If the **transaction value is ₦5,000,000 or more**, the system will usually generate a **processing fee** (3% of the value) and a **payment link** (e.g. Paystack). If you receive a payment link, you are **redirected to that link** to complete the fee payment. After paying, you may return to the platform or follow any instructions on the payment page.
- If there is no payment link (or the value is below the threshold), you see a **success message** on the same page (e.g. "Transaction registered successfully.").
- If something goes wrong (e.g. invalid data, property not found, or the property already has an active registration), an **error message** is shown and you stay on the form so you can correct and try again.

**In short:** You complete one form with transaction type, property and buyer details, value, receipt, and property identification. For values from ₦5M upward, you are shown the 3% fee and, when applicable, sent to a payment page to pay it. The rest is recorded as a registered transaction.

---

## 4. Inspections — Agent dashboard

This section is for **agents**. It describes how you manage **inspection requests** and **property listing status** from your Agent dashboard.

### 4.1 Inspection requests — Accept or reject

**What it's for:** When a buyer or tenant requests an inspection for one of your listed properties, you can **accept** or **reject** that request from your dashboard. This keeps your calendar under your control and avoids inspections you cannot honour.

**Where you see it:**

- In the Agent dashboard, open the **Inspection requests** (or **My inspection requests**) area. You see a list of requests. Each request usually shows who asked, which property, and the requested date/time. Requests that are waiting for your decision may be labelled as **Pending approval** or similar.

**What you do:**

1. Find the inspection request you want to respond to.
2. Choose one of:
   - **Accept** — You confirm that you will honour the inspection. The requester may then see the inspection as confirmed and may be able to book or proceed.
   - **Reject** — You decline the request. You may be asked to add a short **note** (e.g. "Property no longer available" or "Date not suitable"). The requester may see that the request was declined.
3. Confirm your choice (e.g. click **Accept** or **Reject** in a small confirmation step if the system shows one).

**What happens next:**

- If you **accept**, the request status changes (e.g. to **Accepted** or **Confirmed**) and the requester is informed as per the system’s rules.
- If you **reject**, the request is marked as **Rejected** (or **Declined**). The requester may see your note if you added one. The request no longer appears as pending on your side.
- The list refreshes so you can see the updated status and move on to the next request.

**In short:** From your Agent dashboard you **accept** or **reject** each inspection request, with an optional note when rejecting. This keeps inspection requests under your control before any inspection is confirmed.

---

### 4.2 Property listing status — Menu on each property

**What it's for:** For each property you have listed, you can **change its status** (e.g. make it temporarily unavailable or available again) without deleting the listing. This is useful when a property is under offer, undergoing repairs, or you want to pause new enquiries.

**Where you see it:**

- In the Agent dashboard, open **My listings** (or the page where your properties are listed). Each property row or card has a **menu icon** (e.g. three dots **⋮** or a small menu button).

**What you do:**

1. Find the property whose status you want to change.
2. Click the **menu icon** on that property.
3. In the menu that opens, choose an action such as:
   - **Unpublish (mark unavailable)** — The property stays in your list but is no longer shown as available to buyers/tenants (e.g. it is hidden from public search or marked "Unavailable"). Use this when the property is temporarily off the market.
   - **Publish (mark available)** — The property is shown as available again and can appear in search and on the Dealsite. Use this when you are ready to accept enquiries or inspections again.
4. The menu may close and the list may refresh; the property’s status (e.g. Available / Unavailable) updates accordingly.

**What happens next:**

- The system saves your choice and updates the property’s status. Visitors and buyers will see the property as available or unavailable based on your selection. You can change it again later using the same menu.

**In short:** Use the **menu icon** on each listed property to **unpublish (mark unavailable)** or **publish (mark available)**. This lets you control visibility and status of each listing without removing it from your dashboard.

---

### 4.3 Buyer inspection experience (from request to rating)

This subsection describes what **buyers and tenants** experience from the moment they ask for an inspection until after the inspection is over. It complements the agent view in 4.1 and 4.2.

**Requesting an inspection**

- The buyer visits the property listing (e.g. on the main marketplace or on an agent’s public page) and asks for an inspection. They provide their name, email, and phone, and choose a preferred date and time.
- The buyer does **not** pay at this stage. The request is sent to the agent and appears in the agent’s dashboard as **Pending approval** (or similar). The agent may receive an email and an in-app notification.

**After the agent responds**

- If the agent **accepts**, the buyer receives an email (and may see a notification) with a **payment link**. The buyer pays the inspection fee via that link. Once payment is confirmed, the inspection is confirmed and the agent is notified. (On some agent public pages, the flow may differ: for example no inspection fee and no payment link; the buyer is simply notified that the request was accepted.)
- If the agent **rejects**, the buyer receives an email (and may see a note from the agent if one was added). The request is closed and no payment is made.

**After the inspection is completed**

- Once the inspection is marked **completed**, the buyer can:
  - **Rate the agent** — They enter the email they used for the inspection and give a star rating (e.g. 1–5). They can add an optional comment. Only one rating per inspection. This does not require a user account; the system checks that the email matches the buyer on that inspection.
  - **Report or complain** — If something went wrong, the buyer can submit a report using the same email. They choose a category (e.g. unprofessional conduct, property misrepresentation, no-show or late, payment issue, safety concern, communication issue, or other) and can add a subject and description. Reports are sent to the platform for admin review.
- **Prospective buyers** can see an agent’s overall rating (e.g. average stars and total number of ratings) and recent ratings and comments on the agent’s profile or landing page. This helps new buyers decide before requesting an inspection.

**Warnings when a property has a registered transaction**

- When the buyer requests an inspection for a property that already has an active or completed **transaction registration** (e.g. sold or leased), the system may show a short warning message. The request is **not** blocked; the buyer can still proceed, but they are made aware so they can do their due diligence.

**In short:** Buyers request an inspection without paying first; the agent accepts or rejects; if accepted, the buyer pays via a link and the inspection is confirmed. After the inspection is completed, the buyer can rate the agent and report issues using their email (no account needed). Agent ratings are visible to other buyers. Warnings may appear when a property already has a registered transaction.

---

## Quick reference: the three tabs (buyers/tenants) and Agent inspection

| Tab or area | Purpose |
|-------------|--------|
| **Guidelines & fees** | Read LASRERA rules, fee structure (3% from ₦5M), and safe-transaction guidelines. |
| **Check property status** | Search by Property Id, address, or GPS to see if a transaction is registered and related info. |
| **Register transaction** | Submit your transaction (with receipt and property details); pay 3% fee when value ≥ ₦5M. |
| **Inspections (Agent)** | Accept or reject inspection requests; use the menu on each property to unpublish (mark unavailable) or publish (mark available). |

---

## 5. Admin experience: Transaction Registration and Inspection tracking — *in progress*

> **Status:** *in progress* — The backend supports the behaviour described below, but the **admin frontend does not yet use it**. This section describes what will be available once the admin interface is built or updated.

This section is for **platform administrators**. It describes how admins can view and follow up on **transaction registrations** (LASRERA-style) and **inspections** (requests, payments, and buyer feedback).

### 5.1 Transaction registrations (admin)

**What it is for:** Admins need to see all transactions that buyers and tenants have registered (rentals, outright sales, off-plan purchases, joint ventures) so they can monitor compliance, follow up on payments, and support dispute resolution or reporting.

**What the system supports today (backend):**

- **List all registered transactions** — Admins can retrieve a list of every transaction registration. The list can be filtered by status (e.g. submitted, pending completion, completed, rejected) and by transaction type (rental, outright sale, off-plan, joint venture). Each row or card can show key details: who registered, which property, transaction value, processing fee, status, and when it was submitted.
- **Summary numbers** — Admins can see totals and counts, for example how many registrations are in each status and how many are in each transaction type. This supports dashboards and quick oversight.
- **Open a single registration** — From the list, an admin can open one registration to see full details: buyer details, property identification (address, GPS, land/building type, etc.), linked inspection (if any), payment and receipt information, and the full timeline. This helps with follow-up, verification, or handling disputes.

**In short:** Admins can list, filter, and open every transaction registration, with summary stats. The backend is ready; the admin screen that uses this is not yet in place.

---

### 5.2 Inspections: tracking and follow-up (admin)

**What it is for:** Admins need to see the full journey of each inspection (request → agent response → payment → completion) and to investigate buyer feedback (ratings and reports).

**What the system supports today (backend):**

- **List all inspections** — Admins can see every inspection request, including those still waiting for payment or in progress. No status is hidden (e.g. pending approval, rejected, pending payment, approved, completed). Lists can be filtered by status, stage, property, or agent so admins can focus on what matters.
- **Inspection timeline (activity log)** — For any inspection, the admin can open it and see a **timeline of what happened**: when the buyer requested, when the agent accepted or rejected, when payment was made, when the inspection was completed, and any other recorded steps. This supports audits and follow-up without asking the agent or buyer for the story.
- **Logs by inspection or property** — Admins can also pull the activity log for a specific inspection or for all activity linked to a property. This helps when investigating a complaint or checking the history of a given listing.
- **Agent accept/reject is recorded** — When an agent accepts or rejects an inspection request, that action is stored in the activity log with a clear message and status. Admins can see who responded and when.
- **Ratings and reports** — Admins can list all ratings given by buyers (e.g. by agent or by inspection) and all reports or complaints. For each report, the admin can see the category, subject, description, and status (e.g. pending, reviewed, resolved, dismissed). Admins can update the report status and add internal notes so the team can track how each complaint was handled.

**In short:** Admins can see all inspections (all statuses), open any inspection to view its full timeline, and use logs by inspection or property. They can also list and manage buyer ratings and reports. The backend is ready; the admin screens that use this are not yet in place.

---

## Important points for users

- **₦5,000,000 threshold** — Mandatory registration and the 3% processing fee apply only when the transaction value is **at or above** ₦5,000,000.
- **Receipt is required** — You must upload a payment receipt when registering.
- **Property Id** — You can get this from the property listing page or URL when you are viewing a property; it is used both to **check status** and to **register** a transaction for that property.
- **Inspection first (when required)** — For some flows you may be asked to confirm intent after an inspection before using the registration form; the system may prefill Property ID or Inspection ID when you come from a property or inspection link.
- **Payment link** — If the system returns a payment link after you register, use it to pay the processing fee; your transaction is still recorded even if you complete payment later, but the authority may require payment to finalise the registration.
- **Agents — Inspection requests** — From the Agent dashboard you can **accept** or **reject** each inspection request and optionally add a note when rejecting.
- **Agents — Property status** — Use the **menu icon** on each property in **My listings** to **unpublish (mark unavailable)** or **publish (mark available)** so you can control visibility without deleting the listing.
- **Admins — Section 5 (in progress)** — The backend supports admin listing and tracking of transaction registrations and inspections (including activity logs, ratings, and reports). The admin frontend that will use this is not yet built; section 5 describes the intended experience.

This document reflects what is implemented in the Transaction Registration flow: guidelines first, then check property status, then register, with clear fees (3% from ₦5M) and support for Property Id, address, and GPS throughout. It describes the Agent dashboard (inspection requests, property status, and the buyer inspection experience) and the intended Admin experience for transaction registration and inspection tracking, which is tagged *in progress* until the admin frontend consumes it.
