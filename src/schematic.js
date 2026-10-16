import { suggestedWires, validateCircuit } from "./experiments.js";
import { escapeHTML as esc } from "./notebook.js";

export const SCHEMATIC = { width: 810, height: 380, top: 90, bottom: 320 };
// Every lead travels through its electrical net's bus, never through a component.
export function wireGeometry(spec, wires) {
  const nodes = Object.fromEntries(spec.nodes.map((n) => [n.key, n]));
  return wires
    .map(([a, b]) => {
      const first = nodes[a],
        last = nodes[b];
      if (!first || !last) return null;
      const netIndex = spec.nets.findIndex(
        (net) => net.includes(a) && net.includes(b),
      );
      const bus =
        netIndex < 0
          ? (first.y + last.y) / 2
          : spec.nets[netIndex].some((key) => nodes[key].y === 320)
            ? 320
            : 90;
      const points = [
        [first.x, first.y],
        [first.x, bus],
        [last.x, bus],
        [last.x, last.y],
      ];
      return {
        netIndex,
        points,
        path: points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" "),
      };
    })
    .filter(Boolean);
}
export function junctions(geometry) {
  const dots = [];
  for (const net of new Set(
    geometry.map((g) => g.netIndex).filter((n) => n >= 0),
  )) {
    const segments = geometry
      .filter((g) => g.netIndex === net)
      .flatMap((g) => g.points.slice(1).map((p, i) => [g.points[i], p]))
      .filter(([a, b]) => a[0] !== b[0] || a[1] !== b[1]);
    const candidates = segments.flatMap((s) => s);
    for (const [a, b] of segments)
      for (const [c, d] of segments) {
        if (
          a[0] === b[0] &&
          c[1] === d[1] &&
          a[0] >= Math.min(c[0], d[0]) &&
          a[0] <= Math.max(c[0], d[0]) &&
          c[1] >= Math.min(a[1], b[1]) &&
          c[1] <= Math.max(a[1], b[1])
        )
          candidates.push([a[0], c[1]]);
      }
    const unique = new Map(candidates.map((p) => [p.join(","), p]));
    for (const [x, y] of unique.values()) {
      const directions = new Set();
      for (const [a, b] of segments) {
        if (
          a[1] === b[1] &&
          a[1] === y &&
          x >= Math.min(a[0], b[0]) &&
          x <= Math.max(a[0], b[0])
        ) {
          if (Math.min(a[0], b[0]) < x) directions.add("left");
          if (Math.max(a[0], b[0]) > x) directions.add("right");
        }
        if (
          a[0] === b[0] &&
          a[0] === x &&
          y >= Math.min(a[1], b[1]) &&
          y <= Math.max(a[1], b[1])
        ) {
          if (Math.min(a[1], b[1]) < y) directions.add("up");
          if (Math.max(a[1], b[1]) > y) directions.add("down");
        }
      }
      if (directions.size >= 3) dots.push([x, y]);
    }
  }
  return dots;
}
const coil = (x, y, count = 6, direction = -1) =>
  `M${x} ${y}` +
  Array.from(
    { length: count },
    () => `c${direction * 22} 0 ${direction * 22} 20 0 20`,
  ).join(" ");
