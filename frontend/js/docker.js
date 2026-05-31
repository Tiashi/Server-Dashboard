async function loadDocker() {
  const el = document.getElementById('page-docker');
  el.innerHTML = `
    <div class="page-title">Docker</div>
    <div class="page-subtitle">GESTIONE COMPOSE STACKS</div>

    <div class="tab-nav">
      <button class="tab-btn active" data-tab="compose">Compose</button>
      <button class="tab-btn" data-tab="images">Immagini</button>
      <button class="tab-btn" data-tab="networks">Reti</button>
      <button class="tab-btn" data-tab="docker-settings">Impostazioni</button>
    </div>

    <div id="tab-compose" class="tab-content active">
      <div id="compose-list" style="margin-top:16px"></div>
    </div>

    <div id="tab-images" class="tab-content">
      <div class="panel" style="margin-top:16px">
        <div class="panel-header">
          <span>Immagini</span>
          <div class="action-row">
            <button class="btn btn-red" id="images-prune">🗑 Prune</button>
            <button class="btn" id="images-refresh">↻ Aggiorna</button>
          </div>
        </div>
        <div id="images-body"><div class="empty-state"><div class="spinner"></div></div></div>
      </div>
    </div>

    <div id="tab-networks" class="tab-content">
      <div class="panel" style="margin-top:16px">
        <div class="panel-header">
          <span>Reti</span>
          <button class="btn" id="networks-refresh">↻ Aggiorna</button>
        </div>
        <div id="networks-body"><div class="empty-state"><div class="spinner"></div></div></div>
      </div>
    </div>

    <div id="tab-docker-settings" class="tab-content">
      <div class="panel" style="margin-top:16px">
        <div class="panel-header">Percorso Compose</div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:6px">Directory base</label>
            <input id="compose-base-dir" type="text" placeholder="~/docker"
              style="width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font-mono);font-size:12px"/>
            <div style="font-size:10px;color:var(--text-dim);margin-top:4px">
              Ogni sottocartella con un docker-compose.yaml sarà rilevata come stack.
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-green" id="compose-dir-save" style="padding:8px 20px">✓ Salva</button>
            <span id="compose-dir-msg" style="font-size:11px"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  el.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      el.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  document.getElementById('images-refresh').addEventListener('click', renderImages);
  document.getElementById('networks-refresh').addEventListener('click', renderNetworks);
  document.getElementById('images-prune').addEventListener('click', async () => {
    if (!await dlgConfirm('Rimuovere tutte le immagini dangling? L\'operazione è irreversibile.')) return;
    try {
      const result = await POST('/docker/images/prune');
      await renderImages();
      alert(`Pulizia completata. Spazio liberato: ${fmtBytes(result.reclaimed)}`);
    } catch (err) { alert(`Errore: ${err.message}`); }
  });

  try {
    const s = await GET('/docker/compose/settings');
    document.getElementById('compose-base-dir').value = s.base_dir || '';
  } catch(e) {}

  document.getElementById('compose-dir-save').addEventListener('click', async () => {
    const dir = document.getElementById('compose-base-dir').value.trim();
    const msg = document.getElementById('compose-dir-msg');
    if (!dir) return;
    try {
      await PATCH('/docker/compose/settings', { base_dir: dir });
      msg.style.color = 'var(--teal)';
      msg.textContent = '✓ Salvato';
      renderComposeList();
      setTimeout(() => msg.textContent = '', 2000);
    } catch(e) {
      msg.style.color = 'var(--red)';
      msg.textContent = `✕ ${e.message}`;
    }
  });

  renderComposeList();
  renderImages();
  renderNetworks();
}

// ── COMPOSE LIST ──────────────────────────────────────────────
async function renderComposeList() {
  const el = document.getElementById('compose-list');
  if (!el) return;
  el.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;

  let stacks;
  try {
    stacks = await GET('/docker/compose/stacks');
  } catch(e) {
    el.innerHTML = `<div class="empty-state">Errore: ${e.message}</div>`;
    return;
  }

  if (!stacks.length) {
    el.innerHTML = `<div class="empty-state">Nessuno stack trovato nella directory configurata.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="compose-grid">
      ${stacks.map(s => `
        <div class="compose-card" id="stack-${s.name}">
          <div class="compose-card-header">
            <div class="compose-card-title">
              <span class="compose-dot" id="stack-dot-${s.name}"></span>
              <span style="color:#fff;font-size:13px;font-weight:600">${s.name}</span>
              <span id="stack-badge-${s.name}"></span>
            </div>
          </div>
          <div id="stack-table-${s.name}">
            <div class="empty-state" style="padding:20px"><div class="spinner"></div></div>
          </div>
          <div class="compose-card-footer">
            <button class="btn" data-action="pull" data-stack="${s.name}">⬇ Pull</button>
            <div class="compose-footer-divider"></div>
            <button class="btn btn-green" data-action="up" data-stack="${s.name}">▲ Up</button>
            <button class="btn btn-red"   data-action="down" data-stack="${s.name}">▼ Down</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  _injectComposeGridStyle();

  stacks.forEach(s => loadStackStatus(s.name));

  document.getElementById('compose-list').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, stack, container } = btn.dataset;
    if (container) {
      await handleContainerAction(action, stack, container, btn);
    } else {
      await handleComposeAction(action, stack, btn);
    }
  });
}

function _injectComposeGridStyle() {
  if (document.getElementById('compose-grid-style')) return;
  const style = document.createElement('style');
  style.id = 'compose-grid-style';
  style.textContent = `
    .compose-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 14px;
    }
    .compose-card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .compose-card-header {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
    }
    .compose-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .compose-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--text-dim);
    }
    .compose-dot.dot-green  { background: var(--teal); }
    .compose-dot.dot-yellow { background: var(--amber); }
    .compose-dot.dot-red    { background: var(--red); }
    .compose-card-footer {
      padding: 10px 14px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .compose-footer-divider {
      width: 1px;
      height: 14px;
      background: var(--border);
      margin: 0 2px;
    }
    .compose-stack-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .compose-stack-table th {
      font-size: 9px;
      color: var(--text-dim);
      letter-spacing: 1px;
      text-transform: uppercase;
      font-weight: 600;
      padding: 7px 14px 6px;
      border-bottom: 1px solid var(--border);
    }
    .compose-stack-table th.col-name    { width: 28%; text-align: left; }
    .compose-stack-table th.col-status  { width: 18%; text-align: center; }
    .compose-stack-table th.col-ports   { width: 18%; text-align: center; }
    .compose-stack-table th.col-actions { width: 36%; text-align: right; }
    .compose-stack-table td {
      font-size: 11px;
      padding: 6px 14px;
      vertical-align: middle;
      border-bottom: 1px solid var(--bg3);
    }
    .compose-stack-table tr:last-child td { border-bottom: none; }
    .compose-stack-table td.col-name    { color: #fff; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .compose-stack-table td.col-status  { text-align: center; }
    .compose-stack-table td.col-ports   { text-align: center; color: var(--text-dim); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .compose-stack-table td.col-actions { text-align: right; }
    .container-row-actions {
      display: flex;
      gap: 4px;
      justify-content: flex-end;
      align-items: center;
    }
    .btn-icon {
      padding: 4px 7px;
      font-size: 11px;
    }
    @media (max-width: 820px) {
      .compose-grid {
        grid-template-columns: 1fr;
      }
      .compose-stack-table th.col-ports,
      .compose-stack-table td.col-ports {
        display: none;
      }
      .compose-stack-table th.col-name    { width: 35%; }
      .compose-stack-table th.col-status  { width: 25%; }
      .compose-stack-table th.col-actions { width: 40%; }
    }
  `;
  document.head.appendChild(style);
}

// ── STACK STATUS ──────────────────────────────────────────────
async function loadStackStatus(name) {
  const tableEl = document.getElementById(`stack-table-${name}`);
  const badgeEl = document.getElementById(`stack-badge-${name}`);
  const dotEl   = document.getElementById(`stack-dot-${name}`);
  if (!tableEl) return;

  try {
    const data = await GET(`/docker/compose/stacks/${name}/status`);
    const containers = data.containers || [];

    if (!containers.length) {
      dotEl.className = 'compose-dot dot-red';
      badgeEl.innerHTML = `<span class="badge badge-red">down</span>`;
      tableEl.innerHTML = `
        <table class="compose-stack-table">
          <thead><tr>
            <th class="col-name">Container</th>
            <th class="col-status">Stato</th>
            <th class="col-ports">Porte</th>
            <th class="col-actions">Azioni</th>
          </tr></thead>
          <tbody><tr><td colspan="4" style="padding:14px;color:var(--text-dim);font-size:11px">Nessun container attivo</td></tr></tbody>
        </table>`;
      return;
    }

    const running = containers.filter(c => c.state === 'running').length;
    const total   = containers.length;

    if (running === total) {
      dotEl.className = 'compose-dot dot-green';
      badgeEl.innerHTML = `<span class="badge badge-green">${running}/${total} running</span>`;
    } else if (running === 0) {
      dotEl.className = 'compose-dot dot-red';
      badgeEl.innerHTML = `<span class="badge badge-red">0/${total} running</span>`;
    } else {
      dotEl.className = 'compose-dot dot-yellow';
      badgeEl.innerHTML = `<span class="badge badge-yellow">${running}/${total} running</span>`;
    }

    const rows = containers.map(c => {
      const isRunning = c.state === 'running';
      const ports = (c.ports || [])
        .filter(p => p.PublishedPort)
        .map(p => `${p.PublishedPort}→${p.TargetPort}`)
        .join(', ') || '—';

      const toggleBtn = isRunning
        ? `<button class="btn btn-red btn-icon" data-action="stop" data-stack="${name}" data-container="${c.name}">■ Stop</button>`
        : `<button class="btn btn-green btn-icon" data-action="start" data-stack="${name}" data-container="${c.name}">▶ Start</button>`;

      return `<tr>
        <td class="col-name">${c.name}</td>
        <td class="col-status"><span class="badge ${isRunning ? 'badge-green' : 'badge-red'}">${c.status || c.state}</span></td>
        <td class="col-ports">${ports}</td>
        <td class="col-actions">
          <div class="container-row-actions">
            ${toggleBtn}
            <button class="btn btn-icon" data-action="logs" data-stack="${name}" data-container="${c.name}">📄 Logs</button>
            <button class="btn btn-icon" style="border-color:var(--amber-dim);color:var(--amber)" data-action="update-image" data-stack="${name}" data-container="${c.name}">🏷</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    tableEl.innerHTML = `
      <table class="compose-stack-table">
        <thead><tr>
          <th class="col-name">Container</th>
          <th class="col-status">Stato</th>
          <th class="col-ports">Porte</th>
          <th class="col-actions">Azioni</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

  } catch(e) {
    dotEl.className = 'compose-dot dot-red';
    badgeEl.innerHTML = `<span class="badge badge-red">errore</span>`;
    tableEl.innerHTML = `<div class="empty-state" style="padding:16px">Impossibile leggere lo stato</div>`;
  }
}

// ── COMPOSE ACTIONS ───────────────────────────────────────────
async function handleComposeAction(action, stack, btn) {
  const origText = btn.textContent;
  const setLoading = () => {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:9px;height:9px;border-width:1.5px"></span>';
  };
  const reset = () => { btn.disabled = false; btn.textContent = origText; };

  const confirmMap = {
    down: `Eseguire "down" su ${stack}? I container verranno fermati e rimossi.`,
    pull: `Scaricare le ultime immagini per ${stack}? Potrebbe richiedere tempo.`,
  };
  if (confirmMap[action] && !await dlgConfirm(confirmMap[action])) return;

  setLoading();
  try {
    const ep = {
      up:   `/docker/compose/stacks/${stack}/up`,
      down: `/docker/compose/stacks/${stack}/down`,
      pull: `/docker/compose/stacks/${stack}/pull`,
    };
    const result = await POST(ep[action]);
    if (result.output) openOutputModal(stack, action, result.output);
    await loadStackStatus(stack);
  } catch(e) {
    openOutputModal(stack, action, `ERRORE:\n${e.message}`);
  } finally {
    reset();
  }
}

// ── CONTAINER ACTIONS ─────────────────────────────────────────
async function handleContainerAction(action, stack, container, btn) {
  if (action === 'logs') {
    openContainerLogsModal(container);
    return;
  }

  if (action === 'update-image') {
    openUpdateImageModal(stack, container);
    return;
  }

  // start / stop
  const origText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:9px;height:9px;border-width:1.5px"></span>';

  try {
    await POST(`/docker/containers/${container}/${action}`);
    await loadStackStatus(stack);
  } catch(e) {
    alert(`Errore: ${e.message}`);
    btn.disabled = false;
    btn.textContent = origText;
  }
}

// ── UPDATE IMAGE MODAL ────────────────────────────────────────
async function openUpdateImageModal(stack, containerName) {
  let images;
  try {
    images = await GET(`/docker/compose/stacks/${stack}/images`);
  } catch(e) {
    alert(`Impossibile leggere le immagini: ${e.message}`);
    return;
  }

  // Se viene da un container specifico, filtra solo il servizio relativo
  // (il nome container di solito contiene il nome servizio)
  const filtered = images.filter(img =>
    containerName ? containerName.includes(img.service) : true
  );
  const list = filtered.length ? filtered : images;

  const modal   = document.getElementById('log-modal');
  const titleEl = document.getElementById('log-title');
  const content = document.getElementById('log-content');

  titleEl.textContent = `Aggiorna immagine — ${containerName || stack}`;
  modal.classList.remove('hidden');
  content.style.display = 'none';

  modal.querySelector('.update-image-form')?.remove();
  const form = document.createElement('div');
  form.className = 'update-image-form';
  form.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;flex:1';

  form.innerHTML = list.map(img => `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
      <div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:2px">Servizio</div>
      <div style="font-size:12px;color:#fff;margin-bottom:8px">${img.service}</div>
      <div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:2px">Immagine attuale</div>
      <div style="font-size:11px;color:var(--teal);margin-bottom:10px;word-break:break-all">${img.image}</div>
      <div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Nuovo tag</div>
      <div style="display:flex;gap:8px">
        <input type="text" class="img-tag-input" data-service="${img.service}"
          value="${img.tag}" placeholder="es. latest, 2.13.0"
          style="flex:1;padding:8px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font-mono);font-size:12px"/>
        <button class="btn" data-update-svc="${img.service}" data-stack="${stack}">Salva tag</button>
        <button class="btn btn-green" data-deploy-svc="${img.service}" data-stack="${stack}">⬇ Pull + Up</button>
      </div>
    </div>
  `).join('');

  content.insertAdjacentElement('afterend', form);

  form.addEventListener('click', async e => {
    const updateBtn = e.target.closest('[data-update-svc]');
    const deployBtn = e.target.closest('[data-deploy-svc]');
    const btn = updateBtn || deployBtn;
    if (!btn) return;

    const svc   = btn.dataset.updateSvc || btn.dataset.deploySvc;
    const stack = btn.dataset.stack;
    const input = form.querySelector(`.img-tag-input[data-service="${svc}"]`);
    const tag   = input?.value.trim();
    if (!tag) return;

    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:9px;height:9px;border-width:1.5px"></span>';

    try {
      if (updateBtn) {
        await POST(`/docker/compose/stacks/${stack}/images/update`, { service: svc, tag });
        btn.textContent = '✓ Salvato';
        btn.style.color = 'var(--teal)';
        setTimeout(() => { btn.textContent = orig; btn.style.color = ''; btn.disabled = false; }, 1500);
      } else {
        const res = await POST(`/docker/compose/stacks/${stack}/images/update-and-deploy`, { service: svc, tag });
        _closeUpdateModal(modal, form, content);
        openOutputModal(stack, 'pull + up', res.output || '');
        await loadStackStatus(stack);
      }
    } catch(err) {
      btn.textContent = '✕ Errore';
      btn.style.color = 'var(--red)';
      setTimeout(() => { btn.textContent = orig; btn.style.color = ''; btn.disabled = false; }, 2000);
    }
  });

  document.getElementById('log-close').onclick = () => _closeUpdateModal(modal, form, content);
}

function _closeUpdateModal(modal, form, content) {
  modal.classList.add('hidden');
  form.remove();
  content.style.display = '';
}

// ── OUTPUT MODAL ──────────────────────────────────────────────
function openOutputModal(stack, action, output) {
  const modal   = document.getElementById('log-modal');
  const titleEl = document.getElementById('log-title');
  const content = document.getElementById('log-content');
  modal.querySelector('.update-image-form')?.remove();
  content.style.display = '';
  titleEl.textContent = `${stack} — ${action}`;
  content.textContent = output || '(nessun output)';
  modal.classList.remove('hidden');
  content.scrollTop = content.scrollHeight;
  document.getElementById('log-close').onclick = () => modal.classList.add('hidden');
}

// ── CONTAINER LOGS MODAL ──────────────────────────────────────
async function openContainerLogsModal(containerName) {
  const modal   = document.getElementById('log-modal');
  const titleEl = document.getElementById('log-title');
  const content = document.getElementById('log-content');
  modal.querySelector('.update-image-form')?.remove();
  content.style.display = '';
  titleEl.textContent = `Logs — ${containerName}`;
  content.textContent = 'Caricamento...';
  modal.classList.remove('hidden');

  // Usa l'ID corto del container — cerca per nome
  try {
    const containers = await GET('/docker/containers');
    const match = containers.find(c => c.name === containerName);
    if (!match) throw new Error('Container non trovato');
    const data = await GET(`/docker/containers/${match.id}/logs?tail=200`);
    content.textContent = data.logs || '(nessun log)';
    content.scrollTop = content.scrollHeight;
  } catch(e) {
    content.textContent = `Errore: ${e.message}`;
  }

  document.getElementById('log-close').onclick = () => modal.classList.add('hidden');
}

// ── IMMAGINI ──────────────────────────────────────────────────
async function renderImages() {
  const body = document.getElementById('images-body');
  if (!body) return;
  body.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;
  let images;
  try {
    images = await GET('/docker/images');
  } catch(e) {
    body.innerHTML = `<div class="empty-state">Errore: ${e.message}</div>`;
    return;
  }
  if (!images.length) {
    body.innerHTML = '<div class="empty-state">Nessuna immagine trovata</div>';
    return;
  }
  const fmtDate = iso => iso
    ? new Date(iso).toLocaleString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' })
    : '—';
  body.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Tag</th><th>ID</th><th>Dimensione</th><th>Creata</th>
      </tr></thead>
      <tbody>
        ${images.map(img => `
          <tr>
            <td><strong>${img.tags[0] || '—'}</strong>
              ${img.tags.slice(1).map(t => `<div style="font-size:10px;color:var(--text-dim)">${t}</div>`).join('')}
            </td>
            <td style="color:var(--text-dim)">${img.id}</td>
            <td>${fmtBytes(img.size)}</td>
            <td>${fmtDate(img.created)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

// ── RETI ──────────────────────────────────────────────────────
async function renderNetworks() {
  const body = document.getElementById('networks-body');
  if (!body) return;
  body.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;
  let networks;
  try {
    networks = await GET('/docker/networks');
  } catch(e) {
    body.innerHTML = `<div class="empty-state">Errore: ${e.message}</div>`;
    return;
  }
  if (!networks.length) {
    body.innerHTML = '<div class="empty-state">Nessuna rete trovata</div>';
    return;
  }
  body.innerHTML = networks.map(net => `
    <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <strong style="color:#fff">${net.name}</strong>
          <span class="badge badge-yellow">${net.driver}</span>
        </div>
        <span style="font-size:11px;color:var(--teal)">${net.subnet}</span>
      </div>
      ${net.containers.length
        ? `<div style="display:flex;flex-wrap:wrap;gap:6px">
            ${net.containers.map(c => `
              <span style="font-size:10px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:2px 8px">
                ${c.name} <span style="color:var(--text-dim)">${c.ipv4}</span>
              </span>`).join('')}
          </div>`
        : `<span style="font-size:11px;color:var(--text-dim)">Nessun container collegato</span>`
      }
    </div>
  `).join('');
}