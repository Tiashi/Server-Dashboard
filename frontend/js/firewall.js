async function loadFirewall() {
  const el = document.getElementById('page-firewall');
  el.innerHTML = `
    <div class="page-title">Firewall</div>
    <div class="page-subtitle">GESTIONE UFW</div>

    <div class="tab-nav">
      <button class="tab-btn active" data-tab="fw-overview">Stato & Policy</button>
      <button class="tab-btn" data-tab="fw-rules">Regole</button>
    </div>

    <!-- TAB 1: Stato & Policy -->
    <div id="tab-fw-overview" class="tab-content active">

      <div class="panel" style="margin-top:16px">
        <div class="panel-header">
          <span>Stato firewall</span>
          <div id="fw-status-actions"><div class="spinner"></div></div>
        </div>
        <div id="fw-status-body" style="padding:16px;display:flex;gap:32px;flex-wrap:wrap;align-items:center">
          <div class="spinner"></div>
        </div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="panel-header">Policy di default</div>
        <div style="padding:16px;display:flex;gap:24px;flex-wrap:wrap;align-items:flex-end">
          <div>
            <label class="fw-label">Traffico in entrata</label>
            <select id="fw-def-in" class="fw-select" style="width:140px">
              <option value="deny">Deny</option>
              <option value="allow">Allow</option>
              <option value="reject">Reject</option>
            </select>
          </div>
          <div>
            <label class="fw-label">Traffico in uscita</label>
            <select id="fw-def-out" class="fw-select" style="width:140px">
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
              <option value="reject">Reject</option>
            </select>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-green" id="fw-def-save" style="padding:8px 20px">✓ Salva policy</button>
            <span id="fw-def-msg" style="font-size:11px"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: Regole -->
    <div id="tab-fw-rules" class="tab-content">

      <div class="panel" style="margin-top:16px">
        <div class="panel-header">Aggiungi regola</div>
        <div style="padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">
          <div>
            <label class="fw-label">Direzione</label>
            <select id="fw-direction" class="fw-select">
              <option value="in">In</option>
              <option value="out">Out</option>
            </select>
          </div>
          <div>
            <label class="fw-label">Azione</label>
            <select id="fw-action" class="fw-select">
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
              <option value="reject">Reject</option>
            </select>
          </div>
          <div>
            <label class="fw-label">Porta</label>
            <input id="fw-port" type="text" placeholder="es. 80, 8000:9000" class="fw-input" />
          </div>
          <div>
            <label class="fw-label">Protocollo</label>
            <select id="fw-proto" class="fw-select">
              <option value="any">Any</option>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </select>
          </div>
          <div>
            <label class="fw-label">IP sorgente <span style="color:var(--text-dim)">(opz.)</span></label>
            <input id="fw-from" type="text" placeholder="es. 192.168.1.0/24" class="fw-input" />
          </div>
          <div>
            <label class="fw-label">Commento <span style="color:var(--text-dim)">(opz.)</span></label>
            <input id="fw-comment" type="text" placeholder="es. SSH admin" class="fw-input" />
          </div>
        </div>
        <div style="padding:0 16px 16px;display:flex;gap:10px;align-items:center">
          <button class="btn btn-green" id="fw-add-btn" style="padding:8px 24px">+ Aggiungi regola</button>
          <span id="fw-add-msg" style="font-size:11px"></span>
        </div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="panel-header">
          <span>Regole attive</span>
          <button class="btn" id="fw-rules-refresh">↻ Aggiorna</button>
        </div>
        <div id="fw-rules-body">
          <div class="empty-state"><div class="spinner"></div></div>
        </div>
      </div>

    </div>
  `;

  // Stili label/input
  el.querySelectorAll('.fw-label').forEach(l => {
    l.style.cssText = 'display:block;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim);margin-bottom:6px';
  });
  el.querySelectorAll('.fw-select, .fw-input').forEach(i => {
    i.style.cssText = 'width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font-mono);font-size:12px';
  });

  // Tab switching — stesso pattern di docker.js
  el.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      el.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Carica dati
  await _fwLoad();

  // Refresh regole
  document.getElementById('fw-rules-refresh').addEventListener('click', _fwLoad);

  // Aggiungi regola
  document.getElementById('fw-add-btn').addEventListener('click', _fwAddRule);

  // Salva policy
  document.getElementById('fw-def-save').addEventListener('click', async () => {
    const defIn  = document.getElementById('fw-def-in');
    const defOut = document.getElementById('fw-def-out');
    const btn    = document.getElementById('fw-def-save');
    const msg    = document.getElementById('fw-def-msg');

    // Lock UI
    btn.disabled    = true;
    defIn.disabled  = true;
    defOut.disabled = true;
    btn.innerHTML   = '<span class="spinner" style="width:9px;height:9px;border-width:1.5px"></span> Salvataggio...';
    msg.textContent = '';

    try {
      await POST('/firewall/default', { direction: 'incoming', policy: defIn.value });
      await POST('/firewall/default', { direction: 'outgoing', policy: defOut.value });
      msg.style.color = 'var(--teal)';
      msg.textContent = '✓ Policy aggiornate';
      setTimeout(() => msg.textContent = '', 2000);
      _fwLoad();
    } catch(e) {
      msg.style.color = 'var(--red)';
      msg.textContent = `✕ ${e.message}`;
    } finally {
      btn.disabled    = false;
      defIn.disabled  = false;
      defOut.disabled = false;
      btn.textContent = '✓ Salva policy';
    }
  });
}

