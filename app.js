(function () {
  'use strict';

  // ---------- Options (mirrors the dropdowns in the original spreadsheet) ----------
  const OPTIONS = {
    region: ['Atlanta', 'Pittsburgh', 'Other'],
    icp: ['A', 'B'],
    sector: ['Salon / Spa', 'Restaurant', 'Retail', 'Plumbing / HVAC', 'Electrical', 'Roofing', 'Other'],
    method: ['Walk-in', 'Call / Text', 'Email', 'DM'],
    plannedDay: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    priority: ['High', 'Medium', 'Low'],
    status: ['Not started', 'No answer', 'Left message', 'Follow up', 'Interested', 'Meeting scheduled',
      'Meeting completed', 'Not interested', 'Not a fit'],
    yesNo: ['Yes', 'No'],
    icpFit: ['ICP', 'Non-ICP', 'Unsure'],
    aiUsage: ['None', 'Basic prompting', 'Uses AI tools', 'Advanced'],
    objection: ['None', 'Mistrust of AI', 'Wants a DIY tool', 'Price', 'No time', 'Happy as is', 'Other'],
  };

  // Field definitions for the editor, grouped like the spreadsheet columns.
  const GROUPS = [
    { title: 'Prospect', fields: [
      ['business', 'Business', 'text'], ['id', 'ID', 'text'],
      ['region', 'Region', 'region'], ['icp', 'ICP', 'icp'],
      ['sector', 'Sector', 'sector'], ['type', 'Type / Trade', 'text'],
      ['address', 'Address', 'text'], ['phone', 'Phone', 'text'],
      ['contact', 'Contact person', 'text'], ['rating', 'Google rating', 'text'],
      ['reviews', 'Google reviews', 'text'], ['method', 'Outreach method', 'method'],
      ['plannedDay', 'Planned day', 'plannedDay'], ['priority', 'Priority', 'priority'],
      ['whyFits', 'Why it fits', 'textarea'], ['pitch', 'What to investigate / pitch', 'textarea'],
    ] },
    { title: 'Outreach', fields: [
      ['status', 'Status', 'status'], ['contacted', 'Visited / called?', 'yesNo'],
      ['firstContactDate', 'First contact date', 'date'], ['followUpNeeded', 'Follow-up needed?', 'yesNo'],
      ['followUpDate', 'Follow-up date', 'date'], ['meetingScheduled', 'Meeting scheduled?', 'yesNo'],
      ['meetingDateTime', 'Meeting date & time', 'datetime'], ['meetingCompleted', 'Meeting completed?', 'yesNo'],
      ['meetingNotes', 'Meeting notes', 'textarea'], ['nextStep', 'Next step', 'textarea'],
    ] },
    { title: 'ICP qualification', fields: [
      ['icpFit', 'ICP fit', 'icpFit'], ['ownerOperated', 'Owner-operated?', 'yesNo'],
      ['singleLocation', 'Single location?', 'yesNo'], ['stagnating', 'Stagnating / declining?', 'yesNo'],
      ['aiUsage', 'AI usage', 'aiUsage'], ['objection', 'Main objection', 'objection'],
      ['price', 'Price discussed ($/mo)', 'text'], ['dealWon', 'Deal won?', 'yesNo'],
    ] },
  ];
  const ALL_FIELDS = GROUPS.flatMap(g => g.fields);
  const WIDE = new Set(['whyFits', 'pitch', 'meetingNotes', 'nextStep', 'business', 'address']);

  const DEFAULT_PLAN = [
    { day: 'Sunday', plan: 'Prepare what to say / what info is important', target: '', notes: '' },
    { day: 'Monday', plan: 'Visit at least 5 businesses from ICP A', target: 5, notes: '' },
    { day: 'Tuesday', plan: 'Call/text businesses from ICP B', target: 8, notes: '' },
    { day: 'Wednesday', plan: 'Visit remaining businesses from ICP A', target: 2, notes: '' },
    { day: 'Thursday', plan: 'Loose ends with ICP B, follow-up messages', target: '', notes: '' },
    { day: 'Friday', plan: 'Finish anything unfinished; make sure most/all meetings are set up or in progress', target: '', notes: '' },
    { day: 'Pittsburgh', plan: 'Call/text Franklin Park leads (no days assigned yet)', target: 25, notes: '' },
  ];
  // How the "Done" column is counted for each plan row (same logic as the spreadsheet formulas).
  const PLAN_DONE = {
    Monday: { label: 'Atlanta ICP A, planned Monday, contacted', fn: b => b.region === 'Atlanta' && b.icp === 'A' && b.plannedDay === 'Monday' && b.contacted === 'Yes' },
    Tuesday: { label: 'Atlanta ICP B contacted', fn: b => b.region === 'Atlanta' && b.icp === 'B' && b.contacted === 'Yes' },
    Wednesday: { label: 'Atlanta ICP A, planned Wednesday, contacted', fn: b => b.region === 'Atlanta' && b.icp === 'A' && b.plannedDay === 'Wednesday' && b.contacted === 'Yes' },
    Thursday: { label: 'Open Atlanta follow-ups remaining', fn: b => b.region === 'Atlanta' && b.followUpNeeded === 'Yes' && b.meetingCompleted !== 'Yes' },
    Friday: { label: 'Atlanta meetings scheduled', fn: b => b.region === 'Atlanta' && b.meetingScheduled === 'Yes' },
    Pittsburgh: { label: 'Pittsburgh leads contacted', fn: b => b.region === 'Pittsburgh' && b.contacted === 'Yes' },
  };

  // ---------- Storage ----------
  const KEY = 'beacon-outreach-v1';
  const blank = () => Object.fromEntries(ALL_FIELDS.map(([k]) => [k, '']));
  const clone = x => JSON.parse(JSON.stringify(x));

  function freshState() {
    return { businesses: clone(window.SEED_BUSINESSES || []).map(b => Object.assign(blank(), b, { lastUpdated: b.lastUpdated || '' })), plan: clone(DEFAULT_PLAN) };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.businesses)) return { businesses: s.businesses, plan: Array.isArray(s.plan) ? s.plan : clone(DEFAULT_PLAN) };
      }
    } catch (e) { /* fall through to seed data */ }
    return freshState();
  }
  let storageOk = true;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) {
      if (storageOk) toast('Could not save in this browser — use Data → Download backup');
      storageOk = false;
    }
  }
  let state = load();

  // ---------- Helpers ----------
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const dateOnly = v => (v ? String(v).slice(0, 10) : '');
  function fmtDate(v) {
    if (!v) return '';
    const s = String(v);
    const d = new Date(s.length <= 10 ? s + 'T00:00' : s);
    if (isNaN(d)) return s;
    const opts = { month: 'short', day: 'numeric' };
    if (s.length > 10 && !s.endsWith('T00:00:00')) Object.assign(opts, { hour: 'numeric', minute: '2-digit' });
    return d.toLocaleString(undefined, opts);
  }
  const isDue = b => b.followUpNeeded === 'Yes' && b.followUpDate && dateOnly(b.followUpDate) <= todayISO()
    && !['Not interested', 'Not a fit'].includes(b.status) && b.dealWon !== 'Yes';
  function rowClass(b) {
    if (b.dealWon === 'Yes') return 'row-won';
    if (['Not interested', 'Not a fit'].includes(b.status)) return 'row-dead';
    if (b.meetingCompleted === 'Yes') return 'row-completed';
    if (b.meetingScheduled === 'Yes') return 'row-meeting';
    return '';
  }
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  const optionTags = (list, val, placeholder) =>
    (placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : '') +
    list.map(o => `<option${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('') +
    (val && !list.includes(val) ? `<option selected>${esc(val)}</option>` : '');

  // Keep the Yes/No columns consistent with the Status the user picks.
  function applyStatusRules(b, prevStatus) {
    const s = b.status;
    if (s === prevStatus) return;
    if (s && s !== 'Not started') {
      b.contacted = 'Yes';
      if (!b.firstContactDate) b.firstContactDate = todayISO();
    }
    if (s === 'Follow up' || s === 'Left message' || s === 'No answer') b.followUpNeeded = 'Yes';
    if (s === 'Meeting scheduled') b.meetingScheduled = 'Yes';
    if (s === 'Meeting completed') { b.meetingScheduled = 'Yes'; b.meetingCompleted = 'Yes'; }
    if (s === 'Not interested' || s === 'Not a fit') b.followUpNeeded = 'No';
  }
  function touch(b) { b.lastUpdated = todayISO(); }
  function nextId(region, icp) {
    const prefix = `${{ Atlanta: 'ATL', Pittsburgh: 'PGH' }[region] || 'OTH'}-${icp || 'X'}-`;
    const nums = state.businesses.map(b => b.id).filter(id => id && id.startsWith(prefix)).map(id => parseInt(id.slice(prefix.length), 10) || 0);
    return prefix + pad((nums.length ? Math.max(...nums) : 0) + 1);
  }

  // ---------- Views ----------
  let currentView = 'today';
  function show(view) {
    currentView = view;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    try { localStorage.setItem(KEY + '-view', view); } catch (e) { /* ignore */ }
    render();
  }
  function render() {
    ({ today: renderToday, pipeline: renderPipeline, dashboard: renderDashboard, plan: renderPlan })[currentView]();
  }

  function listItem(b, right) {
    return `<li><div><div class="name" data-open="${esc(b.id)}">${esc(b.business)}</div>
      <div class="meta">${esc([b.id, b.region, b.sector, b.phone, b.contact].filter(Boolean).join(' · '))}</div></div>
      <div class="right">${right}</div></li>`;
  }
  function listCard(title, items, emptyMsg) {
    return `<div class="card"><h2>${esc(title)} <span class="muted">(${items.length})</span></h2>
      ${items.length ? `<ul class="list">${items.join('')}</ul>` : `<p class="empty">${esc(emptyMsg)}</p>`}</div>`;
  }

  function renderToday() {
    const bs = state.businesses;
    const today = todayISO();
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const due = bs.filter(isDue).sort((a, b) => dateOnly(a.followUpDate).localeCompare(dateOnly(b.followUpDate)));
    const upcoming = bs.filter(b => b.meetingScheduled === 'Yes' && b.meetingCompleted !== 'Yes')
      .sort((a, b) => String(a.meetingDateTime || '9999').localeCompare(String(b.meetingDateTime || '9999')));
    const planned = bs.filter(b => b.plannedDay === dayName && b.contacted !== 'Yes');
    const prio = { High: 0, Medium: 1, Low: 2 };
    const notStarted = bs.filter(b => b.status === 'Not started' || !b.status)
      .sort((a, b) => (prio[a.priority] ?? 3) - (prio[b.priority] ?? 3)).slice(0, 10);

    const contacted = bs.filter(b => b.contacted === 'Yes').length;
    const stats = [
      [bs.length, 'Businesses'], [contacted, 'Contacted'], [due.length, 'Follow-ups due'],
      [bs.filter(b => b.meetingScheduled === 'Yes').length, 'Meetings scheduled'],
      [bs.filter(b => b.dealWon === 'Yes').length, 'Deals won'],
    ];
    $('#view-today').innerHTML = `
      <div class="stats">${stats.map(([n, l]) => `<div class="stat"><div class="num">${n}</div><div class="lbl">${l}</div></div>`).join('')}</div>
      <div class="grid">
        ${listCard('Follow-ups due today or overdue', due.map(b => listItem(b,
          `<span class="${dateOnly(b.followUpDate) < today ? 'due-date' : ''}">${esc(fmtDate(b.followUpDate))}</span><div class="meta">${esc(b.status)}</div>`)),
          'Nothing due. Nice.')}
        ${listCard('Upcoming meetings', upcoming.map(b => listItem(b, `${esc(fmtDate(b.meetingDateTime) || 'Date not set')}`)),
          'No meetings scheduled yet.')}
        ${listCard(`Planned for ${dayName}`, planned.map(b => listItem(b, `${esc(b.method)}<div class="meta">${esc(b.priority)}</div>`)),
          `Nobody is planned for ${dayName}. Set "Planned day" on a business to see it here.`)}
        ${listCard('Top not-yet-contacted', notStarted.map(b => listItem(b, `<span class="pill ${esc(b.priority)}">${esc(b.priority || '—')}</span>`)),
          'Everyone has been contacted.')}
      </div>`;
  }

  // Pipeline table
  const FILTERS = [
    ['#f-region', 'region', 'All regions'], ['#f-icp', 'icp', 'All ICPs'], ['#f-sector', 'sector', 'All sectors'],
    ['#f-status', 'status', 'All statuses'], ['#f-priority', 'priority', 'All priorities'], ['#f-day', 'plannedDay', 'Any day'],
  ];
  const COLUMNS = [
    ['id', 'ID'], ['business', 'Business'], ['region', 'Region'], ['icp', 'ICP'], ['sector', 'Sector'],
    ['priority', 'Priority'], ['method', 'Method'], ['plannedDay', 'Day'], ['status', 'Status'],
    ['followUpDate', 'Follow-up'], ['meetingDateTime', 'Meeting'], ['nextStep', 'Next step'], ['lastUpdated', 'Updated'],
  ];
  let sort = { key: 'id', asc: true };
  let filtersBuilt = false;

  function buildFilters() {
    FILTERS.forEach(([sel, key, label]) => {
      const values = [...new Set([...(OPTIONS[key] || []), ...state.businesses.map(b => b[key]).filter(Boolean)])];
      const el = $(sel); const cur = el.value;
      el.innerHTML = optionTags(values, cur, label);
    });
    filtersBuilt = true;
  }

  function renderPipeline() {
    if (!filtersBuilt) buildFilters();
    const q = $('#f-search').value.trim().toLowerCase();
    const prio = { High: 0, Medium: 1, Low: 2 };
    let rows = state.businesses.filter(b => FILTERS.every(([sel, key]) => !$(sel).value || b[key] === $(sel).value));
    if (q) rows = rows.filter(b => ALL_FIELDS.some(([k]) => String(b[k] ?? '').toLowerCase().includes(q)));
    rows.sort((a, b) => {
      let x = a[sort.key] ?? '', y = b[sort.key] ?? '';
      if (sort.key === 'priority') { x = prio[x] ?? 3; y = prio[y] ?? 3; }
      if (sort.key === 'status') { x = OPTIONS.status.indexOf(x); y = OPTIONS.status.indexOf(y); }
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return sort.asc ? c : -c;
    });

    const head = `<thead><tr>${COLUMNS.map(([k, l]) =>
      `<th data-sort="${k}" class="${sort.key === k ? 'sorted' + (sort.asc ? ' asc' : '') : ''}">${l}</th>`).join('')}</tr></thead>`;
    const body = rows.map(b => `<tr class="${rowClass(b)}" data-open="${esc(b.id)}">
      <td>${esc(b.id)}</td>
      <td><strong>${esc(b.business)}</strong>${isDue(b) ? '<span class="due-tag">Due</span>' : ''}</td>
      <td>${esc(b.region)}</td><td>${esc(b.icp)}</td><td>${esc(b.sector)}</td>
      <td><span class="pill ${esc(b.priority)}">${esc(b.priority || '—')}</span></td>
      <td>${esc(b.method)}</td><td>${esc(b.plannedDay)}</td>
      <td><select data-status="${esc(b.id)}" aria-label="Status">${optionTags(OPTIONS.status, b.status)}</select></td>
      <td class="${isDue(b) ? 'due-date' : ''}">${esc(b.followUpNeeded === 'Yes' ? fmtDate(b.followUpDate) : '')}</td>
      <td>${esc(fmtDate(b.meetingDateTime))}</td>
      <td class="wrap">${esc(b.nextStep)}</td>
      <td>${esc(fmtDate(b.lastUpdated))}</td>
    </tr>`).join('');
    $('#pipeline-table').innerHTML = head + `<tbody>${body || `<tr><td colspan="${COLUMNS.length}" class="empty">No businesses match these filters.</td></tr>`}</tbody>`;
    let count = $('#view-pipeline .count');
    if (!count) { count = document.createElement('p'); count.className = 'count'; $('#view-pipeline').appendChild(count); }
    count.textContent = `Showing ${rows.length} of ${state.businesses.length}`;
  }

  // Dashboard
  function renderDashboard() {
    const bs = state.businesses;
    const segs = [['Atlanta', 'A'], ['Atlanta', 'B'], ['Pittsburgh', 'A'], ['Pittsburgh', 'B']];
    const inSeg = ([r, i]) => b => b.region === r && b.icp === i;
    const metrics = [
      ['Businesses on list', () => true],
      ['Visited / called', b => b.contacted === 'Yes'],
      ['Not yet contacted', b => b.status === 'Not started'],
      ['Follow-ups needed', b => b.followUpNeeded === 'Yes'],
      ['Interested', b => b.status === 'Interested'],
      ['Meetings scheduled', b => b.meetingScheduled === 'Yes'],
      ['Meetings completed', b => b.meetingCompleted === 'Yes'],
      ['Deals won', b => b.dealWon === 'Yes'],
      ['Not interested', b => b.status === 'Not interested'],
    ];
    const cnt = (list, f) => list.filter(f).length;
    const segLists = [...segs.map(s => bs.filter(inSeg(s))), bs];
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '0%');
    const regionRows = metrics.map(([l, f]) => `<tr><td>${l}</td>${segLists.map(list => `<td>${cnt(list, f)}</td>`).join('')}</tr>`).join('')
      + `<tr><td>Contact rate</td>${segLists.map(list => `<td>${pct(cnt(list, metrics[1][1]), list.length)}</td>`).join('')}</tr>`
      + `<tr><td>Meeting rate (of contacted)</td>${segLists.map(list => `<td>${pct(cnt(list, metrics[5][1]), cnt(list, metrics[1][1]))}</td>`).join('')}</tr>`;

    const fits = ['ICP', 'Non-ICP', 'Unsure'];
    const stages = [['Leads', () => true], ['Opportunities', b => b.meetingScheduled === 'Yes'], ['Wins', b => b.dealWon === 'Yes']];
    const icpRows = stages.map(([l, f]) => {
      const vals = fits.map(fit => cnt(bs, b => b.icpFit === fit && f(b)));
      return `<tr><td>${l}</td>${vals.map(v => `<td>${v}</td>`).join('')}<td>${vals.reduce((a, c) => a + c, 0)}</td></tr>`;
    }).join('');

    const sectorIcp = { 'Salon / Spa': 'A', Restaurant: 'A', Retail: 'A', 'Plumbing / HVAC': 'B', Electrical: 'B', Roofing: 'B' };
    const sectors = [...new Set([...Object.keys(sectorIcp), ...bs.map(b => b.sector).filter(Boolean)])];
    const sectorRows = sectors.map(s => {
      const list = bs.filter(b => b.sector === s);
      return `<tr><td>${esc(s)}</td><td>${sectorIcp[s] || ''}</td><td>${list.length}</td><td>${cnt(list, metrics[1][1])}</td><td>${cnt(list, metrics[5][1])}</td><td>${cnt(list, metrics[7][1])}</td></tr>`;
    }).join('');

    const objections = OPTIONS.objection.filter(o => o !== 'None').map(o => [o, cnt(bs, b => b.objection === o)]);
    const maxObj = Math.max(1, ...objections.map(o => o[1]));

    const funnel = [
      ['On list', bs.length], ['Contacted', cnt(bs, metrics[1][1])], ['Interested+', cnt(bs, b => ['Interested', 'Meeting scheduled', 'Meeting completed'].includes(b.status) || b.meetingScheduled === 'Yes')],
      ['Meeting scheduled', cnt(bs, metrics[5][1])], ['Meeting completed', cnt(bs, metrics[6][1])], ['Deal won', cnt(bs, metrics[7][1])],
    ];
    const top = Math.max(1, funnel[0][1]);

    $('#view-dashboard').innerHTML = `
      <div class="grid">
        <div class="card"><h2>Funnel</h2>
          ${funnel.map(([l, n]) => `<div class="funnel-row"><span>${l}</span><div class="funnel-track"><div class="funnel-fill" style="width:${(n / top) * 100}%"></div></div><span class="n">${n}</span></div>`).join('')}
        </div>
        <div class="card"><h2>ICP tracking</h2>
          <p class="muted">Opportunity = meeting scheduled. Win = deal won. Anything in the ICP with no traction should be reconsidered.</p>
          <div class="table-wrap"><table class="metric-table"><thead><tr><th>Stage</th>${fits.map(f => `<th>${f}</th>`).join('')}<th>Total</th></tr></thead><tbody>${icpRows}</tbody></table></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px"><h2>Pipeline by region and ICP</h2>
        <div class="table-wrap"><table class="metric-table"><thead><tr><th>Metric</th>${segs.map(([r, i]) => `<th>${r} ${i}</th>`).join('')}<th>Total</th></tr></thead><tbody>${regionRows}</tbody></table></div>
      </div>
      <div class="grid" style="margin-top:16px">
        <div class="card"><h2>By sector</h2><p class="muted">Which ICP is getting traction?</p>
          <div class="table-wrap"><table class="metric-table"><thead><tr><th>Sector</th><th>ICP</th><th>Leads</th><th>Contacted</th><th>Meetings</th><th>Wins</th></tr></thead><tbody>${sectorRows}</tbody></table></div>
        </div>
        <div class="card"><h2>Objections heard</h2>
          <div class="table-wrap"><table class="metric-table"><thead><tr><th>Objection</th><th>Count</th></tr></thead><tbody>
          ${objections.map(([o, n]) => `<tr><td>${esc(o)}</td><td>${n}<span class="bar" style="width:${(n / maxObj) * 80}px"></span></td></tr>`).join('')}
          </tbody></table></div>
        </div>
      </div>`;
  }

  // Weekly plan
  function renderPlan() {
    const rows = state.plan.map((p, i) => {
      const rule = PLAN_DONE[p.day];
      const done = rule ? state.businesses.filter(rule.fn).length : '';
      const target = Number(p.target) || 0;
      const prog = rule && target ? `<div class="progress"><div style="width:${Math.min(100, (done / target) * 100)}%"></div></div>` : '';
      return `<tr>
        <td><strong>${esc(p.day)}</strong></td>
        <td><textarea rows="2" data-plan="${i}" data-k="plan">${esc(p.plan)}</textarea></td>
        <td><input type="number" min="0" data-plan="${i}" data-k="target" value="${esc(p.target)}"></td>
        <td>${rule ? `<strong>${done}</strong>${target ? ` / ${target}` : ''}${prog}<div class="meta muted">${esc(rule.label)}</div>` : '<span class="muted">—</span>'}</td>
        <td><textarea rows="2" data-plan="${i}" data-k="notes">${esc(p.notes)}</textarea></td>
      </tr>`;
    }).join('');
    $('#view-plan').innerHTML = `<div class="card"><h2>Weekly plan</h2>
      <p class="muted">"Done" is counted automatically from the pipeline. Plan, target and notes are editable.</p>
      <div class="table-wrap"><table class="plan-table"><thead><tr><th>Day</th><th>Plan</th><th>Target</th><th>Done</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p style="margin-top:10px"><button id="plan-reset" class="ghost">Reset plan to default</button></p></div>`;
  }

  // ---------- Editor ----------
  const dlg = $('#editor');
  let editing = null; // { business, isNew }

  function fieldInput(key, label, kind, val) {
    const name = `name="${key}"`;
    let input;
    if (OPTIONS[kind]) input = `<select ${name}>${optionTags(OPTIONS[kind], val, '—')}</select>`;
    else if (kind === 'textarea') input = `<textarea ${name}>${esc(val)}</textarea>`;
    else if (kind === 'date') input = `<input type="date" ${name} value="${esc(dateOnly(val))}">`;
    else if (kind === 'datetime') input = `<input type="datetime-local" ${name} value="${esc(val ? String(val).slice(0, 16) : '')}">`;
    else input = `<input type="text" ${name} value="${esc(val)}">`;
    return `<label class="${WIDE.has(key) || kind === 'textarea' ? 'full' : ''}">${esc(label)}${input}</label>`;
  }

  function openEditor(b, isNew) {
    editing = { business: b, isNew };
    $('#editor-title').textContent = isNew ? 'New business' : b.business || 'Business';
    $('#editor-sub').textContent = isNew ? 'Fill in what you know; everything can be edited later.'
      : [b.id, b.region, b.sector, b.lastUpdated && 'updated ' + fmtDate(b.lastUpdated)].filter(Boolean).join(' · ');
    $('#editor-fields').innerHTML = GROUPS.map(g => `<fieldset><legend>${g.title}</legend><div class="fields">
      ${g.fields.map(([k, l, kind]) => fieldInput(k, l, kind, b[k])).join('')}</div></fieldset>`).join('');
    $('#quick-actions').innerHTML = isNew ? '' : [
      ['No answer', 'No answer'], ['Left message', 'Left message'], ['Interested', 'Interested'],
      ['Meeting scheduled', 'Meeting scheduled'], ['Meeting done', 'Meeting completed'],
      ['Not interested', 'Not interested'], ['Won! 🎉', '__won'],
    ].map(([l, s]) => `<button type="button" data-quick="${esc(s)}">${esc(l)}</button>`).join('')
      + `<button type="button" data-followup="2">Follow up in 2 days</button><button type="button" data-followup="7">in 1 week</button>`;
    $('#delete-btn').hidden = isNew;
    dlg.showModal();
  }

  function readForm() {
    const f = $('#editor-form');
    const out = {};
    ALL_FIELDS.forEach(([k]) => { const el = f.elements[k]; if (el) out[k] = el.value; });
    return out;
  }
  function setField(k, v) { const el = $('#editor-form').elements[k]; if (el) el.value = v; }

  function commitEditor() {
    const b = editing.business;
    const vals = readForm();
    const prev = b.status;
    vals.business = vals.business.trim();
    if (!vals.business) { toast('Business name is required'); return false; }
    Object.assign(b, vals);
    applyStatusRules(b, prev);
    if (editing.isNew) {
      if (!b.id) b.id = nextId(b.region, b.icp);
      if (state.businesses.some(x => x.id === b.id)) { toast(`ID ${b.id} already exists`); return false; }
      state.businesses.push(b);
    }
    touch(b);
    save(); filtersBuilt = false; render();
    toast(editing.isNew ? 'Business added' : 'Saved');
    return true;
  }

  $('#editor-form').addEventListener('submit', e => { if (!commitEditor()) e.preventDefault(); });
  dlg.addEventListener('click', e => {
    if (e.target === dlg) dlg.close();
    const q = e.target.closest('[data-quick]');
    if (q) {
      const s = q.dataset.quick;
      if (s === '__won') { setField('dealWon', 'Yes'); setField('followUpNeeded', 'No'); }
      else {
        setField('status', s);
        const tmp = Object.assign({}, editing.business, readForm());
        applyStatusRules(tmp, editing.business.status);
        ['contacted', 'firstContactDate', 'followUpNeeded', 'meetingScheduled', 'meetingCompleted'].forEach(k => setField(k, tmp[k]));
      }
      toast('Updated — press Save to keep');
    }
    const fu = e.target.closest('[data-followup]');
    if (fu) {
      const d = new Date(); d.setDate(d.getDate() + Number(fu.dataset.followup));
      setField('followUpNeeded', 'Yes');
      setField('followUpDate', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      toast('Follow-up set — press Save to keep');
    }
    if (e.target.closest('[data-close]')) dlg.close();
  });
  $('#delete-btn').addEventListener('click', () => {
    const b = editing.business;
    if (!confirm(`Delete ${b.business}? This can't be undone (unless you have a backup).`)) return;
    state.businesses = state.businesses.filter(x => x !== b);
    save(); dlg.close(); filtersBuilt = false; render(); toast('Deleted');
  });

  // ---------- Events ----------
  document.querySelectorAll('.tabs button').forEach(btn => btn.addEventListener('click', () => show(btn.dataset.view)));
  $('#add-btn').addEventListener('click', () => {
    const b = Object.assign(blank(), { status: 'Not started', contacted: 'No', followUpNeeded: 'No', meetingScheduled: 'No', meetingCompleted: 'No', dealWon: 'No', priority: 'Medium' });
    const r = $('#f-region').value; if (r) b.region = r;
    openEditor(b, true);
  });

  document.addEventListener('click', e => {
    if (e.target.closest('select, input, textarea, dialog')) return;
    const th = e.target.closest('th[data-sort]');
    if (th) { const k = th.dataset.sort; sort = { key: k, asc: sort.key === k ? !sort.asc : true }; renderPipeline(); return; }
    const o = e.target.closest('[data-open]');
    if (o) { const b = state.businesses.find(x => x.id === o.dataset.open); if (b) openEditor(b, false); }
  });

  // Inline status change in the pipeline table
  document.addEventListener('change', e => {
    const sel = e.target.closest('select[data-status]');
    if (sel) {
      const b = state.businesses.find(x => x.id === sel.dataset.status);
      const prev = b.status; b.status = sel.value; applyStatusRules(b, prev); touch(b); save(); renderPipeline();
      toast(`${b.business}: ${b.status}`);
    }
    const p = e.target.closest('[data-plan]');
    if (p) { state.plan[p.dataset.plan][p.dataset.k] = p.value; save(); renderPlan(); }
  });
  document.addEventListener('click', e => {
    if (e.target.id === 'plan-reset' && confirm('Reset the weekly plan text and targets?')) { state.plan = clone(DEFAULT_PLAN); save(); renderPlan(); }
  });

  FILTERS.forEach(([sel]) => $(sel).addEventListener('change', renderPipeline));
  $('#f-search').addEventListener('input', renderPipeline);
  $('#f-clear').addEventListener('click', () => { FILTERS.forEach(([sel]) => { $(sel).value = ''; }); $('#f-search').value = ''; renderPipeline(); });

  // ---------- Import / export ----------
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const closeMenu = () => $('.menu').removeAttribute('open');
  $('#export-csv').addEventListener('click', () => {
    const cols = [...ALL_FIELDS, ['lastUpdated', 'Last updated']];
    const cell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [cols.map(c => cell(c[1])).join(','), ...state.businesses.map(b => cols.map(([k]) => cell(b[k])).join(','))].join('\n');
    download(`beacon-outreach-${todayISO()}.csv`, '﻿' + csv, 'text/csv');
    closeMenu();
  });
  $('#export-json').addEventListener('click', () => {
    download(`beacon-outreach-backup-${todayISO()}.json`, JSON.stringify(state, null, 2), 'application/json');
    closeMenu();
  });
  $('#import-json').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const s = JSON.parse(await file.text());
      if (!Array.isArray(s.businesses)) throw new Error('bad file');
      if (!confirm(`Replace current data with ${s.businesses.length} businesses from this backup?`)) return;
      state = { businesses: s.businesses.map(b => Object.assign(blank(), b)), plan: Array.isArray(s.plan) ? s.plan : clone(DEFAULT_PLAN) };
      save(); filtersBuilt = false; render(); toast('Backup restored');
    } catch (err) { toast('That file is not a valid backup'); }
    e.target.value = ''; closeMenu();
  });
  $('#reset-data').addEventListener('click', () => {
    if (!confirm('Discard all changes and reload the original spreadsheet data? Download a backup first if unsure.')) return;
    state = freshState(); save(); filtersBuilt = false; render(); toast('Reset to original data'); closeMenu();
  });

  // ---------- Start ----------
  let startView = 'today';
  try { startView = localStorage.getItem(KEY + '-view') || 'today'; } catch (e) { /* ignore */ }
  show(['today', 'pipeline', 'dashboard', 'plan'].includes(startView) ? startView : 'today');
})();
