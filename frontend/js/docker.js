async function loadDocker() {
  const el = document.getElementById('page-docker');
  el.innerHTML = `
    <div class="page-title">Docker</div>
    <div class="page-subtitle">GESTIONE CONTAINER</div>

    <div class="tab-nav">
      <button class="tab-btn active" data-tab="containers">Container</button>
      <button class="tab-btn" data-tab="images">Immagini</button>
      <button class="tab-btn" data-tab="networks">Reti</button>
    </div>

    <div id="tab-containers" class="tab-content active">
      <div class="panel" style="margin-top:16px">
        <div class="panel-header">
          <span>Container</span>
          <button class="btn" id="docker-refresh">↻ Aggiorna</button>
        </div>
        <div id="docker-body"><div class="empty-state"><div class="spinner"></div></div></div>
      </div>
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
  `;

  el.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      el.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  document.getElementById('docker-refresh').addEventListener('click', renderContainers);
  document.getElementById('images-refresh').addEventListener('click', renderImages);
  document.getElementById('networks-refresh').addEventListener('click', renderNetworks);

  document.getElementById('images-prune').addEventListener('click', async () => {
    if (!await dlgConfirm('Rimuovere tutte le immagini dangling (senza tag)? L\'operazione è irreversibile.')) return;
    try {
      const result = await POST('/docker/images/prune');
      await renderImages();
      alert(`Pulizia completata. Spazio liberato: ${fmtBytes(result.reclaimed)}`);
    } catch (err) {
      alert(`Errore: ${err.message}`);
    }
  });

  renderContainers();
  renderImages();
  renderNetworks();
}

// ── CONTAINER ────────────────────────────────────────────────
async function renderContainers() {
  const body = document.getElementById('docker-body');
  if (!body) return;
  body.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;

  let containers;
  try {
    containers = await GET('/docker');
  } catch (e) {
    body.innerHTML = `<div class="empty-state">Errore: ${e.message}</div>`;
    return;
  }

  if (!containers.length) {
    body.innerHTML = '<div class="empty-state">Nessun container trovato</div>';
    return;
  }

  body.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Immagine</th>
          <th>Stato</th>
          <th>Porte</th>
          <th>Azioni</th>
        </tr>
      </thead>
      <tbody id="docker-rows"></tbody>
    </table>
  `;

  const tbody = document.getElementById('docker-rows');
  containers.forEach(c => {
    const running = c.status === 'running';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${c.name}</strong></td>
      <td style="color:var(--text-dim)">${c.image}</td>
      <td><span class="badge ${running ? 'badge-green' : 'badge-red'}">${c.status}</span></td>
      <td style="color:var(--text-dim);font-size:11px">${c.ports || '—'}</td>
      <td>
        <div class="action-row" style="justify-content:flex-end">
          ${running
            ? `<button class="btn btn-red" data-action="stop" data-id="${c.id}" style="width:100px">■ Stop</button>`
            : `<button class="btn btn-green" data-action="start" data-id="${c.id}" style="width:100px">▶ Start</button>`
          }
          <button class="btn" data-action="logs" data-id="${c.id}" data-name="${c.name}" style="width:100px;padding:7px 12px">📄 Log</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id, name } = btn.dataset;

    if (action === 'start' || action === 'stop') {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:10px;height:10px;border-width:1.5px"></span>';
      try {
        await POST(`/docker/${id}/${action}`);
        await renderContainers();
      } catch (err) {
        alert(`Errore: ${err.message}`);
        btn.disabled = false;
      }
    }

    if (action === 'logs') openLogs(id, name);
  });
}

// ── IMMAGINI ─────────────────────────────────────────────────
async function renderImages() {
  const body = document.getElementById('images-body');
  if (!body) return;
  body.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;

  let images;
  try {
    images = await GET('/docker/images');
  } catch (e) {
    body.innerHTML = `<div class="empty-state">Errore: ${e.message}</div>`;
    return;
  }

  if (!images.length) {
    body.innerHTML = '<div class="empty-state">Nessuna immagine trovata</div>';
    return;
  }

  const fmtDate = iso => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('it-IT', {
      day:'2-digit', month:'2-digit', year:'numeric'
    });
  };

  body.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Tag</th>
          <th>ID</th>
          <th>Dimensione</th>
          <th>Creata</th>
        </tr>
      </thead>
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

// ── RETI ─────────────────────────────────────────────────────
async function renderNetworks() {
  const body = document.getElementById('networks-body');
  if (!body) return;
  body.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;

  let networks;
  try {
    networks = await GET('/docker/networks');
  } catch (e) {
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
              </span>
            `).join('')}
          </div>`
        : `<span style="font-size:11px;color:var(--text-dim)">Nessun container collegato</span>`
      }
    </div>
  `).join('');
}

// ── LOG MODAL ────────────────────────────────────────────────
async function openLogs(id, name) {
  const modal   = document.getElementById('log-modal');
  const title   = document.getElementById('log-title');
  const content = document.getElementById('log-content');

  title.textContent = `Logs — ${name}`;
  content.textContent = 'Caricamento...';
  modal.classList.remove('hidden');

  try {
    const data = await GET(`/docker/${id}/logs?tail=200`);
    content.textContent = data.logs || '(nessun log)';
    content.scrollTop = content.scrollHeight;
  } catch (e) {
    content.textContent = `Errore: ${e.message}`;
  }

  document.getElementById('log-close').onclick = () => modal.classList.add('hidden');
}