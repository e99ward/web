/* The timeline's only geometry source is chrono_data.json. */
function parseDate(value) {
  const match = String(value).match(/^(\d{4})(?:[-.](\d{2})(?:[-.](\d{2}))?)?\.?$/);
  if (!match) throw new Error(`Invalid date: ${value}. Use YYYY, YYYY-MM, or YYYY-MM-DD.`);
  const year = +match[1], month = +(match[2] || 1), day = +(match[3] || 1);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`Invalid calendar date: ${value}`);
  return date;
}
function yearPosition(value, startYear, pixelsPerYear) {
  const date = parseDate(value), year = date.getUTCFullYear();
  const first = Date.UTC(year, 0, 1), next = Date.UTC(year + 1, 0, 1);
  return (year - startYear + (date.getTime() - first) / (next - first)) * pixelsPerYear;
}
function itemGeometry(item, settings, today) {
  const start = yearPosition(item.start, settings.startYear, settings.pixelsPerYear);
  const marker = ['reunion', 'mixed'].includes(item.type);
  const end = marker ? start : yearPosition(item.end || today, settings.startYear, settings.pixelsPerYear);
  if (end < start) throw new Error(`End precedes start for ${item.name || item.id}`);
  const total = (settings.endYear - settings.startYear + 1) * settings.pixelsPerYear;
  if (start >= total || (marker ? start < 0 : end <= 0)) return null;
  return { left: Math.max(0, start), width: marker ? Math.min(26, total - start) : Math.min(total, end) - Math.max(0, start) };
}
function validateData(data) {
  const s = data.settings;
  if (!s || !Number.isInteger(s.startYear) || !Number.isInteger(s.endYear) || s.endYear < s.startYear || !Number.isFinite(s.pixelsPerYear) || s.pixelsPerYear <= 0) throw new Error('Invalid timeline settings.');
  if (!Array.isArray(data.agencies)) throw new Error('agencies must be an array.');
  if (s.asOf) parseDate(s.asOf);
  const ids = new Set();
  for (const agency of data.agencies) {
    if (!agency.agency || !Array.isArray(agency.tracks)) throw new Error('Each agency needs a name and tracks array.');
    for (const track of agency.tracks) {
      if (!Array.isArray(track.groups) || (track.events !== undefined && !Array.isArray(track.events))) throw new Error('Each track needs groups and an optional events array.');
      for (const group of track.groups) {
        if (!group.id || ids.has(group.id)) throw new Error(`Missing or duplicate group id: ${group.id}`);
        ids.add(group.id); parseDate(group.start);
        if (group.end && parseDate(group.end) < parseDate(group.start)) throw new Error(`End precedes start: ${group.id}`);
        if (!['group','minor','dormant','dormant_line','reunion','mixed'].includes(group.type)) throw new Error(`Invalid type: ${group.type}`);
      }
      for (const event of track.events || []) {
        if (!event.title) throw new Error('Each event needs a title.');
        parseDate(event.date);
      }
    }
  }
  return data;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
async function readJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
function normalizeName(value) { return String(value || '').toLowerCase().replace(/[\s().\-_\[\]]/g, ''); }
function nameVariants(value) {
  const text = String(value || '').trim();
  const variants = [normalizeName(text)];
  // A trailing alias separated by whitespace is distinct from names such as f(x).
  const combined = text.match(/^(.+?)\s+\((.+)\)$/);
  if (combined) variants.push(normalizeName(combined[1]), normalizeName(combined[2]));
  return variants.filter(Boolean);
}
function findMemberGroup(item, database) {
  if (item.dbId) return database.find(group => group.id === item.dbId);
  const labels = [item.name, ...(item.aliases || [])];
  const exactNames = new Set(labels.map(normalizeName).filter(Boolean));
  const exactMatches = database.filter(group => [group.name, group.alias].some(name => exactNames.has(normalizeName(name))));
  if (exactMatches.length) return exactMatches.length === 1 ? exactMatches[0] : undefined;
  const names = new Set(labels.flatMap(nameVariants));
  const matches = database.filter(group => [group.name, group.alias].flatMap(nameVariants).some(name => names.has(name)));
  // Do not silently choose a different group's members when labels are ambiguous.
  return matches.length === 1 ? matches[0] : undefined;
}
let detailDatabase = [];
function showDetails(item) {
  const content = document.getElementById('details-content'); content.replaceChildren();
  const group = findMemberGroup(item, detailDatabase);
  const name = (group && group.name) || item.name || item.title;
  const alias = (group && group.alias) || '';
  const header = element('div', 'group-header');
  header.append(element('h2', 'group-name', name));
  if (alias) header.append(element('p', 'group-alias', alias));
  if (item.id) {
    const logo = element('img', 'group-logo');
    logo.alt = `${name || ''} logo`;
    logo.style.display = 'none';
    logo.onload = () => { logo.style.display = ''; header.classList.add('with-logo'); };
    logo.onerror = () => { logo.remove(); };
    logo.src = `logo/${item.id}.svg`;
    if (logo.complete && logo.naturalWidth > 0) { logo.style.display = ''; header.classList.add('with-logo'); }
    header.append(logo);
  }
  content.append(header);
  if (item.description) content.append(element('p', '', item.description));
  if (item.source) {
    const link = element('a', '', 'Source');
    try { const url = new URL(item.source); if (['https:', 'http:'].includes(url.protocol)) { link.href = url.href; link.target = '_blank'; link.rel = 'noopener'; content.append(link); } } catch (_) { /* Invalid URLs are not linked. */ }
  }
  if (group && group.members) {
    const members = element('div', 'members');
    for (const member of group.members) {
      const card = element('div', 'member');
      if (member.img && /^https?:\/\//.test(member.img)) { const img = element('img'); img.src = member.img; img.alt = member.name || ''; img.loading = 'lazy'; card.append(img); }
      card.append(element('p', '', [member.name, member.birth].filter(Boolean).join(' · '))); members.append(card);
    }
    content.append(members);
  }
  document.getElementById('group-details').showModal();
}
function dismissEventTooltips() {
  document.querySelectorAll('.event.tooltip-visible, .event.tooltip-pinned').forEach(event => {
    event.classList.remove('tooltip-visible', 'tooltip-pinned');
  });
}
function renderTimeline(data) {
  let tooltipIndex = 0;
  const settings = data.settings, total = (settings.endYear - settings.startYear + 1) * settings.pixelsPerYear;
  const today = settings.asOf || new Date().toLocaleDateString('sv-SE');
  const root = document.getElementById('timeline'); root.replaceChildren();
  root.style.setProperty('--year-width', `${settings.pixelsPerYear}px`);
  const axis = element('div', 'year-axis'); axis.style.width = `${total}px`;
  for (let year = settings.startYear; year <= settings.endYear; year++) { const tick = element('div', 'year', year); tick.style.width = `${settings.pixelsPerYear}px`; axis.append(tick); }
  root.append(axis);
  for (const agency of data.agencies) {
    const section = element('section'); section.append(element('h2', 'agency-title', agency.agency));
    for (const track of agency.tracks) {
      const row = element('div', 'track'); row.style.width = `${total}px`;
      const boxes = element('div', 'group-row');
      for (const item of track.groups) {
        const geometry = itemGeometry(item, settings, today); if (!geometry) continue;
        const clickable = !['dormant', 'dormant_line', 'reunion'].includes(item.type);
        const box = element(clickable ? 'button' : 'span', `group-box ${item.type}${item.datePrecision === 'estimated' ? ' estimated' : ''}`, item.name);
        if (clickable) box.type = 'button';
        else box.setAttribute('role', 'img');
        box.id = item.id;
        box.style.left = `${geometry.left}px`; box.style.width = `${geometry.width}px`;
        box.style.setProperty('--box-color', item.color || '#ddd'); box.style.setProperty('--text-color', item.textColor || '#111');
        const label = `${item.name}: ${item.start}${['reunion','mixed'].includes(item.type) ? '' : ` — ${item.end || today}`}${item.datePrecision === 'estimated' ? ' (estimated)' : ''}`;
        box.setAttribute('aria-label', label);
        if (clickable) box.addEventListener('click', () => showDetails(item));
        boxes.append(box);
      }
      row.append(boxes);
      const events = element('div', 'event-row'), lanes = [];
      row.append(events); section.append(row); root.append(section);
      const sorted = [...(track.events || [])].sort((a,b) => parseDate(a.date) - parseDate(b.date));
      for (const item of sorted) {
        const left = yearPosition(item.date, settings.startYear, settings.pixelsPerYear); if (left < 0 || left >= total) continue;
        const event = element('button', 'event'); event.type = 'button';
        event.append(element('span', 'event-icon', item.icon || '⚲'));
        event.style.left = `${left}px`; if (item.color) event.style.setProperty('--event-color', item.color);
        const label = item.datePrecision === 'released' ? `${item.title} (${item.date})` : item.title;
        event.setAttribute('aria-label', label);
        const tooltip = element('span', 'event-tooltip', label);
        tooltip.id = `event-tooltip-${++tooltipIndex}`; tooltip.setAttribute('role', 'tooltip');
        event.setAttribute('aria-describedby', tooltip.id); event.append(tooltip);
        event.addEventListener('mouseenter', () => event.classList.add('tooltip-visible'));
        event.addEventListener('mouseleave', () => { if (!event.classList.contains('tooltip-pinned')) event.classList.remove('tooltip-visible'); });
        event.addEventListener('focus', () => event.classList.add('tooltip-visible'));
        event.addEventListener('blur', () => { if (!event.classList.contains('tooltip-pinned')) event.classList.remove('tooltip-visible'); });
        event.addEventListener('click', e => {
          e.stopPropagation();
          const wasPinned = event.classList.contains('tooltip-pinned'); dismissEventTooltips();
          if (!wasPinned) event.classList.add('tooltip-visible', 'tooltip-pinned');
        });
        events.append(event);
        // Keep nearby icons from overlapping.
        const width = event.getBoundingClientRect().width;
        let lane = lanes.findIndex(end => end + 8 <= left); if (lane < 0) lane = lanes.length;
        lanes[lane] = left + width; event.style.top = `${lane * 26}px`;
      }
      events.style.height = `${Math.max(1, lanes.length) * 26 + 12}px`; row.append(events); section.append(row);
    }
    root.append(section);
  }
}
async function initChrono() {
  const status = document.getElementById('load-status');
  document.addEventListener('click', dismissEventTooltips);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') dismissEventTooltips(); });
  document.getElementById('close-details').addEventListener('click', () => document.getElementById('group-details').close());
  try {
    const data = validateData(await readJson('./chrono_data.json')); renderTimeline(data);
    status.textContent = 'Edit chrono_data.json and reload to update this timeline.';
    // Member enrichment is optional and never overrides manually entered geometry.
    readJson('./saved_db.json').then(db => { if (Array.isArray(db)) detailDatabase = db; }).catch(() => {});
  } catch (error) { status.dataset.error = 'true'; status.textContent = `Could not load timeline: ${error.message}. Serve this folder over HTTP and check chrono_data.json.`; }
}
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', initChrono);
if (typeof module !== 'undefined') module.exports = { parseDate, yearPosition, itemGeometry, validateData, findMemberGroup };
