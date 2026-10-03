import { DB } from "../controllers";

/**
 * Atomic sequence generator backed by MongoDB findOneAndUpdate with upsert
 */
export async function getNextSequence(key: string): Promise<number> {
  const result = await DB.Models.CaseCounter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return result ? result.seq : 1;
}

/**
 * Returns case number format: KHT-CASE-000321 (6-digit zero pad)
 */
export async function nextCaseNumber(): Promise<string> {
  const seq = await getNextSequence("kht-case");
  return `KHT-CASE-${String(seq).padStart(6, "0")}`;
}

/**
 * Returns petition number format: PET-2026-0001 (4-digit zero pad, current year)
 */
export async function nextPetitionNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`pet-${year}`);
  return `PET-${year}-${String(seq).padStart(4, "0")}`;
}

/**
 * Returns EFCC transfer reference format: EFCC-REF-2026-000042 (6-digit zero pad, current year)
 */
export async function nextEfccRef(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`efcc-ref-${year}`);
  return `EFCC-REF-${year}-${String(seq).padStart(6, "0")}`;
}
