import { WINDINGS, LOADS, simulate } from "./physics.js";
export const PAIRS = ["5-6", "3-4", "3-7", "7-8", "8-4", "5-9", "9-6"];
export const EXPERIMENTS = [
  {
    id: "voltage",
    part: "Part I",
    title: "Voltage & turns",
    figure: 3,
    steps: "1–7",
    purpose:
      "Discover how the number of wire loops changes a transformer’s voltage.",
    task: "Apply 240 V to winding 1–2. Move E2 across each secondary pair, recording one reading at a time.",
    concept:
      "Voltage is electrical push. A transformer uses changing magnetic flux to create a voltage in another, electrically isolated coil. More turns means more induced voltage.",
    questions: [
      [
        "rated",
        "Do the secondary voltages compare with their rated values? Which ratings can you actually verify?",
        "From the manual’s turns counts and a 240 V primary, expect approximately 240 V (5–6) and 415 V (3–4). The actual front-panel rating image was not supplied; tap turns in this simulation are estimates. Compare with theory, but do not claim you verified absent panel markings.",
      ],
      [
        "turns",
        "Calculate N1–2/N5–6 and N1–2/N3–4. Compare with your measured voltage ratios (I.6–7).",
        "500/500 = 1; 500/865 ≈ 0.578. At no load, EPRI/ESEC is approximately NP/NS. Small differences arise from winding impedance and exciting current.",
      ],
    ],
  },
  {
    id: "short56",
    part: "Part I",
    title: "Current ratio · 5–6",
    figure: 4,
    steps: "8–11",
    purpose: "See the inverse relationship between turns and current.",
    task: "I2 bridges winding 5–6. Start at zero and slowly raise the low AC supply until I2 is 0.200 A (±0.005 A). Never apply 240 V to a short.",
    concept:
      "Current is the rate of flow of charge. A short circuit has almost no load resistance. Winding impedance is all that limits current, so only a small supply voltage is needed.",
    questions: [
      [
        "ratio56",
        "Calculate IPRI/ISEC. Is it approximately N5–6/N1–2? (I.10–11)",
        "500/500 = 1. Include the small exciting current when explaining why the measured RMS ratio is not exactly one.",
      ],
    ],
  },
  {
    id: "short34",
    part: "Part I",
    title: "Current ratio · 3–4",
    figure: 4,
    steps: "12–13",
    purpose: "Repeat the current test with a higher-turn secondary.",
    task: "With power OFF and voltage zero, connect the shorting ammeter to 3–4. Raise the supply until I2 is 0.200 A (±0.005 A).",
    concept:
      "An ideal transformer conserves power: increasing secondary voltage reduces available secondary current. That is why the current ratio is the inverse of the voltage ratio.",
    questions: [
      [
        "ratio34",
        "Calculate IPRI/ISEC. Does it agree with N3–4/N1–2? (I.13)",
        "865/500 = 1.73. The primary must provide roughly 1.73 times the secondary current, plus exciting current.",
      ],
    ],
  },
  {
    id: "saturation",
    part: "Part I",
    title: "Excitation & saturation",
    figure: 5,
    steps: "14–20",
    purpose:
      "Find out why a magnetic core needs much more current at high flux.",
    task: "Use R = 400 Ω, primary 6–9 and open secondary 4–8. Adjust the source until E2 reaches each target from 20 to 240 V; record E1, E2 and E3.",
    concept:
      "Exciting current creates the magnetic field even with no load. Saturation means increasingly large current produces only a small increase in magnetic flux. The sense resistor makes this current measurable: I₀ = E1/400.",
    questions: [
      [
        "rapid",
        "Does exciting current rise more rapidly above rated voltage? (I.17)",
        "Compare successive E1 increments for equal E2 increments. Half winding 6–9 has an inferred nominal rating of120 V; the nonlinear curve is illustrative, not a measured knee at that voltage.",
      ],
      [
        "core",
        "Does your E2-versus-E1 curve illustrate saturation? Explain. (I.18)",
        "A curve that flattens toward the right means a large current increase buys little extra flux or voltage. Our smooth constitutive law demonstrates this qualitatively; no measured B–H curve was supplied.",
      ],
      [
        "satRatio",
        "How is the primary-to-secondary voltage ratio affected? (I.19)",
        "The number of turns does not change. The induced-voltage ratio stays fixed; terminal ratios can drift because high current increases winding voltage drops.",
      ],
    ],
  },
  ...[
    [
      "resistive",
      "Resistive loading",
      "R",
      "2",
      "5–7",
      "Q1: What happens to secondary voltage as load increases (resistance decreases)?",
      "Voltage falls as current increases because of internal winding resistance and leakage reactance. Resistance opposes current and dissipates energy as heat.",
    ],
    [
      "inductive",
      "Inductive loading",
      "L",
      "3",
      "8–11",
      "Q2: How does secondary voltage vary as inductive load increases?",
      "Voltage falls more strongly with a lagging inductive current. An inductor stores magnetic energy; its current lags the voltage.",
    ],
    [
      "capacitive",
      "Capacitive loading",
      "C",
      "4",
      "12–16",
      "Q3: How does secondary voltage vary as capacitive load increases?",
      "A leading capacitive current initially raises terminal voltage by compensating leakage reactance. At much heavier loading it reaches a maximum and falls; the manual’s setpoints need not reach that maximum. A capacitor stores electric-field energy.",
    ],
  ].map(([id, title, kind, table, steps, q, hint]) => ({
    id,
    part: "Part II",
    title,
    kind,
    table,
    figure: 7,
    steps,
    purpose:
      "Measure how a real transformer’s output changes when it supplies a load.",
    task: "Hold the source at 240 V. Start with all load switches open, then select 4800, 2400, 1600, 1200 and 960 Ω. Record all four meters at every setting.",
    concept: hint,
    questions: [
      [id + "Trend", q, hint],
      ...(kind === "R"
        ? [
            [
              "regulation",
              "Calculate the voltage regulation using no-load and minimum-resistance output voltages. (II.7)",
              "The manual uses100(ENL−EFL)/ENL. Here “full load” means its minimum-R row, not a verified nameplate-current operating point.",
            ],
          ]
        : []),
      ...(kind === "C"
        ? [
            [
              "compare",
              "Q4: What differences do you observe between the three load curves?",
              "Compare all three at matching current, not just matching impedance. Resistive and inductive loads lower voltage; capacitive loads can raise it. Their currents have different phase angles.",
            ],
          ]
        : []),
    ],
  })),
];
export const byId = (id) => EXPERIMENTS.find((e) => e.id === id);
export function optionsFor(id, config = {}) {
  if (id === "saturation")
    return {
      primary: 250,
      secondary: 115,
      sense: 400,
      nonlinearScale: config.nonlinearScale ?? 1,
    };
  if (id.startsWith("short"))
    return { kind: "short", secondary: id === "short34" ? 865 : 500 };
  if (id === "voltage") return { secondary: WINDINGS[config.pair || "5-6"] };
  return {
    kind: byId(id).kind,
    load: LOADS[config.loadIndex || 0],
    parallel: config.parallel || 1,
  };
}
export function readExperiment(id, voltage, config = {}) {
  return simulate({ voltage, ...optionsFor(id, config) });
}
export function targets(id) {
  return id === "voltage"
    ? PAIRS
    : id === "saturation"
      ? Array.from({ length: 12 }, (_, i) => (i + 1) * 20)
      : id.startsWith("short")
        ? ["0.200 A"]
        : LOADS.map((v) => v ?? "open");
}
export function targetKey(id, config = {}) {
  return id === "voltage"
    ? config.pair || "5-6"
    : id === "saturation"
      ? config.target || 20
      : id.startsWith("short")
        ? "0.200 A"
        : (LOADS[config.loadIndex || 0] ?? "open");
}
export function recordEligibility(id, powered, valid, reading, config = {}) {
  if (!powered || !valid)
    return "Complete the circuit and switch the power on first.";
  if (id.startsWith("short") && Math.abs(reading.isec - 0.2) > 0.005)
    return "Adjust I2 to 0.200 A (within ±0.005 A).";
  if (id === "saturation" && Math.abs(reading.e2 - (config.target || 20)) > 0.5)
    return "Adjust the source until E2 is within 0.5 V of the selected target.";
  if (
    (id === "voltage" || byId(id).kind) &&
    Math.abs(reading.supply - 240) > 0.5
  )
    return "Set the source to 240 V before recording.";
  return "";
}
// Net lists specify topology, not a prescribed drawing or lead order. Meters are ideal.
export function circuit(id, config = {}) {
  const sat = id === "saturation",
    short = id.startsWith("short"),
    load = !!byId(id).kind;
  const pair = sat
    ? ["4", "8"]
    : short
      ? id === "short34"
        ? ["3", "4"]
        : ["5", "6"]
      : (config.pair || "5-6").split("-");
  const nodes = [];
  function node(key, label, x, y, group) {
    nodes.push({ key, label, x, y, group });
  }
  node("S", "S · variable AC", 60, 90, "Supply");
  node("N", "N · return", 60, 320, "Supply");
  const p = sat ? ["6", "9"] : ["1", "2"];
  node("T" + p[0], "T" + p[0], 365, 90, "Transformer");
  node("T" + p[1], "T" + p[1], 365, 320, "Transformer");
  node("T" + pair[0], "T" + pair[0], 425, 90, "Transformer");
  node("T" + pair[1], "T" + pair[1], 425, 320, "Transformer");
  if (sat) {
    node("RA", "R in", 160, 90, "Sense resistor");
    node("RB", "R out", 240, 90, "Sense resistor");
    node("E1+", "E1 +", 160, 40, "E1");
    node("E1-", "E1 −", 240, 40, "E1");
    node("E2+", "E2 +", 280, 180, "E2");
    node("E2-", "E2 −", 280, 250, "E2");
    node("E3+", "E3 +", 610, 180, "E3");
    node("E3-", "E3 −", 610, 250, "E3");
    return {
      nodes,
      pair,
      p,
      nets: [
        ["S", "RA", "E1+"],
        ["RB", "T6", "E1-", "E2+"],
        ["N", "T9", "E2-"],
        ["T4", "E3+"],
        ["T8", "E3-"],
      ],
      sat,
      short,
      load,
    };
  }
  node("I1+", "I1 +", 160, 90, "I1");
  node("I1-", "I1 −", 220, 90, "I1");
  const sourceMeter = id === "voltage";
  node("E1+", "E1 +", sourceMeter ? 125 : 280, 180, "E1");
  node("E1-", "E1 −", sourceMeter ? 125 : 280, 250, "E1");
  const nets = [
    ["S", "I1+", ...(sourceMeter ? ["E1+"] : [])],
    ["I1-", "T1", ...(sourceMeter ? [] : ["E1+"])],
    ["N", "T2", "E1-"],
  ];
  if (short) {
    node("I2+", "I2 +", 580, 180, "I2");
    node("I2-", "I2 −", 580, 250, "I2");
    nets.push(["T" + pair[0], "I2+"], ["T" + pair[1], "I2-"]);
  } else if (load) {
    node("I2+", "I2 +", 540, 90, "I2");
    node("I2-", "I2 −", 600, 90, "I2");
    node("E2+", "E2 +", 610, 180, "E2");
    node("E2-", "E2 −", 610, 250, "E2");
    node("L+", "Load +", 730, 150, "Load");
    node("L-", "Load −", 730, 280, "Load");
    nets.push(["T5", "I2+"], ["I2-", "E2+", "L+"], ["T6", "E2-", "L-"]);
  } else {
    node("E2+", "E2 +", 570, 180, "E2");
    node("E2-", "E2 −", 570, 250, "E2");
    nets.push(["T" + pair[0], "E2+"], ["T" + pair[1], "E2-"]);
  }
  return { nodes, nets, pair, p, sat, short, load };
}
export function suggestedWires(spec) {
  return spec.nets.flatMap((net) => net.slice(1).map((n) => [net[0], n]));
}
export function validateCircuit(spec, wires) {
  const parent = Object.fromEntries(spec.nodes.map((n) => [n.key, n.key]));
  const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const membership = Object.fromEntries(
    spec.nets.flatMap((net, i) => net.map((n) => [n, i])),
  );
  for (const [a, b] of wires) {
    if (!(a in parent) || !(b in parent) || a === b)
      return {
        valid: false,
        invalid: true,
        message: "Unknown or self-connected terminal. Remove the lead.",
      };
    if (membership[a] !== membership[b])
      return {
        valid: false,
        invalid: true,
        message: `${a} → ${b} joins different circuit nodes. Remove that lead before powering on.`,
      };
    parent[find(a)] = find(b);
  }
  const missing = suggestedWires(spec).filter(([a, b]) => find(a) !== find(b));
  return {
    valid: missing.length === 0,
    invalid: false,
    missing,
    message: missing.length
      ? `${missing.length} connection${missing.length === 1 ? "" : "s"} remaining. Next: ${missing[0][0]} → ${missing[0][1]}.`
      : "Circuit checked. Ready to energize at zero volts.",
  };
}
