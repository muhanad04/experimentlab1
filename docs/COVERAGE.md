# Experiment coverage contract
Manual audited in full: 9 pages (printed pp.5–13), including all diagrams and tables. Extract: `audit/manual.txt`; original assets remain in `../../source` and are not redistributed. Implementation IDs below are stable experiment IDs. Verification is tracked in PROGRESS, not inferred from this checklist.

| Manual steps | Implementation / student action |
|---|---|
| I.1–2 | Preset installed modules; OFF, zero supply, 4–N metering described; virtual wall supply implicit |
| I.3–4 Fig.3 | `voltage`: wire source, I1, E1, E2; energize 240 V; probe all seven secondary pairs and primary; record IPRI and voltage; zero then OFF |
| I.5 | Automatic voltage verification; distinguish absent panel ratings |
| I.6–7 | Automatic 500/500, 500/865 arithmetic with substituted recorded voltage ratios and percentage difference |
| I.8–11 Fig.4 | `short56`: series I2 short across 5–6, raise low supply to ISEC≈0.2 A; record EPRI/IPRI/ISEC, zero/OFF, current ratio and comparison |
| I.12–13 Fig.4 | `short34`: repeat for 3–4; worked inverse turns ratio and automatic comparison |
| I.14–16 Fig.5 | `saturation`: 400 Ω sense resistor, primary 6–9, secondary 4–8, E1/E2/E3; acquire E2=20…240 in 20 V steps, zero/OFF |
| I.17–19 | Recorded E1 horizontal/E2 vertical graph; worked early/late current-growth rates, automatic saturation explanation and first/last voltage-ratio comparison |
| I.20 | zero/OFF/remove leads; explicit finish action |
| II.1–3 Fig.7 | `resistive`: preset modules, open load; wire I1/I2 series, E1/E2 parallel |
| II.4–5 | 240 V, record no-load and 4800/2400/1600/1200/960 Ω; load-bank controls; zero/OFF |
| II.6 Q1 | Recorded VSEC vs ISEC plot and automatic voltage-change explanation |
| II.7 | Regulation from no-load and minimum-R records; manual denominator ENL, textbook denominator EFL shown separately |
| II.8–10 | `inductive`: replace module while OFF/zero, same six setpoints, table 3 |
| II.11 Q2 | Inductive recorded curve and automatic interpretation |
| II.12–14 | `capacitive`: replace module while OFF/zero, same six setpoints, table 4 |
| II.15 Q3–4 | Capacitive recorded curve; three-load overlay and computed comparison |
| II.16 | zero/OFF/remove leads |

Current UI: all questions are addressed by automatic worked results and observations, with no calculation-entry or written-answer fields. Formula, substituted values and result are shown; records remain in the current page only and explicit exports regenerate the math. Refresh clears the experiment. Legacy entered answers remain compatible in JSON but are not requested. Graphs use recorded data only (never prefilled model curves). The next-action walkthrough handles connection, source adjustment and next-target selection; only Record captures a measurement. Optional manual controls remain. Figure 3 step 7 references measured values in “step 6”; measurements actually occur in step 4. Figure 5 prose says supply 4/5 while initial setup says 4–N; source output is shown generically as S/N and ambiguity disclosed. Physical mains connection and installing heavy equipment are represented, not interactive mains procedures.
