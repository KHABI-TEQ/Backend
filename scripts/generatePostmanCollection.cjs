const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const routesDir = path.join(srcDir, "routes");

const SAMPLE_ID = "64f0a1b2c3d4e5f678901234";

const SAMPLE_BY_KEY = {
  email: "user@example.com",
  newEmail: "new.user@example.com",
  password: "Password@123",
  oldPassword: "Password@123",
  currentPassword: "Password@123",
  newPassword: "NewPassword@123",
  confirmPassword: "NewPassword@123",
  firstName: "Ada",
  lastName: "Okafor",
  fullName: "Ada Okafor",
  phoneNumber: "08012345678",
  phone: "08012345678",
  whatsAppNumber: "08012345678",
  address: "12 Bode Thomas Street, Surulere, Lagos",
  street: "Bode Thomas Street",
  homeNo: "12A",
  state: "Lagos",
  localGovtArea: "Surulere",
  lga: "Surulere",
  area: "Bode Thomas",
  page: "1",
  limit: "20",
  search: "lagos",
  q: "lagos",
  status: "pending",
  filter: "30days",
  format: "json",
  reference: "PSK_ref_123456",
  trxref: "PSK_ref_123456",
  publicSlug: "agbeloba-homes",
  slug: "legal-due-diligence",
  category: "lawyer",
  serviceName: "Legal due diligence",
  coverageNote: "Title search and legal opinion",
  fee: 150000,
  serviceFee: 150000,
  amount: 150000,
  inspectionAmount: 0,
  notes: "Delivery notes for the client.",
  url: "https://res.cloudinary.com/demo/image/upload/sample.pdf",
  deliverableUrl: "https://res.cloudinary.com/demo/image/upload/sample.pdf",
  professionalId: SAMPLE_ID,
  inspectionId: SAMPLE_ID,
  preferenceId: SAMPLE_ID,
  propertyId: SAMPLE_ID,
  buyerId: SAMPLE_ID,
  userId: SAMPLE_ID,
  adminId: SAMPLE_ID,
  agentId: SAMPLE_ID,
  registrationId: SAMPLE_ID,
  notificationId: SAMPLE_ID,
  documentId: SAMPLE_ID,
  id: SAMPLE_ID,
  token: "reset-or-access-token",
  code: "123456",
  otp: "123456",
  deviceToken: "fcm-device-token-sample",
  platform: "android",
  accept: true,
  commissionAccepted: true,
  letterheadReportAccepted: true,
  serviceItems: [
    { serviceId: "title-document-review", name: "Review title and ownership documents", fee: 100000 },
  ],
  requestedServices: ["title-document-review", "title-search"],
  brief: {
    objective: "Confirm title is clean before purchase.",
    questions: "Are there encumbrances?",
    timeline: "7–14 days",
    deliverable: "Written legal opinion on letterhead",
    additional: "",
  },
  logoUrl: "https://example.com/lasrera-logo.png",
  stampUrl: "https://example.com/lasrera-stamp.png",
  signatureUrl: "https://example.com/signature.png",
  signatoryName: "Director General",
  signatoryTitle: "Lagos State Real Estate Regulatory Authority",
  decision: "approved",
  note: "Documents verified.",
  fromParty: "lasrera",
  message: "Please provide additional proof of payment.",
};

