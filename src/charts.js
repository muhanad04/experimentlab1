import { escapeHTML as esc } from "./notebook.js";
export const COLORS = {
  resistive: "#245cce",
  inductive: "#a06316",
  capacitive: "#167c67",
  saturation: "#245cce",
};
export function chart(series, xlabel, ylabel, { interactive = false } = {}) {
  const points = series
    .flatMap((s) => s.points)
    .filter((p) => p.slice(0, 2).every(Number.isFinite));
  if (!points.length)
    return '<div class="empty-state"><strong>Your graph starts with your measurements.</strong><p>Record at least two points at the bench. No readings are prefilled.</p></div>';
  const W = 760,
    H = 340,
    L = 65,
    R = 24,
    T = 18,
    B = 58;
  const xmax = Math.max(...points.map((p) => p[0]), 0.001) * 1.12,
    ymax = Math.max(...points.map((p) => p[1]), 1) * 1.12;
  const px = (x) => L + (x / xmax) * (W - L - R),
    py = (y) => H - B - (y / ymax) * (H - T - B);
  let content = "";
  for (let i = 0; i <= 5; i++) {
    const x = (xmax * i) / 5,
      y = (ymax * i) / 5;
    const fmt = (v) =>
      v >= 100
        ? v.toFixed(0)
        : v >= 10
          ? v.toFixed(1)
          : v >= 1
            ? v.toFixed(2)
            : v.toFixed(3);
    content += `<path d="M${px(x)} ${T}V${H - B}M${L} ${py(y)}H${W - R}" stroke="#e2e8ef" fill="none"/><text x="${px(x)}" y="${H - B + 22}" text-anchor="middle">${fmt(x)}</text><text x="${L - 10}" y="${py(y) + 4}" text-anchor="end">${fmt(y)}</text>`;
  }
  content += `<path d="M${L} ${T}V${H - B}H${W - R}" fill="none" stroke="#8191a5"/><text x="${(W + L - R) / 2}" y="${H - 9}" text-anchor="middle">${esc(xlabel)}</text><text transform="translate(15 ${(H - B + T) / 2}) rotate(-90)" text-anchor="middle">${esc(ylabel)}</text>`;
  for (const [seriesIndex, s] of series.entries()) {
    const p = [...s.points]
      .filter((p) => p.slice(0, 2).every(Number.isFinite))
      .sort((a, b) => a[0] - b[0]);
    content += `<g data-chart-series="${seriesIndex}"><polyline points="${p.map(([x, y]) => `${px(x)},${py(y)}`).join(" ")}" fill="none" stroke="${s.color}" stroke-width="2.5"/>`;
    for (const [x, y, detail] of p) {
      const description = `${s.name}: ${xlabel} = ${x.toPrecision(6)}; ${ylabel} = ${y.toPrecision(6)}${detail ? " · " + detail : ""}`;
      content += `<circle class="chart-point" ${interactive ? `tabindex="0" role="button" data-chart-point="${esc(description)}" aria-label="${esc(description)}"` : ""} cx="${px(x)}" cy="${py(y)}" r="5" fill="white" stroke="${s.color}" stroke-width="2"><title>${esc(description)}</title></circle>`;
    }
    content += "</g>";
  }
  return `<svg id="measurement-chart" class="chart" viewBox="0 0 ${W} ${H}" role="${interactive ? "group" : "img"}" aria-label="Recorded simulated measurements: ${esc(ylabel)} against ${esc(xlabel)}"><title>${esc(ylabel)} against ${esc(xlabel)}</title>${content}</svg><div class="legend">${series.map((s, i) => (interactive ? `<button type="button" data-toggle-series="${i}" aria-pressed="true"><i style="background:${s.color}"></i>${esc(s.name)} · ${s.points.length} points</button>` : `<span><i style="background:${s.color}"></i>${esc(s.name)} · ${s.points.length} points</span>`)).join("")}</div>${interactive ? '<p class="chart-inspector" role="status">Select a point (mouse, touch or keyboard) to inspect its recorded values. Use the legend to show or hide a curve.</p>' : ""}`;
}
