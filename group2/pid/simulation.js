export const defaults = {
  kp: 2.4, ki: 0.12, kd: 4, derivativeFilter: 0.25, derivativeSource: 'measurement', ambient: 25, heating: 18, loss: 0.012, lag: 1.5, delay: 0.5, cooldown: 30,
  stages: [{ target: 450, rate: 8, hold: 20 }, { target: 800, rate: 5, hold: 30 }]
};
export function makeProfile(config) {
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
export function controllerParameters(config) {
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
export function filteredDerivative(previous, slope, dt, filter) {
  return filter === 0 ? slope : previous + (slope - previous) * (1 - Math.exp(-dt / filter));
}
export function simulate(config, dt = 0.05) {
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
