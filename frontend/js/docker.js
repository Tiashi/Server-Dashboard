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

  el.innerHTML = `<div class="compose-wrap">
    ${stacks.map(s => `
      <div class="compose-block" id="stack-${s.name}">
        <div class="compose-header">
          <div class="compose-header-left">
            <span class="compose-dot" id="stack-dot-${s.name}"></span>
            <span class="compose-stack-name">${s.name}</span>
          </div>
          <span id="stack-badge-${s.name}"></span>
        </div>
        <div id="stack-table-${s.name}">
          <div class="empty-state" style="padding:20px"><div class="spinner"></div></div>
        </div>
        <div class="compose-footer">
          <button class="btn-compose c-green" data-action="up"   data-stack="${s.name}">▲ Up</button>
          <button class="btn-compose c-red"   data-action="down" data-stack="${s.name}">▼ Down</button>
          <div class="compose-footer-divider"></div>
          <button class="btn-compose"         data-action="pull" data-stack="${s.name}">⬇ Pull</button>
        </div>
      </div>
    `).join('')}
  </div>`;

  stacks.forEach(s => loadStackStatus(s.name));

  el.addEventListener('click', async e => {
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

// ── STACK STATUS ──────────────────────────────────────────────
async function loadStackStatus(name) {
  const tableEl = document.getElementById(`stack-table-${name}`);
  const badgeEl = document.getElementById(`stack-badge-${name}`);
  const dotEl   = document.getElementById(`stack-dot-${name}`);
  if (!tableEl) return;

  const thead = `
    <thead><tr>
      <th class="c-name">Container</th>
      <th class="c-status">Stato</th>
      <th class="c-ports">Porte</th>
      <th class="c-actions">Azioni</th>
    </tr></thead>`;

  try {
    const data = await GET(`/docker/compose/stacks/${name}/status`);
    const containers = data.containers || [];

    if (!containers.length) {
      dotEl.className = 'compose-dot dot-red';
      badgeEl.innerHTML = `<span class="badge badge-red">down</span>`;
      tableEl.innerHTML = `
        <table class="compose-tbl">${thead}
          <tbody><tr><td class="compose-empty" colspan="4">Nessun container attivo</td></tr></tbody>
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
        ? `<button class="btn-row r-red"   data-action="stop"  data-stack="${name}" data-container="${c.name}">■ Stop</button>`
        : `<button class="btn-row r-green" data-action="start" data-stack="${name}" data-container="${c.name}">▶ Start</button>`;

      return `<tr>
        <td class="c-name">${c.name}</td>
        <td class="c-status"><span class="badge ${isRunning ? 'badge-green' : 'badge-red'}">${isRunning ? 'running' : 'exited'}</span></td>
        <td class="c-ports">${ports}</td>
        <td class="c-actions">
          <div class="row-actions">
            ${toggleBtn}
            <button class="btn-row" data-action="logs" data-stack="${name}" data-container="${c.name}">📄 Logs</button>
            <button class="btn-row r-amber" data-action="update-image" data-stack="${name}" data-container="${c.name}">🏷 Image</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    tableEl.innerHTML = `<table class="compose-tbl">${thead}<tbody>${rows}</tbody></table>`;

  } catch(e) {
    dotEl.className = 'compose-dot dot-red';
    badgeEl.innerHTML = `<span class="badge badge-red">errore</span>`;
    tableEl.innerHTML = `<div class="compose-empty">Impossibile leggere lo stato</div>`;
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

  const filtered = images.filter(img => containerName ? containerName.includes(img.service) : true);
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
    const stk   = btn.dataset.stack;
    const input = form.querySelector(`.img-tag-input[data-service="${svc}"]`);
    const tag   = input?.value.trim();
    if (!tag) return;

    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:9px;height:9px;border-width:1.5px"></span>';

    try {
      if (updateBtn) {
        await POST(`/docker/compose/stacks/${stk}/images/update`, { service: svc, tag });
        btn.textContent = '✓ Salvato';
        btn.style.color = 'var(--teal)';
        setTimeout(() => { btn.textContent = orig; btn.style.color = ''; btn.disabled = false; }, 1500);
      } else {
        const res = await POST(`/docker/compose/stacks/${stk}/images/update-and-deploy`, { service: svc, tag });
        _closeUpdateModal(modal, form, content);
        openOutputModal(stk, 'pull + up', res.output || '');
        await loadStackStatus(stk);
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
  const modal   = document.getElementById('log-output-modal');
  const titleEl = document.getElementById('log-output-title');
  const content = document.getElementById('log-output-content');

  titleEl.textContent = `Logs — ${containerName}`;
  content.textContent = 'Caricamento...';
  modal.classList.remove('hidden');

  try {
    const containers = await GET('/docker/containers');
    const match = containers.find(c => c.name === containerName);
    if (!match) throw new Error('Container non trovato');
    const data = await GET(`/docker/containers/${match.id}/logs?tail=200`);
    content.innerHTML = formatLogs(data.logs || '');
    content.scrollTop = content.scrollHeight;
  } catch(e) {
    content.textContent = `Errore: ${e.message}`;
  }

  document.getElementById('log-output-close').onclick = () => modal.classList.add('hidden');
}

function formatLogs(raw) {
  if (!raw) return '<span style="color:var(--text-dim)">(nessun log)</span>';

  return raw.split('\n').filter(l => l.trim()).map(line => {
    // Rimuovi timestamp Docker iniziale (es. 2026-06-01T08:28:15.185303368Z)
    line = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '');

    // Timestamp interno (es. 2026/06/01 08:28:15 oppure 08:28:15.123)
    line = line.replace(
      /(\d{4}[\/\-]\d{2}[\/\-]\d{2}\s+\d{2}:\d{2}:\d{2}[\.\d]*|\d{2}:\d{2}:\d{2}[\.\d]*)/g,
      '<span class="log-ts">$1</span>'
    );

    // Livello log
    const levelPatterns = [
      { re: /\b(ERROR|ERR|FATAL|CRIT|CRITICAL)\b/gi,   cls: 'log-error' },
      { re: /\b(WARN|WARNING)\b/gi,                     cls: 'log-warn'  },
      { re: /\b(INFO|NOTICE)\b/gi,                      cls: 'log-info'  },
      { re: /\b(DEBUG|TRACE)\b/gi,                      cls: 'log-debug' },
    ];

    for (const { re, cls } of levelPatterns) {
      line = line.replace(re, `<span class="${cls}">$1</span>`);
    }

    // Escape HTML residuo (tranne i tag che abbiamo già inserito)
    return `<div class="log-line">${line}</div>`;
  }).join('');
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