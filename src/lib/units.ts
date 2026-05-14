// Unit conversions. Database stores metric (cm, kg, km/h, m/s); UI is imperial.
export const KMH_PER_MPH = 1.609344;
export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const M_PER_FT = 0.3048;

export const kgToLb = (kg: number | null | undefined) =>
  kg == null ? null : kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;

export const cmToIn = (cm: number | null | undefined) =>
  cm == null ? null : cm / CM_PER_IN;
export const inToCm = (inches: number) => inches * CM_PER_IN;

export const kmhToMph = (k: number | null | undefined) =>
  k == null ? null : k / KMH_PER_MPH;
export const mphToKmh = (m: number) => m * KMH_PER_MPH;

export const msToFps = (ms: number | null | undefined) =>
  ms == null ? null : ms / M_PER_FT;

// Format cm as feet & inches, e.g. 177.8 -> 5'10"
export function formatHeightImperial(cm: number | null | undefined): string {
  if (cm == null) return "—";
  const totalIn = Math.round(cm / CM_PER_IN);
  const ft = Math.floor(totalIn / 12);
  const inches = totalIn % 12;
  return `${ft}'${inches}"`;
}

export function formatWeightLb(kg: number | null | undefined, digits = 0): string {
  if (kg == null) return "—";
  return `${(kg / KG_PER_LB).toFixed(digits)} lb`;
}
