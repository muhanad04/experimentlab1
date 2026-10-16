import { WINDINGS, PARAMETERS, regulation } from "./physics.js";
import { bankSetting, equivalentComponent } from "./load-bank.js";

const f = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const step = (title, formula, substitution, result, note = "") => ({
  title,
  formula,
  substitution,
  result,
  note,
});
const ratio = (title, top, bottom, expected, symbols) =>
  step(
    title,
    `${symbols[0]} / ${symbols[1]}`,
    `${f(top, Math.abs(top) < 1 ? 6 : 4)} / ${f(bottom, Math.abs(bottom) < 1 ? 6 : 4)}`,
    f(top / bottom, 4),
    `Turns predict ${f(expected, 4)}. Difference = 100 × (${f(top / bottom, 4)} − ${f(expected, 4)}) / ${f(expected, 4)} = ${f((100 * (top / bottom - expected)) / expected, 2)}%. Winding drops and exciting current can cause small differences.`,
  );

// Calculations consume actual live/recorded readings, never a list of expected answers.
export function operatingMath(id, r, config = {}) {
  if (!r.epri) return [];
  if (id === "voltage") {
    const ns = WINDINGS[config.pair || "5-6"];
    return [
      step(
        "Voltage ratio",
        "EPRI / ESEC ≈ NP / NS",
        `${f(r.epri, 4)} V / ${f(r.esec, 4)} V`,
        f(r.epri / r.esec, 4),
        `Turns predict 500 / ${ns} = ${f(500 / ns, 4)}. ${["5-6", "3-4"].includes(config.pair || "5-6") ? "Small differences come from winding drops." : "These tap turns are estimated, not verified panel ratings."}`,
      ),
    ];
  }
  if (id.startsWith("short"))
    return [
      ratio("Current ratio", r.ipri, r.isec, id === "short34" ? 865 / 500 : 1, [
        "IPRI",
        "ISEC",
      ]),
    ];
  if (id === "saturation")
    return [
      step(
        "Exciting current",
        "I₀ = E1 / R",
        `${f(r.e1, 5)} V / 400 Ω`,
        `${f(r.e1 / 400, 6)} A = ${f(r.i0 * 1000, 2)} mA`,
        "The resistor converts the small current into a measurable voltage.",
      ),
    ];
  return r.isec > 0
    ? [
        step(
          "Effective load impedance",
          "|Z| = ESEC / ISEC",
          `${f(r.esec, 4)} V / ${f(r.isec, 7)} A`,
          `${f(r.esec / r.isec, 1)} Ω`,
          id === "resistive"
            ? "Resistive current is in phase with load voltage."
            : id === "inductive"
              ? "Inductive current lags load voltage by 90° in this ideal load model."
              : "Capacitive current leads load voltage by 90° in this ideal load model.",
        ),
      ]
    : [
        step(
          "Open secondary",
          "ISEC = 0 A",
          "All load switches open",
          "No load current",
          "A secondary voltage is still induced. The primary still draws exciting current.",
        ),
      ];
}

// Live working is deliberately independent of the measurement book: adjusting
// the instruments updates these steps without creating or requiring a record.
export function liveMath(id, r, config = {}) {
  const current = operatingMath(id, r, config);
  if (!current.length) return [];
  if (id === "voltage") {
    const ns = WINDINGS[config.pair || "5-6"];
    return [
      ...current,
      step(
        "Turns ratio",
        "NP / NS",
        `500 / ${ns}`,
        f(500 / ns, 4),
        ["5-6", "3-4"].includes(config.pair || "5-6")
          ? "Winding counts supplied by the manual."
          : "This tap count is estimated.",
      ),
      step(
        "Ideal secondary voltage",
        "ESEC,ideal = EPRI × NS / NP",
        `${f(r.epri, 4)} V × ${ns} / 500`,
        `${f((r.epri * ns) / 500, 3)} V`,
        `The live meter reads ${f(r.esec, 3)} V; winding drops account for the difference.`,
      ),
    ];
  }
  if (id.startsWith("short")) {
    const ns = id === "short34" ? 865 : 500;
    return [
      ...current,
      step("Expected current ratio", "NS / NP", `${ns} / 500`, f(ns / 500, 4)),
      step(
        "Ideal primary load current",
        "IPRI,load ≈ ISEC × NS / NP",
        `${f(r.isec, 6)} A × ${ns} / 500`,
        `${f((r.isec * ns) / 500, 6)} A`,
        `The primary meter reads ${f(r.ipri, 6)} A because it also includes exciting current.`,
      ),
    ];
  }
  if (id === "saturation")
    return [
      ...current,
      step(
        "Terminal voltage ratio",
        "E2 / E3",
        `${f(r.e2, 4)} V / ${f(r.e3, 4)} V`,
        f(r.e2 / r.e3, 4),
        "Estimated turns predict 250 / 115 ≈ 2.1739. Higher current creates winding voltage drops.",
      ),
      step(
        "Sense-resistor power",
        "PR = E1² / R",
        `(${f(r.e1, 5)} V)² / 400 Ω`,
        `${f((r.e1 * r.e1) / 400, 4)} W`,
        "Virtual dissipated power, not a physical resistor power rating.",
      ),
    ];
  const pf = id === "resistive" ? 1 : 0;
  const phase = id === "resistive" ? "0°" : id === "inductive" ? "90°" : "−90°";
  const power = step(
    "Real power delivered to the load",
    "PLOAD = ESEC × ISEC × cos φ",
    `${f(r.esec, 4)} V × ${f(r.isec, 7)} A × cos(${phase})`,
    `${f(r.esec * r.isec * pf, 4)} W`,
    pf
      ? "This is load power, excluding winding and core losses."
      : "An ideal reactive bank has zero average real power. The transformer still consumes power in its winding and core losses.",
  );
  if (r.effective === null) return [...current, power];
  return [
    ...current,
    step(
      "Secondary current",
      "ISEC = ESEC / |ZLOAD|",
      `${f(r.esec, 4)} V / ${f(r.effective, 4)} Ω`,
      `${f(r.esec / r.effective, 7)} A`,
      "Uses the effective impedance of the selected load-bank setting.",
    ),
    power,
  ];
}

