# Physics, evidence and uncertainty

## Provenance
- **Manual:** ENEL3109 Experiment 1, supplied nine-page PDF (printed pp.5–13). Figures3/4 use primary1–2, Figure5 uses primary6–9 and secondary4–8, Figure7 loads5–6. N12=N56=500; N34=865. R sense=400 Ω. E2 sweep20…240 V. Load labels∞,4800,2400,1600,1200,960 Ω. Source240 V, short target0.2 A.
- **Observed:** supplied handwritten photographs. Full transcription, uncertainty and effective impedance analysis in `audit/OBSERVATIONS.md`. No measured excitation sweep or B–H data supplied.
- **Estimated:** frequency50 Hz, winding impedances, taps, core parameters below. Not manufacturer specifications. Observations weakly constrain them; no unique parameter identification is possible.
- **Simulated:** every live reading and exported student record. Deterministic, no added noise. The legacy CSV is also simulated, not calibration data.

## Research and model selection
The manual itself specifies the ideal transformer plus series resistance/reactance equivalent circuit. External background consulted: [Transformer — theory, equivalent circuit, leakage flux, EMF equation](https://en.wikipedia.org/wiki/Transformer) (retrieved during implementation, 2026-10-16 environment). Its equivalent-circuit discussion supports copper-loss resistances, series leakage reactance, and shunt magnetizing/core-loss branches. Its Faraday-law discussion supports induced voltage proportional to turns and frequency. This is background theory, not a source for this module’s numeric characteristics. Public reference fetched successfully; Monid discovery lacked an API key, so no paid endpoint was used. No library adds scientific value for this small deterministic model.

## Complex equivalent circuit
All voltage/current magnitudes are RMS. Let n=NS/NP, j²=−1.

```
Z1 = (50 + j65)(NP/500)² Ω
Z2 = (50 + j65)(NS/500)² Ω
ZL = R, jXL, or −jXC; open ⇒ no branch; short ⇒ ZL=0
YL,primary = n²/(Z2+ZL)
I2 = n Ec/(Z2+ZL)
V2 = ZL I2     [open: V2=n Ec]
I1,fund = Iexc,fund + n I2
V1,fund = Ec + Z1 I1,fund
```

Load labels are effective resistance/reactance by default. The explicit photo-hypothesis option uses ZL magnitude=label/3. At50 Hz, L=XL/(2π50), C=1/(2π50XC). Ideal meters have zero ammeter impedance and infinite voltmeter impedance.

For normal full windings, combined series impedance≈100+j130 Ω. This predicts a short-circuit voltage≈32.8 V at0.2 A for1:1, versus photographed apparent27.9 V (≈18% high, uncertain handwriting). This is a documented mismatch, not a fit hidden as truth. Parameters were selected as broad order-of-magnitude estimates balancing short test and load trends. They are not least-squares-fitted or independently measured.

## Nonlinear excitation without a fabricated knee
Normalize alternating core flux using p=|Ec|/[240(NP/500)] at the fixed assumed frequency. Define θ through a sinusoidal core flux. The memoryless odd constitutive law is:

```
i_mag(θ) = √2(500/NP)[0.010 p cosθ + 0.0006 s (p cosθ)^9] A
Icore = |Ec| (1/80000)(500/NP)² A, in phase with Ec
```

s=1 reference; exposed sensitivity options0.5 and1.25. The smooth positive odd polynomial gives increasing inverse permeability at high flux; no fixed saturation threshold is asserted. These coefficients are illustrative, not measured material properties. No coercivity/hysteresis loop is modelled. Since E∝NfΦ, driving the estimated half winding6–9 at240 V gives approximately twice its nominal flux excitation. Nominal half-winding120 V is inferred from a240 V whole winding, not a measured onset of saturation.

Numerical quadrature (256 equally spaced θ samples) obtains magnetizing RMS, reactive fundamental and residual harmonic RMS. In phase convention Ec real, Iexc,fund=Icore−jIq. For a candidate |Ec|, solve:

```
Yexc = (Icore−jIq)/|Ec|
D = 1 + (Z1+Rsense)(Yexc+YL,primary)
Vsupply,RMS² = (|Ec||D|)² + [(R1+Rsense) Ih]²
arg(Ec) = −arg(D)
```

Bisection (80 iterations) solves the positive scalar core magnitude. Only resistive harmonic drop is retained; leakage-reactance effects on each harmonic and full distorted-waveform feedback are omitted. This is a fundamental/harmonic-RMS approximation, not a transient nonlinear circuit solver. At strong saturation numeric predictions have substantial unquantified uncertainty. It is suitable for qualitative instruction, not equipment qualification.

```
V1,RMS = hypot(|V1,fund|, R1 Ih)
I1,RMS = hypot(|I1,fund|, Ih)
E1,sense = 400 I1,RMS
I0 = E1/400
E2 = V1,RMS; E3 = |n Ec|
```

Figure5 source is adjustable, not E2. The virtual range extends to300 V to reach the final winding setpoint despite the400 Ω sense drop. This extension is explicitly a teaching affordance, not a claim about actual EMS supply capability. Source-side harmonics can distort real voltages; this model assumes sinusoidal core voltage. Do not interpret the strongest-saturation rows as calibrated predictions.

## Energy and losses
Pout=Re(V2 conj(I2)); Pcore=|Ec|Icore; Pcopper=R1 I1,RMS²+R2 |I2|². Primary input power uses the fundamental phasors plus R1 Ih². The computed transformer power balance is exact within this approximate model. The sense resistor, when present, dissipates400 I0² separately. Reactive loads have zero real output power in this ideal bank model; real inductors/capacitors may have losses. Short-circuit terminal voltage is zero on the shorted secondary.

## Tap assumptions
N37=440,N78=310,N84=115 sum to865. These reflect rough relative proportions of photographed voltages211.9 (inferred),148.5,54.6 V, not authoritative panel ratings. N59=N96=250 follows nearly equal photographed117/117.2 V. N48=115 gives ratio115/250=.46 for Figure5; the legacy.467 is not a known turns ratio. Dots/polarity are not investigated by this manual; only same-winding magnitude measurements are exposed.

## Regulation convention
The manual explicitly uses100(ENL−EFL)/ENL. The walkthrough automatically shows that convention with the recorded ENL/EFL substituted. The common textbook denominator EFL remains an independently tested physics-helper option, but is not an extra choice imposed on the student. Minimum-R row is the requested “full-load” point; nominal winding current is unavailable, so the app does not claim a rated-current test. Negative capacitive regulation denotes voltage rise.

## Validation and known mismatch
Automated tests verify zero input, winding ratios, complex Ohm law, energy balance, current ratios, smooth superlinear excitation, sense RMS, all E2 sweep setpoints, load trends including capacitive turnover outside the table, both regulation conventions, circuit connectivity, workflow record gating and export restoration. Independent scalar check:240×960/√(1060²+130²)≈215.7 V (neglecting excitation), agreeing within1 V with the full model.

Photograph checks are approximate, not pass/fail calibration claims: no-load current≈12 mA and near240 V for a1:1 coil are compatible;415 V at measured235.3 V implies a ratio1.764 vs manual1.73 (≈2% discrepancy). Standard-load simulation does NOT reproduce photographed load drops/current; the explicitZ/3 hypothesis brings effective impedances into alignment and broadly captures trends. Open-secondary photographed≈7–8 mA cannot be a true load current in an ideal open circuit; no fake leakage is introduced to match it. Capacitive final current may be meter-clipped at1 A. Full numerical comparison is generated in `docs/VALIDATION.md` by `node scripts/validate.js`.

## Guided operation and worked results
`walkthrough.js` solves the required source voltage from the same model: bisection for ISEC=0.2 A, and the inverse primary-voltage solve for each Figure5 target. This operates the virtual source; it does not insert canned answers into tables. Recording remains an explicit action. `results.js` derives arithmetic, error comparisons, saturation slopes and interpretations from recorded readings; incomplete/mixed endpoint data do not yield fabricated regulation results. Display values are rounded, while calculations retain full precision. Manual operating controls remain optional. Drawing changes use the same validated electrical nets; the load-bank symbol is open when the modeled load is open.

## Limits
No known exact ratings, tolerances, measured B–H loop, parasitics, thermal model, inrush, source impedance, mechanical equipment installation, or physical mains wiring. A virtual0.45 A primary short-test trip and80 V short range are software limits, NOT module safety ratings. Only circuits in the manual may energize. Do not transfer virtual settings or safety limits to live equipment.
