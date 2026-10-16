import { escapeHTML as esc } from "./notebook.js";
export function reportDocument(sections, comparison = "") {
  const populated = sections.filter((s) => s.count > 0);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>labo — Transformer experiment report</title><style>
@page{size:A4;margin:12mm 13mm 14mm}*{box-sizing:border-box}body{font:9pt/1.35 Arial,Helvetica,sans-serif;color:#172333;background:white;max-width:182mm;margin:18px auto;padding:0 10px}h1{font-size:22pt;margin:0 0 8px}h2{font-size:16pt;margin:0 0 10px}h3{font-size:11pt;margin:12px 0 5px}p{margin:7px 0 12px}.provenance,.report-meta{font-size:9pt;color:#45566b}.report-section{margin-top:30px}.report-block{margin:12px 0}.math-block{display:block}.math-block .worked-step{display:inline-block;vertical-align:top;width:48%;margin:6px 1%}.math-block p{font-size:8pt}table{width:100%;border-collapse:collapse;font-size:8pt;font-variant-numeric:tabular-nums}caption{text-align:left;font-size:9pt;margin-bottom:6px}th,td{text-align:right;padding:4px;border-bottom:1px solid #cfd8e3}th:first-child{text-align:left}th{background:#edf1f5}thead{display:table-header-group}tr{break-inside:avoid}.worked-step{margin:13px 0;padding-top:8px;border-top:1px solid #d5dde6;break-inside:avoid}.math-formula,.math-substitution,.math-result{font:8pt/1.5 Consolas,monospace;overflow-wrap:anywhere}.math-result{font-weight:bold;color:#203f75}.worked-step p{font-size:9pt}.chart{display:block;width:100%;height:auto;max-height:50mm}.chart text{font:12px Arial,sans-serif;fill:#42536a}.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:8pt}.legend i{display:inline-block;width:13px;height:3px;margin:0 5px 2px 0}.report-circuit{width:100%;height:auto;max-height:40mm}.report-circuit .schematic-device path{fill:none;stroke:#27364a;stroke-width:1.8}.report-circuit .schematic-device circle{fill:white;stroke:#27364a;stroke-width:1.8}.report-circuit .schematic-device text{fill:#27364a;font:14px Arial}.report-circuit .schematic-device .meter-symbol{font-size:22px}.report-circuit .schematic-wire{fill:none;stroke:#27364a;stroke-width:1.8}.report-circuit .reference-wires{display:none}.report-circuit .junction{fill:#27364a}.report-circuit .print-pin{font:12px Arial;fill:#27364a}.report-circuit .switch-label{font:12px Arial;fill:#45566b}.warning{border:1px solid #cba565;padding:8px;font-size:9pt}.empty-state{font-size:9pt;color:#45566b}.observations p{font-size:9pt}.observations{break-inside:avoid}a{color:inherit}.comparison{margin-top:25px}details>summary{display:none}details>*{display:block}
@media print{body{margin:0;padding:0;max-width:none}.report-section{margin-top:22px;border-top:1px solid #cfd8e3;padding-top:15px;break-before:auto}.report-section:first-of-type{border-top:0;padding-top:0}.report-block.graph-block,.report-block.circuit-block{break-inside:avoid}.comparison{break-before:auto}h2,h3{break-after:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><h1>Single-phase transformer</h1><p class="report-meta">labo · Experiment results · ${new Date().toISOString().slice(0, 10)} · ${populated.reduce((sum, s) => sum + s.count, 0)} recorded readings</p><p class="provenance">These measurements are computed simulations, not physically validated results. Calculations retain full precision; printed numbers are rounded. Missing readings are not fabricated.</p>${populated.length ? populated.map((s) => `<section class="report-section"><h2>${esc(s.title)}</h2>${s.html}</section>`).join("") : "<p>No readings recorded. Complete a measurement before exporting a report.</p>"}${comparison ? `<section class="comparison"><h2>Load-curve comparison</h2>${comparison}</section>` : ""}<p class="provenance">Model equivalent-circuit-v1: assumed50 Hz; each500-turn winding50+j65 Ω, estimated. Taps and nonlinear core law include estimates; no measured B–H curve was supplied. Regulation uses100(ENL−EFL)/ENL. A minimum-impedance row is not proof of rated current. Load switch combinations follow Festo Didactic30328-00, Appendix B (240 V/50 Hz). See the application Reference for sources and limitations.</p></body></html>`.replaceAll(
    'id="measurement-chart"',
    "",
  );
}

// In-page preview avoids popup blocking and document.write/print timing races.
// Printing is user-triggered only after the iframe has fully loaded.
export function openReport(html, detailedHTML = null) {
  document.querySelector("#report-preview")?.remove();
  const previous = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.id = "report-preview";
  dialog.className = "report-preview";
  dialog.setAttribute("aria-labelledby", "report-preview-title");
  dialog.innerHTML =
    '<div class="report-toolbar"><div><h2 id="report-preview-title">Export report</h2><p>Select “Save as PDF” in the print dialog. A4 layout; only recorded experiments are included.</p></div><label class="report-detail-toggle"><input type="checkbox" data-report-details> Include model derivations</label><button data-report-print class="primary" disabled>Preparing…</button><button data-report-close>Close</button></div><iframe title="Print-ready experiment report"></iframe>';
  document.body.append(dialog);
  const frame = dialog.querySelector("iframe"),
    print = dialog.querySelector("[data-report-print]"),
    close = dialog.querySelector("[data-report-close]");
  frame.addEventListener("load", async () => {
    await frame.contentDocument.fonts.ready;
    if (!dialog.isConnected) return;
    print.disabled = false;
    print.textContent = "Print / save PDF";
  });
  frame.srcdoc = html;
  const details = dialog.querySelector("[data-report-details]");
  details.disabled = !detailedHTML;
  details.addEventListener("change", () => {
    print.disabled = true;
    print.textContent = "Preparing…";
    frame.srcdoc = details.checked ? detailedHTML : html;
  });
  print.addEventListener("click", () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  });
  dialog.showModal();
  close.focus();
}
