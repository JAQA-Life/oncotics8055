/* Oncotics Scenario Lab. AGPL-3.0-or-later. No patient or imaging data access. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const json = value => `<pre>${escape(JSON.stringify(value, null, 2))}</pre>`;
  const badge = value => `<span class="badge ${['FACT','DERIVED','ASSUMPTION','SIMULATED'].includes(value) ? value : 'SIMULATED'}">${escape(value)}</span>`;
  const sourceLink = (url, label) => {
    try { if (!['https:', 'http:'].includes(new URL(url).protocol)) return escape(label); }
    catch { return escape(label); }
    return `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`;
  };
  let config, snapshot, current, tab = 'overview', worldMode = 'reality', timer, viewer, busy = false, idem;
  let generation = 0;
  function status(message, error = false) { $('status').textContent = message; $('status').className = error ? 'error' : ''; }
  async function api(path, body, headers = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 240000);
    try {
      const response = await fetch('/api/scenarios' + path, {method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: {'Accept':'application/json', ...(body === undefined ? {} : {'Content-Type':'application/json','X-CSRF-Token':config?.csrf_token || ''}), ...headers},
        body: body === undefined ? undefined : JSON.stringify(body)});
      const content = response.headers.get('content-type') || '';
      if (!content.includes('application/json')) throw new Error('Scenario Lab needs its authenticated API deployment. The static site alone cannot run simulations.');
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Scenario service unavailable');
      return value;
    } catch (e) { if (e.name === 'AbortError') throw new Error('Request timed out. Refresh to inspect existing scenarios before resubmitting.'); throw e; }
    finally { clearTimeout(timeout); }
  }
  function buttons() {
    $('retrieve').disabled = busy || !config;
    const engine = document.querySelector('[name=engine]:checked').value;
    const available = config?.engines.find(e => e.id === engine)?.available;
    $('run').disabled = busy || !snapshot?.snapshot.records.length || !available || !config?.worker_available || !$('reviewed').checked;
    $('cloud-consent-label').hidden = engine !== 'cloud';
  }
  async function scenarios() {
    const data = await api('');
    $('scenario-list').innerHTML = data.scenarios.length ? data.scenarios.map(s => `<button class="scenario-button" data-scenario="${escape(s.id)}">${escape(s.spec.title)}<span>${escape(s.state)} · ${Math.round(s.progress || 0)}%</span></button>`).join('') : '<p class="muted">No scenarios yet.</p>';
  }
  function destroyGlobe() { if (viewer) { viewer.destroy(); viewer = undefined; } }
  function render() {
    destroyGlobe();
    $('overview').hidden = tab !== 'overview'; $('detail').hidden = tab === 'overview';
    document.querySelectorAll('[data-tab]').forEach(b => { if (b.dataset.tab === tab) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
    $('snapshot-summary').textContent = snapshot ? `${snapshot.snapshot.records.length} source record occurrences · snapshot ${snapshot.id} · SHA-256 ${snapshot.sha256}` : 'No evidence snapshot selected.';
    if (tab === 'overview') { buttons(); return; }
    const empty = text => `<div class="empty">${escape(text)}</div>`;
    let html = '';
    if (tab === 'evidence') {
      html = '<h2>Frozen public evidence</h2><p class="muted">FACT labels preserve source fields. Search relevance, interpretations and entity mappings still require review.</p>';
      if (!snapshot) html += empty('Retrieve evidence in Overview before running a scenario.');
      else {
        const s = snapshot.snapshot;
        html += `<p class="muted">Snapshot ${escape(snapshot.id)} · ${escape(new Date(s.created_at * 1000).toLocaleString())}</p>`;
        html += '<h3>Entity resolution hints</h3>' + s.entities.map(e => `<div class="record">${badge('DERIVED')}${escape(e.input)} → ${escape(e.normalized)}<p>${escape(e.method)}. Source identity has not been confirmed.</p></div>`).join('');
        html += '<h3>Source coverage</h3><div class="table-wrap"><table><thead><tr><th>Source / concept</th><th>Receipt</th><th>Coverage</th></tr></thead><tbody>' + s.receipts.map(r => `<tr><td>${escape(r.source)} / ${escape(r.query)}</td><td>${escape(r.id)}</td><td>${escape(r.status)}${r.error ? ' · ' + escape(r.error) : ''}</td></tr>`).join('') + '</tbody></table></div>';
        html += '<h3>Preserved records</h3>' + (s.records.length ? s.records.map(r => `<article class="record">${badge('FACT')}${sourceLink(r.url,r.title)}<p>${escape(r.source_id)} · ${escape(r.source)} · query ${escape(r.matched_query)}</p><p class="muted">Receipt ${escape(r.receipt_id)} · field ${escape(r.locator)}</p><details><summary>Inspect source record</summary>${json(r.raw)}</details></article>`).join('') : empty('No records were retrieved. A scenario cannot run with empty evidence.'));
        html += `<details><summary>Evidence graph, receipts and integrity</summary>${json({sha256:snapshot.sha256, graph:s.graph, receipts:s.receipts})}</details>`;
        html += s.limitations.map(l => `<p class="muted">${escape(l)}</p>`).join('');
      }
    } else if (tab === 'agents') {
      html = '<h2>Synthetic stakeholders</h2><p class="muted">Every persona is SIMULATED. Names, roles and statements do not represent real people or professional advice.</p>';
      html += current?.agents?.length ? current.agents.map((a, i) => `<article class="record">${badge('SIMULATED')} <button data-agent="${i}">${escape(a.profile.name || a.profile.username || 'Synthetic agent ' + (i+1))}</button><p>${escape(a.profile.profession || a.profile.role || 'Engine-generated persona')}</p></article>`).join('') : empty('Agents will appear after the engine finishes preparing the scenario.');
    } else if (tab === 'simulation') {
      html = '<h2>Simulation progress</h2>';
      if (!current) html += empty('Create or select a scenario to inspect a run.');
      else {
        const p = current.engine_progress?.data || {};
        html += `<p>${badge('SIMULATED')} ${escape(current.spec.title)} · ${escape(current.state)} / ${escape(current.stage)}</p><progress value="${Math.max(0, Math.min(100,current.progress || 0))}" max="100" aria-label="Scenario progress"></progress>`;
        html += `<div class="metrics"><div class="metric"><strong>${Math.round(current.progress || 0)}%</strong><small>Workflow progress</small></div><div class="metric"><strong>${escape(p.current_round ?? '—')}</strong><small>Round / max ${escape(current.spec.rounds)}</small></div><div class="metric"><strong>${escape(p.total_actions_count ?? '—')}</strong><small>Synthetic actions</small></div></div>`;
        if (current.error) html += `<p role="alert">${escape(current.error)}</p>`;
        if (!['completed','failed','cancelled'].includes(current.state)) html += '<button id="cancel-run" type="button">Request cancellation</button>';
        html += '<h3>Observed synthetic interactions</h3><p class="muted">Bounded engine action window, up to 100 actions. Unavailable memory or reasoning is not inferred.</p>';
        html += (current.events || []).map(e => `<details class="record"><summary>SIMULATED · ${escape(e.data.agent_name || e.data.agent_id)} · round ${escape(e.data.round_num)} · ${escape(e.data.action_type)}</summary>${badge('SIMULATED')}${json(e.data)}</details>`).join('') || empty('No engine actions returned yet.');
        html += `<details><summary>Engine progress and stage identifiers</summary>${json({ids:current.engine_ids,progress:current.engine_progress})}</details>`;
        if (current.simulation_graph) html += `<details><summary>SIMULATED graph (separate from evidence)</summary>${badge('SIMULATED')}${json(current.simulation_graph.data)}</details>`;
      }
    } else if (tab === 'world') {
      html = '<h2>Evidence &amp; scenario world</h2><div class="mode-buttons">' + ['reality','simulation','difference'].map(m => `<button data-world="${m}" aria-pressed="${m === worldMode}">${m[0].toUpperCase()+m.slice(1)}</button>`).join('') + '</div>';
      const places = worldMode === 'reality' ? snapshot?.snapshot.locations || [] : current?.world?.[worldMode] || [];
      html += `<p class="muted">${worldMode === 'reality' ? 'Public trial registry coordinates only. No geocoding, patient locations or external map tiles.' : 'The pinned social engines do not provide geographic scenario deltas. This layer has no supported data.'}</p>`;
      if (places.length) {
        html += '<div id="globe" aria-label="Public trial location globe"></div><div class="table-wrap"><table><thead><tr><th>Location</th><th>Coordinates</th><th>Provenance</th></tr></thead><tbody>' + places.map(p => `<tr><td>${escape(p.label)}</td><td>${escape(p.lat)}, ${escape(p.lon)}</td><td>${badge(p.provenance)}</td></tr>`).join('') + '</tbody></table></div>';
      } else html += empty(worldMode === 'reality' ? 'No source-provided coordinates are available in this evidence snapshot.' : 'No supported synthetic location changes. No geographic difference is calculated.');
    } else if (tab === 'report') {
      html = '<h2>Scenario report</h2><p class="muted">Engine narrative stays SIMULATED even when it appears factual or cites sources. Source fields and explicit assumptions are listed separately.</p>';
      if (!current?.report) html += empty('The report will appear after simulation, upstream report generation and provenance auditing finish.');
      else {
        html += `<a href="/api/scenarios/${encodeURIComponent(current.id)}/export" download>Download report, evidence and reproducibility manifest (JSON)</a>`;
        html += current.report.claims.map(c => `<article class="record">${badge(c.provenance)}<p>${escape(c.text)}</p>${c.url ? sourceLink(c.url,'Source record') : ''}${c.locator ? `<p class="muted">Receipt ${escape(c.receipt_id)} · ${escape(c.locator)}</p>` : ''}${c.method ? `<p class="muted">${escape(c.method)}</p>` : ''}</article>`).join('');
        html += '<h3>Limitations</h3>' + current.report.limitations.map(l => `<p class="muted">${escape(l)}</p>`).join('');
        html += `<details><summary>Provenance audit method</summary>${json(current.report.audit)}</details>`;
      }
    }
    $('detail').innerHTML = html;
    if (tab === 'world' && $('globe')) mountGlobe(snapshot.snapshot.locations, ++generation);
    buttons();
  }
  async function mountGlobe(places, version) {
    const mount = $('globe');
    try {
      window.CESIUM_BASE_URL = '/assets/globe/';
      const C = await import('/assets/globe/index.js');
      if (version !== generation || !mount.isConnected || tab !== 'world') return;
      viewer = new C.Viewer(mount, {baseLayer:false, terrainProvider:new C.EllipsoidTerrainProvider(), animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false});
      viewer.scene.globe.baseColor = C.Color.fromCssColorString('#12305A');
      for (const p of places) viewer.entities.add({name:p.label, position:C.Cartesian3.fromDegrees(p.lon,p.lat),point:{pixelSize:7,color:C.Color.fromCssColorString('#14B8A6')},description:escape('FACT · public trial registry coordinate · ' + p.receipt_id)});
    } catch { if (mount.isConnected) mount.textContent = '3D rendering unavailable in this browser. Source-backed locations remain in the table below.'; destroyGlobe(); }
  }
  async function select(id) {
    clearTimeout(timer); current = await api('/' + encodeURIComponent(id));
    snapshot = await api('/evidence/' + encodeURIComponent(current.spec.snapshot_id));
    const form = $('scenario-form');
    for (const key of ['title','question','rounds','agent_budget']) form.elements[key].value = current.spec[key];
    form.elements.assumptions.value = current.spec.assumptions.join('\n');
    $('concepts').value = snapshot.snapshot.entities.map(e => e.input).join(', ');
    for (const radio of document.querySelectorAll('[name=engine]')) radio.checked = radio.value === current.spec.engine;
    for (const checkbox of $('sources').querySelectorAll('input')) checkbox.checked = snapshot.snapshot.receipts.some(r => r.source === checkbox.value);
    $('reviewed').checked = false; $('public-only').checked = false; $('cloud-consent').checked = false; idem = undefined;
    location.hash = current.id; tab = 'simulation'; render(); poll();
  }
  function poll() {
    clearTimeout(timer);
    if (!current || ['completed','failed','cancelled'].includes(current.state)) return;
    const id = current.id;
    timer = setTimeout(async () => {
      try {
        const value = await api('/' + encodeURIComponent(id));
        if (current?.id !== id) return;
        current = value; render(); await scenarios(); status(`${current.spec.title}: ${current.state} / ${current.stage}`); poll();
      } catch (e) { status(e.message, true); if (current?.id === id) poll(); }
    }, 5000);
  }
  $('retrieve').addEventListener('click', async () => {
    if (!$('public-only').checked) return status('Confirm public, non-patient research use before retrieving evidence.',true);
    busy = true; buttons(); status('Retrieving public evidence and preserving source receipts…');
    try {
      snapshot = await api('/evidence', {entities:$('concepts').value.split(',').map(s => s.trim()).filter(Boolean), sources:[...$('sources').querySelectorAll('input:checked')].map(e=>e.value), public_data_only:true});
      $('reviewed').checked = false; idem = undefined; tab = 'evidence'; render(); status('Evidence snapshot frozen. Inspect coverage and records, then return to Overview.');
    } catch (e) { status(e.message,true); } finally { busy = false; buttons(); }
  });
  $('scenario-form').addEventListener('submit', async event => {
    event.preventDefault(); if (!snapshot || busy) return;
    const form = new FormData(event.target); const engine = form.get('engine');
    if (!$('reviewed').checked || !$('public-only').checked || (engine === 'cloud' && !$('cloud-consent').checked)) return status('Review evidence and accept the required research/cloud disclosures.',true);
    busy = true; buttons(); idem ||= crypto.randomUUID();
    try {
      current = await api('', {title:form.get('title'),question:form.get('question'),snapshot_id:snapshot.id, assumptions:String(form.get('assumptions')).split('\n').map(s=>s.trim()).filter(Boolean),engine,rounds:Number(form.get('rounds')),agent_budget:Number(form.get('agent_budget')),research_only:true,public_data_only:true,cloud_consent:$('cloud-consent').checked}, {'Idempotency-Key':idem});
      location.hash = current.id; tab = 'simulation'; render(); await scenarios(); poll(); status('Scenario queued. Only the Oncotics server contacts the selected engine.');
    } catch (e) { status(e.message,true); } finally { busy = false; buttons(); }
  });
  document.addEventListener('click', async event => {
    const b = event.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.tab) { tab = b.dataset.tab; generation++; render(); }
      if (b.dataset.scenario) await select(b.dataset.scenario);
      if (b.dataset.world) { worldMode = b.dataset.world; render(); }
      if (b.dataset.agent !== undefined) {
        const a = current.agents[Number(b.dataset.agent)]; const id = a.profile.user_id ?? a.profile.agent_id;
        const events = (current.events || []).filter(e => String(e.data.agent_id) === String(id));
        $('agent-detail').innerHTML = `<h2>Synthetic agent inspection</h2>${badge('SIMULATED')}<h3>Engine persona</h3>${json(a.profile)}<h3>Observed interactions</h3>${json(events)}<p class="muted">The engine profile and bounded action history are shown as returned. Private reasoning, complete memory and per-agent evidence access are not exposed by this adapter; none is inferred.</p>`;
        $('agent-dialog').showModal();
      }
      if (b.id === 'cancel-run') { await api('/' + encodeURIComponent(current.id) + '/cancel', {}); status('Cancellation requested. It will be checked between upstream operations.'); }
    } catch (e) { status(e.message,true); }
  });
  $('close-dialog').onclick = () => $('agent-dialog').close();
  $('new-scenario').onclick = () => { clearTimeout(timer); current = undefined; snapshot = undefined; idem = undefined; tab='overview'; $('scenario-form').reset(); history.replaceState(null,'',location.pathname); render(); };
  $('scenario-form').addEventListener('input', event => { idem = undefined; if (event.target.id === 'concepts' || event.target.closest('#sources')) { snapshot=undefined; $('reviewed').checked=false; } buttons(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && current) poll(); });
  (async () => {
    try {
      config = await api('/config');
      for (const e of config.engines) $(e.id + '-health').textContent = e.available ? '· available' : e.enabled ? '· unreachable' : '· disabled';
      status(config.worker_available ? 'Scenario service ready. Begin with a public evidence snapshot.' : 'Scenario API available; worker is offline. Runs remain disabled until the worker is ready.');
      await scenarios();
      if (/^#[a-f0-9-]{36}$/.test(location.hash)) await select(location.hash.slice(1));
    } catch (e) { status(e.message,true); }
    buttons();
  })();
})();
