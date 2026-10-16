import {
  EXPERIMENTS,
  PAIRS,
  byId,
  circuit,
  suggestedWires,
  validateCircuit,
  readExperiment,
  targets,
  targetKey,
  recordEligibility,
} from "./experiments.js";
import { PARAMETERS } from "./physics.js";
import {
  freshBook,
  validateBook,
  saveRecord,
  escapeHTML as esc,
  csv,
} from "./notebook.js";
import { chart, COLORS } from "./charts.js";
import { schematic } from "./schematic.js";
import { liveMath, detailedMath, workedResults } from "./results.js";
import { bankSetting } from "./load-bank.js";
import { openReport, reportDocument } from "./report.js";
import { walkthroughAction, operatingVoltage } from "./walkthrough.js";

const $ = (selector) => document.querySelector(selector);
// Session memory only. Reloading always creates an empty experiment book.
let book = freshBook();
let id = byId(location.hash.slice(1))?.id || "voltage",
  tab = "bench",
  powered = false,
  voltage = 0,
  wires = [],
  selected = null,
  manualOpen = false,
  diagramZoomed = false,
  inspected = null,
  toastTimer;
let config = defaults();
function defaults() {
  return {
    pair: "5-6",
    target: 20,
    loadIndex: 0,
    parallel: 1,
    nonlinearScale: 1,
  };
}
const exp = () => byId(id),
  spec = () => circuit(id, config),
  validity = () => validateCircuit(spec(), wires);
const reading = () =>
  readExperiment(id, powered && validity().valid ? voltage : 0, config);
const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const action = () =>
  walkthroughAction({
    id,
    config,
    records: book.records[id],
    powered,
    valid: validity().valid,
    reading: reading(),
  });
