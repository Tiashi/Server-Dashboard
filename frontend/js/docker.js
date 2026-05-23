async function loadDocker() {
  const el = document.getElementById('page-docker');
  el.innerHTML = `
    <div class="page-title">Docker</div>
    <div class="page-subtitle">GESTIONE CONTAINER</div>
    <div class="panel">
      <div class="panel-header">
        <span>Containers</span>
        <button class="btn" id="docker-refresh">↻ Aggiorna</button>
      </div>
      <div id="docker-body"><div class="empty-state"><div class="spinner"></div></div></div>
    </div>
  `;

  document.getElementById('docker-refresh').addEventListener('click', renderDocker);
  renderDocker();
}

async function renderDocker() {
  const body = document.getElementById('docker-body');
  if (!body) return;

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
        <div class="action-row">
          ${running
            ? `<button class="btn btn-red" data-action="stop" data-id="${c.id}">■ Stop</button>`
            : `<button class="btn btn-green" data-action="start" data-id="${c.id}">▶ Start</button>`
          }
          <button class="btn" data-action="logs" data-id="${c.id}" data-name="${c.name}">📄 Log</button>
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
      btn.innerHTML = '<span class="spinner"></span>';
      try {
        await POST(`/docker/${id}/${action}`);
        await renderDocker();
      } catch (err) {
        alert(`Errore: ${err.message}`);
        btn.disabled = false;
      }
    }

    if (action === 'logs') {
      openLogs(id, name);
    }
  });
}

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
