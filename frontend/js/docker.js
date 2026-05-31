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

    <!-- COMPOSE TAB -->
    <div id="tab-compose" class="tab-content active">
      <div id="compose-list" style="margin-top:16px"></div>
    </div>

    <!-- IMAGES TAB -->
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

    <!-- NETWORKS TAB -->
    <div id="tab-networks" class="tab-content">
      <div class="panel" style="margin-top:16px">
        <div class="panel-header">
          <span>Reti</span>
          <button class="btn" id="networks-refresh">↻ Aggiorna</button>
        </div>
        <div id="networks-body"><div class="empty-state"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- SETTINGS TAB -->
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

  // Tab switching
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

  // Settings
  try {
    const s = await GET('/docker/compose/settings');
    document.getElementById('compose-base-dir').value = s.base_dir || '';
  } catch(e) {}

  document.getElementById('compose-dir-save').addEventListener('click', async () => {
    const dir  = document.getElementById('compose-base-dir').value.trim();
    const msg  = document.getElementById('compose-dir-msg');
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

  el.innerHTML = stacks.map(s => `
    <div class="panel compose-stack" id="stack-${s.name}" style="margin-bottom:16px">
      <div class="panel-header" style="cursor:pointer" data-stack="${s.name}">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="color:#fff;font-size:13px">◈ ${s.name}</span>
          <span id="stack-badges-${s.name}"></span>
        </div>
        <div class="action-row">
          <button class="btn btn-green"  data-action="up"      data-stack="${s.name}">▶ Up</button>
          <button class="btn btn-red"    data-action="down"    data-stack="${s.name}">■ Down</button>
          <button class="btn"            data-action="restart" data-stack="${s.name}">↺ Restart</button>
          <button class="btn"            data-action="pull"    data-stack="${s.name}">⬇ Pull</button>
          <button class="btn"            data-action="logs"    data-stack="${s.name}">📄 Logs</button>
          <button class="btn"            data-action="update-image" data-stack="${s.name}">🏷 Aggiorna immagine</button>
        </div>
      </div>
      <div id="stack-status-${s.name}" style="display:none"></div>
    </div>
  `).join('');

  // Carica status per ogni stack
  stacks.forEach(s => loadStackStatus(s.name));

  // Event delegation
  el.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, stack } = btn.dataset;
    await handleStackAction(action, stack, btn);
  });
}

