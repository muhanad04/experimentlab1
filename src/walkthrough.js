import {
  targets,
  targetKey,
  recordEligibility,
  optionsFor,
  readExperiment,
} from "./experiments.js";
import { supplyForPrimary } from "./physics.js";

export function walkthroughAction({
  id,
  config,
  records,
  powered,
  valid,
  reading,
}) {
  const missing = targets(id).filter(
    (key) => !records.some((r) => r.key === key),
  );
  if (!missing.length)
    return {
      action: "results",
      label: "View results",
      instruction:
        "All readings recorded. Review the calculated results and graph.",
    };
  const key = targetKey(id, config),
    recorded = records.some((r) => r.key === key);
  if (recorded)
    return {
      action: "next",
      key: missing[0],
      label: "Next reading",
      instruction: "Reading saved. Continue to the next measurement.",
    };
  if (!valid)
    return {
      action: "connect",
      label: id === "voltage" ? "Connect circuit & probe" : "Connect circuit",
      instruction: `Connect Figure ${id === "saturation" ? 5 : id.startsWith("short") ? 4 : id === "voltage" ? 3 : 7}. The supply will be kept OFF at zero.`,
    };
  const reason = recordEligibility(id, powered, valid, reading, config);
  if (reason)
    return {
      action: "operate",
      label:
        id === "saturation"
          ? `Set E2 to ${config.target} V`
          : id.startsWith("short")
            ? "Set I2 to 0.200 A"
            : "Apply 240 V",
      instruction:
        id === "saturation"
          ? `Adjust the source until the winding meter E2 reads ${config.target} V. The source must also supply the sense-resistor drop.`
          : id.startsWith("short")
            ? "Raise the low-voltage supply until the shorted secondary carries 0.200 A."
            : "Apply 240 V to the primary and read the instruments.",
    };
  return {
    action: "record",
    label: "Record & continue",
    instruction:
      "The operating point is ready. Record the meters; calculations are shown automatically.",
  };
}

export function operatingVoltage(id, config) {
  if (id === "saturation")
    return (
      Math.round(supplyForPrimary(config.target, optionsFor(id, config)) * 10) /
      10
    );
  if (id.startsWith("short")) {
    let low = 0,
      high = 80;
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2;
      if (readExperiment(id, mid, config).isec > 0.2) high = mid;
      else low = mid;
    }
    return Math.round(((low + high) / 2) * 10) / 10;
  }
  return 240;
}
