import { defaults, simulate, controllerParameters } from './simulation.js';
const $ = id => document.getElementById(id);
let config = { ...structuredClone(defaults), controllerForm: 'time', tn: 20, tv: 4 / 2.4, td: 0.25, integralEnabled: true, derivativeSource: 'error' }, result, baseline = null, cursor = 1, playing = false, frame, lastTime, hover = null, debounce;
const gainSpecs = [
  { key: 'kp', symbol: 'P', name: 'Proportional', description: 'Responds to the current temperature error', max: 12, step: 0.1 },
  { key: 'ki', symbol: 'I', name: 'Integral', description: 'Corrects error that accumulates over time', max: 1, step: 0.01 },
  { key: 'kd', symbol: 'D', name: 'Derivative', description: 'Dampens the rate of temperature change', max: 30, step: 0.5 }
];
const timeSpecs = [
  { key: 'kp', symbol: 'Kp', name: 'Proportional gain', description: 'Overall gain · %/°C', min: 0, max: 12, step: 0.1 },
  { key: 'tn', symbol: 'Tn', name: 'Integral time', description: 'Minutes · smaller means stronger I', min: 0.01, max: 200, step: 0.1 },
  { key: 'tv', symbol: 'Tv', name: 'Derivative action time', description: 'Minutes · larger means stronger D', min: 0, max: 20, step: 0.05 },
  { key: 'td', symbol: 'Td', name: 'Derivative filter time', description: 'Minutes · larger means more smoothing', min: 0, max: 5, step: 0.01 }
];
const activeSpecs = () => config.controllerForm === 'time' ? timeSpecs : [...gainSpecs, { key: 'derivativeFilter', symbol: 'Tf', name: 'Derivative filter time', description: 'Minutes · first-order D filter', min: 0, max: 5, step: 0.01 }];
function renderStages() {
  $('stages').replaceChildren();
  config.stages.forEach((stage, i) => {
    const row = document.createElement('div'); row.className = 'stage-row';
    const index = document.createElement('span'); index.className = 'stage-index'; index.textContent = String(i + 1).padStart(2, '0'); row.append(index);
    for (const key of ['target', 'rate', 'hold']) {
      const input = document.createElement('input'); input.type = 'number'; input.value = stage[key];
      input.min = key === 'rate' ? '0.1' : '0'; input.max = key === 'target' ? '2000' : key === 'rate' ? '100' : '1000'; input.step = key === 'rate' ? '0.1' : '1';
      input.setAttribute('aria-label', `Stage ${i + 1} ${key === 'target' ? 'target temperature in Celsius' : key === 'rate' ? 'ramp rate in Celsius per minute' : 'hold time in minutes'}`);
      input.addEventListener('input', () => { config.stages[i][key] = input.value === '' ? NaN : Number(input.value); $('preset').value = 'custom'; schedule(); });
      row.append(input);
    }
    const remove = document.createElement('button'); remove.className = 'remove-stage'; remove.textContent = '×'; remove.disabled = config.stages.length === 1; remove.setAttribute('aria-label', `Remove stage ${i + 1}`);
    remove.onclick = () => { config.stages.splice(i, 1); $('preset').value = 'custom'; renderStages(); run(); }; row.append(remove); $('stages').append(row);
  });
  $('add-stage').disabled = config.stages.length >= 8;
}
function renderGains() {
  const specs = activeSpecs();
  $('gains').innerHTML = specs.map(s => `<div class="gain"><div class="gain-top"><div><div class="gain-name"><span class="gain-symbol">${s.symbol}</span>${s.name}</div><div class="gain-description">${s.description}</div></div><input id="${s.key}" type="number" min="${s.min ?? 0}" max="${Math.max(s.max, config[s.key])}" step="any" value="${config[s.key]}" aria-label="${config.controllerForm === 'time' || s.key === 'derivativeFilter' ? s.name : `${s.name} gain`}"></div><input id="${s.key}-range" type="range" min="${s.min ?? 0}" max="${Math.max(s.max, config[s.key])}" step="any" value="${config[s.key]}" aria-label="${s.name} slider"><div class="range-labels"><span>${s.min ?? 0}</span><span>${Math.max(s.max, config[s.key])}</span></div></div>`).join('');
  $('integral-toggle').hidden = config.controllerForm !== 'time';
  $('integral-enabled').checked = config.integralEnabled;
  $('controller-form').value = config.controllerForm;
  $('derivative-source').value = config.derivativeSource;
  for (const s of specs) {
    $(s.key).oninput = () => { $(`${s.key}-range`).value = $(s.key).value; schedule(); };
    $(`${s.key}-range`).oninput = () => { $(s.key).value = Number($(`${s.key}-range`).value).toPrecision(6); schedule(); };
  }
}
function schedule() { clearTimeout(debounce); stop(); $('run-state').textContent = 'Updating simulation…'; debounce = setTimeout(run, 180); }
function readConfig() {
  const inputs = [...document.querySelectorAll('input[type=number]')];
  const invalid = inputs.find(input => !input.validity.valid || input.value.trim() === '');
  if (invalid) throw new Error(`Check ${invalid.getAttribute('aria-label') || invalid.closest('label')?.childNodes[0].textContent || 'the highlighted field'}; enter a value within its limits.`);
  for (const key of [...activeSpecs().map(s => s.key), 'ambient', 'heating', 'loss', 'lag', 'delay', 'cooldown']) config[key] = Number($(key).value);
  config.integralEnabled = $('integral-enabled').checked;
  config.derivativeSource = $('derivative-source').value;
  return config;
}
function run() {
  clearTimeout(debounce); stop();
  try {
    result = simulate(readConfig()); cursor = 1; hover = null; $('tooltip').hidden = true;
    const c = result.controller;
    $('controller-equation').textContent = config.controllerForm === 'time' ? `Gc(s) = Kp [1 + ${config.integralEnabled ? '1/(Tn·s)' : '0'} + Tv·s/(1 + Td·s)]` : 'Gc(s) = Kp + Ki/s + Kd·s/(1 + Tf·s)';
    $('controller-details').textContent = `Ki = ${c.ki.toPrecision(4)}, Kd = ${c.kd.toPrecision(4)} · filter = ${c.filter} min. ${c.source === 'error' ? 'D acts on error: U(s) = Gc(s)E(s) before limiting.' : 'D acts on temperature; the displayed transfer function applies to error-based D.'} Anti-windup · 0–100% output.`;
    $('validation').textContent = ''; $('run-state').innerHTML = '<span class="status-dot"></span> Simulation complete';
    for (const id of ['export', 'save-run', 'play', 'scrub']) $(id).disabled = false;
    $('duration').textContent = `${result.profile.processEnd.toFixed(1)} min + ${config.cooldown} min cool down`;
    $('peak').textContent = result.metrics.peak.toFixed(1); $('overshoot').textContent = result.metrics.overshoot.toFixed(1); $('hold-error').textContent = result.metrics.holdError === null ? '—' : result.metrics.holdError.toFixed(1);
    const maxTarget = Math.max(...config.stages.map(s => s.target));
    const ceiling = config.loss > 0 ? config.ambient + config.heating / config.loss : Infinity;
    $('insight').textContent = maxTarget >= ceiling ? `This furnace cannot sustain ${maxTarget} °C: its full-power equilibrium is ${ceiling.toFixed(0)} °C. Increase maximum heating or reduce the heat loss coefficient.` : c.kp === 0 && c.ki === 0 && c.kd === 0 ? 'The controller gains are zero. Increase proportional gain to begin heating.' : `Tracking error is ${result.metrics.rmse.toFixed(1)} °C RMS during the heating program. Save this run to compare another setting. ${config.controllerForm === 'time' ? 'Smaller Tn increases I; larger Tv increases D; larger Td smooths and slows D.' : 'Compare gains and filter time across the whole ramp and hold.'}${c.filter === 0 ? ' D is unfiltered; its response is sensitive to the simulation time step.' : c.filter < 0.05 ? ' The filter time is below the nominal simulation step; very fast filter dynamics have limited resolution.' : ''}`;
    updatePlayback(); draw();
  } catch (error) {
    $('validation').textContent = error.message; $('run-state').textContent = 'Check inputs';
    for (const id of ['export', 'save-run', 'play', 'scrub']) $(id).disabled = true;
  }
}
function stop() { playing = false; cancelAnimationFrame(frame); $('play').textContent = '▶'; $('play').setAttribute('aria-label', 'Play simulation'); lastTime = null; }
function updatePlayback() {
  if (!result) return;
  const point = result.points[Math.min(result.points.length - 1, Math.round(cursor * (result.points.length - 1)))];
  $('scrub').value = Math.round(cursor * 1000); $('phase').textContent = cursor === 1 ? 'Full simulation' : point.phase;
  $('time-readout').textContent = `${point.t.toFixed(1)} / ${result.profile.duration.toFixed(1)} min`;
}
function animate(now) {
  if (!playing) return;
  if (lastTime !== null) cursor = Math.min(1, cursor + (now - lastTime) / 1000 * Number($('speed').value) / result.profile.duration);
  lastTime = now; updatePlayback(); draw();
  if (cursor >= 1) stop(); else frame = requestAnimationFrame(animate);
}

