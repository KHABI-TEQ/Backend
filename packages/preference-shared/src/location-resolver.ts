export type LocationResolver = {
  getLGAsByState: (state: string) => string[];
  getAreasByLGA: (state: string, lga: string) => string[];
};

let resolver: LocationResolver | null = null;

export function setPreferenceLocationResolver(r: LocationResolver): void {
  resolver = r;
}

export function getLGAsByState(state: string): string[] {
  return resolver?.getLGAsByState(state) ?? [];
}

export function getAreasByLGA(state: string, lga: string): string[] {
  return resolver?.getAreasByLGA(state, lga) ?? [];
}