function sampleFor(key) {
  if (Object.prototype.hasOwnProperty.call(SAMPLE_BY_KEY, key)) return SAMPLE_BY_KEY[key];
  const k = String(key);
  if (/email/i.test(k)) return "user@example.com";
  if (/password/i.test(k)) return "Password@123";
  if (/phone|whatsapp/i.test(k)) return "08012345678";
  if (/^(id|.*Id|.*_id)$/.test(k) || /Id$/.test(k)) return SAMPLE_ID;
  if (/slug/i.test(k)) return "sample-slug";
  if (/page/i.test(k)) return "1";
  if (/limit|perPage|pageSize/i.test(k)) return "20";
  if (/status/i.test(k)) return "pending";
  if (/amount|price|fee|budget/i.test(k)) return 100000;
  if (/url|link|href/i.test(k)) return "https://example.com/file.pdf";
  if (/date|At$/i.test(k) || /Date/.test(k)) return "2026-10-15";
  if (/time/i.test(k)) return "10:00";
  if (/^(is|has|enable|accept|agreed)/i.test(k) || /Accepted$/.test(k)) return true;
  if (/count|total|qty/i.test(k)) return 1;
  if (/token/i.test(k)) return "sample-token";
  if (/code|otp/i.test(k)) return "123456";
  if (/name/i.test(k)) return "Sample Name";
  if (/description|note|message|bio|objective/i.test(k)) return "Sample description";
  if (/address|street/i.test(k)) return "12 Bode Thomas Street, Lagos";
  if (/state/i.test(k)) return "Lagos";
  if (/lga|localGovt/i.test(k)) return "Surulere";
  return `sample_${k}`;
}

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walk(full, acc);
    } else if (/\.(ts|js)$/.test(name)) acc.push(full);
  }
  return acc;
}

function extractKeysFromJoiBlock(block) {
  const keys = [];
  const re = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm;
  let m;
  while ((m = re.exec(block))) keys.push(m[1]);
  return [...new Set(keys)];
}

function loadJoiSchemas() {
  const schemas = {};
  const files = walk(path.join(srcDir, "validators"));
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const re = /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*Joi\.object\(\{([\s\S]*?)\}\s*\)/g;
    let m;
    while ((m = re.exec(src))) {
      schemas[m[1]] = extractKeysFromJoiBlock(m[2]);
    }
  }
  return schemas;
}

