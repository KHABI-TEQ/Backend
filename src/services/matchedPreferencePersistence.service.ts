import { DB } from "../controllers";
import { Types } from "mongoose";
import { calculateDetailedMatchScore } from "../controllers/Admin/preference/findMatchProerty";
import {
  dedupeScoredPropertiesByPhysicalIdentity,
  toObjectIds,
} from "../utils/propertyPhysicalFingerprint";
import {
  effectiveRevealedCount,
  revealAndNotifyIfNeeded,
  type MatchNotifyChannels,
} from "./matchBatch.service";
import { notifyPractitionersOfListingMatches } from "./practitionerMatchNotify.service";

async function dedupePropertyObjectIds(
  ids: Types.ObjectId[],
  preference: any,
): Promise<Types.ObjectId[]> {
  if (!ids.length) return [];
  const docs = await DB.Models.Property.find({ _id: { $in: ids } }).lean();
  const byId = new Map(docs.map((p: any) => [String(p._id), p]));
  const scored = ids
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .map((property: any) => ({
      property,
      matchScore: calculateDetailedMatchScore(property, preference),
    }));
  return toObjectIds(dedupeScoredPropertiesByPhysicalIdentity(scored));
}

/**
 * Create or merge MatchedPreferenceProperty, notify the buyer of newly revealed
 * matches, and notify listing owners/marketers of newly paired properties.
 */
export async function persistMatchedPreferenceProperties(params: {
  preferenceId: string;
  matchedPropertyIds: Types.ObjectId[];
  notes?: string;
  sendMatchEmail: boolean;
  /** When true (admin submit-matches), notify even if no new property IDs were merged. */
  forceSendMatchEmail?: boolean;
  /**
   * When set (e.g. agent-initiated match from marketplace), match email CTA uses this origin
   * (e.g. https://slug.khabiteq.com) instead of resolving from listing owner/marketer.
   */
  matchEmailBaseUrlOverride?: string;
  /**
   * submittedVia: honor how the preference was submitted (app inbox vs website email).
   * all: email + in-app + push — used when a new listing is reverse-matched.
   */
  notifyChannels?: MatchNotifyChannels;
}): Promise<{ matchedRecord: any; wasUpdated: boolean } | null> {
  const {
    preferenceId,
    matchedPropertyIds,
    notes,
    sendMatchEmail,
    forceSendMatchEmail,
    matchEmailBaseUrlOverride,
    notifyChannels,
  } = params;

  if (!matchedPropertyIds.length) return null;

  const preference = await DB.Models.Preference.findById(preferenceId).populate("buyer");
  if (!preference) return null;

  const dedupedIncoming = await dedupePropertyObjectIds(
    matchedPropertyIds,
    preference,
  );
  if (!dedupedIncoming.length) return null;

  let matchedRecord: any;
  let wasUpdated = false;
  let previousTotal = 0;
  let previousRevealed = 0;
  let newlyMatchedIds: Types.ObjectId[] = [];

  const existingRecord = await DB.Models.MatchedPreferenceProperty.findOne({
    preference: preferenceId,
    buyer: preference.buyer,
  });

  if (existingRecord) {
    previousTotal = (existingRecord.matchedProperties || []).length;
    previousRevealed = effectiveRevealedCount(existingRecord);

    const newUniqueIds = dedupedIncoming.filter(
      (id) =>
        !existingRecord.matchedProperties.some((existingId: Types.ObjectId) =>
          existingId.equals(id),
        ),
    );

    if (newUniqueIds.length > 0) {
      existingRecord.matchedProperties.push(...newUniqueIds);
    }

    // Collapse any historical physical duplicates already on the record.
    const collapsed = await dedupePropertyObjectIds(
      existingRecord.matchedProperties as Types.ObjectId[],
      preference,
    );
    const before = (existingRecord.matchedProperties || [])
      .map((id: Types.ObjectId) => String(id))
      .join(",");
    const after = collapsed.map((id) => String(id)).join(",");
    if (before !== after) {
      existingRecord.matchedProperties = collapsed as any;
      wasUpdated = true;
    } else if (newUniqueIds.length > 0) {
      wasUpdated = true;
    }

    const collapsedSet = new Set(collapsed.map((id) => String(id)));
    newlyMatchedIds = newUniqueIds.filter((id) => collapsedSet.has(String(id)));

    if (notes) existingRecord.notes = notes;
    if (wasUpdated || notes) await existingRecord.save();

    matchedRecord = existingRecord;
  } else {
    matchedRecord = await DB.Models.MatchedPreferenceProperty.create({
      preference: preferenceId,
      buyer: preference.buyer,
      matchedProperties: dedupedIncoming,
      notes: notes || "",
      revealedCount: 0,
    });
    wasUpdated = true;
    previousTotal = 0;
    previousRevealed = 0;
    newlyMatchedIds = dedupedIncoming;
  }

  // Prefer status "matched" once we have at least one listing for the buyer.
  if (
    matchedRecord?.matchedProperties?.length &&
    ["pending", "approved"].includes(String(preference.status))
  ) {
    preference.status = "matched";
    await preference.save();
  }

  const shouldNotify =
    sendMatchEmail &&
    matchedRecord &&
    (forceSendMatchEmail || wasUpdated || !existingRecord);

  await revealAndNotifyIfNeeded({
    preference,
    matchedRecord,
    previousTotal,
    previousRevealed,
    sendNotify: !!shouldNotify,
    matchEmailBaseUrlOverride,
    notifyChannels,
  });

  if (newlyMatchedIds.length) {
    try {
      await notifyPractitionersOfListingMatches({
        preference,
        newlyMatchedPropertyIds: newlyMatchedIds,
        matchedRecordId: String(matchedRecord?._id || ""),
      });
    } catch (e) {
      console.warn(
        "[persistMatchedPreferenceProperties] Practitioner match notify failed:",
        e,
      );
    }
  }

  return { matchedRecord, wasUpdated };
}
