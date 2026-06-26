# LASRERA × KHABITEQ — Feature Compliance Contributions

**Document type:** Operating model implementation guide  
**Date:** 24 June 2026  
**Audience:** CEO, leadership team, LASRERA partnership working group  
**Related documents:** `LASRERA_PARTNERSHIP_STRUCTURE.md`, `LASRERA_PARTNERSHIP_EXECUTIVE_SUMMARY.md`

---

## 1. Purpose

This document maps each major KHABITEQ platform feature to **practical contributions** by LASRERA and KHABITEQ toward **full regulatory compliance**, within the agreed operating model.

LASRERA’s partnership lever is binary per feature:

| LASRERA action | Meaning |
|----------------|---------|
| **Endorse** | Officially recognises the feature as aligned with LASRERA policy; encourages voluntary adoption |
| **Mandate** | Issues a regulatory directive requiring practitioners (and where applicable, the public) to use the feature for defined transaction types or activities |

KHABITEQ delivers the technology, operations, and merchant-of-record functions regardless of endorse or mandate. LASRERA never operates the platform.

---

## 2. Operating Model (Reference)

| LASRERA | KHABITEQ |
|---------|----------|
| Regulatory endorser | Technology owner |
| Industry communicator | Platform operator |
| Public-facing representative | Merchant of record |
| Policy alignment | KYC management |
| Practitioner engagement | Subscription billing |
| Launch and awareness campaigns | Transaction processing |

**Boundary rule:** LASRERA sets policy and communicates it. KHABITEQ implements, enforces technically, bills, supports, and reports.

---

## 3. Feature-by-Feature Compliance Contributions

---

### Feature 1: Transaction Registration

**Platform capability:** Public buyer-led portal to register rental agreements, outright sales, off-plan purchases, and joint ventures. Processing fees apply by transaction value (₦100,000 for ₦5M–₦50M; ₦150,000 above ₦50M). Properties are tagged in a central registry; public due-diligence search by address, property ID, or GPS is available. Flow links to completed inspections where applicable.

**Compliance objective:** Reduce double sales, unregistered transactions, and fraud; create an auditable trail between buyer, property, practitioner, and transaction value in line with LASRERA’s digital enforcement framework.

This is LASRERA’s **highest-interest feature**. Below is an expanded compliance playbook.

#### 3.1 LASRERA contributions

| Operating role | Practical contribution |
|----------------|------------------------|
| **Regulatory endorser** | Issue a formal notice that KHABITEQ is the **endorsed digital channel** for voluntary transaction registration pending full mandate rollout |
| **Policy alignment** | Publish written thresholds: which transaction types and value bands require registration; confirm fee bands match platform config; update policy when bands change (KHABITEQ updates `transactionRegistration.config.ts` on written directive) |
| **Industry communicator** | Circular to all 4,000+ registered agents: registration is **buyer-led** but agents must not obstruct or discourage it; agents should direct buyers to the portal after agreed transactions |
| **Public-facing representative** | Co-branded public messaging: “Register your transaction with LASRERA via KHABITEQ” on LASRERA website, social channels, and stakeholder events |
| **Practitioner engagement** | Include transaction-registration awareness in agent renewal / CPD materials; clarify that failure to facilitate registration where mandated may affect licence standing |
| **Launch and awareness** | Joint press on buyer protection; LASRERA-led SMS/circular to estate associations and developers on mandatory registration effective date (if mandated) |

**If LASRERA endorses (Phase 1 — recommended pilot):**

- Publish guidance that transactions at or above ₦5M **should** be registered on the platform.
- LASRERA website links to the co-branded registration portal.
- No enforcement penalty yet; focus on education and volume proof.

**If LASRERA mandates (Phase 2 — after pilot):**

- Issue a **regulatory instrument** (circular or gazette notice) stating:
  - Transaction types covered (rental, sale, off-plan, JV).
  - Value thresholds for mandatory registration.
  - Effective date and grace period (e.g. 90 days).
  - That registration on KHABITEQ satisfies the filing requirement (subject to legal confirmation).
- Require registered agents to **display** the registration portal link on marketing materials and DealSites.
- Authorise LASRERA compliance officers to **request registration IDs** during audits (KHABITEQ provides verification API or admin lookup — no LASRERA system access).
- Coordinate with Lagos State on **E-GIS / land registry** data sharing policy so KHABITEQ can enrich search results (LASRERA facilitates inter-agency MOU; KHABITEQ builds integration).

