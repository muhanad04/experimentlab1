// Festo Didactic 30328-00, Appendix B, Table B-1 / Figure B-1,
// 240 V / 50 Hz column. Each section contains 4800, 2400, 1200 ohm elements.
export const ELEMENTS = [4800, 2400, 1200];
export const SWITCH_PRESETS = Object.freeze({
  4800: [true, false, false],
  2400: [false, true, false],
  1600: [true, true, false],
  1200: [false, false, true],
  960: [true, false, true],
});
export function bankSetting(label, sections = 1) {
  if (![1, 3].includes(sections))
    throw new RangeError("Use one or three identical sections");
  if (label !== null && !SWITCH_PRESETS[label])
    throw new RangeError("Unsupported manual load target");
  const enabled =
    label === null ? [false, false, false] : SWITCH_PRESETS[label];
  const active = ELEMENTS.filter((_, i) => enabled[i]);
  const conductance = active.reduce((sum, z) => sum + 1 / z, 0) * sections;
  return {
    sections,
    enabled: [...enabled],
    active,
    conductance,
    effective: conductance ? 1 / conductance : null,
    switches: Array.from({ length: sections }, (_, bank) =>
      enabled.flatMap((on, i) => (on ? [bank * 3 + i + 1] : [])),
    ).flat(),
  };
}
export function equivalentComponent(kind, impedance, frequency = 50) {
  if (impedance === null) return null;
  if (
    !Number.isFinite(impedance) ||
    impedance <= 0 ||
    !Number.isFinite(frequency) ||
    frequency <= 0
  )
    throw new RangeError("Positive impedance and frequency required");
  if (kind === "R")
    return { symbol: "R", formula: "R = |Z|", value: impedance, unit: "Ω" };
  if (kind === "L")
    return {
      symbol: "L",
      formula: "L = XL / (2πf)",
      value: impedance / (2 * Math.PI * frequency),
      unit: "H",
    };
  if (kind === "C")
    return {
      symbol: "C",
      formula: "C = 1 / (2πf XC)",
      value: 1 / (2 * Math.PI * frequency * impedance),
      unit: "F",
    };
  throw new RangeError("Unknown load kind");
}
