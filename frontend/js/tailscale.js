async function loadTailscale() {
  const el = document.getElementById('page-tailscale');
  el.innerHTML = `
    <div class="page-title">VPN / Hosts</div>
    <div class="page-subtitle">DISPOSITIVI CONNESSI VIA HEADSCALE</div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
      <button class="btn" id="vpn-refresh">↻ Aggiorna</button>
    </div>
    <div id="vpn-body"><div class="empty-state"><div class="spinner"></div></div></div>
  `;

  document.getElementById('vpn-refresh').addEventListener('click', renderTailscale);
  renderTailscale();
}

async function renderTailscale() {
  const body = document.getElementById('vpn-body');
  if (!body) return;

  let hosts;
  try {
    hosts = await GET('/tailscale');
  } catch (e) {
    body.innerHTML = `<div class="empty-state">${e.message}</div>`;
    return;
  }

  if (!hosts.length) {
    body.innerHTML = '<div class="empty-state">Nessun host trovato</div>';
    return;
  }

  const online  = hosts.filter(h => h.online);
  const offline = hosts.filter(h => !h.online);

  const osIcon = os => {
    if (!os) return '💻';
    const o = os.toLowerCase();
    if (o.includes('linux'))   return '🐧';
    if (o.includes('windows')) return '🪟';
    if (o.includes('android')) return '📱';
    if (o.includes('ios') || o.includes('darwin')) return '🍎';
    return '💻';
  };

  body.innerHTML = `
    <div style="font-size:11px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">
      ${online.length} online · ${offline.length} offline
    </div>
    <div class="host-grid" id="host-grid"></div>
  `;

  const grid = document.getElementById('host-grid');
  [...online, ...offline].forEach(h => {
    const card = document.createElement('div');
    card.className = `host-card ${h.online ? 'online' : 'offline'}`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:20px">${osIcon(h.os)}</span>
        <span class="host-name">${h.name}</span>
      </div>
      <div class="host-ip">${h.ip || '—'}</div>
      <div class="host-meta">
        <span class="badge ${h.online ? 'badge-green' : 'badge-red'}">${h.online ? 'online' : 'offline'}</span>
        ${h.last_seen ? `<span style="margin-left:8px">Visto: ${h.last_seen}</span>` : ''}
      </div>
    `;
    grid.appendChild(card);
  });
}
