// Deterministic RMS/fundamental equivalent circuit. No DOM or measured-answer lookup.
export const PARAMETERS = Object.freeze({
  frequency: 50,
  r500: 50,
  x500: 65,
  coreConductance: 1 / 80000,
  linearMagA: 0.01,
  nonlinearMagA: 0.0006,
  exponent: 9,
  model: "equivalent-circuit-v1",
});
export const c = (re = 0, im = 0) => ({ re, im });
export const add = (a, b) => c(a.re + b.re, a.im + b.im);
export const mul = (a, b) =>
  c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const scale = (a, k) => c(a.re * k, a.im * k);
export const abs = (a) => Math.hypot(a.re, a.im);
export const div = (a, b) => {
  const d = b.re * b.re + b.im * b.im;
  return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
export const WINDINGS = Object.freeze({
  "1-2": 500,
  "3-4": 865,
  "5-6": 500,
  "3-7": 440,
  "7-8": 310,
  "8-4": 115,
  "5-9": 250,
  "9-6": 250,
  "6-9": 250,
  "4-8": 115,
});
export const LOADS = [null, 4800, 2400, 1600, 1200, 960];
const impedance = (n) =>
  scale(c(PARAMETERS.r500, PARAMETERS.x500), (n / 500) ** 2);
// Normalized flux follows cos(theta); i(phi)=a*phi+b*phi^9 is smooth and passive.
// RMS and fundamental are integrated, retaining harmonic RMS in sense-resistor readings.
export function excitation(volts, turns = 500, nonlinearScale = 1) {
  const p = volts / ((240 * turns) / 500),
    k = 500 / turns;
  let square = 0,
    proj = 0;
  const count = 256;
  for (let j = 0; j < count; j++) {
    const co = Math.cos((2 * Math.PI * j) / count);
    const i =
      Math.SQRT2 *
      k *
      (PARAMETERS.linearMagA * p * co +
        PARAMETERS.nonlinearMagA * nonlinearScale * (p * co) ** 9);
    square += (i * i) / count;
    proj += (i * Math.SQRT2 * co) / count;
  }
  const loss = volts * PARAMETERS.coreConductance * k * k;
  return {
    loss,
    reactive: proj,
    harmonic: Math.sqrt(Math.max(0, square - proj * proj)),
    rms: Math.sqrt(square + loss * loss),
  };
}
export function simulate({
  voltage = 0,
  primary = 500,
  secondary = 500,
  kind = "R",
  load = null,
  parallel = 1,
  sense = 0,
  nonlinearScale = 1,
} = {}) {
  if (
    !Number.isFinite(voltage) ||
    voltage < 0 ||
    voltage > 300 ||
    !Number.isFinite(primary) ||
    primary <= 0 ||
    !Number.isFinite(secondary) ||
    secondary <= 0 ||
    ![1, 3].includes(parallel) ||
    !["R", "L", "C", "short"].includes(kind) ||
    !(load === null || (Number.isFinite(load) && load > 0)) ||
    !Number.isFinite(nonlinearScale) ||
    nonlinearScale < 0 ||
    nonlinearScale > 4 ||
    !Number.isFinite(sense) ||
    sense < 0
  )
    throw new RangeError("Invalid model input");
  const n = secondary / primary,
    z1 = impedance(primary),
    z2 = impedance(secondary),
    zs = add(z1, c(sense));
  const effective = load === null ? null : load / parallel;
  const zl =
    kind === "short"
      ? c()
      : effective === null
        ? null
        : kind === "R"
          ? c(effective)
          : c(0, kind === "L" ? effective : -effective);
  const branch = zl === null ? c() : scale(div(c(1), add(z2, zl)), n * n);
  function state(u) {
    const ex = excitation(u, primary, nonlinearScale);
    const ym = u ? c(ex.loss / u, -ex.reactive / u) : c();
    const d = add(c(1), mul(zs, add(ym, branch)));
    return { ex, d, input: Math.hypot(u * abs(d), zs.re * ex.harmonic) };
  }
  let low = 0,
    high = Math.max(1, voltage * 4);
  if (voltage > 0) {
    for (let i = 0; i < 80; i++) {
      let mid = (low + high) / 2;
      if (state(mid).input > voltage) high = mid;
      else low = mid;
    }
  }
  const core = voltage === 0 ? 0 : (low + high) / 2,
    { ex, d } = state(core);
  const phase = -Math.atan2(d.im, d.re),
    vcore = c(core * Math.cos(phase), core * Math.sin(phase));
  const imag = mul(
    c(ex.loss, -ex.reactive),
    c(Math.cos(phase), Math.sin(phase)),
  );
  const isec = zl === null ? c() : div(scale(vcore, n), add(z2, zl));
  const ipri = add(imag, scale(isec, n));
  const vp = add(vcore, mul(z1, ipri)),
    vs = zl === null ? scale(vcore, n) : mul(isec, zl);
  const epri = Math.hypot(abs(vp), z1.re * ex.harmonic),
    esec = abs(vs),
    i2 = abs(isec),
    i1 = Math.hypot(abs(ipri), ex.harmonic);
  const senseV = sense * i1;
  const watts = vp.re * ipri.re + vp.im * ipri.im + z1.re * ex.harmonic ** 2;
  const output = vs.re * isec.re + vs.im * isec.im;
  return {
    supply: voltage,
    epri,
    esec,
    ipri: i1,
    isec: i2,
    e1: senseV,
    e2: epri,
    e3: esec,
    i0: i1,
    core,
    effective,
    phaseDegrees: (Math.atan2(isec.im, isec.re) * 180) / Math.PI,
    powerFactor: i2 ? output / (esec * i2 || 1) : null,
    inputWatts: watts,
    outputWatts: output,
    copperWatts: z1.re * i1 * i1 + z2.re * i2 * i2,
    coreWatts: core * ex.loss,
    phasors: {
      primary: vp,
      secondary: vs,
      primaryCurrent: ipri,
      secondaryCurrent: isec,
    },
    harmonicA: ex.harmonic,
  };
}
export function regulation(noload, loaded, denominator = "manual") {
  const d = denominator === "manual" ? noload : loaded;
  return d > 0 ? (100 * (noload - loaded)) / d : null;
}
export function supplyForPrimary(target, options = {}) {
  let lo = 0,
    hi = 300;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (simulate({ ...options, voltage: m }).epri > target) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}