#### 3.2 KHABITEQ contributions

| Operating role | Practical contribution |
|----------------|------------------------|
| **Technology owner** | Maintain registration portal, fee engine, property status tagging (`transaction_registered_pending`, `sold_leased_registered`), inspection-to-registration intent flow, E-GIS validate endpoint (stub today; wire when LASRERA enables) |
| **Platform operator** | 99.5% uptime SLA; admin workflow for `submitted` → `pending_completion` → `completed` / `rejected`; activity logs for audit |
| **Merchant of record** | Collect processing fees via Paystack; issue payment receipts; reconcile and report fee totals to LASRERA quarterly |
| **KYC management** | Where registration references an agent or property owner, cross-check practitioner KYC status in registry metadata (flag unverified agents in admin view) |
| **Subscription billing** | N/A directly — but gate agent DealSite visibility if agent is non-compliant with mandate (configurable policy flag) |
| **Transaction processing** | Payment webhook → status update; failed-payment retry comms to buyer; refund policy per terms |

**Technical enforcement when mandated:**

- Show **due-diligence warnings** on inspection booking when a property already has an active registration (already implemented).
- Block duplicate registration per property (409 conflict — already implemented).
- LASRERA-attributed entry URL (`/transaction-registration?source=lasrera`) for reporting.
- Read-only **LASRERA executive dashboard**: registrations by LGA, type, status, fee collected, month-on-month trend.
- Export pack for LASRERA compliance audits (aggregated; no raw buyer PII without legal basis).

#### 3.3 End-to-end compliance flow (mandated scenario)

```
Buyer completes transaction
    → Agent / landlord directs buyer to LASRERA-co-branded portal
    → Buyer reviews Safe Transaction Guidelines
    → Buyer submits registration + ID + proof of payment
    → KHABITEQ computes fee → Paystack payment
    → Property tagged in central registry
    → LASRERA receives quarterly aggregate report
    → LASRERA audit: officer requests registration ID → KHABITEQ confirms status
```

#### 3.4 Success metrics (Transaction Registration)

| Metric | Pilot (90 days) | Year 1 (mandated) |
|--------|-----------------|-------------------|
| Registrations initiated | 50+ | 500+ |
| Payment completion rate | >85% | >90% |
| LGAs with at least 1 registration | 10+ | 20+ (all Lagos LGAs) |
| Duplicate-sale warnings triggered | Track baseline | Decreasing trend |

---

### Feature 2: Practitioner Page (Verified DealSite)

**Platform capability:** Public practitioner profile at `slug.khabiteq.com` — listings, ratings, inspection settings, contact options, bank/payment setup. Agents require KYC approval and active subscription (after trial) to maintain listing and public-page access. Equivalent to the **Verified Practitioner Page** in LASRERA discussions.

**Compliance objective:** Only identifiable, KYC-verified, LASRERA-licensed practitioners market properties publicly; buyers can verify who they are dealing with.

#### LASRERA contributions

| Role | Practical action |
|------|------------------|
| **Endorse** | Recommend that all registered agents maintain an active Verified Practitioner Page on KHABITEQ |
| **Mandate** | Require every active LASRERA-licensed agent to create and maintain a verified page within 90 days of directive; link LASRERA licence number to page |
| **Policy alignment** | Define minimum profile fields (licence number, photo, firm name, contact) that must appear on every page |
| **Practitioner engagement** | Bulk onboarding circular with dedicated link; LASRERA licence validation list shared with KHABITEQ for fast-track KYC |
| **Launch and awareness** | “LASRERA Verified Practitioner” badge co-brand on approved pages |

#### KHABITEQ contributions

| Role | Practical action |
|------|------------------|
| **KYC management** | Verify identity documents; cross-check LASRERA licence number; approve/reject within SLA |
| **Subscription billing** | Enforce paid plan after trial for continued public visibility |
| **Platform operator** | Auto-pause DealSites when KYC lapses or subscription expires; auto-resume when cleared |
| **Technology owner** | Display LASRERA licence field on public page; `KYC_REQUIRED` / `SUBSCRIPTION_REQUIRED` gates on visitor APIs |
| **Transaction processing** | Enable Paystack sub-account on page for inspection fees and commissions |