// Optional expanded working: symbolic relationships, effective bank arithmetic,
// unit conversions, complex impedance and independent power balance.
export function detailedMath(id, r, config = {}) {
  if (!r.epri) return [];
  const steps = [];
  const primary = id === "saturation" ? 250 : 500;
  const secondary =
    id === "saturation"
      ? 115
      : id === "short34"
        ? 865
        : id === "voltage"
          ? WINDINGS[config.pair || "5-6"]
          : 500;
  const n = secondary / primary;
  steps.push(
    step(
      "Ideal transformer relationships",
      "n = NS / NP; ESEC,ideal = n Ecore; IPRI,load = n ISEC",
      `n = ${secondary} / ${primary}`,
      f(n, 6),
      "N counts wire turns; E is RMS voltage (V), I is RMS current (A). Terminal readings include winding drops; induced voltages follow turns.",
    ),
  );
  const z1r = PARAMETERS.r500 * (primary / 500) ** 2,
    z1x = PARAMETERS.x500 * (primary / 500) ** 2;
  const z2r = PARAMETERS.r500 * (secondary / 500) ** 2,
    z2x = PARAMETERS.x500 * (secondary / 500) ** 2;
  steps.push(
    step(
      "Series transformer impedance, referred to the secondary",
      "Zeq,sec = Z2 + n² Z1",
      `(${f(z2r)} + j${f(z2x)}) + ${f(n * n, 6)} × (${f(z1r)} + j${f(z1x)}) Ω`,
      `${f(z2r + n * n * z1r)} + j${f(z2x + n * n * z1x)} Ω`,
      "R represents copper loss; X represents leakage reactance. These numeric winding parameters and turns² scaling are estimates, not a measured equipment certificate.",
    ),
  );
  if (["resistive", "inductive", "capacitive"].includes(id)) {
    const kind = { resistive: "R", inductive: "L", capacitive: "C" }[id];
    const label = [null, 4800, 2400, 1600, 1200, 960][config.loadIndex || 0];
    const bank = bankSetting(label, config.parallel || 1);
    steps.push(
      step(
        "Load-bank combination · Festo Appendix B",
        "1 / |Zeffective| = sections × Σ(1 / |Zelement|)",
        bank.active.length
          ? `${bank.sections} × (${bank.active.map((z) => "1 / " + z).join(" + ")}) Ω⁻¹`
          : "All switches open",
        bank.effective === null
          ? "∞ Ω · open load"
          : `${f(bank.effective, 3)} Ω`,
        `Switches ON: ${bank.switches.join(", ") || "none"}. Elements per section: 4800,2400,1200 Ω at50 Hz. Three-section operation is optional; its use in the photos is unconfirmed.`,
      ),
    );
    if (bank.effective !== null) {
      const component = equivalentComponent(kind, bank.effective),
        omega = 2 * Math.PI * PARAMETERS.frequency;
      if (kind !== "R")
        steps.push(
          step(
            "Equivalent physical load element",
            component.formula,
            kind === "L"
              ? `${f(bank.effective, 3)} / (2π × 50)`
              : `1 / (2π × 50 × ${f(bank.effective, 3)})`,
            kind === "L"
              ? `${f(component.value, 5)} H`
              : `${f(component.value * 1e6, 5)} µF`,
            "This converts the nominal reactance into an ideal equivalent. Real coils and capacitors may have losses/tolerances.",
          ),
        );
      steps.push(
        step(
          "Complex AC load impedance",
          "ZR = R; ZL = jωL; ZC = −j/(ωC); ω = 2πf",
          `ω = 2π × 50 = ${f(omega, 4)} rad/s`,
          `${kind === "R" ? "" : kind === "L" ? "+j" : "−j"}${f(bank.effective, 3)} Ω`,
          "j means a90° phase rotation. V/I gives |Z|, not the resistive part of an inductive or capacitive load.",
        ),
      );
    }
  }
  if (r.phasors) {
    const complex = (z) =>
      `${f(z.re, 6)} ${z.im < 0 ? "−" : "+"} j${f(Math.abs(z.im), 6)}`;
    steps.push(
      step(
        "Complex meter quantities · source-voltage reference",
        "|a + jb| = √(a² + b²); angle = atan2(b,a)",
        `I2 = ${complex(r.phasors.secondaryCurrent)} A; V2 = ${complex(r.phasors.secondary)} V`,
        `|I2| = ${f(r.isec, 7)} A; |V2| = ${f(r.esec, 4)} V`,
        "These real/imaginary components are phasors, not instantaneous waveforms. A capacitor leads its own terminal voltage; the absolute current angle relative to the source also includes transformer drops. Primary RMS can additionally contain harmonics.",
      ),
    );

    const z = id.startsWith("short")
      ? "0 Ω (short)"
      : r.effective === null
        ? "∞ (open)"
        : `${id === "resistive" ? "" : id === "inductive" ? "+j" : "−j"}${f(r.effective)} Ω`;
    steps.push(
      step(
        "Secondary phasor solve",
        "I2 = n Ecore / (Z2 + Zload); V2 = Zload I2",
        `|Ecore| = ${f(r.core, 4)} V; n = ${f(n, 6)}; Zload = ${z}`,
        `|I2| = ${f(r.isec, 7)} A; |V2| = ${f(r.esec, 4)} V`,
        "Core voltage is found by the nonlinear primary-branch solve, including exciting current. Complex values are added before taking RMS magnitudes; scalar voltage subtraction is not valid for reactive loads.",
      ),
    );
  }
  if (Number.isFinite(r.inputWatts))
    steps.push(
      step(
        "Power balance",
        "PIN = PLOAD + PCOPPER + PCORE",
        `${f(r.outputWatts, 5)} + ${f(r.copperWatts, 5)} + ${f(r.coreWatts, 5)} W`,
        `${f(r.inputWatts, 5)} W`,
        id === "saturation"
          ? `Sense-resistor loss is additional: E1² /400 = ${f((r.e1 * r.e1) / 400, 5)} W; transformer input above excludes that external resistor.`
          : "PCOPPER = R1 I1,rms² + R2 I2,rms². Reactive power circulates but is not average real power.",
      ),
    );
  return steps;
}

