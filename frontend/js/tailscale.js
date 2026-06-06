async function loadTailscale() {
  const el = document.getElementById('page-tailscale');
  el.innerHTML = `
    <div class="page-title">Headscale</div>
    <div class="page-subtitle">GESTIONE HEADSCALE</div>

    <div class="tab-nav">
      <button class="tab-btn active" data-tab="nodes">Nodi</button>
      <button class="tab-btn" data-tab="users">Utenti</button>
      <button class="tab-btn" data-tab="session">Sessione</button>
    </div>

    <div id="tab-nodes" class="tab-content active">
      <div id="nodes-locked" class="empty-state" style="display:none;flex-direction:column;align-items:center;gap:12px;padding:64px">
        <div style="font-size:48px">🔒</div>
        <div style="font-size:13px;color:var(--text-dim)">Imposta una chiave API nella tab <strong style="color:var(--amber)">Sessione</strong></div>
      </div>
      <div id="nodes-content">
        <div class="panel" style="margin-top:16px">
          <div class="panel-header">Registra nuovo nodo</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px">
            <div>
              <label style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:6px">Utente</label>
              <select id="reg-user" style="width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font-mono);font-size:12px">
                <option value="">Caricamento...</option>
              </select>
            </div>
            <div>
              <label style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:6px">Chiave di registrazione</label>
              <input id="reg-key" type="text" placeholder="nodekey:abc123..." style="width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font-mono);font-size:12px"/>
            </div>
          </div>
          <div style="padding:0 16px 16px">
            <button class="btn btn-green" id="reg-node-btn" style="width:100%;padding:10px">+ Registra nodo</button>
          </div>
          <div id="reg-result" style="display:none;margin:0 16px 16px;padding:12px;background:var(--bg);border:1px solid var(--teal-dim);border-radius:var(--radius);font-size:11px;color:var(--teal)"></div>
        </div>
        <div class="panel" style="margin-top:16px">
          <div class="panel-header">
            <span>Nodi</span>
            <button class="btn" id="nodes-refresh">↻ Aggiorna</button>
          </div>
          <div id="nodes-body"><div class="empty-state"><div class="spinner"></div></div></div>
        </div>
      </div>
    </div>

    <div id="tab-users" class="tab-content">
      <div id="users-locked" class="empty-state" style="display:none;flex-direction:column;align-items:center;gap:12px;padding:64px">
        <div style="font-size:48px">🔒</div>
        <div style="font-size:13px;color:var(--text-dim)">Imposta una chiave API nella tab <strong style="color:var(--amber)">Sessione</strong></div>
      </div>
      <div id="users-content">
        <div class="panel" style="margin-top:16px">
          <div class="panel-header">Nuovo utente</div>
          <div style="display:flex;gap:10px;padding:16px">
            <input id="new-user-name" type="text" placeholder="Nome utente" style="flex:1;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font-mono);font-size:12px"/>
            <button class="btn btn-green" id="create-user-btn">+ Crea</button>
          </div>
        </div>
        <div class="panel" style="margin-top:16px">
          <div class="panel-header">
            <span>Utenti</span>
            <button class="btn" id="users-refresh">↻ Aggiorna</button>
          </div>
          <div id="users-body"><div class="empty-state"><div class="spinner"></div></div></div>
        </div>
      </div>
    </div>

    <div id="tab-session" class="tab-content">
      <div class="panel" style="margin-top:16px">
        <div class="panel-header">Configurazione API Headscale</div>
        <div style="padding:16px">

          <!-- FORM (visibile quando non configurato o in modifica) -->
          <div id="session-form">
            <div id="session-form-msg" style="font-size:11px;margin-bottom:12px;display:none"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;min-width:0">
              <div style="min-width:0">
                <label style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">URL Headscale</label>
                <input id="session-edit-url" type="text" placeholder="https://headscale.example.com" style="width:100%;box-sizing:border-box;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font-mono);font-size:12px"/>
              </div>
              <div style="min-width:0">
                <label style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">API Key <span style="color:var(--text-dim)">(lascia vuoto per non cambiare)</span></label>
                <div style="display:flex;gap:8px">
                  <input id="session-edit-key" type="password" placeholder="Inserisci chiave..." style="flex:1;min-width:0;box-sizing:border-box;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font-mono);font-size:12px"/>
                  <button class="btn" id="session-key-toggle">👁</button>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;width:100%">
              <button class="btn btn-green" id="session-form-save" style="padding:8px 20px;min-width:100px">✓ Salva</button>
              <button class="btn" id="session-form-cancel" style="display:none;padding:8px 20px;min-width:100px">Annulla</button>
              <div id="session-form-error" style="font-size:11px;color:var(--red);flex:1"></div>
            </div>
          </div>

          <!-- INFO (visibile quando configurato correttamente) -->
          <div id="session-info" style="display:none">
            <!-- Mobile: compatto -->
            <div class="session-info-mobile" style="display:flex;flex-direction:column;gap:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <div>
                  <div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">URL</div>
                  <code id="session-url-m" style="font-size:12px;color:var(--amber)"></code>
                </div>
                <div style="display:flex;gap:8px">
                  <button class="btn" id="session-edit-btn">✏</button>
                  <button class="btn btn-red" id="session-key-forget">✕</button>
                </div>
              </div>
              <div style="display:flex;gap:24px;flex-wrap:wrap">
                <div>
                  <div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">Chiave</div>
                  <code id="session-key-m" style="font-size:12px;color:var(--teal)"></code>
                </div>
                <div>
                  <div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">Scadenza</div>
                  <code id="session-expiry-m" style="font-size:12px"></code>
                </div>
              </div>
            </div>

            <!-- Desktop: espanso -->
            <div class="session-info-desktop" style="display:none">
              <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:24px;align-items:center">
                <div>
                  <div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">URL Headscale</div>
                  <code id="session-url-d" style="font-size:14px;color:var(--amber)"></code>
                </div>
                <div>
                  <div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Chiave attiva</div>
                  <code id="session-key-d" style="font-size:14px;color:var(--teal)"></code>
                </div>
                <div>
                  <div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Scadenza</div>
                  <code id="session-expiry-d" style="font-size:14px"></code>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px">
                  <button class="btn" id="session-edit-btn-d">✏ Modifica</button>
                  <button class="btn btn-red" id="session-key-forget-d">✕ Dimentica</button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div id="session-keys-panel" class="panel" style="margin-top:16px;display:none">
        <div class="panel-header">
          <span>Lista Chiavi API</span>
          <button class="btn" id="session-keys-refresh">↻ Aggiorna</button>
        </div>
        <div id="session-keys-body"><div class="empty-state"><div class="spinner"></div></div></div>
      </div>
    </div>
  `;

  // Nascondi contenuti finché lo status non è pronto
  document.getElementById('nodes-content').style.display = 'none';
  document.getElementById('users-content').style.display = 'none';

  // Tab switching
  el.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      el.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Controlla stato chiave e aggiorna UI
  await _updateSessionUI();

  // Toggle visibilità chiave
  document.getElementById('session-key-toggle').addEventListener('click', () => {
    const input = document.getElementById('session-edit-key');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Salva form
  document.getElementById('session-form-save').addEventListener('click', async () => {
    const url = document.getElementById('session-edit-url').value.trim();
    const key = document.getElementById('session-edit-key').value.trim();
    const errEl = document.getElementById('session-form-error');
    if (!url) { errEl.textContent = 'URL obbligatorio'; return; }
    errEl.textContent = 'Salvataggio...';
    errEl.style.color = 'var(--text-dim)';
    try {
      const payload = { url };
      if (key) payload.key = key;
      await api('PATCH', '/tailscale/session/config', payload);
      document.getElementById('session-edit-key').value = '';
      errEl.textContent = '';
      await _updateSessionUI();
    } catch(err) {
      errEl.textContent = `✕ ${err.message}`;
      errEl.style.color = 'var(--red)';
    }
  });

  // Annulla modifica
  document.getElementById('session-form-cancel').addEventListener('click', async () => {
    await _updateSessionUI();
  });

  // Apri form modifica (mobile e desktop)
  const _openEditForm = () => {
    document.getElementById('session-info').style.display = 'none';
    document.getElementById('session-form').style.display = 'block';
    document.getElementById('session-form-cancel').style.display = 'inline-block';
    document.getElementById('session-edit-url').value =
      document.getElementById('session-url-d')?.textContent ||
      document.getElementById('session-url-m')?.textContent || '';
  };
  document.getElementById('session-edit-btn').addEventListener('click', _openEditForm);
  document.getElementById('session-edit-btn-d').addEventListener('click', _openEditForm);

  // Dimentica chiave (mobile e desktop)
  const _forgetKey = async () => {
    if (!await dlgConfirm('Rimuovere la chiave dal config? Il pannello Headscale non sarà più accessibile.')) return;
    try {
      await DELETE('/tailscale/session/key');
      await _updateSessionUI();
    } catch(err) { alert(`Errore: ${err.message}`); }
  };
  document.getElementById('session-key-forget').addEventListener('click', _forgetKey);
  document.getElementById('session-key-forget-d').addEventListener('click', _forgetKey);

  // Refresh chiavi
  document.getElementById('session-keys-refresh').addEventListener('click', _loadSessionKeys);

}

function unloadTailscale() {
  _nodesListenersInit = false;
  _usersListenersInit = false;
}

// ── Aggiorna UI sessione in base allo stato della chiave ──────
async function _updateSessionUI() {
  let status;
  try {
    status = await GET('/tailscale/session/status');
  } catch(e) {
    status = { has_key: false, valid: false, prefix: null, url: '' };
  }

  const form     = document.getElementById('session-form');
  const info     = document.getElementById('session-info');
  const keyPanel = document.getElementById('session-keys-panel');
  const nodesLocked  = document.getElementById('nodes-locked');
  const nodesContent = document.getElementById('nodes-content');
  const usersLocked  = document.getElementById('users-locked');
  const usersContent = document.getElementById('users-content');
  const msgEl    = document.getElementById('session-form-msg');
  const cancelBtn = document.getElementById('session-form-cancel');

  if (status.has_key && status.valid) {
    // Tutto ok — mostra info, nascondi form
    form.style.display     = 'none';
    info.style.display     = 'block';
    keyPanel.style.display = 'block';
    cancelBtn.style.display = 'none';
    nodesLocked.style.display  = 'none';
    nodesContent.style.display = 'block';
    usersLocked.style.display  = 'none';
    usersContent.style.display = 'block';

    // Popola info mobile e desktop
    ['session-url-m', 'session-url-d'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = status.url;
    });
    ['session-key-m', 'session-key-d'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = status.prefix;
    });

    // Scadenza
    try {
      const keys   = await GET('/tailscale/session/keys');
      const prefix = status.prefix.replace('...', '');
      const match  = keys.find(k => k.prefix.startsWith(prefix) || prefix.startsWith(k.prefix));
      let expiryText = 'Nessuna scadenza';
      let expiryColor = 'var(--text-dim)';
      if (match?.expiration && !match.expiration.startsWith('0001')) {
        expiryText = new Date(match.expiration).toLocaleString('it-IT', {
          day:'2-digit', month:'2-digit', year:'numeric',
          hour:'2-digit', minute:'2-digit'
        });
        expiryColor = new Date(match.expiration) < new Date() ? 'var(--red)' : 'var(--text)';
      }
      ['session-expiry-m', 'session-expiry-d'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = expiryText; el.style.color = expiryColor; }
      });
    } catch(e) {
      ['session-expiry-m', 'session-expiry-d'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '—';
      });
    }

    _populateRegUserSelect();
    _loadNodes();
    _loadUsers();
    _loadSessionKeys();
    _initNodesListeners();
    _initUsersListeners();

  } else {
    // Non configurato o non valido — mostra form
    form.style.display     = 'block';
    info.style.display     = 'none';
    keyPanel.style.display = 'none';
    cancelBtn.style.display = 'none';
    nodesLocked.style.display  = 'flex';
    nodesContent.style.display = 'none';
    usersLocked.style.display  = 'flex';
    usersContent.style.display = 'none';

    // Precompila URL se disponibile
    document.getElementById('session-edit-url').value = status.url || '';

    if (status.has_key && !status.valid) {
      msgEl.style.display = 'block';
      msgEl.style.color   = 'var(--amber)';
      msgEl.textContent   = '⚠ La chiave attuale non è valida o è scaduta — aggiorna la configurazione';
    } else {
      msgEl.style.display = 'none';
    }
  }
}

