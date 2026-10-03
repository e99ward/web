import { defaults, simulate } from './simulation.js';
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
