type YouverifyLookup = {
  found: boolean;
  status: string;
  retrievedFields: string[];
  raw: Record<string, unknown>;
  legalName?: string;
  registrationNumber?: string;
  companyStatus?: string;
  registeredAddress?: {
    homeNo?: string;
    street?: string;
    localGovtArea?: string;
    state?: string;
  };
  directors?: string[];
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dateOfBirth?: string;
  addressLine?: string;
};

const isProd = process.env.NODE_ENV === "production";
const YOUVERIFY_BASE_URL = isProd
  ? "https://api.youverify.co/v2/api/identity/ng"
  : "https://api.sandbox.youverify.co/v2/api/identity/ng";

function baseUrl() {
  return YOUVERIFY_BASE_URL.replace(/\/$/, "");
}

function secretToken() {
  return (
    process.env.YOUVERIFY_SECRET_TOKEN ||
    process.env.YOUVERIFY_API_KEY ||
    ""
  ).trim();
}

export function isYouverifyConfigured() {
  return Boolean(secretToken());
}

async function youverifyPost(
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const token = secretToken();
  if (!token) {
    return { ok: false, data: { error: "Youverify is not configured" } };
  }
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data: json };
  } catch (err) {
    return {
      ok: false,
      data: {
        error: err instanceof Error ? err.message : "Youverify request failed",
      },
    };
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function nest(obj: Record<string, unknown>): Record<string, unknown> {
  const data = obj.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return obj;
}

export function normalizeCacNumber(input: string): string {
  const raw = String(input || "").replace(/[\s-]/g, "").toUpperCase();
  if (!raw) return "";
  if (/^(RC|BN|IT)\d+$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `RC${raw}`;
  return raw;
}

export async function lookupNigerianCompany(cacNumber: string): Promise<YouverifyLookup> {
  const registrationNumber = normalizeCacNumber(cacNumber);
  const attempts = ["/cac"];
  let last: Record<string, unknown> = {};
  for (const path of attempts) {
    const body = { registrationNumber, isSubjectConsent: true };
    const { ok, data } = await youverifyPost(path, body);
    last = data;
    if (!ok) continue;
    const inner = nest(data);
    const status = String(inner.status || data.status || "").toLowerCase();
    const found = status === "found" || status === "verified" || status === "success";
    const legalName = pickString(inner, [
      "name",
      "companyName",
      "legalName",
      "registeredName",
    ]);
    const addressRaw =
      (inner.address as Record<string, unknown> | undefined) ||
      (inner.registeredAddress as Record<string, unknown> | undefined) ||
      {};
    const street = pickString(addressRaw, ["street", "addressLine", "line1"]);
    return {
      found,
      status: status || (found ? "found" : "not_found"),
      retrievedFields: ["legalName", "registrationNumber", "registeredAddress"].filter(
        Boolean
      ),
      raw: data,
      legalName,
      registrationNumber: pickString(inner, ["registrationNumber", "rcNumber"]) || registrationNumber,
      companyStatus: pickString(inner, ["companyStatus", "status"]),
      registeredAddress: {
        homeNo: pickString(addressRaw, ["houseNumber", "homeNo", "number"]),
        street,
        localGovtArea: pickString(addressRaw, ["lga", "localGovtArea", "localGovernment"]),
        state: pickString(addressRaw, ["state"]),
      },
      directors: Array.isArray(inner.directors)
        ? (inner.directors as unknown[]).map((d) =>
            typeof d === "string" ? d : String((d as { name?: string })?.name || "")
          ).filter(Boolean)
        : undefined,
    };
  }
  return {
    found: false,
    status: "unavailable",
    retrievedFields: [],
    raw: last,
  };
}

export async function verifyNigerianId(opts: {
  idType: "nin" | "passport" | "drivers_license";
  idNumber: string;
  firstName?: string;
  lastName?: string;
}): Promise<YouverifyLookup> {
  const path =
    opts.idType === "nin"
      ? "/nin"
      : opts.idType === "passport"
        ? "/passport"
        : "/drivers-license";
  const idKey = opts.idType === "nin" ? "nin" : "id";
  const body: Record<string, unknown> = {
    [idKey]: String(opts.idNumber || "").trim(),
    isSubjectConsent: true,
  };
  if (opts.firstName || opts.lastName) {
    body.validations = {
      data: {
        ...(opts.firstName ? { firstName: opts.firstName } : {}),
        ...(opts.lastName ? { lastName: opts.lastName } : {}),
      },
    };
  }
  const { data } = await youverifyPost(path, body);
  const inner = nest(data);
  const status = String(inner.status || data.status || "").toLowerCase();
  const found = status === "found" || status === "verified";
  const firstName = pickString(inner, ["firstName", "firstname"]);
  const lastName = pickString(inner, ["lastName", "lastname", "surname"]);
  const address = (inner.address as Record<string, unknown> | undefined) || {};
  return {
    found,
    status: status || (found ? "found" : "not_found"),
    retrievedFields: ["fullName", "dateOfBirth"].filter(Boolean),
    raw: data,
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" ") || pickString(inner, ["fullName"]),
    dateOfBirth: pickString(inner, ["dateOfBirth", "dob"]),
    addressLine: pickString(address, ["addressLine", "street"]) || pickString(inner, ["address"]),
    registeredAddress: {
      street: pickString(address, ["addressLine", "street"]),
      localGovtArea: pickString(address, ["lga", "localGovtArea"]),
      state: pickString(address, ["state"]),
    },
  };
}

export function dimensionFromYouverify(lookup: YouverifyLookup): "verified" | "requires_attention" | "pending" {
  if (lookup.status === "unavailable") return "pending";
  if (lookup.found) return "verified";
  return "requires_attention";
}