function extractHandlerFields(src) {
  const body = new Set();
  const query = new Set();
  const params = new Set();

  const addFromDestructure = (set, inner) => {
    inner.split(",").forEach((part) => {
      const name = part.replace(/[{}]/g, "").split(":")[0].trim();
      if (name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) set.add(name);
    });
  };

  let m;
  const destRe = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*req\.(body|query|params)/g;
  while ((m = destRe.exec(src))) {
    const set = m[2] === "body" ? body : m[2] === "query" ? query : params;
    addFromDestructure(set, m[1]);
  }

  const accRe = /req\.(body|query|params)\.([A-Za-z_][A-Za-z0-9_]*)/g;
  while ((m = accRe.exec(src))) {
    const set = m[1] === "body" ? body : m[1] === "query" ? query : params;
    set.add(m[2]);
  }

  const bracketRe = /req\.(body|query|params)\[["'`]([A-Za-z_][A-Za-z0-9_]*)["'`]\]/g;
  while ((m = bracketRe.exec(src))) {
    const set = m[1] === "body" ? body : m[1] === "query" ? query : params;
    set.add(m[2]);
  }

  return { body: [...body], query: [...query], params: [...params] };
}

function loadHandlers() {
  const handlers = {};
  for (const file of walk(srcDir)) {
    if (file.includes(`${path.sep}routes${path.sep}`)) continue;
    const src = fs.readFileSync(file, "utf8");
    const chunks = src.split(/(?=export\s+(?:const|async\s+function|function)\s+[A-Za-z_])/);
    for (const chunk of chunks) {
      const named = chunk.match(/^export\s+(?:const|async\s+function|function)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (!named) continue;
      const fields = extractHandlerFields(chunk);
      const name = named[1];
      if (!handlers[name]) handlers[name] = { body: new Set(), query: new Set(), params: new Set() };
      fields.body.forEach((k) => handlers[name].body.add(k));
      fields.query.forEach((k) => handlers[name].query.add(k));
      fields.params.forEach((k) => handlers[name].params.add(k));
    }
  }
  const plain = {};
  for (const [k, v] of Object.entries(handlers)) {
    plain[k] = { body: [...v.body], query: [...v.query], params: [...v.params] };
  }
  return plain;
}

function extractCalls(src) {
  const results = [];
  const re = /\.(get|post|put|patch|delete)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const method = m[1].toUpperCase();
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    let inStr = null;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (inStr) {
        if (ch === "\\" ) {
          i += 2;
          continue;
        }
        if (ch === inStr) inStr = null;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inStr = ch;
        i++;
        continue;
      }
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }
    const args = src.slice(start, i - 1);
    const pathMatch = args.match(/^\s*(?:`([^`]+)`|"([^"]+)"|'([^']+)')/);
    if (!pathMatch) continue;
    const routePath = pathMatch[1] || pathMatch[2] || pathMatch[3];
    const joiMatch = args.match(/validateJoi\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/);
    const idents = [...args.matchAll(/([A-Za-z_][A-Za-z0-9_]*)/g)].map((x) => x[1]);
    const skip = new Set([
      "validateJoi",
      "upload",
      "single",
      "array",
      "requirePermission",
      "requireSuperAdmin",
      "optionalAccountAuth",
      "accountAuth",
      "adminAuth",
      "buyerAuth",
      "PERMISSIONS",
    ]);
    const handler = [...idents].reverse().find((id) => !skip.has(id) && id !== routePath.replace(/^\//, "").split("/")[0]);
    results.push({
      method,
      routePath,
      schema: joiMatch ? joiMatch[1] : null,
      handler: handler || null,
    });
  }
  return results;
}

const joiSchemas = loadJoiSchemas();
const handlers = loadHandlers();

const mounted = [
  { file: "index.ts", prefix: "" },
  { file: "auth.ts", prefix: "auth" },
  { file: "googleAuth.ts", prefix: "auth" },
  { file: "buyerAuth.ts", prefix: "buyer/auth" },
  { file: "account.ts", prefix: "account" },
  { file: "property.ts", prefix: "properties" },
  { file: "preference.ts", prefix: "preferences" },
  { file: "inspectionRouter.ts", prefix: "inspections" },
  { file: "promotions.ts", prefix: "promotions" },
  { file: "transactionRegistration.ts", prefix: "transaction-registration" },
  { file: "dealSite.ts", prefix: "deal-site" },
  { file: "professionalSite.ts", prefix: "professional-site" },
  { file: "thirdParty.ts", prefix: "third-party" },
  { file: "admin.ts", prefix: "admin" },
  { file: "admin.inspections.ts", prefix: "admin" },
];

function joinPath(prefix, routePath) {
  const joined = ["api", prefix, routePath.replace(/^\//, "")]
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/");
  return `/${joined}`.replace(/\/$/, "");
}

function looksLikeList(p, method) {
  if (method !== "GET") return false;
  if (/\/:[^/]+$/.test(p)) return false;
  return /s$/.test(p.split("/").pop()) || /fetchAll|list|queue|jobs|search|stats|overview/i.test(p);
}

function extraQueryForPath(p, method) {
  const q = new Set();
  if (looksLikeList(p, method)) {
    q.add("page");
    q.add("limit");
    q.add("search");
    q.add("status");
  }
  if (p.includes("verify-payment") || p.endsWith("/verifyPayment")) {
    q.add("reference");
    q.add("trxref");
  }
  if (p.includes("/stats") || p.includes("getStats")) q.add("filter");
  if (p.includes("/export")) {
    q.add("filter");
    q.add("format");
  }
  if (p.includes("public-site/resolve")) q.add("host");
  return [...q];
}

function extraBodyForPath(p, method) {
  if (!["POST", "PUT", "PATCH"].includes(method)) return [];
  if (p.includes("/login")) return ["email", "password"];
  if (p.includes("/register") || p.includes("/signup")) return ["email", "password", "firstName", "lastName", "phoneNumber"];
  if (p.includes("change-password") || p.includes("changePassword")) return ["oldPassword", "newPassword"];
  if (p.includes("change-email") || p.includes("changeEmail")) return ["newEmail", "currentPassword"];
  if (p.includes("/respond")) return ["coverageNote", "fee", "serviceItems", "commissionAccepted", "letterheadReportAccepted", "accept"];
  if (p.includes("/deliver")) return ["notes", "url"];
  if (p.includes("select-offer")) return ["professionalId"];
  if (p.includes("/briefs")) return ["category", "serviceName", "inspectionId", "brief", "requestedServices"];
  if (p.includes("/pay")) return ["email"];
  if (p.endsWith("/lasrera/settings")) return ["logoUrl", "stampUrl", "signatureUrl", "signatoryName", "signatoryTitle"];
  if (p.includes("lasrera-review")) return ["decision", "note"];
  return [];
}

let all = [];
for (const m of mounted) {
  const src = fs.readFileSync(path.join(routesDir, m.file), "utf8");
  for (const call of extractCalls(src)) {
    if (!call.routePath || call.routePath.startsWith("http")) continue;
    all.push({
      method: call.method,
      path: joinPath(m.prefix, call.routePath),
      schema: call.schema,
      handler: call.handler,
    });
  }
}

const seen = new Set();
all = all.filter((r) => {
  const key = `${r.method} ${r.path}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
all.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

function folderFor(p) {
  if (p === "/api/admin/login" || p === "/api/admin/profile" || p === "/api/admin/change-password" || p === "/api/admin/change-email") {
    return ["Khabiteq Admin (Khabiteq-admin-web)", "LASRERA Admin (Khabiteq-admin-web)"];
  }
  if (
    p.startsWith("/api/admin/lasrera") ||
    p.includes("/lasrera-queue") ||
    p.includes("/lasrera-review") ||
    p.includes("/lasrera/")
  ) {
    return "LASRERA Admin (Khabiteq-admin-web)";
  }
  if (p.startsWith("/api/admin")) return "Khabiteq Admin (Khabiteq-admin-web)";
  if (p.startsWith("/api/deal-site") || p.startsWith("/api/professional-site") || p.startsWith("/api/public-site")) {
    return "Public-access / Deal sites";
  }
  if (p.startsWith("/api/third-party") || p.includes("/syndication/") || p.includes("/whatsapp/webhook") || p.includes("/ussd/")) {
    return "Third-party, webhooks & USSD";
  }
  if (
    p.startsWith("/api/buyer") ||
    p.startsWith("/api/preferences") ||
    p.startsWith("/api/ai/") ||
    p.startsWith("/api/transaction-registration") ||
    p.startsWith("/api/lasrera-marketplace") ||
    p.startsWith("/api/licensed-agents") ||
    p.startsWith("/api/professional-services") ||
    p.startsWith("/api/professional-service-requests") ||
    p.startsWith("/api/lawyers/marketplace") ||
    p.startsWith("/api/surveyors/marketplace") ||
    p.startsWith("/api/survey-requests") ||
    p.startsWith("/api/document-verifications")
  ) {
    return "Clients / Buyers (main website + khabiteq-mobile)";
  }
  if (
    p.startsWith("/api/account/lawyer") ||
    p.startsWith("/api/account/surveyor") ||
    p.startsWith("/api/account/valuer") ||
    p.startsWith("/api/account/professional-services")
  ) {
    return "Practitioners (main website dashboard + khabiteq-practitioners)";
  }
  if (p.startsWith("/api/account") || p.startsWith("/api/auth") || p.startsWith("/api/properties") || p.startsWith("/api/inspections") || p.startsWith("/api/promotions")) {
    return "Main website (Frontend) — agents, developers, landlords";
  }
  return "Shared / public";
}

function authFor(p, method) {
  if (p.includes("/login") || p.includes("/register") || p.includes("/forgot") || p.includes("/reset")) {
    return undefined;
  }
  if (p.startsWith("/api/admin")) {
    return { type: "bearer", bearer: [{ key: "token", value: "{{adminToken}}", type: "string" }] };
  }
  if (p.startsWith("/api/buyer")) {
    return { type: "bearer", bearer: [{ key: "token", value: "{{buyerToken}}", type: "string" }] };
  }
  if (p.startsWith("/api/account") || p.startsWith("/api/inspections")) {
    return { type: "bearer", bearer: [{ key: "token", value: "{{accountToken}}", type: "string" }] };
  }
  return undefined;
}

function collectFields(r) {
  const body = new Set(extraBodyForPath(r.path, r.method));
  const query = new Set(extraQueryForPath(r.path, r.method));
  const params = new Set();
  if (r.schema && joiSchemas[r.schema]) {
    joiSchemas[r.schema].forEach((k) => body.add(k));
  }
  if (r.handler && handlers[r.handler]) {
    handlers[r.handler].body.forEach((k) => body.add(k));
    handlers[r.handler].query.forEach((k) => query.add(k));
    handlers[r.handler].params.forEach((k) => params.add(k));
  }
  return { body: [...body], query: [...query], params: [...params] };
}

function skipBodyKey(k) {
  return ["_id", "__v", "req", "res", "next", "headers", "cookies"].includes(k);
}

function requestItem(r) {
  const fields = collectFields(r);
  const parts = r.path.replace(/^\//, "").split("/").filter(Boolean);
  const variables = [];
  const pathSegs = parts.map((seg) => {
    if (seg.startsWith(":")) {
      const name = seg.slice(1).replace(/\?$/, "");
      variables.push({ key: name, value: String(sampleFor(name)) });
      return `:${name}`;
    }
    return seg;
  });
  const query = fields.query
    .filter((k) => !skipBodyKey(k))
    .map((k) => ({ key: k, value: String(sampleFor(k)), description: "sample" }));

  const rawPath = "/" + pathSegs.join("/");
  let raw = `{{baseUrl}}${rawPath}`;
  if (query.length) {
    raw += "?" + query.map((q) => `${q.key}=${encodeURIComponent(q.value)}`).join("&");
  }

  const url = {
    raw,
    host: ["{{baseUrl}}"],
    path: pathSegs,
  };
  if (variables.length) url.variable = variables;
  if (query.length) url.query = query.map((q) => ({ key: q.key, value: q.value }));

  const needsBody = ["POST", "PUT", "PATCH"].includes(r.method);
  const item = {
    name: `${r.method} ${r.path.replace(/^\/api/, "") || "/"}`,
    request: {
      method: r.method,
      header: needsBody ? [{ key: "Content-Type", value: "application/json" }] : [],
      url,
    },
  };
  const auth = authFor(r.path, r.method);
  if (auth) item.request.auth = auth;
  if (needsBody) {
    const bodyObj = {};
    fields.body.filter((k) => !skipBodyKey(k)).forEach((k) => {
      bodyObj[k] = sampleFor(k);
    });
    if (!Object.keys(bodyObj).length) {
      bodyObj.note = "Add request fields as required by this endpoint.";
    }
    item.request.body = {
      mode: "raw",
      raw: JSON.stringify(bodyObj, null, 2),
      options: { raw: { language: "json" } },
    };
  }
  return item;
}

const folders = {};
for (const r of all) {
  const names = folderFor(r.path);
  const list = Array.isArray(names) ? names : [names];
  for (const name of list) {
    if (!folders[name]) folders[name] = [];
    folders[name].push(requestItem(r));
  }
}

const folderOrder = [
  "Shared / public",
  "Main website (Frontend) — agents, developers, landlords",
  "Clients / Buyers (main website + khabiteq-mobile)",
  "Practitioners (main website dashboard + khabiteq-practitioners)",
  "Public-access / Deal sites",
  "Khabiteq Admin (Khabiteq-admin-web)",
  "LASRERA Admin (Khabiteq-admin-web)",
  "Third-party, webhooks & USSD",
];

const collection = {
  info: {
    name: "Khabiteq Backend API",
    description:
      "Generated from Express routes, Joi schemas, and handler req.body / req.query / req.params usage.\n\nImport: File → Import.\n\nVariables: baseUrl, accountToken, buyerToken, adminToken.\nPath params, query params, and JSON bodies include sample values — replace them before calling production.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:5050" },
    { key: "accountToken", value: "" },
    { key: "buyerToken", value: "" },
    { key: "adminToken", value: "" },
  ],
  item: folderOrder
    .filter((name) => folders[name]?.length)
    .map((name) => ({
      name: `${name} (${folders[name].length})`,
      item: folders[name],
    })),
};

const outDir = path.join(root, "api-collections");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "khabiteq-backend.postman_collection.json");
fs.writeFileSync(outFile, JSON.stringify(collection, null, 2));
console.log(`Wrote ${outFile}`);
console.log(`Total unique endpoints: ${all.length}`);
console.log(`Joi schemas parsed: ${Object.keys(joiSchemas).length}`);
for (const name of folderOrder) {
  if (folders[name]) console.log(`  ${name}: ${folders[name].length}`);
}