function markUpdated() {
  book.updated = new Date().toISOString();
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function progress(e) {
  return `${book.records[e.id].length}/${targets(e.id).length}`;
}
function render() {
  const active = document.activeElement;
  const restore = active?.closest("#view, #tabs, #experiments")
    ? active.id
      ? "#" + CSS.escape(active.id)
      : ["terminal", "tab", "experiment", "action"]
          .map((key) =>
            active.dataset[key] !== undefined
              ? `[data-${key}="${CSS.escape(active.dataset[key])}"]`
              : null,
          )
          .find(Boolean)
    : null;
  $("#experiments").innerHTML = EXPERIMENTS.map(
    (e, i) =>
      `${i === 0 || i === 4 ? `<div class="nav-part">${e.part} · ${i === 0 ? "Operation" : "Regulation"}</div>` : ""}<button class="experiment-button ${e.id === id ? "active" : ""}" data-experiment="${e.id}" ${e.id === id ? 'aria-current="step"' : ""}><span class="nav-number">${i + 1}</span><span>${e.title}</span><span class="nav-done">${progress(e)}</span></button>`,
  ).join("");
  if (matchMedia("(max-width:700px)").matches) {
    const nav = $("#experiments");
    nav.scrollLeft = Math.max(
      0,
      nav.querySelector(".active").offsetLeft - nav.offsetLeft - 12,
    );
  }
  $("#intro").innerHTML =
    `<div class="intro-row"><h1>${exp().title}</h1><span class="manual-ref">Figure ${exp().figure} · Manual ${exp().part}, ${exp().steps}</span></div>`;
  $("#tabs").innerHTML = [
    ["bench", "Walkthrough"],
    ["results", "Measurements & results"],
  ]
    .map(
      ([key, label]) =>
        `<button data-tab="${key}" class="${tab === key ? "active" : ""}" ${tab === key ? 'aria-current="page"' : ""}>${label}</button>`,
    )
    .join("");
  $("#view").innerHTML =
    tab === "bench" ? bench() : tab === "results" ? results() : evidence();
  if (tab === "bench") updateLive();
  if (restore) {
    const target = $(restore) || $("#view h2") || $("#main");
    if (!target.matches("button,input,select,a")) target.tabIndex = -1;
    if (!target.disabled) target.focus({ preventScroll: true });
  }
}
function shutdown() {
  powered = false;
  voltage = 0;
  wires = [];
  selected = null;
}
function switchExperiment(next) {
  if (next === id) return;
  // The walkthrough safely shuts down before replacing a module, rather than making
  // students navigate elsewhere to discover how to leave the current procedure.
  shutdown();
  id = next;
  inspected = null;
  config = defaults();
  tab = "bench";
  manualOpen = false;
  diagramZoomed = false;
  history.replaceState(null, "", "#" + id);
  render();
}
function setTab(next) {
  tab = ["notebook", "analysis"].includes(next) ? "results" : next;
  render();
}
function label(key) {
  return id === "voltage"
    ? `Winding ${key}`
    : id === "saturation"
      ? `E2 = ${key} V`
      : id.startsWith("short")
        ? "ISEC = 0.200 A"
        : key === "open"
          ? "No load"
          : `${key} Ω`;
}
function mathMarkup(steps, compact = false) {
  if (!steps.length)
    return '<p class="subtle">The formula and substituted readings appear when voltage is applied.</p>';
  return steps
    .map(
      (s) =>
        `<div class="worked-step ${compact ? "compact" : ""}"><h3>${esc(s.title)}</h3><div class="math-formula">${esc(s.formula)}</div><div class="math-substitution">${esc(s.substitution)}</div><div class="math-result">= ${esc(s.result)}</div>${s.note ? `<p>${esc(s.note)}</p>` : ""}</div>`,
    )
    .join("");
}
function meterDefinitions() {
  if (id === "saturation")
    return [
      ["e1", "E1 · Sense resistor", "V"],
      ["e2", "E2 · Primary", "V"],
      ["e3", "E3 · Secondary", "V"],
      ["i0", "I₀ · Calculated", "mA"],
    ];
  if (id.startsWith("short"))
    return [
      ["epri", "E1 · Primary", "V"],
      ["ipri", "I1 · Primary", "A"],
      ["isec", "I2 · Secondary", "A"],
    ];
  const meters = [
    ["epri", "E1 · Primary", "V"],
    ["ipri", "I1 · Primary", "A"],
    ["esec", "E2 · Secondary", "V"],
  ];
  return id === "voltage"
    ? meters
    : [...meters, ["isec", "I2 · Secondary", "A"]];
}
function bench() {
  const s = spec(),
    current = targets(id).indexOf(targetKey(id, config)) + 1;
  return `<section class="walkthrough-step" aria-label="Current experiment step"><div><h2 id="step-title"></h2><p id="step-instruction"></p><span id="step-position" class="step-position">Reading ${current} of ${targets(id).length} · ${label(targetKey(id, config))}</span></div><button class="primary" id="guide-next" data-action="advance" aria-describedby="step-instruction step-position"></button></section>
  <div class="bench-layout"><div class="bench-main"><section class="bench-plate ${diagramZoomed ? "diagram-enlarged" : ""}"><div class="plate-header"><h2>Figure ${exp().figure} · ${id === "voltage" ? "No-load circuit" : id.startsWith("short") ? "Short-circuit test" : id === "saturation" ? "Exciting-current circuit" : "Loaded transformer"}</h2><div class="schematic-tools"><span id="circuit-status" class="circuit-status"></span><button class="diagram-zoom" data-action="zoom-diagram" aria-pressed="${diagramZoomed}">${diagramZoomed ? "Fit" : "Enlarge"}</button></div></div>${schematic(s, wires, { selected, powered, kind: exp().kind, figure: exp().figure, loadOpen: config.loadIndex === 0 })}<p class="schematic-caption">${diagramZoomed ? "Pan horizontally to inspect connections." : validity().valid ? "Voltmeters in parallel · Ammeters in series" : "Dashed lines show the connections to make."}</p></section>
  <details class="manual-controls" ${manualOpen ? "open" : ""}><summary>Manual wiring & instrument controls</summary><div class="manual-body"><div class="wiring-toolbar"><button data-action="auto-wire" ${powered || voltage ? "disabled" : ""}>Connect circuit</button><button data-action="next-wire" ${powered || voltage || validity().valid || validity().invalid ? "disabled" : ""}>Connect next lead</button><button data-action="undo" ${powered || voltage || !wires.length ? "disabled" : ""}>Undo lead</button><button data-action="clear-wires" ${powered || voltage || !wires.length ? "disabled" : ""}>Remove leads</button></div><p id="wiring-help" class="subtle"></p><div class="supply-panel"><div><label>Supply</label><button id="power" class="power-switch ${powered ? "on" : ""}" data-action="power" aria-pressed="${powered}">${powered ? "I · ON" : "O · OFF"}</button></div><div><label for="source-voltage">Source voltage · RMS</label><div class="source-line"><input id="voltage-range" type="range" aria-label="Source voltage slider" min="0" max="${maxVoltage()}" step="0.1" value="${voltage}"><div class="number-with-unit"><input id="source-voltage" type="number" aria-label="Source voltage in volts" min="0" max="${maxVoltage()}" step="0.1" value="${voltage}"><span>V</span></div></div></div><button data-action="zero">Zero supply</button></div>${setupControls()}<div class="button-row"><button id="record" data-action="record">Record current reading</button><button data-action="finish">Switch OFF & disconnect</button></div><p class="subtle" id="record-note"></p><details class="wire-list"><summary>Leads (${wires.length})</summary><div class="wire-items">${wires.map(([a, b], i) => `<button data-remove-wire="${i}" ${powered ? "disabled" : ""}>${a} → ${b} · remove</button>`).join("")}</div></details></div></details>
  <section class="circuit-inspection"><h2>Circuit inspector</h2><p id="circuit-inspection">Choose an instrument or component to see its connections and live values.</p><div class="button-row"><button data-inspect="primary">Primary / transformer</button><button data-inspect="secondary">Secondary / load</button><button data-inspect="sense">${id === "saturation" ? "400 Ω sense resistor" : "Meter connections"}</button></div><div id="component-detail"></div></section>
  <details class="recorded-data"><summary>Recorded readings · ${progress(exp())}</summary>${measurementTable(id)}</details>
  <details class="experiment-note"><summary>What this experiment demonstrates</summary><p>${exp().concept}</p><p>${exp().task}</p></details></div>
  <aside class="bench-aside"><section class="instrument-panel"><h2>Meter readings <span>AC RMS</span></h2><div class="instrument-meters">${meterDefinitions()
    .map(
      ([key, name, unit]) =>
        `<div class="meter"><div class="meter-name">${name}</div><div class="meter-value"><output id="meter-${key}" aria-label="${esc(name + " in " + unit)}">0</output><span class="meter-unit">${unit}</span></div></div>`,
    )
    .join(
      "",
    )}</div><p class="instrument-foot" id="instrument-foot"></p></section><section class="live-math" aria-labelledby="live-math-title"><h2 id="live-math-title">Live math</h2><p class="live-math-caption">Updates with voltage and load. No recording required.</p><div id="live-working"></div><details class="deep-working"><summary>Detailed equations & model</summary><div id="deep-working"></div></details></section></aside></div>`;
}
function maxVoltage() {
  return id.startsWith("short") ? 80 : id === "saturation" ? 300 : 240;
}
function setupControls() {
  if (id === "voltage")
    return `<label for="probe-pair">E2 probe terminals · power OFF before moving leads</label><select id="probe-pair" ${powered || voltage ? "disabled" : ""}>${PAIRS.map((pair) => `<option value="${pair}" ${config.pair === pair ? "selected" : ""}>${pair}</option>`).join("")}</select>`;
  if (id === "saturation")
    return `<div class="setup-fields"><div><label for="saturation-target">E2 target</label><select id="saturation-target">${targets(
      id,
    )
      .map(
        (v) =>
          `<option ${config.target === v ? "selected" : ""} value="${v}">${v} V</option>`,
      )
      .join(
        "",
      )}</select></div><div><label for="nonlinearity">Illustrative core strength</label><select id="nonlinearity" ${powered || voltage ? "disabled" : ""}>${[0.5, 1, 1.25].map((v) => `<option ${config.nonlinearScale === v ? "selected" : ""} value="${v}">${v}×</option>`).join("")}</select></div></div><p class="subtle">400 Ω sense resistor. The virtual source extends to 300 V to supply its voltage drop; this is not a hardware supply rating.</p>`;
  if (exp().kind)
    return `<label>Load-bank setting</label><div class="load-switches">${targets(
      id,
    )
      .map(
        (v, i) =>
          `<button data-load="${i}" class="${config.loadIndex === i ? "active" : ""}" aria-pressed="${config.loadIndex === i}">${v === "open" ? "Open" : v + " Ω"}</button>`,
      )
      .join(
        "",
      )}</div><details class="advanced-settings"><summary>Load interpretation</summary><label for="parallel-banks">Effective impedance</label><select id="parallel-banks" ${powered || voltage ? "disabled" : ""}><option value="1" ${config.parallel === 1 ? "selected" : ""}>Manual values</option><option value="3" ${config.parallel === 3 ? "selected" : ""}>Photo hypothesis: three parallel banks</option></select><p class="subtle">The photo hypothesis uses label ÷ 3; it is not confirmed equipment wiring.</p></details>`;
  return '<p class="subtle">Intentional secondary short: low voltage only. Virtual 80 V range and 0.45 A primary trip are software teaching limits, not equipment ratings.</p>';
}
function updateLive() {
  if (tab !== "bench") return;
  const r = reading(),
    v = validity();
  if (powered && id.startsWith("short") && r.ipri > 0.45) {
    shutdown();
    render();
    toast(
      "Virtual protection tripped above 0.45 A primary. Source reset to zero.",
    );
    return;
  }
  for (const [key, , unit] of meterDefinitions())
    $(`#meter-${key}`).textContent = fmt(
      key === "i0" ? r[key] * 1000 : r[key],
      unit === "A" ? 3 : 2,
    );
  const status = $("#circuit-status");
  status.textContent = powered
    ? "Power ON"
    : v.invalid
      ? "Invalid lead"
      : v.valid
        ? "Connected · OFF"
        : "Supply OFF";
  status.className =
    "circuit-status " +
    (v.invalid ? "invalid" : powered ? "live" : v.valid ? "ready" : "");
  $("#instrument-foot").textContent = powered
    ? `Source ${fmt(voltage, 1)} V · simulated readings`
    : "Source OFF · no induced voltage";
  $("#wiring-help").textContent = selected
    ? `${selected} selected. Choose its other terminal; Escape cancels.`
    : powered
      ? "Switch OFF and zero the supply before changing leads."
      : v.message;
  const reason = recordEligibility(id, powered, v.valid, r, config);
  $("#record").disabled = !!reason;
  $("#record-note").textContent = reason || "Ready to record.";
  const a = action();
  $("#guide-next").textContent = a.label;
  $("#step-title").textContent = {
    connect: "Connect the circuit",
    operate: "Set the operating point",
    record: "Read & record",
    next: "Continue the measurements",
    results: "Experiment complete",
  }[a.action];
  $("#step-instruction").textContent = a.instruction;
  $("#live-working").innerHTML = mathMarkup(liveMath(id, r, config), true);
  $("#deep-working").innerHTML = mathMarkup(detailedMath(id, r, config), true);
  if (inspected) updateInspection(r);
  $("#power").textContent = powered ? "I · ON" : "O · OFF";
  $("#power").classList.toggle("on", powered);
  $("#power").setAttribute("aria-pressed", String(powered));
  for (const selector of ["#probe-pair", "#parallel-banks", "#nonlinearity"])
    if ($(selector)) $(selector).disabled = powered || voltage !== 0;
}
function updateInspection(r = reading()) {
  const s = spec();
  const texts = {
    primary: `Primary terminals ${s.p.join("–")}: ${fmt(r.epri, 3)} V RMS, ${fmt(r.ipri, 6)} A RMS. The iron core magnetically couples windings; no conductive primary-to-secondary connection exists. Estimated primary series impedance: ${(50 * (id === "saturation" ? 0.5 : 1) ** 2).toFixed(2)} + j${(65 * (id === "saturation" ? 0.5 : 1) ** 2).toFixed(2)} Ω.`,
    secondary: `Secondary terminals ${s.pair.join("–")}: ${fmt(r.esec, 3)} V RMS, ${fmt(r.isec, 6)} A RMS. ${exp().kind ? `Load ${r.effective === null ? "open" : fmt(r.effective, 3) + " Ω effective"}; ${config.parallel} section(s). Reactive magnitude is not resistance.` : id.startsWith("short") ? "I2 deliberately short-circuits the secondary; only low source voltage is used." : "Secondary open except for an ideal high-impedance voltmeter."}`,
    sense:
      id === "saturation"
        ? `R =400 Ω in series with primary6–9. E1 across R=${fmt(r.e1, 5)} V; I₀=E1/400=${fmt(r.i0, 7)} A. E2 measures the winding, not the source. Source=${fmt(voltage, 2)} V.`
        : `E1 across ${id === "voltage" ? "source" : "primary1–2"}, I1 in the primary path. ${id.startsWith("short") ? "I2 is a shorting ammeter." : `E2 across secondary ${s.pair.join("–")}${exp().kind ? ", I2 in series with the load" : ""}.`} Ideal meters: infinite voltage-input impedance, zero current-input impedance.`,
  };
  $("#component-detail").textContent = texts[inspected];
  if (inspected === "secondary" && exp().kind) {
    const bank = bankSetting(
      [null, 4800, 2400, 1600, 1200, 960][config.loadIndex],
      config.parallel,
    );
    const details = document.createElement("p");
    details.className = "subtle";
    details.textContent = `Documented load-bank switches ON: ${bank.switches.join(", ") || "none"}. ${bank.active.length ? `1/|Z| = ${bank.sections} × (${bank.active.map((z) => "1/" + z).join(" + ")}) → ${fmt(bank.effective, 3)} Ω.` : "Open bank: no conducting element."} Source: Festo30328-00, Appendix B,240 V/50 Hz.`;
    $("#component-detail").append(details);
  }
  document
    .querySelectorAll("[data-inspect]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.inspect === inspected)),
    );
}
function selectTarget(key) {
  selected = null;
  if (id === "voltage") {
    powered = false;
    voltage = 0;
    config.pair = key;
    wires = wires.filter((w) => !w.some((n) => n.startsWith("E2")));
  } else if (id === "saturation") config.target = key;
  else if (exp().kind) config.loadIndex = targets(id).indexOf(key);
}
function advance() {
  const a = action();
  if (a.action === "results") {
    powered = false;
    voltage = 0;
    setTab("results");
    return;
  }
  if (a.action === "connect") {
    powered = false;
    voltage = 0;
    selected = null;
    wires = suggestedWires(spec());
  }
  if (a.action === "operate") {
    if (!validity().valid) return;
    voltage = 0;
    powered = true;
    voltage = operatingVoltage(id, config);
  }
  if (a.action === "record") {
    record(true);
    return;
  }
  if (a.action === "next") selectTarget(a.key);
  render();
}
function record(continueGuided = false) {
  const r = reading(),
    reason = recordEligibility(id, powered, validity().valid, r, config);
  if (reason) {
    toast(reason);
    return;
  }
  saveRecord(book, id, targetKey(id, config), r, config, voltage);
  if (continueGuided) {
    const next = targets(id).find(
      (key) => !book.records[id].some((row) => row.key === key),
    );
    if (next !== undefined) selectTarget(next);
  }
  markUpdated();
  render();
}
function wiringAllowed() {
  if (powered || voltage !== 0) {
    toast("Zero the supply and switch OFF before changing leads.");
    return false;
  }
  return true;
}
function connectTerminal(key) {
  if (!wiringAllowed()) return;
  if (!selected) {
    selected = key;
    render();
    return;
  }
  if (selected === key) {
    selected = null;
    render();
    return;
  }
  if (
    !wires.some(
      ([a, b]) =>
        (a === selected && b === key) || (b === selected && a === key),
    )
  )
    wires.push([selected, key]);
  selected = null;
  render();
  if (validity().invalid) toast(validity().message);
}
function setVoltage(value) {
  if (!Number.isFinite(value)) return;
  voltage = Math.round(Math.max(0, Math.min(maxVoltage(), value)) * 10) / 10;
  $("#source-voltage").value = voltage;
  $("#voltage-range").value = voltage;
  updateLive();
}
function measurementTable(experimentId) {
  const sat = experimentId === "saturation",
    vol = experimentId === "voltage",
    short = experimentId.startsWith("short");
  const headers = sat
    ? ["E2 target V", "E1 V", "E2 V", "E3 V", "I₀ mA"]
    : vol
      ? ["Pair", "EPRI V", "IPRI A", "ESEC V", "EPRI/ESEC"]
      : short
        ? ["Target", "EPRI V", "IPRI A", "ISEC A", "IPRI/ISEC"]
        : ["Load Ω", "Effective Ω", "EPRI V", "IPRI A", "ESEC V", "ISEC A"];
  return `<div class="table-scroll"><table><caption>${esc(byId(experimentId).title)} · ${book.records[experimentId].length}/${targets(experimentId).length}</caption><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${targets(
    experimentId,
  )
    .map((key) => {
      const row = book.records[experimentId].find((r) => r.key === key),
        r = row?.reading;
      const values = !r
        ? headers.slice(1).map(() => "—")
        : sat
          ? [fmt(r.e1), fmt(r.e2), fmt(r.e3), fmt(r.i0 * 1000)]
          : vol
            ? [
                fmt(r.epri),
                fmt(r.ipri, 3),
                fmt(r.esec),
                fmt(r.epri / r.esec, 4),
              ]
            : short
              ? [
                  fmt(r.epri),
                  fmt(r.ipri, 3),
                  fmt(r.isec, 3),
                  fmt(r.ipri / r.isec, 4),
                ]
              : [
                  r.effective === null ? "∞" : fmt(r.effective, 1),
                  fmt(r.epri),
                  fmt(r.ipri, 3),
                  fmt(r.esec),
                  fmt(r.isec, 3),
                ];
      return `<tr><th scope="row">${key === "open" ? "∞ · open" : esc(key)}</th>${values.map((v) => `<td class="${r ? "" : "empty-cell"}">${v}</td>`).join("")}</tr>`;
    })
    .join("")}</tbody></table></div>`;
}
function consistencyWarning(experimentId) {
  const settings = new Set(
    book.records[experimentId].map((r) =>
      experimentId === "saturation"
        ? r.config.nonlinearScale
        : r.config.parallel,
    ),
  );
  return settings.size > 1
    ? '<p class="warning">These readings use different model settings. Repeat with one consistent setting before treating them as a controlled sweep.</p>'
    : "";
}
function observationsMarkup(observations) {
  return `<div class="observations">${observations.map((o) => `<div><h3>${esc(o.title)}</h3><p>${esc(o.text)}</p></div>`).join("")}</div>`;
}
function graphMarkup(experimentId, comparison = true, interactive = false) {
  if (experimentId === "saturation")
    return chart(
      [
        {
          name: "Recorded sweep",
          color: COLORS.saturation,
          points: book.records[experimentId].map((r) => [
            r.reading.e1,
            r.reading.e2,
            `E2 target ${r.key} V; I₀ ${(r.reading.i0 * 1000).toFixed(4)} mA; E3 ${r.reading.e3.toFixed(4)} V; core strength ${r.config.nonlinearScale}×`,
          ]),
        },
      ],
      "Sense voltage E1 (V)",
      "Primary voltage E2 (V)",
      { interactive },
    );
  if (byId(experimentId).kind) {
    const selected = EXPERIMENTS.filter(
      (e) => e.kind && (comparison || e.id === experimentId),
    );
    const settings = new Set(
      selected.flatMap((e) => book.records[e.id].map((r) => r.config.parallel)),
    );
    return `${settings.size > 1 ? '<p class="warning">Load curves use different impedance interpretations; compare effective settings before drawing conclusions.</p>' : ""}${chart(
      selected.map((e) => ({
        name: e.title,
        color: COLORS[e.id],
        points: book.records[e.id].map((r) => [
          r.reading.isec,
          r.reading.esec,
          `${r.key === "open" ? "No load" : r.key + " Ω label"}; effective ${r.reading.effective === null ? "∞" : r.reading.effective.toFixed(3)} Ω; primary ${r.reading.epri.toFixed(3)} V / ${r.reading.ipri.toFixed(6)} A; sections ${r.config.parallel}`,
        ]),
      })),
      "Secondary current ISEC (A)",
      "Secondary voltage ESEC (V)",
      { interactive },
    )}`;
  }
  return "";
}
function results() {
  const derived = workedResults(id, book.records[id], book.records),
    next = EXPERIMENTS[EXPERIMENTS.findIndex((e) => e.id === id) + 1];
  return `<div class="results-toolbar"><span>${progress(exp())} readings recorded · simulated RMS values</span><div class="button-row"><button data-action="report">Print / PDF</button><button data-action="csv">CSV</button></div></div><section class="results-section"><h2>Measurements</h2>${measurementTable(id)}${consistencyWarning(id)}</section><section class="results-section"><h2>Worked calculations</h2><p class="subtle">Formula → recorded values → result. Calculations retain full precision; displayed numbers are rounded.</p><div class="worked-grid">${mathMarkup(derived.steps)}</div><details class="deep-working"><summary>Full derivation for each recorded operating point</summary>${book.records[id].map((row) => `<h3>${esc(label(row.key))}</h3>${mathMarkup(detailedMath(id, row.reading, row.config))}`).join("")}</details></section>${id === "saturation" || exp().kind ? `<section class="results-section"><div class="section-heading"><h2>${exp().kind ? "Load curves" : "Excitation curve"}</h2><button data-action="svg">Save graph</button></div>${graphMarkup(id, true, true)}</section>` : ""}<section class="results-section"><h2>What the readings show</h2>${observationsMarkup(derived.observations)}</section><div class="results-actions"><button data-tab="bench">Return to experiment</button>${next ? `<button class="primary" data-next-experiment="${next.id}">Next: ${next.title}</button>` : ""}</div><details class="data-files"><summary>Measurement files</summary><div class="button-row"><button data-action="json">Export complete data</button><button data-action="import">Import data</button><button class="danger" data-action="clear-records">Clear this experiment’s readings</button></div></details>`;
}
function evidence() {
  return `<section class="results-section"><h2>Model & reference</h2><dl class="evidence-list"><dt>Manual</dt><dd>500 turns on 1–2 and 5–6; 865 on 3–4. Sense resistor 400 Ω. Source 240 V; short-test current 0.2 A. The manual’s regulation denominator is ENL.</dd><dt>Simulation</dt><dd>Complex AC equivalent circuit with winding copper losses, leakage reactance, core loss and nonlinear excitation. All displayed and exported readings are simulated, not physically obtained.</dd><dt>Estimates</dt><dd>50 Hz; each 500-turn winding uses 50 + j65 Ω. Taps 3–7 / 7–8 / 8–4 use 440 / 310 / 115 estimated turns; 5–9 and 9–6 use 250 each. No measured B–H curve was supplied, so the smooth saturation law is illustrative.</dd><dt>Documented banks</dt><dd>Festo30328-00 Appendix B confirms three sections, each containing4800,2400,1200 Ω elements for240 V/50 Hz. Switches1+2 give1600 Ω;1+3 give960 Ω. Values are effective impedances, not automatically divided by three. <a href="./docs/LABVOLT-RESEARCH.md" target="_blank" rel="noopener">Read the source audit</a>.</dd><dt>Photographs</dt><dd>The load readings imply impedances near printed values ÷ 3. Three equal banks in parallel is a hypothesis, not proven wiring. Manual values remain the default; the optional interpretation is under manual controls.</dd><dt>Limits</dt><dd>No inrush, temperature or full distorted-waveform solution. The 300 V excitation range and 80 V / 0.45 A short-test limits are virtual teaching settings, not hardware ratings. Use actual lab safety procedures on physical equipment.</dd></dl><p><a href="./docs/PHYSICS.md" target="_blank" rel="noopener">Equations, parameters & validation</a> · <a href="./docs/COVERAGE.md" target="_blank" rel="noopener">Manual coverage</a></p><button data-tab="bench">Return to experiment</button></section>`;
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function exportJSON() {
  download(
    JSON.stringify(
      {
        ...book,
        parameters: PARAMETERS,
        disclaimer: "All readings are simulated, not physically obtained.",
      },
      null,
      2,
    ),
    "labo-labbook.json",
    "application/json",
  );
}
function reportCircuit(e, row) {
  const s = circuit(e.id, row.config),
    container = document.createElement("div");
  container.innerHTML = schematic(s, suggestedWires(s), {
    kind: e.kind,
    figure: e.figure,
    loadOpen: row.reading.effective === null,
  });
  const svg = container.querySelector("svg");
  svg.removeAttribute("role");
  svg.classList.add("report-circuit");
  svg.querySelectorAll("[data-inspect]").forEach((el) => {
    el.removeAttribute("data-inspect");
    el.removeAttribute("tabindex");
    el.removeAttribute("role");
  });
  for (const node of s.nodes.filter((n) => n.key.startsWith("T"))) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", node.x);
    text.setAttribute("y", node.y === 320 ? 338 : 77);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "print-pin");
    text.textContent = node.key;
    svg.append(text);
  }
  return svg.outerHTML;
}
function report() {
  const sections = EXPERIMENTS.map((e) => {
    const rows = book.records[e.id],
      derived = workedResults(e.id, rows, book.records),
      row = rows.at(-1);
    return {
      title: `${e.part} · ${e.title}`,
      count: rows.length,
      html: `${consistencyWarning(e.id)}${row ? `<div class="report-block circuit-block">${reportCircuit(e, row)}<p class="report-meta">Figure ${e.figure} · circuit shown at last recorded target ${esc(row.key)}. Source ${fmt(row.source)} V; primary ${fmt(row.reading.epri)} V / ${fmt(row.reading.ipri, 6)} A; secondary ${fmt(row.reading.esec)} V / ${fmt(row.reading.isec, 6)} A.</p></div>` : ""}<div class="report-block">${measurementTable(e.id)}</div><p class="report-meta">Recorded settings: ${new Set(rows.map((r) => `${r.config.parallel}/${r.config.nonlinearScale}`)).size === 1 && row ? `All ${rows.length} readings: ${row.config.parallel} section(s), core strength ${row.config.nonlinearScale}×` : rows.map((r) => `${esc(r.key)}: ${r.config.parallel} section(s), core strength ${r.config.nonlinearScale}×`).join("; ")}</p><div class="report-block math-block">${mathMarkup(derived.steps)}</div>${observationsMarkup(derived.observations)}<div class="report-block graph-block">${graphMarkup(e.id, false)}</div>${row ? `<div class="report-block report-derivation"><h3>Detailed equivalent-circuit working · last recorded point</h3>${mathMarkup(detailedMath(e.id, row.reading, row.config))}</div>` : ""}`,
    };
  });
  const hasLoads = EXPERIMENTS.some((e) => e.kind && book.records[e.id].length);
  const comparison = hasLoads ? graphMarkup("capacitive") : "";
  const compact = sections.map((section) => {
    const holder = document.createElement("div");
    holder.innerHTML = section.html;
    holder.querySelectorAll(".report-derivation").forEach((el) => el.remove());
    return { ...section, html: holder.innerHTML };
  });
  openReport(
    reportDocument(compact, comparison),
    reportDocument(sections, comparison),
  );
}
$("#experiments").addEventListener("click", (e) => {
  const el = e.target.closest("[data-experiment]");
  if (el) switchExperiment(el.dataset.experiment);
});
$("#tabs").addEventListener("click", (e) => {
  const el = e.target.closest("[data-tab]");
  if (el) setTab(el.dataset.tab);
});
$("#about-button").addEventListener("click", () => setTab("evidence"));
$("#export-all").addEventListener("click", report);
$("#view").addEventListener(
  "toggle",
  (e) => {
    if (e.target.matches(".manual-controls") && e.target.isConnected)
      manualOpen = e.target.open;
  },
  true,
);
function inspectPoint(point) {
  const svg = point.closest("svg"),
    panel = svg.parentElement;
  svg
    .querySelectorAll(".chart-point")
    .forEach((p) => p.classList.toggle("selected-point", p === point));
  panel.querySelector(".chart-inspector").textContent =
    point.dataset.chartPoint;
}
$("#view").addEventListener("focusin", (event) => {
  if (event.target.matches("[data-chart-point]")) inspectPoint(event.target);
});
$("#view").addEventListener("keydown", (event) => {
  if (
    event.target.matches("g[data-inspect]") &&
    ["Enter", " "].includes(event.key)
  ) {
    event.preventDefault();
    inspected = event.target.dataset.inspect;
    updateInspection();
    $("#component-detail").scrollIntoView({ block: "nearest" });
    return;
  }
  if (
    event.target.matches("[data-chart-point]") &&
    ["Enter", " "].includes(event.key)
  ) {
    event.preventDefault();
    inspectPoint(event.target);
  }
});
$("#view").addEventListener("click", (e) => {
  const point = e.target.closest("[data-chart-point]");
  if (point) {
    inspectPoint(point);
    return;
  }
  const toggle = e.target.closest("[data-toggle-series]");
  if (toggle) {
    const visible = toggle.getAttribute("aria-pressed") !== "true";
    toggle.setAttribute("aria-pressed", String(visible));
    toggle
      .closest(".legend")
      .previousElementSibling.querySelector(
        `[data-chart-series="${toggle.dataset.toggleSeries}"]`,
      ).style.display = visible ? "" : "none";
    return;
  }
  const component = e.target.closest("[data-inspect]");
  if (component) {
    inspected = component.dataset.inspect;
    updateInspection();
    $("#component-detail").scrollIntoView({ block: "nearest" });
    return;
  }
  const el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.tab) {
    setTab(el.dataset.tab);
    return;
  }
  if (el.dataset.nextExperiment) {
    switchExperiment(el.dataset.nextExperiment);
    return;
  }
  if (el.dataset.terminal) {
    connectTerminal(el.dataset.terminal);
    return;
  }
  if (el.dataset.removeWire !== undefined) {
    if (wiringAllowed()) {
      wires.splice(Number(el.dataset.removeWire), 1);
      render();
    }
    return;
  }
  if (el.dataset.load !== undefined) {
    config.loadIndex = Number(el.dataset.load);
    render();
    return;
  }
  switch (el.dataset.action) {
    case "zoom-diagram":
      diagramZoomed = !diagramZoomed;
      render();
      break;
    case "advance":
      advance();
      break;
    case "auto-wire":
      if (wiringAllowed()) {
        wires = suggestedWires(spec());
        selected = null;
        render();
      }
      break;
    case "next-wire":
      if (wiringAllowed()) {
        const v = validity();
        if (v.invalid) {
          toast("Remove the invalid lead before continuing.");
          break;
        }
        if (v.missing?.length) wires.push(v.missing[0]);
        selected = null;
        render();
      }
      break;
    case "undo":
      if (wiringAllowed()) {
        wires.pop();
        selected = null;
        render();
      }
      break;
    case "clear-wires":
      if (wiringAllowed()) {
        wires = [];
        selected = null;
        render();
      }
      break;
    case "power":
      if (powered) {
        powered = false;
        render();
      } else if (voltage) toast("Zero the supply before switching ON.");
      else if (!validity().valid) toast(validity().message);
      else {
        powered = true;
        selected = null;
        render();
      }
      break;
    case "zero":
      setVoltage(0);
      break;
    case "record":
      record();
      break;
    case "finish":
      shutdown();
      render();
      toast("Supply OFF, voltage zero, leads removed. Measurements retained.");
      break;
    case "report":
      report();
      break;
    case "csv":
      download(csv(book), "labo-measurements.csv", "text/csv;charset=utf-8");
      break;
    case "json":
      exportJSON();
      break;
    case "import":
      $("#import-file").click();
      break;
    case "svg": {
      const svg = $("#measurement-chart");
      if (!svg) {
        toast("Record measurements before saving a graph.");
        break;
      }
      const copy = svg.cloneNode(true);
      copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      copy.insertAdjacentHTML(
        "afterbegin",
        "<style>text{font:12px system-ui,sans-serif;fill:#45566b}</style>",
      );
      download(copy.outerHTML, "labo-graph.svg", "image/svg+xml");
      break;
    }
    case "clear-records":
      if (
        confirm(
          "Clear this experiment’s recorded readings? Other experiments are unchanged.",
        )
      ) {
        book.records[id] = [];
        markUpdated();
        render();
      }
      break;
  }
});
$("#view").addEventListener("input", (e) => {
  if (
    ["source-voltage", "voltage-range"].includes(e.target.id) &&
    e.target.value !== ""
  )
    setVoltage(Number(e.target.value));
});
$("#view").addEventListener("change", (e) => {
  if (e.target.id === "probe-pair" && wiringAllowed()) {
    selectTarget(e.target.value);
    render();
  }
  if (e.target.id === "saturation-target") {
    config.target = Number(e.target.value);
    render();
  }
  if (e.target.id === "parallel-banks" && wiringAllowed()) {
    config.parallel = Number(e.target.value);
    render();
  }
  if (e.target.id === "nonlinearity" && wiringAllowed()) {
    config.nonlinearScale = Number(e.target.value);
    render();
  }
});
$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 1e6) throw Error("Maximum file size is 1 MB.");
    const imported = validateBook(JSON.parse(await file.text()));
    if (confirm("Replace the recorded data with this file?")) {
      book = imported;
      markUpdated();
      render();
      toast("Measurements imported.");
    }
  } catch (error) {
    toast("Import failed: " + error.message);
  } finally {
    e.target.value = "";
  }
});
window.addEventListener("hashchange", () => {
  const next = byId(location.hash.slice(1))?.id;
  if (next && next !== id) switchExperiment(next);
});
// A browser back/forward-cache restore must not resume an old experiment either.
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  book = freshBook();
  shutdown();
  config = defaults();
  tab = "bench";
  manualOpen = false;
  diagramZoomed = false;
  render();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && selected) {
    selected = null;
    render();
  }
});
render();