**Endorse vs mandate:**

- **Endorse:** Voluntary adoption; LASRERA lists verified practitioners on its website by syncing from KHABITEQ export.
- **Mandate:** Agents without an active verified page are flagged in LASRERA’s registry; renewal conditional on compliance (LASRERA enforcement; KHABITEQ supplies status feed).

---

### Feature 3: Central Booking Inspection System

**Platform capability:** Unified inspection workflow across main app and DealSites — buyer submits request (no upfront payment) → practitioner notified → accept/reject → optional inspection fee (₦1,000–₦50,000) → buyer pays via link → inspection completed → buyer may rate/report agent. Admin inspection audit logs. Field-agent assignment supported. Warnings shown if property has active transaction registration.

**Compliance objective:** Documented, traceable property viewings; fee transparency; accountability for no-shows and misrepresentation; inspection trail supports transaction registration.

#### LASRERA contributions

| Role | Practical action |
|------|------------------|
| **Endorse** | Recommend that practitioners use the central inspection system rather than informal viewings for regulated transactions |
| **Mandate** | Require that inspections preceding registrable transactions (above threshold) are booked through the platform; practitioners must not bypass for fee evasion |
| **Policy alignment** | Set acceptable inspection fee range (platform already enforces ₦1k–₦50k); define when inspection record is required before registration |
| **Industry communicator** | Educate buyers: “Book inspections through verified practitioner pages” |
| **Practitioner engagement** | Include inspection-system training in agent onboarding materials |

#### KHABITEQ contributions

| Role | Practical action |
|------|------------------|
| **Technology owner** | Central inspection model, activity logs, multi-property requests, DealSite + general flows |
| **Platform operator** | Admin oversight of all inspection statuses; field-agent assignment; complaint/rating review |
| **Merchant of record** | Process inspection fee payments; notify practitioner on successful payment |
| **KYC management** | Only KYC-approved agents can accept inspections on Market Place properties |
| **Transaction processing** | Link completed inspections to transaction-registration intent (`POST /transaction-registration/intent`) |

**Endorse vs mandate:**

- **Endorse:** Inspection booking encouraged as best practice; links from LASRERA buyer-education pages.
- **Mandate:** Registration portal requires `inspectionId` or proof of platform inspection for transactions above threshold (KHABITEQ validation rule, activated on LASRERA written policy).

---

### Feature 4: Platform Syndication

**Platform capability:** Approved third-party property platforms connect to KHABITEQ; property create/update events push listings outbound with DealSite and inspection URLs. Partners apply via public API; admin approves platforms. Practitioners enable/disable per-connection syndication. Triggered on own listings and on Market Place properties after Request To Market acceptance.

**Compliance objective:** Consistent property data across portals; all syndicated listings route buyers back to verified practitioner pages and the central inspection system — preventing “off-platform” bypass of LASRERA-aligned workflows.

#### LASRERA contributions

| Role | Practical action |
|------|------------------|
| **Endorse** | Acknowledge KHABITEQ syndication as acceptable distribution if listings link back to verified practitioner pages |
| **Mandate** | Require that LASRERA-licensed agents syndicating on approved portals must syndicate **through** KHABITEQ (single hub); ban direct duplicate listings that omit practitioner verification |
| **Policy alignment** | Publish list of **approved syndication partners** (KHABITEQ admin approves technical integration; LASRERA approves regulatory fit) |
| **Industry communicator** | Notify major portals (PropertyPro, etc.) of hub requirement |
| **Practitioner engagement** | Agents must connect syndication in dashboard; LASRERA audits via connection status export |

#### KHABITEQ contributions

| Role | Practical action |
|------|------------------|
| **Technology owner** | Syndication platform catalog, connection management, job queue, outbound payload with `dealsiteUrl` and `inspectionUrl` |
| **Platform operator** | Admin review of partner applications; enable/disable platforms; monitor failed sync jobs |
| **Merchant of record** | N/A for syndication itself (no direct fee) |
| **KYC management** | Only syndicate properties for practitioners who pass KYC/subscription gates |
| **Transaction processing** | N/A |

**Endorse vs mandate:**

