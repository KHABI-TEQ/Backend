import { LAGOS_LGAS } from "./lagosLgas";
import { PILOT_STATE } from "./pilotLocation";

/** Practitioner KYC progress. Achievement is not a step. */
export const PRACTITIONER_KYC_STEPS = [
  { key: "identityDocuments", label: "Identity Documents", order: 1 },
  { key: "professionalInfo", label: "Professional Info", order: 2 },
  { key: "addressAndRegions", label: "Address & Regions", order: 3 },
] as const;

const lgaOptions = LAGOS_LGAS.map((name) => ({ value: name, label: name }));

/**
 * Form contract for Practitioner KYC verification.
 * Region of operation is a multi-select of Lagos LGAs, rendered as removable chips.
 */
export function buildPractitionerKycForm() {
  return {
    title: "Practitioner KYC verification",
    subtitle: "Complete your verification to enhance your public Practitioner profile",
    steps: PRACTITIONER_KYC_STEPS,
    addressAndRegions: {
      state: {
        name: "address.state",
        label: "State",
        required: true,
        value: PILOT_STATE,
        helperText: "Lagos State only (pilot location)",
        locked: true,
      },
      localGovtArea: {
        name: "address.localGovtArea",
        label: "Local Government Area",
        placeholder: "Select LGA",
        required: true,
        selectionMode: "single" as const,
        options: lgaOptions,
      },
      regionOfOperation: {
        name: "regionOfOperation",
        label: "Region of operation",
        helperText: "Select the LGAs you primarily operate in for the selected state",
        required: true,
        selectionMode: "multiple" as const,
        display: "chips" as const,
        options: lgaOptions,
      },
    },
  };
}