// ── Carica status + regole ────────────────────────────────────
async function _fwLoad() {
  let data;
  try {
    data = await GET('/firewall/status');
  } catch(e) {
    document.getElementById('fw-status-body').innerHTML =
      `<span style="color:var(--red)">Errore: ${e.message}</span>`;
    return;
  }

  const isEnabled = data.enabled;

  // Toggle button
  const actionsEl = document.getElementById('fw-status-actions');
  actionsEl.innerHTML = `
    <button class="btn ${isEnabled ? 'btn-red' : 'btn-green'}" id="fw-toggle-btn">
      ${isEnabled ? '■ Disabilita' : '▶ Abilita'}
    </button>
  `;

  // Status body
  document.getElementById('fw-status-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <div style="width:10px;height:10px;border-radius:50%;background:${isEnabled ? 'var(--teal)' : 'var(--red)'}"></div>
      <span style="font-size:20px;font-weight:600;color:${isEnabled ? 'var(--teal)' : 'var(--red)'}">
        ${isEnabled ? 'ATTIVO' : 'INATTIVO'}
      </span>
    </div>
    <div>
      <div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Default in entrata</div>
      <span class="badge ${data.default_in === 'allow' ? 'badge-green' : 'badge-red'}">${data.default_in}</span>
    </div>
    <div>
      <div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Default in uscita</div>
      <span class="badge ${data.default_out === 'allow' ? 'badge-green' : 'badge-red'}">${data.default_out}</span>
    </div>
    <div>
      <div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Regole totali</div>
      <span style="font-size:16px;font-weight:600;color:var(--amber)">${data.rules.length}</span>
    </div>
  `;

  // Sincronizza select policy
  const selIn  = document.getElementById('fw-def-in');
  const selOut = document.getElementById('fw-def-out');
  if (selIn)  selIn.value  = data.default_in;
  if (selOut) selOut.value = data.default_out;

  // Toggle listener
  document.getElementById('fw-toggle-btn').addEventListener('click', async () => {
    try {
      await POST(isEnabled ? '/firewall/disable' : '/firewall/enable');
      _fwLoad();
    } catch(e) {
      alert(`Errore: ${e.message}`);
    }
  });

  // Regole
  _fwRenderRules(data.rules);
}

// ── Render tabella regole ─────────────────────────────────────
function _fwRenderRules(rules) {
  const body = document.getElementById('fw-rules-body');
  if (!rules.length) {
    body.innerHTML = '<div class="empty-state">Nessuna regola configurata</div>';
    return;
  }

  const actionColor = a => {
    if (a.includes('ALLOW'))  return 'badge-green';
    if (a.includes('DENY'))   return 'badge-red';
    if (a.includes('REJECT')) return 'badge-yellow';
    return '';
  };

  body.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>A (To)</th>
          <th>Azione</th>
          <th>Da (From)</th>
          <th>Commento</th>
          <th>Elimina</th>
        </tr>
      </thead>
      <tbody>
        ${rules.map(r => `
          <tr>
            <td style="color:#fff;font-family:var(--font-mono)">${r.to}</td>
            <td><span class="badge ${actionColor(r.action)}">${r.action}</span></td>
            <td style="color:var(--teal);font-family:var(--font-mono)">${r.from}</td>
            <td style="color:var(--text-dim)">${r.comment || '—'}</td>
            <td>
              <button class="btn btn-red"
                data-to="${_esc(r.to)}"
                data-action="${_esc(r.action)}"
                data-from="${_esc(r.from)}"
                data-fw-delete>✕</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  body.querySelectorAll('[data-fw-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const to     = btn.dataset.to;
      const action = btn.dataset.action;
      const from   = btn.dataset.from;
      if (!await dlgConfirm(`Eliminare la regola "${action}" per "${to}" da "${from}"?`)) return;

      // Spinner sul bottone della riga
      const origText = btn.textContent;
      btn.disabled  = true;
      btn.innerHTML = '<span class="spinner" style="width:9px;height:9px;border-width:1.5px"></span>';

      try {
        await api('DELETE', `/firewall/rules?to=${encodeURIComponent(to)}&action=${encodeURIComponent(action)}&from_=${encodeURIComponent(from)}`);
        _fwLoad();
      } catch(e) {
        alert(`Errore: ${e.message}`);
        btn.disabled  = false;
        btn.textContent = origText;
      }
    });
  });
}

// ── Aggiungi regola ───────────────────────────────────────────
async function _fwAddRule() {
  const direction = document.getElementById('fw-direction').value;
  const action    = document.getElementById('fw-action').value;
  const port      = document.getElementById('fw-port').value.trim();
  const proto     = document.getElementById('fw-proto').value;
  const from_ip   = document.getElementById('fw-from').value.trim();
  const comment   = document.getElementById('fw-comment').value.trim();
  const msg       = document.getElementById('fw-add-msg');
  const btn       = document.getElementById('fw-add-btn');

  if (!port && !from_ip) {
    msg.style.color = 'var(--amber)';
    msg.textContent = '⚠ Specifica almeno una porta o un IP sorgente';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:9px;height:9px;border-width:1.5px"></span>';
  msg.textContent = '';

  try {
    await POST('/firewall/rules', { direction, action, port, proto, from_ip, comment });
    msg.style.color = 'var(--teal)';
    msg.textContent = '✓ Regola aggiunta';
    document.getElementById('fw-port').value    = '';
    document.getElementById('fw-from').value    = '';
    document.getElementById('fw-comment').value = '';
    setTimeout(() => msg.textContent = '', 2500);
    _fwLoad();
  } catch(e) {
    msg.style.color = 'var(--red)';
    msg.textContent = `✕ ${e.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Aggiungi regola';
  }
}

function _esc(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}