let _nodesListenersInit = false;
let _usersListenersInit = false;

function _initNodesListeners() {
  if (_nodesListenersInit) return;
  _nodesListenersInit = true;

  document.getElementById('nodes-refresh')?.addEventListener('click', _loadNodes);

  document.getElementById('reg-node-btn')?.addEventListener('click', async () => {
    const user = document.getElementById('reg-user').value;
    const key  = document.getElementById('reg-key').value.trim();
    if (!user || !key) { alert('Seleziona utente e inserisci la chiave'); return; }
    const btn = document.getElementById('reg-node-btn');
    btn.disabled = true;
    btn.textContent = 'Registrazione...';
    try {
      const result = await POST('/tailscale/nodes/register', { user, key });
      const resEl = document.getElementById('reg-result');
      resEl.style.display = 'block';
      resEl.textContent = result.output || 'Nodo registrato con successo';
      document.getElementById('reg-key').value = '';
      _loadNodes();
    } catch(err) {
      alert(`Errore: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = '+ Registra nodo';
    }
  });
}

function _initUsersListeners() {
  if (_usersListenersInit) return;
  _usersListenersInit = true;

  document.getElementById('users-refresh')?.addEventListener('click', _loadUsers);

  document.getElementById('create-user-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('new-user-name').value.trim();
    if (!name) return;
    try {
      await POST('/tailscale/users', { name });
      document.getElementById('new-user-name').value = '';
      _loadUsers();
    } catch(err) { alert(`Errore: ${err.message}`); }
  });
}

async function _populateRegUserSelect() {
  try {
    const users = await GET('/tailscale/users');
    const sel = document.getElementById('reg-user');
    if (sel) sel.innerHTML = users.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
  } catch(e) {}
}

// ── NODI ─────────────────────────────────────────────────────
async function _loadNodes() {
  const body = document.getElementById('nodes-body');
  if (!body) return;
  body.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;

  let nodes;
  try {
    nodes = await GET('/tailscale/nodes');
  } catch(e) {
    body.innerHTML = `<div class="empty-state">Errore: ${e.message}</div>`;
    return;
  }

  if (!nodes.length) {
    body.innerHTML = '<div class="empty-state">Nessun nodo trovato</div>';
    return;
  }

  const osIcon = os => {
    if (!os) return '💻';
    const o = os.toLowerCase();
    if (o.includes('linux'))   return '🐧';
    if (o.includes('windows')) return '🪟';
    if (o.includes('android')) return '📱';
    if (o.includes('ios') || o.includes('darwin')) return '🍎';
    return '💻';
  };

  const fmtDate = iso => {
    if (!iso || iso.startsWith('0001')) return '—';
    return new Date(iso).toLocaleString('it-IT', {
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    });
  };

  body.innerHTML = nodes.map(n => `
    <div class="node-card" data-id="${n.id}">
      <div class="node-card-inner">
        <div class="node-card-left">
          <div class="node-card-name">
            <span style="font-size:20px">${osIcon(n.os)}</span>
            <span class="node-name">${n.given_name || n.name}</span>
            <span class="badge ${n.online ? 'badge-green' : 'badge-red'}">${n.online ? 'online' : 'offline'}</span>
            ${n.routes_advertised?.includes('0.0.0.0/0') ? '<span class="badge badge-yellow">exit node</span>' : ''}
          </div>
          <div style="font-size:11px;color:var(--teal);margin-bottom:8px">${n.ip}</div>
          <div class="node-card-meta">
            <span>Utente: <strong>${n.user}</strong></span>
            <span>Connessione: <strong>${fmtDate(n.last_seen)}</strong></span>
            <span>Creato: <strong>${fmtDate(n.created)}</strong></span>
            ${n.routes_advertised?.length ? `<span>Route: <strong>${n.routes_advertised.join(', ')}</strong></span>` : ''}
          </div>
        </div>
        <div class="node-card-actions">
          <button class="btn" data-action="rename" data-id="${n.id}" data-name="${n.given_name || n.name}">✏ Rinomina</button>
          <button class="btn" data-action="move" data-id="${n.id}" data-user="${n.user}">⇄ Trasferisci</button>
          <button class="btn btn-red" data-action="delete-node" data-id="${n.id}" data-name="${n.given_name || n.name}">✕ Elimina</button>
        </div>
      </div>
    </div>
  `).join('');

  const handleClick = async e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id, name, user } = btn.dataset;

    if (action === 'rename') {
      const newName = await dlgPrompt('Rinomina nodo', `Nuovo nome per "${name}":`, name);
      if (!newName || newName === name) return;
      try {
        await POST(`/tailscale/nodes/${id}/rename`, { name: sanitize(newName) });
        body.removeEventListener('click', handleClick);
        _loadNodes();
      } catch(err) { alert(`Errore: ${err.message}`); }
    }

    if (action === 'move') {
      let users = [];
      try { users = await GET('/tailscale/users'); } catch(e) {}
      const userOptions = users.map(u => ({ value: u.id, label: u.name }));
      if (!userOptions.length) { alert('Nessun utente disponibile'); return; }
      const currentUser = users.find(u => u.name === user);
      const newUserId = await dlgSelect('Trasferisci nodo', `Trasferisci ad utente (attuale: "${user}"):`, userOptions, currentUser?.id ?? '');
      if (!newUserId || newUserId === currentUser?.id) return;
      try {
        await POST(`/tailscale/nodes/${id}/move`, { user: newUserId });
        body.removeEventListener('click', handleClick);
        _loadNodes();
      } catch(err) { alert(`Errore: ${err.message}`); }
    }

    if (action === 'delete-node') {
      if (!await dlgConfirm(`Eliminare "${name}"? L'operazione è irreversibile.`)) return;
      try {
        await DELETE(`/tailscale/nodes/${id}`);
        body.removeEventListener('click', handleClick);
        _loadNodes();
      } catch(err) { alert(`Errore: ${err.message}`); }
    }
  };

  body._handleClick && body.removeEventListener('click', body._handleClick);
  body._handleClick = handleClick;
  body.addEventListener('click', handleClick);
}

// ── UTENTI ───────────────────────────────────────────────────
async function _loadUsers() {
  const body = document.getElementById('users-body');
  if (!body) return;
  body.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;

  let users;
  try {
    users = await GET('/tailscale/users');
  } catch(e) {
    body.innerHTML = `<div class="empty-state">Errore: ${e.message}</div>`;
    return;
  }

  if (!users.length) {
    body.innerHTML = '<div class="empty-state">Nessun utente trovato</div>';
    return;
  }

  const fmtDate = iso => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' });
  };

  body.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Nodi</th>
          <th>Creato</th>
          <th>Azioni</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td><strong style="color:#fff">${u.name}</strong></td>
            <td>${u.node_count}</td>
            <td>${fmtDate(u.created)}</td>
            <td>
              <div class="action-row" style="justify-content:flex-end">
                <button class="btn" data-action="rename-user" data-id="${u.id}" data-name="${u.name}">✏ Rinomina</button>
                <button class="btn btn-red" data-action="delete-user" data-id="${u.id}" data-name="${u.name}"
                  ${u.node_count > 0 ? 'disabled title="Rimuovi prima i nodi"' : ''}>✕ Elimina</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const handleClick = async e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id, name } = btn.dataset;

    if (action === 'rename-user') {
      const newName = await dlgPrompt('Rinomina utente', `Nuovo nome per "${name}":`, name);
      if (!newName || newName === name) return;
      try {
        await POST(`/tailscale/users/${id}/rename`, { new_name: sanitize(newName) });
        body.removeEventListener('click', handleClick);
        _loadUsers();
      } catch(err) { alert(`Errore: ${err.message}`); }
    }

    if (action === 'delete-user') {
      if (!await dlgConfirm(`Eliminare l'utente "${name}"? L'operazione è irreversibile.`)) return;
      try {
        await DELETE(`/tailscale/users/${id}`);
        body.removeEventListener('click', handleClick);
        _loadUsers();
      } catch(err) { alert(`Errore: ${err.message}`); }
    }
  };

  body._handleClick && body.removeEventListener('click', body._handleClick);
  body._handleClick = handleClick;
  body.addEventListener('click', handleClick);
}

