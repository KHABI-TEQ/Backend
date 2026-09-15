import axios from "axios";
import { Types } from "mongoose";
import { DB } from "../controllers";
import {
  CLIP_IMAGE_EMBEDDING_DIM,
  CLIP_IMAGE_EMBEDDING_MODEL,
  PROPERTY_IMAGE_VECTOR_INDEX_NAME,
} from "../models/propertyImageEmbedding";
import { isPropertyListedAndMatchable } from "./autoPreferencePairing.service";
import { liveListingMongoFilter } from "../utils/liveListingFilter";

export type PreparedImageEmbedding = {
  pictureUrl: string;
  embedding: number[];
  embeddingModel: string;
};

const DEFAULT_SIMILARITY_THRESHOLD = 0.88;
const VECTOR_TOP_K = 8;
const MAX_IMAGES_PER_LISTING = 12;
const BRUTE_FORCE_LIVE_CAP = 400;

let clipPipelinePromise: Promise<any> | null = null;
let clipUnavailable = false;
let vectorIndexEnsurePromise: Promise<void> | null = null;
let loggedClipDisabled = false;

function rssMb(): number {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

/**
 * In-process CLIP (transformers.js + ONNX) typically needs 400–800MB RSS.
 * Render web instances are often 512MB, so inference is off there unless opted in.
 * Stored vectors still power duplicate-photo matching.
 *
 * PROPERTY_IMAGE_CLIP_ENABLED=true|false overrides the default.
 */
export function isClipInferenceEnabled(): boolean {
  const raw = String(process.env.PROPERTY_IMAGE_CLIP_ENABLED ?? "")
    .trim()
    .toLowerCase();
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return !process.env.RENDER;
}

function warnClipDisabledOnce(): void {
  if (loggedClipDisabled) return;
  loggedClipDisabled = true;
  console.info(
    `[CLIP] In-process model is off (rss=${rssMb()}MB). Duplicate-photo checks still use stored vectors. Enable with PROPERTY_IMAGE_CLIP_ENABLED=true on a larger instance or a one-off job.`,
  );
}

export function imageSimilarityThreshold(): number {
  const n = Number(process.env.PROPERTY_IMAGE_SIMILARITY_THRESHOLD);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_SIMILARITY_THRESHOLD;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function sameStateAndLga(
  a: { state?: string; localGovernment?: string } | undefined,
  b: { state?: string; localGovernment?: string } | undefined,
): boolean {
  const ns = (s?: string) => String(s ?? "").trim().toLowerCase();
  return ns(a?.state) === ns(b?.state) && ns(a?.localGovernment) === ns(b?.localGovernment);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function getClipPipeline(): Promise<any | null> {
  if (!isClipInferenceEnabled()) {
    warnClipDisabledOnce();
    return null;
  }
  if (clipUnavailable) return null;
  if (!clipPipelinePromise) {
    clipPipelinePromise = (async () => {
      console.info(
        `[CLIP] Loading transformers.js (first run downloads ~150MB; rss=${rssMb()}MB)...`,
      );
      const { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } = await import(
        "@xenova/transformers"
      );
      try {
        env.allowLocalModels = false;
        if (env.backends?.onnx?.wasm) {
          env.backends.onnx.wasm.numThreads = 1;
        }
      } catch {
        /* ignore */
      }
      const modelId = "Xenova/clip-vit-base-patch32";
      const lastPct: Record<string, number> = {};
      const progress_callback = (info: any) => {
        const file = String(info?.file || info?.name || "");
        if (info?.status === "progress" && info.total) {
          const pct = Math.floor((100 * Number(info.loaded || 0)) / Number(info.total));
          if (pct >= (lastPct[file] ?? -10) + 10) {
            lastPct[file] = pct;
            console.info(`[CLIP] ${file || "download"} ${pct}%`);
          }
        } else if (info?.status === "ready" || info?.status === "done") {
          console.info(`[CLIP] ${info.status}${file ? ` ${file}` : ""}`);
        }
      };
      console.info("[CLIP] Loading processor...");
      const processor = await AutoProcessor.from_pretrained(modelId, { progress_callback });
      console.info("[CLIP] Loading vision model...");
      const vision = await CLIPVisionModelWithProjection.from_pretrained(modelId, {
        progress_callback,
      });
      console.info(`[CLIP] Ready (rss=${rssMb()}MB).`);
      return { processor, vision, RawImage };
    })().catch((err) => {
      clipUnavailable = true;
      clipPipelinePromise = null;
      console.warn("[propertyImageEmbedding] CLIP pipeline unavailable:", err);
      return null;
    });
  }
  return clipPipelinePromise;
}

function l2normalize(arr: number[]): number[] {
  let n = 0;
  for (let i = 0; i < arr.length; i++) n += arr[i] * arr[i];
  const s = Math.sqrt(n) || 1;
  return arr.map((x) => x / s);
}

async function loadRawImage(clip: any, url: string): Promise<any> {
  try {
    return await clip.RawImage.read(url);
  } catch {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout: 20000,
      maxContentLength: 12 * 1024 * 1024,
      headers: { Accept: "image/*" },
    });
    const blob = new Blob([Buffer.from(response.data)]);
    return clip.RawImage.fromBlob(blob);
  }
}

/**
 * CLIP ViT-B/32 image embedding (512-d). Returns null if the model or fetch fails.
 * Uses transformers.js RawImage only (no top-level `sharp`) so Windows does not
 * load two libvips copies and abort.
 */
export async function embedImage(url: string): Promise<number[] | null> {
  if (!url || typeof url !== "string") return null;
  try {
    const clip = await getClipPipeline();
    if (!clip) return null;

    let image = await loadRawImage(clip, url);
    if (image && typeof image.rgb === "function") {
      image = image.rgb();
    }
    const imageInputs = await clip.processor(image);
    const { image_embeds } = await clip.vision(imageInputs);
    const arr: number[] = Array.from(image_embeds?.data ?? image_embeds ?? []);
    if (arr.length < CLIP_IMAGE_EMBEDDING_DIM / 2) return null;
    return l2normalize(arr.slice(0, CLIP_IMAGE_EMBEDDING_DIM));
  } catch (err) {
    console.warn("[embedImage] failed for", url, err);
    return null;
  }
}

export async function embedPictureUrls(
  urls: string[],
): Promise<PreparedImageEmbedding[]> {
  const unique = [...new Set((urls || []).filter((u) => typeof u === "string" && u.trim()))];
  const limited = unique.slice(0, MAX_IMAGES_PER_LISTING);
  const out: PreparedImageEmbedding[] = [];
  for (const pictureUrl of limited) {
    const embedding = await embedImage(pictureUrl);
    if (embedding) {
      out.push({
        pictureUrl,
        embedding,
        embeddingModel: CLIP_IMAGE_EMBEDDING_MODEL,
      });
    }
  }
  return out;
}

/** Reuse stored vectors for known URLs; generate CLIP embeddings only for new ones. */
export async function resolveEmbeddingsForUrls(
  urls: string[],
): Promise<PreparedImageEmbedding[]> {
  const unique = [
    ...new Set((urls || []).filter((u) => typeof u === "string" && u.trim())),
  ].slice(0, MAX_IMAGES_PER_LISTING);
  if (!unique.length) return [];

  const stored = await DB.Models.PropertyImageEmbedding.find({
    pictureUrl: { $in: unique },
  })
    .select("pictureUrl embedding embeddingModel")
    .lean();

  const byUrl = new Map<string, PreparedImageEmbedding>();
  for (const row of stored) {
    if (!byUrl.has(row.pictureUrl) && Array.isArray(row.embedding) && row.embedding.length) {
      byUrl.set(row.pictureUrl, {
        pictureUrl: row.pictureUrl,
        embedding: row.embedding,
        embeddingModel: row.embeddingModel || CLIP_IMAGE_EMBEDDING_MODEL,
      });
    }
  }

  const missing = unique.filter((u) => !byUrl.has(u));
  const generated =
    missing.length && isClipInferenceEnabled()
      ? await embedPictureUrls(missing)
      : [];
  if (missing.length && !isClipInferenceEnabled()) {
    warnClipDisabledOnce();
  }
  return [...byUrl.values(), ...generated];
}

export async function persistPropertyImageEmbeddings(
  propertyId: string | Types.ObjectId | unknown,
  prepared: PreparedImageEmbedding[],
): Promise<void> {
  if (!prepared.length) return;
  const pid = new Types.ObjectId(String(propertyId));
  for (const item of prepared) {
    try {
      await DB.Models.PropertyImageEmbedding.updateOne(
        { propertyId: pid, pictureUrl: item.pictureUrl },
        {
          $set: {
            embedding: item.embedding,
            embeddingModel: item.embeddingModel || CLIP_IMAGE_EMBEDDING_MODEL,
          },
        },
        { upsert: true },
      );
    } catch (err) {
      console.warn("[persistPropertyImageEmbeddings] upsert failed:", err);
    }
  }
}

export async function syncPropertyImageEmbeddings(
  propertyId: string | Types.ObjectId | unknown,
  pictureUrls: string[],
): Promise<void> {
  const pid = new Types.ObjectId(String(propertyId));
  const urls = [...new Set((pictureUrls || []).filter(Boolean))];

  const existing = await DB.Models.PropertyImageEmbedding.find({
    propertyId: pid,
    pictureUrl: { $in: urls },
  })
    .select("pictureUrl")
    .lean();
  const have = new Set(existing.map((e) => e.pictureUrl));
  const missing = urls.filter((u) => !have.has(u));
  if (missing.length && isClipInferenceEnabled()) {
    const prepared = await embedPictureUrls(missing);
    await persistPropertyImageEmbeddings(pid, prepared);
  } else if (missing.length) {
    warnClipDisabledOnce();
  }

  if (urls.length) {
    await DB.Models.PropertyImageEmbedding.deleteMany({
      propertyId: pid,
      pictureUrl: { $nin: urls },
    });
  } else {
    await DB.Models.PropertyImageEmbedding.deleteMany({ propertyId: pid });
  }
}

async function listAtlasSearchIndexes(): Promise<Array<{ name?: string }>> {
  const Model = DB.Models.PropertyImageEmbedding as any;
  const listed =
    typeof Model.listSearchIndexes === "function"
      ? await withTimeout(Promise.resolve(Model.listSearchIndexes()), 8000, "listSearchIndexes")
      : [];

  if (Array.isArray(listed)) return listed;
  if (listed && typeof listed.toArray === "function") {
    return withTimeout(listed.toArray(), 8000, "listSearchIndexes.toArray");
  }

  const names: Array<{ name?: string }> = [];
  if (listed && typeof listed[Symbol.asyncIterator] === "function") {
    const iterate = (async () => {
      for await (const idx of listed) names.push(idx);
      return names;
    })();
    return withTimeout(iterate, 8000, "listSearchIndexes.iterate");
  }
  return names;
}

export async function ensurePropertyImageVectorIndex(): Promise<void> {
  if (!vectorIndexEnsurePromise) {
    vectorIndexEnsurePromise = (async () => {
      console.info("[propertyImageEmbedding] Checking Atlas vector index (8s timeout)...");
      const indexes = await listAtlasSearchIndexes();
      if (indexes.some((i) => i?.name === PROPERTY_IMAGE_VECTOR_INDEX_NAME)) {
        console.info("[propertyImageEmbedding] Vector index already exists.");
        return;
      }
      const Model = DB.Models.PropertyImageEmbedding as any;
      if (typeof Model.createSearchIndex !== "function") {
        console.info("[propertyImageEmbedding] createSearchIndex not available; skipping.");
        return;
      }
      await withTimeout(
        Promise.resolve(
          Model.createSearchIndex({
            name: PROPERTY_IMAGE_VECTOR_INDEX_NAME,
            type: "vectorSearch",
            definition: {
              fields: [
                {
                  type: "vector",
                  path: "embedding",
                  numDimensions: CLIP_IMAGE_EMBEDDING_DIM,
                  similarity: "cosine",
                },
              ],
            },
          }),
        ),
        15000,
        "createSearchIndex",
      );
      console.info(
        `[propertyImageEmbedding] created Atlas vector index ${PROPERTY_IMAGE_VECTOR_INDEX_NAME}`,
      );
    })().catch((err) => {
      vectorIndexEnsurePromise = null;
      console.warn("[propertyImageEmbedding] ensure vector index failed:", err);
    });
  }
  await vectorIndexEnsurePromise;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findLiveImageMatchesBruteForce(
  queryEmbeddings: number[][],
  location: { state?: string; localGovernment?: string },
  excludePropertyId?: string | Types.ObjectId | unknown,
): Promise<any[]> {
  const state = String(location.state || "").trim();
  const lga = String(location.localGovernment || "").trim();
  if (!state || !lga || !queryEmbeddings.length) return [];

  const query: Record<string, unknown> = {
    ...liveListingMongoFilter(),
    "location.state": new RegExp(`^${escapeRegex(state)}$`, "i"),
    "location.localGovernment": new RegExp(`^${escapeRegex(lga)}$`, "i"),
  };
  if (excludePropertyId) {
    query._id = { $ne: new Types.ObjectId(String(excludePropertyId)) };
  }

  const live = await DB.Models.Property.find(query)
    .select(
      "_id price location status isDeleted isRejected isApproved isAvailable additionalFeatures propertyType propertyCategory pictures pricing shortletDetails",
    )
    .limit(BRUTE_FORCE_LIVE_CAP)
    .lean();
  const liveIds = live.map((p) => p._id);
  if (!liveIds.length) return [];

  const stored = await DB.Models.PropertyImageEmbedding.find({
    propertyId: { $in: liveIds },
  })
    .select("propertyId embedding")
    .lean();

  const threshold = imageSimilarityThreshold();
  const best = new Map<string, number>();
  for (const row of stored) {
    const pid = String(row.propertyId);
    const vec = row.embedding || [];
    let max = best.get(pid) ?? 0;
    for (const q of queryEmbeddings) {
      const c = cosineSimilarity(q, vec);
      if (c > max) max = c;
    }
    if (max >= threshold) best.set(pid, max);
  }

  return live.filter(
    (p) => best.has(String(p._id)) && isPropertyListedAndMatchable(p),
  );
}

/**
 * Atlas `$vectorSearch` top-K, then keep cosine ≥ threshold in the same state + LGA.
 * Falls back to in-process cosine among live listings in that LGA if the index is missing.
 */
export async function findLiveImageMatches(
  queryEmbeddings: number[][],
  location: { state?: string; localGovernment?: string },
  excludePropertyId?: string | Types.ObjectId | unknown,
): Promise<any[]> {
  if (!queryEmbeddings.length) return [];
  const state = String(location.state || "").trim();
  const lga = String(location.localGovernment || "").trim();
  if (!state || !lga) return [];

  const indexName =
    process.env.PROPERTY_IMAGE_VECTOR_INDEX || PROPERTY_IMAGE_VECTOR_INDEX_NAME;
  const threshold = imageSimilarityThreshold();
  const best = new Map<string, number>();

  try {
    await ensurePropertyImageVectorIndex();
    for (const embedding of queryEmbeddings) {
      const docs = await DB.Models.PropertyImageEmbedding.aggregate([
        {
          $vectorSearch: {
            index: indexName,
            path: "embedding",
            queryVector: embedding,
            numCandidates: 50,
            limit: VECTOR_TOP_K,
          },
        },
        {
          $project: {
            propertyId: 1,
            embedding: 1,
          },
        },
      ]);
      for (const doc of docs) {
        const pid = String(doc.propertyId);
        if (excludePropertyId && pid === String(excludePropertyId)) continue;
        const c = cosineSimilarity(embedding, doc.embedding || []);
        const prev = best.get(pid) ?? 0;
        if (c > prev) best.set(pid, c);
      }
    }
  } catch (err) {
    console.warn(
      "[findLiveImageMatches] $vectorSearch failed, using same-LGA brute force:",
      err,
    );
    return findLiveImageMatchesBruteForce(
      queryEmbeddings,
      location,
      excludePropertyId,
    );
  }

  const above = [...best.entries()].filter(([, score]) => score >= threshold);
  if (!above.length) return [];

  const ids = above.map(([id]) => new Types.ObjectId(id));
  const properties = await DB.Models.Property.find({
    _id: { $in: ids },
    ...liveListingMongoFilter(),
  }).lean();

  return properties.filter((p) => {
    if (excludePropertyId && String(p._id) === String(excludePropertyId)) {
      return false;
    }
    if (!isPropertyListedAndMatchable(p)) return false;
    return sameStateAndLga(p.location, location);
  });
}

export async function backfillLiveListingImageEmbeddings(opts?: {
  limit?: number;
}): Promise<{ processed: number; embedded: number; skipped: number }> {
  if (!isClipInferenceEnabled()) {
    warnClipDisabledOnce();
    return { processed: 0, embedded: 0, skipped: 0 };
  }
  const limit = opts?.limit ?? 50;
  console.info(`[backfill] Querying up to ${limit * 3} live listings with photos...`);
  const live = await DB.Models.Property.find({
    ...liveListingMongoFilter(),
    pictures: { $exists: true, $ne: [] },
  })
    .select("_id pictures")
    .sort({ updatedAt: -1 })
    .limit(limit * 3)
    .maxTimeMS(20000)
    .lean();
  console.info(`[backfill] Found ${live.length} candidate listing(s).`);

  let processed = 0;
  let embedded = 0;
  let skipped = 0;

  for (const prop of live) {
    if (processed >= limit) break;
    const urls = (prop.pictures || []).filter(Boolean);
    if (!urls.length) continue;
    const propertyId = String(prop._id);
    const existingCount = await DB.Models.PropertyImageEmbedding.countDocuments({
      propertyId,
      pictureUrl: { $in: urls },
    });
    if (existingCount >= Math.min(urls.length, MAX_IMAGES_PER_LISTING)) {
      skipped += 1;
      processed += 1;
      continue;
    }
    const missing = Math.min(urls.length, MAX_IMAGES_PER_LISTING) - existingCount;
    console.info(
      `[backfill] ${processed + 1}/${limit} property ${propertyId} — embedding ${missing} new photo(s)`,
    );
    await syncPropertyImageEmbeddings(propertyId, urls);
    const after = await DB.Models.PropertyImageEmbedding.countDocuments({
      propertyId,
    });
    embedded += Math.max(0, after - existingCount);
    processed += 1;
  }

  return { processed, embedded, skipped };
}
