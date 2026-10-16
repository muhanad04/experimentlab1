# Lab-Volt / Festo source audit

## Sources actually retrieved and read
1. **Festo Didactic 30328-00, Power Circuits and Transformers, Student Manual**: https://lvsim.labvolt.com/Manuals/8006-1/30328_00.pdf . Consulted printed pp.237–247 (ratios/excitation),257–262 (regulation),329–332 (load tables). Appendix B Table B-1 and Figure B-1 were also rendered and inspected because extracted table columns were ambiguous.
2. **LVSIM-EMS Help**, equipment descriptions printed pp.25–28: https://lvsim.labvolt.com/help/helpEms.pdf . Confirms three identical sections of three elements each for resistive, inductive and capacitive modules; transformer8341 has three discrete windings with taps.
3. Public manufacturer catalog search listings identify 8311-0A240 V/50 Hz as1200/2400/4800 Ω per bank, nominal240 V, resistor accuracy±5%. Full datasheet retrieval redirected to an access-denied Festo page; these search excerpts are corroborating discovery only, not a source for newly asserted numeric winding parameters. Direct Festo product-page/datasheet requests were not readable in this environment. The two original PDFs above were readable in full.

No scraped original PDF/images are redistributed. Local research copies are under gitignored `.tmp/research/`. Sources above are linked in the application/reference and report.

## Confirmed bank interpretation
Table B-1,240 V/50 Hz:

| Effective setting Ω | Switches ON (one section) | Calculation |
|---|---|---|
|∞|none|open|
|4800|1|4800|
|2400|2|2400|
|1600|1,2|1/(1/4800+1/2400)|
|1200|3|1200|
|960|1,3|1/(1/4800+1/1200)|

Switches4–6 and7–9 repeat the same three elements. Figure B-1 shows sections interconnected in parallel; the table still lists **effective impedance for the selected individual switches**, not a value that must always be divided by three. Example: switches1,4,7 give4800/3=1600 Ω. Three identically switched sections give label/3, which is physically realizable, but not proven to be the photographed lab's actual connection.

**Resolution:** retain manual effective values as default. Add explicit documented element/switch arithmetic; name the optional alternative “three identical sections in parallel — photo hypothesis”. Do not silently divide the table or claim the photos are validated. At the photographed4800 row,227.7/.144≈1581 Ω, consistent with that hypothesis; nonideal elements/meter errors remain possible.

## Transformer impedance audit
The original manual describes series R+jX and tests to determine it; it does NOT specify this exact unit's winding resistance or leakage reactance. Current simulation uses each500-turn winding50+j65 Ω, referred with turns². Combined1:1 impedance≈100+j130 Ω, magnitude164 Ω. The apparent photographed27.9 V/.2 A gives139.5 Ω; disagreement≈18%. One short test yields magnitude only, not unique R/X. Therefore do not tune both to a single ambiguous reading or call current parameters manufacturer data.

Turns² scaling is an equivalent-circuit estimate, not proof that physical DC resistance of a partial tap scales quadratically. A valid replacement requires DC resistance, short-circuit voltage/current/**power**, selected winding pair and frequency. Needed: Req=Psc/Isc², |Zeq|=Vsc/Isc, Xeq=√(|Zeq|²−Req²), with all values referred to the same side. No such complete observations were supplied or found. Retain explicit uncertainty and expose the equivalent-circuit working.

## Other distinctions retained
-240 V/50 Hz bank values are appropriate for the supplied manual.120 V/60 Hz equipment has different elements; model numbers alone are insufficient to identify a voltage variant.
-|Z|=V/I is impedance magnitude, **not resistance** for reactive loads. ZR=R, ZL=jωL, ZC=−j/(ωC). Show phase and units.
-Manual regulation uses ENL denominator; source manual does too. Do not swap to the textbook EFL denominator without explanation.
-Core knee, tap counts beyond manual-supported full windings, virtual source headroom and software trips remain estimates/teaching affordances, not newly authenticated hardware ratings.