// ── SESSIONE ─────────────────────────────────────────────────
async function _loadSessionKeys() {
  const body = document.getElementById('session-keys-body');
  if (!body) return;
  body.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;

  let keys;
  try {
    keys = await GET('/tailscale/session/keys');
  } catch(e) {
    body.innerHTML = `<div class="empty-state">Errore: ${e.message}</div>`;
    return;
  }

  if (!keys.length) {
    body.innerHTML = '<div class="empty-state">Nessuna chiave trovata</div>';
    return;
  }

  const fmtDate = iso => {
    if (!iso || iso.startsWith('0001')) return '—';
    return new Date(iso).toLocaleString('it-IT', {
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    });
  };

  const isExpired = iso => {
    if (!iso || iso.startsWith('0001')) return false;
    return new Date(iso) < new Date();
  };

  body.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Prefisso</th>
          <th>Creata</th>
          <th>Scadenza</th>
          <th>Stato</th>
          <th>Azioni</th>
        </tr>
      </thead>
      <tbody>
        ${keys.map(k => {
          const expired = isExpired(k.expiration);
          return `
            <tr>
              <td><code style="color:var(--teal)">${k.prefix}...</code></td>
              <td>${fmtDate(k.created)}</td>
              <td>${fmtDate(k.expiration)}</td>
              <td><span class="badge ${expired ? 'badge-red' : 'badge-green'}">${expired ? 'scaduta' : 'valida'}</span></td>
              <td>
                <button class="btn btn-red" data-action="expire-apikey" data-prefix="${k.prefix}"
                  ${expired ? 'disabled' : ''}>✕ Revoca</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  const handleClick = async e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { prefix } = btn.dataset;
    if (!await dlgConfirm(`Revocare la chiave ${prefix}...? Se è quella attiva perderai l'accesso.`)) return;
    try {
      await POST('/tailscale/session/keys/expire', { prefix });
      body.removeEventListener('click', handleClick);
      _loadSessionKeys();
    } catch(err) { alert(`Errore: ${err.message}`); }
  };

  body._handleClick && body.removeEventListener('click', body._handleClick);
  body._handleClick = handleClick;
  body.addEventListener('click', handleClick);
}