# KYC Conditions — Agent, Developer, and Landlord

This document describes Know Your Customer (KYC) and listing rules for **Agent**, **Developer**, and **Landowner** (Landlord) accounts on Khabi-Teq.

---

## Overview

| Account type | KYC required? | Subscription required? | Listing limits |
|--------------|---------------|------------------------|----------------|
| **Agent** | Yes (after 7-day grace) | Yes (after 4-week trial / 10-property cap) | 4-week trial: up to 10 properties without subscription |
| **Developer** | No | No | None |
| **Landowner** | No | No | None |

Agents use **`PublisherProfile.kycStatus`** (canonical) with legacy **`Agent.kycStatus`** mirrored for dashboards. Developers and Landowners may still submit KYC optionally via the same endpoint, but it is not enforced for listing or DealSite access.

---

## KYC status lifecycle

| Status | Meaning |
|--------|---------|
| `none` | No KYC submitted yet (default after registration) |
| `pending` | User submitted KYC; awaiting admin review |
| `in_review` | Reserved for future use |
| `approved` | Admin approved KYC |
| `rejected` | Admin rejected KYC (user may resubmit via `submitKyc`) |

**Canonical source:** `PublisherProfile.kycStatus`  
**Legacy fallback (Agent only):** `Agent.kycStatus` if no publisher profile exists yet.

---

## Agent rules

Enforced in `agentPublisherEligibility.service.ts`, `assertPropertyListingAllowedForOwner`, and `dealSiteKycEligibility.service.ts`.

### Timeline from signup (`User.createdAt`)

| Phase | Listing | Public page (DealSite) |
|-------|---------|------------------------|
| **Days 0–7** (KYC grace, no approved KYC) | **1** owned property only | Allowed |
| **Days 0–7** (KYC approved) | Up to **10** without subscription (trial rules) | Allowed |
| **After day 7 without approved KYC** | **Blocked** | **Blocked** (running pages auto-paused) |
| **KYC approved + within 4 weeks** | Up to **10** owned properties without subscription | Allowed |
| **After 4 weeks from signup** (or 10 properties reached) without active subscription | **Blocked** | **Blocked** |

After the trial window or property cap, an **active subscription** is required to list more properties and to run the public page.

### Auto-resume

When every blocking condition is cleared (KYC approved where required, active subscription where required), policy-paused DealSites are **automatically set back to `running`**:

- On admin KYC approval
- On successful subscription payment (Paystack webhook)
- On nightly reconciliation cron jobs

Manual pauses (user disables their page) are not auto-resumed.

### Error messages (403)

- KYC: `Complete KYC verification and obtain approval to continue (the 7-day grace period has expired).`
- KYC grace listing cap: `During the 7-day signup grace period you may list only 1 property until KYC is approved.`
- Trial ended: `Your 4-week trial period has ended. Subscribe to a plan to continue listing properties and using your public page.`
- Property cap: `You have reached the trial limit of 10 properties. Subscribe to a plan to list more properties.`

### Subscription purchase

Only **Agents** (and optionally **Developers**) may create paid subscriptions. **Agents** must have **approved KYC** before subscribing.

**403:** `Your account must be KYC-approved before creating a subscription.`

Landowners cannot purchase subscriptions.

### Public visitor APIs

When an Agent owner fails KYC or subscription gates, visitors may receive `errorCode: "KYC_REQUIRED"` or `"SUBSCRIPTION_REQUIRED"`.

Agents blocked by KYC or subscription policy cannot **Request To Market** LASRERA Market Place properties owned by Landlords or Developers.

**Note:** Only **Agents** are subject to DealSite KYC/subscription policy. **Developers** may still create DealSites without these gates.

---

## Developer and Landowner rules

- **No KYC** enforcement for property listing (KYC submission remains optional).
- **No subscription** enforcement for property listing (Developers align with Landowners).
- **Unlimited listings** by default — no trial or property cap applies.
- Developers may still use DealSites; subscription is not required for the public page.
- Agent KYC/subscription policy messaging must **not** be shown on Developer or Landlord dashboards.

---

## User flows

### 1. Registration

On signup (self-service, social auth, or admin-provisioned):

- A **`PublisherProfile`** row is created with `kycStatus: "none"` for Agent, Developer, and Landowner.
- **Agent** accounts also get an **`Agent`** profile row.

### 2. Submit KYC

**Endpoint:** `PUT /api/account/submitKyc`  
**Auth:** Account bearer token  
**Allowed user types:** Agent, Developer, Landowner

### 3. Admin review

**Primary endpoint:** `POST /api/admin/users/:userId/reviewKycRequest`  
**Legacy alias:** `POST /api/admin/agents/:userId/reviewKycRequest` (same handler)

**On approve (Agent):**

- `PublisherProfile.kycStatus` → `"approved"`
- `User.accountApproved` → `true`, `accountStatus` → `"active"`
- Agent legacy `kycStatus` → `"approved"`
- Policy-paused DealSites auto-resumed when eligible
- **Free trial subscription** (if `free_trial_status` enabled): **Agent only**, not Developer

---

## Related endpoints (quick reference)

| Method | Path | Purpose |
|--------|------|---------|
| `PUT` | `/api/account/submitKyc` | Submit / resubmit KYC |
| `GET` | `/api/account/profile` | Read profile incl. `kycStatus` |
| `POST` | `/api/admin/users/:userId/reviewKycRequest` | Approve or reject KYC |
| `POST` | `/api/admin/agents/:userId/reviewKycRequest` | Legacy alias (same handler) |

---

*Last updated: Agent-only enforced KYC/trial; Developer/Landowner listing without KYC or subscription.*