function setupCanvas(id) {
  const canvas = $(id), rect = canvas.getBoundingClientRect(), ratio = devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
  return { canvas, ctx, width: rect.width, height: rect.height };
}
function drawChart(id, output = false) {
  if (!result) return;
  const { ctx, width, height } = setupCanvas(id);
  const theme = getComputedStyle(document.documentElement);
  const color = name => theme.getPropertyValue(name).trim();
  const colors = { sp: color('--green'), temp: color('--orange'), baseline: color('--baseline'), output: color('--green') };
  const margin = { left: 43, right: 12, top: output ? 9 : 27, bottom: 25 };
  const w = width - margin.left - margin.right, h = height - margin.top - margin.bottom;
  const maxTime = Math.max(result.profile.duration, baseline?.profile.duration || 0);
  const minY = output ? 0 : Math.min(0, result.config.ambient, ...result.config.stages.map(s => s.target), baseline?.config.ambient ?? 0);
  let maxY = output ? 100 : Math.max(result.metrics.peak, ...result.config.stages.map(s => s.target), baseline?.metrics.peak || 0);
  const stepY = output ? 25 : niceStep((maxY - minY) / 5); maxY = output ? 100 : Math.ceil((maxY + stepY * 0.12) / stepY) * stepY;
  const x = t => margin.left + t / maxTime * w, y = value => margin.top + h - (value - minY) / (maxY - minY) * h;
  ctx.font = '10px "DM Sans", sans-serif'; ctx.lineWidth = 1;
  ctx.save(); ctx.beginPath(); ctx.rect(margin.left, margin.top, w, h); ctx.clip();
  for (const segment of result.profile.segments) {
    if (segment.kind === 'hold') { ctx.fillStyle = color('--chart-hold'); ctx.fillRect(x(segment.start), margin.top, x(segment.end) - x(segment.start), h); }
    if (segment.kind === 'cool') { ctx.fillStyle = color('--chart-cool'); ctx.fillRect(x(segment.start), margin.top, x(segment.end) - x(segment.start), h); }
  }
  ctx.restore();
  for (let value = minY; value <= maxY + 0.01; value += stepY) {
    ctx.strokeStyle = color('--chart-grid'); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(margin.left, y(value)); ctx.lineTo(width - margin.right, y(value)); ctx.stroke();
    ctx.fillStyle = color('--muted'); ctx.textAlign = 'right'; ctx.fillText(String(Math.round(value)), margin.left - 10, y(value) + 3);
  }
  const stepX = niceStep(maxTime / Math.max(3, Math.floor(w / 90)));
  for (let t = 0; t <= maxTime; t += stepX) {
    ctx.strokeStyle = color('--chart-grid'); ctx.beginPath(); ctx.moveTo(x(t), margin.top); ctx.lineTo(x(t), margin.top + h); ctx.stroke();
    ctx.fillStyle = color('--muted'); ctx.textAlign = 'center'; ctx.fillText(String(t), x(t), height - 6);
  }
  ctx.setLineDash([]);
  if (!output) {
    ctx.font = '9px "DM Sans", sans-serif'; ctx.fillStyle = color('--muted'); ctx.textAlign = 'center';
    for (const s of result.profile.segments) if (x(s.end) - x(s.start) > 42) ctx.fillText(s.name.toUpperCase(), (x(s.start) + x(s.end)) / 2, 13);
  }
  ctx.save(); ctx.beginPath(); ctx.rect(margin.left, margin.top, w, h); ctx.clip();
  const visible = result.profile.duration * cursor;
  function line(points, key, color, dash = [], fill = false, until = Infinity) {
    const data = points.filter(p => p.t <= until);
    if (!data.length) return;
    // One sample per roughly half pixel is sufficient at this chart size.
    const stride = Math.max(1, Math.floor(data.length / (w * 2)));
    ctx.beginPath(); ctx.moveTo(x(data[0].t), y(data[0][key]));
    for (let i = stride; i < data.length; i += stride) ctx.lineTo(x(data[i].t), y(data[i][key]));
    const end = data[data.length - 1]; ctx.lineTo(x(end.t), y(end[key]));
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
    if (fill) { ctx.lineTo(x(end.t), y(0)); ctx.lineTo(x(data[0].t), y(0)); ctx.closePath(); const gradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + h); gradient.addColorStop(0, `${color}25`); gradient.addColorStop(1, `${color}02`); ctx.fillStyle = gradient; ctx.fill(); }
  }
  if (baseline) line(baseline.points, output ? 'output' : 'temp', colors.baseline, [3, 5]);
  if (output) line(result.points, 'output', colors.output, [], true, visible);
  else {
    // Draw segment endpoints explicitly so step profiles cannot be skipped by downsampling.
    const profilePoints = [{ t: 0, sp: result.config.ambient }];
    for (const s of result.profile.segments) profilePoints.push({ t: s.start, sp: s.from }, { t: s.end, sp: s.to });
    line(profilePoints, 'sp', colors.sp, [5, 5]); line(result.points, 'temp', colors.temp, [], true, visible);
  }
  const indicator = hover !== null ? hover : cursor < 1 ? visible : null;
  if (indicator !== null) {
    const p = result.points[Math.min(result.points.length - 1, Math.round(indicator / result.profile.duration * (result.points.length - 1)))];
    ctx.strokeStyle = color('--muted'); ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x(p.t), margin.top); ctx.lineTo(x(p.t), margin.top + h); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = output ? colors.output : colors.temp; ctx.beginPath(); ctx.arc(x(p.t), y(output ? p.output : p.temp), 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function niceStep(value) { const power = 10 ** Math.floor(Math.log10(Math.max(value, 0.0001))); const n = value / power; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * power; }
function draw() { drawChart('temperature-chart'); drawChart('output-chart', true); }
$('temperature-chart').addEventListener('pointermove', event => {
  if (!result) return;
  const rect = $('temperature-chart').getBoundingClientRect();
  const t = (event.clientX - rect.left - 43) / (rect.width - 55) * Math.max(result.profile.duration, baseline?.profile.duration || 0);
  if (t < 0 || t > result.profile.duration) { hover = null; $('tooltip').hidden = true; draw(); return; }
  const p = result.points[Math.round(t / result.profile.duration * (result.points.length - 1))]; hover = p.t;
  $('tooltip').innerHTML = `<b>${p.t.toFixed(1)} min · ${p.phase}</b><br>Setpoint &nbsp; ${p.sp.toFixed(1)} °C<br><strong>Actual &nbsp; ${p.temp.toFixed(1)} °C</strong><br>Heater &nbsp; ${p.output.toFixed(1)}%`;
  $('tooltip').hidden = false; $('tooltip').style.left = `${Math.max(0, Math.min(rect.width - $('tooltip').offsetWidth, event.clientX - rect.left + 14))}px`; $('tooltip').style.top = `${Math.max(0, Math.min(rect.height - $('tooltip').offsetHeight, event.clientY - rect.top - 35))}px`; draw();
});
$('temperature-chart').addEventListener('pointerleave', () => { hover = null; $('tooltip').hidden = true; draw(); });
$('add-stage').onclick = () => { if (config.stages.length >= 8) return; const last = config.stages.at(-1); config.stages.push({ target: Number.isFinite(last.target) ? Math.min(2000, last.target + 200) : 800, rate: 5, hold: 20 }); $('preset').value = 'custom'; renderStages(); run(); };
$('preset').onchange = () => {
  const presets = { sinter: [{ target: 450, rate: 8, hold: 20 }, { target: 800, rate: 5, hold: 30 }], anneal: [{ target: 600, rate: 5, hold: 60 }, { target: 200, rate: 3, hold: 15 }], step: [{ target: 500, rate: 100, hold: 60 }] };
  if (presets[$('preset').value]) { config.stages = structuredClone(presets[$('preset').value]); renderStages(); run(); }
};
$('reset-gains').onclick = () => { Object.assign(config, { kp: defaults.kp, ki: defaults.ki, kd: defaults.kd, derivativeFilter: 0.25, tn: 20, tv: 4 / 2.4, td: 0.25, integralEnabled: true }); renderGains(); run(); };
$('controller-form').onchange = () => {
  const next = $('controller-form').value;
  try {
    readConfig();
    const c = controllerParameters(config);
    if (next === 'time') {
      if (c.kp === 0 && (c.ki > 0 || c.kd > 0)) throw new Error('A controller with Kp = 0 and nonzero I or D cannot be represented by this time form. Set a positive Kp first.');
      config.tn = c.ki > 0 ? c.kp / c.ki : 20; config.tv = c.kp > 0 ? c.kd / c.kp : 0; config.td = c.filter; config.integralEnabled = c.ki > 0;
    } else { config.ki = c.ki; config.kd = c.kd; config.derivativeFilter = c.filter; }
    config.controllerForm = next; renderGains(); run();
  } catch (error) { $('controller-form').value = config.controllerForm; $('validation').textContent = error.message; }
};
$('integral-enabled').onchange = schedule;
$('derivative-source').onchange = schedule;
for (const key of ['ambient', 'heating', 'loss', 'lag', 'delay', 'cooldown']) $(key).oninput = schedule;
$('run').onclick = run;
document.addEventListener('keydown', event => { if (event.key === 'Enter' && !$('model-dialog').open && event.target.tagName !== 'BUTTON') run(); });
$('save-run').onclick = () => {
  baseline = result; $('baseline-legend').hidden = false; $('clear-run').hidden = false; $('save-run').textContent = '↻ Replace saved run';
  $('baseline-legend').title = `Saved gains: Kp ${baseline.controller.kp}, Ki ${baseline.controller.ki}, Kd ${baseline.controller.kd}; filter ${baseline.controller.filter} min; D on ${baseline.controller.source}`;
  draw();
};
$('clear-run').onclick = () => { baseline = null; $('baseline-legend').hidden = true; $('clear-run').hidden = true; $('save-run').textContent = '+ Save for comparison'; draw(); };
$('play').onclick = () => { if (playing) stop(); else { if (cursor >= 1) cursor = 0; playing = true; lastTime = null; $('play').textContent = 'Ⅱ'; $('play').setAttribute('aria-label', 'Pause simulation'); frame = requestAnimationFrame(animate); } };
$('scrub').oninput = () => { stop(); cursor = Number($('scrub').value) / 1000; updatePlayback(); draw(); };
$('export').onclick = () => {
  const fields = ['t', 'sp', 'temp', 'output', 'p', 'integral', 'd'];
  const csv = ['time_min,setpoint_C,temperature_C,heater_percent,P_percent,I_percent,D_percent,phase', ...result.points.map(p => fields.map(f => p[f].toFixed(5)).join(',') + ',' + p.phase)].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'furnace-simulation.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('model-button').onclick = () => $('model-dialog').showModal(); $('close-model').onclick = () => $('model-dialog').close();
new ResizeObserver(draw).observe($('temperature-chart').parentElement); new ResizeObserver(draw).observe($('output-chart').parentElement);
renderStages(); renderGains(); run();