- **Endorse:** Syndication optional; encouraged for reach with compliance backlinks.
- **Mandate:** Agents must enable syndication to at least one LASRERA-approved portal; outbound payload must include verification and inspection URLs (enforced in `buildSyndicationPayload`).

---

### Feature 5: Document Verification

**Platform capability:** Public submission of land title documents (C of O, deed of assignment, survey plan, governor’s consent, etc.) with per-document fees from system settings. Paystack payment → admin review → registered/unregistered outcome → buyer notified. Third-party access via access code for verification reports.

**Compliance objective:** Buyers and practitioners can verify title authenticity before transacting; supports ownership verification standards in Safe Transaction Guidelines and transaction registration.

#### LASRERA contributions

| Role | Practical action |
|------|------------------|
| **Endorse** | Recommend document verification for high-value purchases before registration |
| **Mandate** | Require document verification (specified doc types) for outright sales and JV registrations above threshold before registration is accepted as complete |
| **Policy alignment** | Define which document types are acceptable; align verification outcomes with LASRERA title standards |
| **Practitioner engagement** | Train agents to advise buyers to verify C of O / survey plan before payment |
| **Launch and awareness** | Public campaign: “Verify before you pay” |

#### KHABITEQ contributions

| Role | Practical action |
|------|------------------|
| **Technology owner** | Document verification portal, doc-type pricing, access-code workflow, third-party read API |
| **Platform operator** | Admin verification team reviews submissions; SLA for turnaround; escalation queue |
| **Merchant of record** | Collect verification fees via Paystack |
| **KYC management** | Optional: link verification requests to practitioner profiles for audit trail |
| **Transaction processing** | Payment → `payment-approved` status; webhook handling |

**Endorse vs mandate:**

- **Endorse:** Verification offered as optional due-diligence step; linked from registration guidelines.
- **Mandate:** Registration cannot move to `completed` until linked document verification returns `registered` (KHABITEQ workflow rule, enabled on LASRERA directive). LASRERA may later integrate Lagos land registry APIs — KHABITEQ implements once MOU permits.

---

## 4. Summary Matrix — Who Does What Per Feature

| Feature | LASRERA (policy & comms) | KHABITEQ (tech & ops) | Endorse first? | Mandate later? |
|---------|--------------------------|------------------------|----------------|----------------|
| **Transaction registration** | Thresholds, circulars, audits, E-GIS facilitation | Portal, fees, registry, reporting, payment | ✓ Pilot | ✓ Primary candidate |
| **Practitioner page** | Licence link, badge, renewal condition | KYC, DealSite, subscription gates | ✓ | ✓ |
| **Central inspection** | Fee policy, booking requirement before registration | Booking flow, payments, logs, intent link | ✓ | Optional |
| **Platform syndication** | Approved partner list, hub requirement | Partner onboarding, outbound sync | ✓ | If agent reach requires |
| **Document verification** | Acceptable doc types, verify-before-pay campaign | Submission, admin review, fees | ✓ | For high-value sales |

---

## 5. Recommended Phasing

| Phase | Timeline | LASRERA actions | KHABITEQ actions |
|-------|----------|-----------------|------------------|
| **1 — Endorse** | Months 1–3 | Endorse transaction registration + practitioner pages; circular to agents; co-branded launch | Co-branded portals live; LASRERA dashboard; licence fast-track KYC |
| **2 — Mandate (registration)** | Months 4–6 | Mandate registration above ₦5M; 90-day grace; audit protocol | Enforce entry attribution; completion reporting; optional inspectionId rule |
| **3 — Mandate (practitioners)** | Months 7–9 | Mandate verified page for all licensed agents | Licence field required; status export to LASRERA |
| **4 — Extend** | Months 10–12 | Mandate document verification for high-value sales; approve syndication partner list | Workflow gates; partner catalog; E-GIS integration if MOU signed |

---

## 6. What LASRERA Must Not Be Asked To Do

Regardless of endorse or mandate level:

- Operate helpdesk or respond to buyer/agent tickets  
- Review KYC documents or document-verification submissions  
- Manage Paystack, refunds, or subscription billing  
- Administer the platform or approve syndication partners technically  
- Hold merchant-of-record liability for fees  

All of the above remain **KHABITEQ** responsibilities under the operating model.

---

*This document supports internal alignment and LASRERA negotiation. Legal counsel should review all mandate language before issuance.*
