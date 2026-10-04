"use strict";
(() => {
const defaults = {
  kp: 2.4, ki: 0.12, kd: 4, derivativeFilter: 0.25, derivativeSource: 'measurement', ambient: 25, heating: 18, loss: 0.012, lag: 1.5, delay: 0.5, cooldown: 30,
  stages: [{ target: 450, rate: 8, hold: 20 }, { target: 800, rate: 5, hold: 30 }]
};
function makeProfile(config) {
  let time = 0, temperature = config.ambient;
  const segments = [];
  for (const [index, stage] of config.stages.entries()) {
    const duration = Math.abs(stage.target - temperature) / stage.rate;
    if (duration > 0) segments.push({ start: time, end: time + duration, from: temperature, to: stage.target, name: `Ramp ${index + 1}`, kind: 'ramp' });
    time += duration;
    if (stage.hold > 0) segments.push({ start: time, end: time + stage.hold, from: stage.target, to: stage.target, name: `Hold ${index + 1}`, kind: 'hold' });
    time += stage.hold;
    temperature = stage.target;
  }
  const processEnd = time;
  if (config.cooldown > 0) segments.push({ start: time, end: time + config.cooldown, from: config.ambient, to: config.ambient, name: 'Cool down', kind: 'cool' });
  return { segments, duration: time + config.cooldown, processEnd };
}
function controllerParameters(config) {
  if (config.controllerForm !== undefined && !['parallel', 'time'].includes(config.controllerForm)) throw new Error('Invalid controller form.');
  const source = config.derivativeSource ?? 'measurement';
  if (!['measurement', 'error'].includes(source)) throw new Error('Invalid derivative source.');
  if (!Number.isFinite(config.kp) || config.kp < 0) throw new Error('Invalid proportional gain.');
  if (config.controllerForm === 'time') {
    if (!Number.isFinite(config.tn) || config.tn <= 0) throw new Error('Tn must be a positive time; use Integral enabled to turn I off.');
    if (!Number.isFinite(config.tv) || config.tv < 0 || !Number.isFinite(config.td) || config.td < 0) throw new Error('Tv and Td must be nonnegative times.');
    return { kp: config.kp, ki: config.integralEnabled === false ? 0 : config.kp / config.tn, kd: config.kp * config.tv, filter: config.td, source };
  }
  const filter = config.derivativeFilter ?? 0.25;
  if (!Number.isFinite(filter) || filter < 0 || !Number.isFinite(config.ki) || config.ki < 0 || !Number.isFinite(config.kd) || config.kd < 0) throw new Error('Invalid integral gain, derivative gain or filter time.');
  return { kp: config.kp, ki: config.ki, kd: config.kd, filter, source };
}
function filteredDerivative(previous, slope, dt, filter) {
  return filter === 0 ? slope : previous + (slope - previous) * (1 - Math.exp(-dt / filter));
}
function simulate(config, dt = 0.05) {
  const controller = controllerParameters(config);
  for (const key of ['ambient', 'heating', 'loss', 'lag', 'delay', 'cooldown']) {
    if (!Number.isFinite(config[key]) || (key !== 'ambient' && config[key] < 0)) throw new Error(`Invalid ${key}`);
  }
  if (config.heating <= 0 || config.lag < 0.05 || dt <= 0 || !Number.isFinite(dt)) throw new Error('Heating, thermal lag and time step must be positive.');
  if (!config.stages.length || config.stages.some(s => !Number.isFinite(s.target) || !Number.isFinite(s.rate) || !Number.isFinite(s.hold) || s.rate <= 0 || s.hold < 0)) throw new Error('Every stage needs a temperature, positive ramp rate and nonnegative hold time.');
  const profile = makeProfile(config);
  if (profile.duration <= 0 || profile.duration > 3000) throw new Error('Profile must be between 0 and 3,000 minutes. Increase the ramp rate or reduce the hold time.');
  const steps = Math.ceil(profile.duration / dt);
  // Integer number of fixed steps, with a final step exactly at the profile end.
  dt = profile.duration / steps;
  let temp = config.ambient, heat = 0, integral = 0, derivative = 0, previousSignal = controller.source === 'error' ? 0 : -temp, segmentIndex = 0;
  const commands = [], points = [];
  let squaredError = 0, overshoot = 0, holdError = 0, holdCount = 0, energy = 0, peak = temp;
  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    while (segmentIndex < profile.segments.length - 1 && t >= profile.segments[segmentIndex].end) segmentIndex++;
    const segment = profile.segments[segmentIndex];
    const sp = segment.from + (segment.to - segment.from) * Math.min(1, Math.max(0, (t - segment.start) / (segment.end - segment.start)));
    const error = sp - temp;
    // The error source implements Gc(s)E(s); measurement avoids setpoint kick.
    const signal = controller.source === 'error' ? error : -temp;
    derivative = filteredDerivative(derivative, (signal - previousSignal) / dt, dt, controller.filter);
    previousSignal = signal;
    const p = controller.kp * error, d = controller.kd * derivative;
    const candidate = integral + controller.ki * error * dt;
    const raw = p + candidate + d;
    // Conditional integration: do not accumulate error further into saturation.
    if ((raw >= 0 && raw <= 100) || (raw > 100 && error < 0) || (raw < 0 && error > 0)) integral = candidate;
    const output = segment.kind === 'cool' ? 0 : Math.max(0, Math.min(100, p + integral + d));
    commands.push(output);
    points.push({ t, sp, temp, output, p, integral, d, phase: segment.name });
    if (t < profile.processEnd) { squaredError += error * error; overshoot = Math.max(overshoot, temp - sp); }
    if (segment.kind === 'hold') { holdError += Math.abs(error); holdCount++; }
    peak = Math.max(peak, temp);
    if (i === steps) break;
    energy += output / 100 * dt;
    // Fractional transport delay via linear interpolation of command history.
    const delayedIndex = i - config.delay / dt;
    const lo = Math.floor(delayedIndex), fraction = delayedIndex - lo;
    const delayed = (lo >= 0 ? commands[lo] : 0) * (1 - fraction) + (lo + 1 >= 0 ? commands[lo + 1] ?? 0 : 0) * fraction;
    const decay = Math.exp(-dt / config.lag);
    const nextHeat = delayed + (heat - delayed) * decay;
    const averageHeat = delayed + (heat - delayed) * config.lag * (1 - decay) / dt;
    heat = nextHeat;
    // Stable exponential update of the lumped thermal energy balance.
    const source = config.heating * averageHeat / 100;
    temp = config.loss > 0 ? config.ambient + (temp - config.ambient) * Math.exp(-config.loss * dt) + source / config.loss * (1 - Math.exp(-config.loss * dt)) : temp + source * dt;
  }
  return { config: structuredClone(config), controller, profile, points, metrics: { peak, overshoot, rmse: Math.sqrt(squaredError / Math.max(1, points.filter(p => p.t < profile.processEnd).length)), holdError: holdCount ? holdError / holdCount : null, energy } };
}

const $ = id => document.getElementById(id);
const experiments = {
  kp: { reference: 2.4, initial: 6, min: 0, max: 8, step: 0.1, fixed: { kp: 2.4, ki: 0, kd: 0, delay: 0.5 }, unit: '%/°C', note: 'P-only experiment: increasing P usually reduces the hold error, but lag and delay can create oscillation at high gain. At steady temperature, a nonzero P error is needed to supply heat-loss power.' },
  ki: { reference: 0, initial: 0.12, min: 0, max: 0.6, step: 0.01, fixed: { kp: 2.4, ki: 0, kd: 0, delay: 0.5 }, unit: '%/(°C·min)', note: 'PI experiment: I accumulates persistent error and can close the P-only hold gap. Higher I can also change overshoot and oscillation. Anti-windup is enabled, so integration pauses when it would drive the output further into saturation.' },
  kd: { reference: 0, initial: 8, min: 0, max: 20, step: 0.5, fixed: { kp: 6, ki: 0, kd: 0, delay: 2 }, unit: '%·min/°C', note: 'PD experiment: the longer 2-minute delay makes oscillation easier to see. D can damp it, but I remains zero, so the steady-state hold gap remains. D does not guarantee less overshoot in a PI-controlled ramp: its braking can let I accumulate more error.' }
};
let reference, current;
function update() {
  const key = $('term').value, exp = experiments[key], value = Number($('gain').value);
  const config = { ...structuredClone(defaults), ...exp.fixed, stages: [{ target: 600, rate: 8, hold: 60 }], cooldown: 0 };
  reference = simulate({ ...config, [key]: exp.reference }); current = simulate({ ...config, [key]: value });
  $('gain-label').textContent = `K${key[1]} · ${exp.unit}`; $('gain-value').textContent = String(value);
  $('reference-label').textContent = `K${key[1]} = ${exp.reference}`;
  const fixed = ['kp', 'ki', 'kd'].filter(k => k !== key).map(k => `K${k[1]} = ${config[k]}`).join(' · ');
  $('experiment-settings').textContent = `25 → 600 °C at 8 °C/min · 60 min hold · ${fixed} · H = 18 °C/min · λ = 0.012/min · lag = 1.5 min · delay = ${config.delay} min`;
  $('final-error').textContent = `${(600 - current.points.at(-1).temp).toFixed(1)} °C`;
  $('max-overshoot').textContent = `${current.metrics.overshoot.toFixed(1)} °C`;
  $('reference-error').textContent = `${(600 - reference.points.at(-1).temp).toFixed(1)} °C`;
  $('experiment-note').textContent = exp.note;
  $('experiment-chart').setAttribute('aria-label', `Temperature versus time for K${key[1]} ${value}, compared with reference ${exp.reference}. Final error ${(600 - current.points.at(-1).temp).toFixed(1)} degrees Celsius. ${exp.note}`);
  draw();
}
function changeTerm() {
  const exp = experiments[$('term').value];
  for (const key of ['min', 'max', 'step']) $('gain')[key] = String(exp[key]);
  $('gain').value = exp.initial ?? exp.reference; update();
}
function draw() {
  if (!current) return;
  const canvas = $('experiment-chart'), box = canvas.getBoundingClientRect(), ratio = devicePixelRatio || 1;
  canvas.width = Math.round(box.width * ratio); canvas.height = Math.round(box.height * ratio);
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
  const style = getComputedStyle(document.documentElement), color = name => style.getPropertyValue(name).trim();
  const width = box.width, height = box.height, left = 44, right = 14, top = 26, bottom = 40;
  const maxY = Math.ceil(Math.max(650, reference.metrics.peak, current.metrics.peak) / 100) * 100;
  const x = t => left + t / current.profile.duration * (width - left - right);
  const y = v => top + (1 - v / maxY) * (height - top - bottom);
  ctx.font = '11px sans-serif'; ctx.fillStyle = color('--muted'); ctx.fillText('TEMPERATURE / °C', left, 12);
  ctx.textAlign = 'center'; ctx.fillText('ELAPSED TIME / min', width / 2, height - 3);
  for (let v = 0; v <= maxY; v += 100) {
    ctx.strokeStyle = color('--border'); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(left, y(v)); ctx.lineTo(width - right, y(v)); ctx.stroke();
    ctx.fillStyle = color('--muted'); ctx.textAlign = 'right'; ctx.fillText(String(v), left - 9, y(v) + 4);
  }
  for (let t = 0; t <= current.profile.duration; t += width < 500 ? 40 : 20) { ctx.textAlign = 'center'; ctx.fillText(String(t), x(t), height - 21); }
  const holdStart = current.profile.segments.find(s => s.kind === 'hold').start;
  ctx.setLineDash([3, 5]); ctx.strokeStyle = color('--border'); ctx.beginPath(); ctx.moveTo(x(holdStart), top); ctx.lineTo(x(holdStart), height - bottom); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = color('--muted'); ctx.textAlign = 'center'; ctx.fillText('RAMP', (left + x(holdStart)) / 2, top + 15); ctx.fillText('HOLD', (x(holdStart) + width - right) / 2, top + 15);
  function line(points, field, c, dash) {
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash(dash); ctx.beginPath();
    const stride = Math.max(1, Math.floor(points.length / width));
    ctx.moveTo(x(points[0].t), y(points[0][field]));
    for (let i = stride; i < points.length; i += stride) ctx.lineTo(x(points[i].t), y(points[i][field]));
    const last = points.at(-1); ctx.lineTo(x(last.t), y(last[field])); ctx.stroke(); ctx.setLineDash([]);
  }
  line(reference.points, 'temp', color('--d'), [3, 4]);
  line(current.points, 'sp', color('--i'), [7, 5]);
  line(current.points, 'temp', color('--p'), []);
}
$('term').onchange = changeTerm; $('gain').oninput = update; $('reset').onclick = changeTerm; $('print').onclick = () => window.print();
new ResizeObserver(draw).observe($('experiment-chart').parentElement);
window.addEventListener('beforeprint', draw); window.addEventListener('afterprint', draw);
changeTerm();

})();