async function loadStackStatus(name) {
  const badgeEl  = document.getElementById(`stack-badges-${name}`);
  const statusEl = document.getElementById(`stack-status-${name}`);
  if (!badgeEl || !statusEl) return;

  try {
    const data = await GET(`/docker/compose/stacks/${name}/status`);
    const containers = data.containers || [];

    if (!containers.length) {
      badgeEl.innerHTML = `<span class="badge badge-red">down</span>`;
      statusEl.style.display = 'none';
      return;
    }

    const running = containers.filter(c => c.state === 'running').length;
    const total   = containers.length;
    badgeEl.innerHTML = running === total
      ? `<span class="badge badge-green">${running}/${total} running</span>`
      : `<span class="badge badge-yellow">${running}/${total} running</span>`;

    statusEl.style.display = 'block';
    statusEl.innerHTML = `
      <table class="data-table" style="font-size:11px">
        <thead><tr>
          <th>Container</th><th>Servizio</th><th>Stato</th><th>Porte</th>
        </tr></thead>
        <tbody>
          ${containers.map(c => {
            const running = c.state === 'running';
            const ports = (c.ports || [])
              .map(p => `${p.PublishedPort || ''}→${p.TargetPort || ''}/${p.Protocol || ''}`)
              .filter(p => p !== '→/')
              .join(', ') || '—';
            return `<tr>
              <td><strong>${c.name}</strong></td>
              <td style="color:var(--text-dim)">${c.service}</td>
              <td><span class="badge ${running ? 'badge-green' : 'badge-red'}">${c.status || c.state}</span></td>
              <td style="color:var(--text-dim);font-size:10px">${ports}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch(e) {
    badgeEl.innerHTML = `<span class="badge badge-red">errore</span>`;
  }
}

async function handleStackAction(action, stack, btn) {
  const origText = btn.textContent;
  const setLoading = () => {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:10px;height:10px;border-width:1.5px"></span>';
  };
  const reset = () => {
    btn.disabled = false;
    btn.textContent = origText;
  };

  if (action === 'logs') {
    openComposeLogsModal(stack);
    return;
  }

  if (action === 'update-image') {
    openUpdateImageModal(stack);
    return;
  }

  const confirmMap = {
    down: `Eseguire "down" su ${stack}? I container verranno fermati e rimossi.`,
    pull: `Scaricare le ultime immagini per ${stack}? Potrebbe richiedere tempo.`,
  };

  if (confirmMap[action]) {
    if (!await dlgConfirm(confirmMap[action])) return;
  }

  setLoading();
  try {
    const endpointMap = {
      up:      `/docker/compose/stacks/${stack}/up`,
      down:    `/docker/compose/stacks/${stack}/down`,
      restart: `/docker/compose/stacks/${stack}/restart`,
      pull:    `/docker/compose/stacks/${stack}/pull`,
    };
    const result = await POST(endpointMap[action]);
    if (result.output) openOutputModal(stack, action, result.output);
    await loadStackStatus(stack);
  } catch(e) {
    openOutputModal(stack, action, `ERRORE:\n${e.message}`);
  } finally {
    reset();
  }
}

// ── UPDATE IMAGE MODAL ────────────────────────────────────────
async function openUpdateImageModal(stack) {
  let images;
  try {
    images = await GET(`/docker/compose/stacks/${stack}/images`);
  } catch(e) {
    alert(`Impossibile leggere le immagini: ${e.message}`);
    return;
  }

  if (!images.length) {
    alert('Nessuna immagine trovata nel compose.');
    return;
  }

  // Usa il modal log come contenitore generico
  const modal   = document.getElementById('log-modal');
  const titleEl = document.getElementById('log-title');
  const content = document.getElementById('log-content');

  titleEl.textContent = `Aggiorna immagini — ${stack}`;
  modal.classList.remove('hidden');

  // Rimuoviamo il <pre> e inseriamo un div
  content.style.display = 'none';
  const existing = modal.querySelector('.update-image-form');
  if (existing) existing.remove();

  const form = document.createElement('div');
  form.className = 'update-image-form';
  form.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:16px;overflow-y:auto;flex:1';

  form.innerHTML = images.map(img => `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;letter-spacing:1px;text-transform:uppercase">Servizio</div>
      <div style="font-size:13px;color:#fff;margin-bottom:10px">${img.service}</div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;letter-spacing:1px;text-transform:uppercase">Immagine attuale</div>
      <div style="font-size:12px;color:var(--teal);margin-bottom:12px;word-break:break-all">${img.image}</div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;letter-spacing:1px;text-transform:uppercase">Nuovo tag</div>
      <div style="display:flex;gap:8px">
        <input
          type="text"
          class="img-tag-input"
          data-service="${img.service}"
          data-repo="${img.repo}"
          value="${img.tag}"
          placeholder="es. latest, 2.13.0, stable"
          style="flex:1;padding:8px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font-mono);font-size:12px"
        />
        <button class="btn" data-update-svc="${img.service}" data-stack="${stack}" style="white-space:nowrap">
          Aggiorna tag
        </button>
        <button class="btn btn-green" data-deploy-svc="${img.service}" data-stack="${stack}" style="white-space:nowrap">
          ⬇ Pull + Up
        </button>
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
    btn.innerHTML = '<span class="spinner" style="width:10px;height:10px;border-width:1.5px"></span>';

    try {
      if (updateBtn) {
        await POST(`/docker/compose/stacks/${stack}/images/update`, { service: svc, tag });
        btn.textContent = '✓';
        btn.style.color = 'var(--teal)';
        setTimeout(() => { btn.textContent = orig; btn.style.color = ''; btn.disabled = false; }, 1500);
        return;
      }
      if (deployBtn) {
        const res = await POST(`/docker/compose/stacks/${stack}/images/update-and-deploy`, { service: svc, tag });
        modal.classList.add('hidden');
        form.remove();
        content.style.display = '';
        openOutputModal(stack, 'update+deploy', res.output || '');
        await loadStackStatus(stack);
        return;
      }
    } catch(err) {
      btn.textContent = '✕ Errore';
      btn.style.color = 'var(--red)';
      setTimeout(() => { btn.textContent = orig; btn.style.color = ''; btn.disabled = false; }, 2000);
    }
  });

  document.getElementById('log-close').onclick = () => {
    modal.classList.add('hidden');
    form.remove();
    content.style.display = '';
  };
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

// ── COMPOSE LOGS MODAL ────────────────────────────────────────
async function openComposeLogsModal(stack) {
  const modal   = document.getElementById('log-modal');
  const titleEl = document.getElementById('log-title');
  const content = document.getElementById('log-content');
  modal.querySelector('.update-image-form')?.remove();
  content.style.display = '';
  titleEl.textContent = `Logs — ${stack}`;
  content.textContent = 'Caricamento...';
  modal.classList.remove('hidden');
  try {
    const data = await GET(`/docker/compose/stacks/${stack}/logs?tail=200`);
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
  const fmtDate = iso => iso ? new Date(iso).toLocaleString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
  body.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Tag</th><th>ID</th><th>Dimensione</th><th>Creata</th></tr></thead>
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
    </table>
  `;
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