export function workedResults(id, records, allRecords = {}) {
  const rows = [...records];
  const steps = [],
    observations = [];
  if (id === "voltage") {
    for (const pair of ["5-6", "3-4"]) {
      const expected = 500 / WINDINGS[pair];
      steps.push(
        step(
          `Turns ratio · ${pair}`,
          "NP / NS",
          `500 / ${WINDINGS[pair]}`,
          f(expected, 4),
        ),
      );
      const row = rows.find((r) => r.key === pair);
      if (row)
        steps.push(
          ratio(
            `Measured voltage ratio · ${pair}`,
            row.reading.epri,
            row.reading.esec,
            expected,
            ["EPRI", "ESEC"],
          ),
        );
    }
    observations.push({
      title: "Voltage verification",
      text: rows.length
        ? "The measured ratios are compared with the manual’s turns counts above. More secondary turns produce a higher induced voltage. Actual front-panel markings were not supplied, so agreement with those markings cannot be certified."
        : "Record a secondary reading to compare it with the turns relationship.",
    });
  } else if (id.startsWith("short")) {
    const ns = id === "short34" ? 865 : 500;
    steps.push(
      step("Expected current ratio", "NS / NP", `${ns} / 500`, f(ns / 500, 4)),
    );
    if (rows[0]) steps.push(...operatingMath(id, rows[0].reading));
    observations.push({
      title: "Current and turns",
      text: "The current ratio is the inverse of the voltage ratio: the higher-turn secondary needs more primary current for the same secondary current. The small exciting current makes the RMS ratio slightly imperfect.",
    });
  } else if (id === "saturation") {
    rows.sort((a, b) => a.key - b.key);
    if (rows.length) steps.push(...operatingMath(id, rows.at(-1).reading));
    if (rows.length >= 4) {
      const a = rows[0].reading,
        b = rows[1].reading,
        c = rows.at(-2).reading,
        d = rows.at(-1).reading;
      const early = (b.i0 - a.i0) / (b.e2 - a.e2),
        late = (d.i0 - c.i0) / (d.e2 - c.e2);
      steps.push(
        step(
          "Early current-growth rate",
          "ΔI₀ / ΔE2",
          `(${f(b.i0 * 1000, 2)} − ${f(a.i0 * 1000, 2)}) mA / (${f(b.e2, 2)} − ${f(a.e2, 2)}) V`,
          `${f(early * 1000)} mA/V`,
        ),
      );
      steps.push(
        step(
          "Late current-growth rate",
          "ΔI₀ / ΔE2",
          `(${f(d.i0 * 1000, 2)} − ${f(c.i0 * 1000, 2)}) mA / (${f(d.e2, 2)} − ${f(c.e2, 2)}) V`,
          `${f(late * 1000)} mA/V`,
        ),
      );
      observations.push({
        title: "Saturation trend",
        text: `The late current-growth rate is ${f(late / early, 2)} times the early rate. ${late > early ? "Current grows faster at high voltage, illustrating saturation and a curve that flattens toward the right." : "These recorded points do not show a larger late growth rate."} The core law is illustrative, not a measured B–H curve or a known saturation threshold.`,
      });
    }
    if (rows.length) {
      const a = rows[0].reading,
        b = rows.at(-1).reading;
      steps.push(
        step(
          "Terminal voltage ratio · first point",
          "E2 / E3",
          `${f(a.e2, 2)} / ${f(a.e3, 2)}`,
          f(a.e2 / a.e3, 4),
        ),
      );
      if (rows.length > 1)
        steps.push(
          step(
            "Terminal voltage ratio · last point",
            "E2 / E3",
            `${f(b.e2, 2)} / ${f(b.e3, 2)}`,
            f(b.e2 / b.e3, 4),
          ),
        );
      observations.push({
        title: "Why the ratio changes slightly",
        text: "Turns do not change during saturation. The induced-voltage ratio remains 250/115 ≈ 2.1739 (estimated taps); increased winding drops can change the measured terminal ratio.",
      });
    }
  } else {
    const nl = rows.find((r) => r.key === "open"),
      fl = rows.find((r) => r.key === 960);
    if (nl && fl && nl.config.parallel === fl.config.parallel) {
      const a = nl.reading.esec,
        b = fl.reading.esec;
      steps.push(
        step(
          "Voltage regulation · manual convention",
          "100 × (ENL − EFL) / ENL",
          `100 × (${f(a, 2)} − ${f(b, 2)}) / ${f(a, 2)}`,
          `${f(regulation(a, b), 2)}%`,
          "The minimum-impedance row is used as the manual’s “full-load” point; rated current has not been established.",
        ),
      );
      observations.push({
        title: "Recorded voltage change",
        text: `From no load to 960 Ω, secondary voltage ${b > a ? "rises" : "falls"} from ${f(a, 2)} V to ${f(b, 2)} V (${f(Math.abs(b - a), 2)} V). ${id === "capacitive" ? "Leading current can compensate leakage reactance and raise voltage. Much heavier loading can eventually reverse this rise." : id === "inductive" ? "Lagging current increases the voltage drop associated with leakage reactance." : "Winding resistance and leakage reactance cause voltage drop as load current increases."}`,
      });
    } else
      observations.push({
        title: "Voltage regulation",
        text:
          nl && fl
            ? "The two endpoint readings use different bank interpretations. Record them with matching settings before comparing."
            : "Record the open-load and 960 Ω readings; regulation will be calculated here automatically.",
      });
    if (id === "capacitive") {
      const complete = ["resistive", "inductive", "capacitive"].every((k) =>
        (allRecords[k] || []).some((r) => r.key === 960),
      );
      observations.push({
        title: "Comparison of the three loads",
        text: complete
          ? ["resistive", "inductive", "capacitive"]
              .map(
                (k) =>
                  `${k}: ${f(allRecords[k].find((r) => r.key === 960).reading.esec, 2)} V at the 960 Ω label`,
              )
              .join("; ") +
            ". Compare the curves at equal current as well: the three current phase angles produce different internal voltage drops. Check effective bank settings before comparing."
          : "Record all three load experiments to compare their curves. Resistive and inductive currents typically reduce voltage; leading capacitive current can raise it.",
      });
    }
  }
  return { steps, observations };
}