function meter(x, y, name, type, horizontal = false, leftLabel = false) {
  const leads = horizontal
    ? `M${x - 30} ${y}h6M${x + 24} ${y}h6`
    : `M${x} ${y - 35}v11M${x} ${y + 24}v11`;
  return `<g class="schematic-device"><path d="${leads}"/><circle cx="${x}" cy="${y}" r="24"/><text class="meter-symbol" x="${x}" y="${y + 7}" text-anchor="middle">${type}</text><text class="device-name" x="${horizontal ? x : leftLabel ? x - 36 : x + 36}" y="${horizontal ? (y < 50 ? y + 38 : y - 36) : y + 5}" text-anchor="${horizontal ? "middle" : leftLabel ? "end" : "start"}">${name}</text></g>`;
}
export function schematic(
  spec,
  wires,
  {
    selected = null,
    powered = false,
    kind = "R",
    figure = 3,
    loadOpen = true,
  } = {},
) {
  const actual = wireGeometry(spec, wires),
    reference = wireGeometry(spec, suggestedWires(spec));
  const valid = validateCircuit(spec, wires),
    next = valid.missing?.[0] || [],
    connected = new Set(wires.flat());
  let devices = `<g class="schematic-device"><circle cx="60" cy="205" r="24"/><path d="M60 90V181M60 229V320M44 205c5-15 11-15 16 0s11 15 16 0"/><text class="device-name schematic-caption-name" x="60" y="362" text-anchor="middle">AC source</text><path d="M365 90V145 ${coil(365, 145)} M365 265V320 M425 90V145 ${coil(425, 145, 6, 1)} M425 265V320 M390 143V267M400 143V267"/><text class="device-name schematic-caption-name" x="395" y="362" text-anchor="middle">Transformer</text></g>`;
  if (spec.sat)
    devices += `<g class="schematic-device"><path d="M160 90h10v-8h60v16h-60v-8M230 90h10M160 40h16M224 40h16"/><text class="device-name" x="200" y="129" text-anchor="middle">R = 400 Ω</text></g>${meter(200, 40, "E1", "V", true)}${meter(280, 215, "E2", "V", false, true)}${meter(610, 215, "E3", "V")}`;
  else {
    devices += `${meter(190, 90, "I1", "A", true)}${meter(spec.short || spec.load ? 280 : 125, 215, "E1", "V", false, spec.short || spec.load)}`;
    if (spec.short) devices += meter(580, 215, "I2", "A");
    else if (spec.load) {
      const load =
        kind === "L"
          ? `M730 185V195 ${coil(730, 195, 3, 1)} M730 255V280`
          : kind === "C"
            ? "M730 185V214M710 214H750M710 232H750M730 232V280"
            : "M730 185V205h-9v49h18v-49h-9M730 254V280";
      const loadSwitch = `<path d="M730 150V165 ${loadOpen ? "M730 165l17 13" : "M730 165V185"}"/><circle cx="730" cy="165" r="2.5"/><circle cx="730" cy="185" r="2.5"/>`;
      devices += `${meter(570, 90, "I2", "A", true)}${meter(610, 215, "E2", "V")}<g class="schematic-device" data-load-switch="${loadOpen ? "open" : "closed"}">${loadSwitch}<path d="${load}"/><text class="device-name" x="766" y="230">${kind}</text>${loadOpen ? '<text class="switch-label" x="760" y="178">Open</text>' : ""}</g>`;
    } else devices += meter(570, 215, "E2", "V");
  }
  const description = spec.sat
    ? `Figure 5: source and 400 ohm resistor in series with winding 6–9. E1 across the resistor, E2 across 6–9, E3 across the open winding 4–8.`
    : spec.short
      ? `Figure 4: source through I1 into winding 1–2. E1 is across primary winding 1–2. I2 short-circuits winding ${spec.pair.join("–")}.`
      : spec.load
        ? `Figure 7: I1 in series with primary 1–2, E1 across that winding. I2 in series with the ${kind} load bank on winding 5–6, E2 across the load. Load switch ${loadOpen ? "open" : "closed"}.`
        : `Figure 3: source through I1 into winding 1–2. E1 across the source, E2 across open secondary ${spec.pair.join("–")}.`;
  const paths = actual
    .map(
      (g) =>
        `<path class="schematic-wire ${g.netIndex < 0 ? "invalid-wire" : ""}" d="${g.path}"/>`,
    )
    .join("");
  const dots = junctions(actual)
    .map(([x, y]) => `<circle class="junction" cx="${x}" cy="${y}" r="3.5"/>`)
    .join("");
  return `<div class="schematic-scroll"><div class="circuit-viewport" role="group" aria-label="Figure ${figure}. Click two terminals to connect a lead."><svg viewBox="0 0 810 380" role="img" aria-label="${esc(description)}"><g class="reference-wires">${reference.map((g) => `<path d="${g.path}"/>`).join("")}</g>${paths}${dots}${devices}</svg>${spec.nodes.map((n) => `<button class="terminal ${connected.has(n.key) ? "connected" : ""} ${selected === n.key ? "selected" : ""} ${!selected && next.includes(n.key) ? "next" : ""}" style="left:${(n.x / 810) * 100}%;top:${(n.y / 380) * 100}%" data-terminal="${n.key}" aria-label="${esc(n.group + ": " + n.label)}" aria-pressed="${selected === n.key}" ${powered ? "disabled" : ""}><span class="terminal-label ${n.key.startsWith("T") || ["S", "N"].includes(n.key) ? (n.y === 320 ? "bus-bottom" : "bus-top") : n.key.startsWith("E") || n.key.startsWith("L") ? "probe-label" : n.key.startsWith("I") ? "bus-top" : ""}">${esc(/[+-]$/.test(n.key) ? (n.key.endsWith("+") ? "+" : "−") : n.key)}</span></button>`).join("")}</div></div>`;
}
