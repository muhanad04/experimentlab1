import { EXPERIMENTS, targets } from "./experiments.js";
import { PARAMETERS } from "./physics.js";
export const SCHEMA = 1;
export function freshBook() {
  return {
    schema: SCHEMA,
    model: PARAMETERS.model,
    records: Object.fromEntries(EXPERIMENTS.map((e) => [e.id, []])),
    answers: {},
    student: "",
    updated: null,
  };
}
export function validateBook(data) {
  if (
    !data ||
    data.schema !== SCHEMA ||
    data.model !== PARAMETERS.model ||
    !data.records ||
    !data.answers ||
    typeof data.student !== "string" ||
    data.student.length > 200
  )
    throw Error("Unsupported lab book format or model version.");
  const result = freshBook();
  result.student = data.student;
  for (const e of EXPERIMENTS) {
    const rows = data.records[e.id];
    if (!Array.isArray(rows) || rows.length > targets(e.id).length)
      throw Error("Invalid record count.");
    const keys = new Set();
    result.records[e.id] = rows.map((r) => {
      if (
        !r ||
        !targets(e.id).includes(r.key) ||
        keys.has(r.key) ||
        r.provenance !== "simulated" ||
        typeof r.timestamp !== "string" ||
        !r.reading ||
        !r.config ||
        !Number.isFinite(r.source) ||
        r.source < 0 ||
        r.source > 300
      )
        throw Error("Invalid measurement record.");
      keys.add(r.key);
      const values = Object.values(r.reading);
      if (
        !values.every(
          (v) =>
            v === null ||
            (typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e7),
        )
      )
        throw Error("Invalid measurement values.");
      for (const k of [
        "supply",
        "epri",
        "esec",
        "ipri",
        "isec",
        "e1",
        "e2",
        "e3",
        "i0",
        "core",
      ])
        if (!Number.isFinite(r.reading[k]) || r.reading[k] < 0)
          throw Error("Missing measurement value.");
      if (
        ![1, 3].includes(r.config.parallel) ||
        ![0.5, 1, 1.25].includes(r.config.nonlinearScale)
      )
        throw Error("Invalid experiment configuration.");
      return {
        key: r.key,
        provenance: "simulated",
        timestamp: r.timestamp.slice(0, 50),
        source: r.source,
        config: {
          pair: String(r.config.pair).slice(0, 3),
          target: Number(r.config.target) || 20,
          loadIndex: Number(r.config.loadIndex) || 0,
          parallel: r.config.parallel,
          nonlinearScale: r.config.nonlinearScale,
        },
        reading: { ...r.reading },
      };
    });
  }
  for (const e of EXPERIMENTS)
    for (const [key] of e.questions) {
      const a = data.answers[key];
      if (a !== undefined) {
        if (typeof a !== "string" || a.length > 20000)
          throw Error("Invalid answer.");
        result.answers[key] = a;
      }
    }
  result.updated =
    typeof data.updated === "string" ? data.updated.slice(0, 50) : null;
  return result;
}
export function saveRecord(book, id, key, reading, config, source) {
  const keep = [
    "supply",
    "epri",
    "esec",
    "ipri",
    "isec",
    "e1",
    "e2",
    "e3",
    "i0",
    "core",
    "effective",
    "inputWatts",
    "outputWatts",
    "copperWatts",
    "coreWatts",
    "powerFactor",
    "harmonicA",
  ];
  const row = {
    key,
    provenance: "simulated",
    timestamp: new Date().toISOString(),
    source,
    config: { ...config },
    reading: Object.fromEntries(keep.map((k) => [k, reading[k]])),
  };
  const rows = book.records[id],
    i = rows.findIndex((r) => r.key === key);
  if (i < 0) rows.push(row);
  else rows[i] = row;
  book.updated = row.timestamp;
  return i >= 0;
}
export function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}
const csvCell = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
export function csv(book) {
  const lines = [
    [
      "experiment",
      "target",
      "provenance",
      "source_V",
      "EPRI_V",
      "IPRI_A",
      "ESEC_V",
      "ISEC_A",
      "E1_sense_V",
      "I0_A",
      "effective_load_ohm",
      "parallel_banks",
      "nonlinear_scale",
      "timestamp",
    ],
  ];
  for (const e of EXPERIMENTS)
    for (const r of book.records[e.id])
      lines.push([
        e.id,
        r.key,
        r.provenance,
        r.source,
        r.reading.epri,
        r.reading.ipri,
        r.reading.esec,
        r.reading.isec,
        e.id === "saturation" ? r.reading.e1 : "",
        e.id === "saturation" ? r.reading.i0 : "",
        r.reading.effective,
        r.config.parallel,
        r.config.nonlinearScale,
        r.timestamp,
      ]);
  return lines.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
