let _resourcesInterval = null;
let _prevNet = null;  // per calcolare il delta bytes/sec

async function loadResources() {
  const el = document.getElementById('page-resources');
  el.innerHTML = `
    <div class="page-title">Risorse</div>
    <div class="page-subtitle">MONITOR DI SISTEMA — LIVE</div>

    <!-- Riga top: CPU · MEM · SWAP -->
    <div class="resource-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 16px">
      <div class="resource-card">
        <div class="resource-label">CPU</div>
        <div class="resource-value" id="rv-cpu">—<span>%</span></div>
        <div class="meter"><div class="meter-fill" id="rm-cpu" style="width:0%"></div></div>
        <div class="resource-sub" id="rs-cpu"></div>
      </div>
      <div class="resource-card">
        <div class="resource-label">Memoria</div>
        <div class="resource-value" id="rv-mem">—<span>%</span></div>
        <div class="meter"><div class="meter-fill" id="rm-mem" style="width:0%"></div></div>
        <div class="resource-sub" id="rs-mem"></div>
      </div>
      <div class="resource-card" id="rc-swap">
        <div class="resource-label">Swap</div>
        <div class="resource-value" id="rv-swap">—<span>%</span></div>
        <div class="meter"><div class="meter-fill" id="rm-swap" style="width:0%"></div></div>
        <div class="resource-sub" id="rs-swap"></div>
      </div>
    </div>

    <!-- Load avg -->
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-header">Load Average</div>
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); text-align:center; padding: 20px 16px">
        <div>
          <div style="font-size:36px; font-weight:600; color:var(--amber)" id="rl-1">—</div>
          <div class="resource-sub" style="margin-top:6px">1 min</div>
        </div>
        <div style="border-left:1px solid var(--border); border-right:1px solid var(--border)">
          <div style="font-size:36px; font-weight:600; color:var(--amber)" id="rl-5">—</div>
          <div class="resource-sub" style="margin-top:6px">5 min</div>
        </div>
        <div>
          <div style="font-size:36px; font-weight:600; color:var(--amber)" id="rl-15">—</div>
          <div class="resource-sub" style="margin-top:6px">15 min</div>
        </div>
      </div>
    </div>

    <!-- Temperature -->
    <div class="panel" id="panel-temps" style="display:none; margin-bottom:16px">
      <div class="panel-header">Temperature</div>
      <div id="temp-rows"></div>
    </div>

    <!-- Disco -->
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-header">Disco</div>
      <div id="disk-rows"></div>
    </div>

    <!-- Rete -->
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-header">Rete</div>
      <div id="net-rows"></div>
    </div>
  `;

  _prevNet = null;

  async function poll() {
    let data;
    try { data = await GET('/resources'); } catch { return; }

    const now = Date.now();

    // ── CPU ──────────────────────────────────────────────────
    document.getElementById('rv-cpu').innerHTML =
      `${data.cpu.percent.toFixed(1)}<span>%</span>`;
    const mCpu = document.getElementById('rm-cpu');
    mCpu.style.width = `${data.cpu.percent}%`;
    mCpu.className = `meter-fill ${meterClass(data.cpu.percent)}`;
    const freqStr = data.cpu.freq_mhz ? ` · ${(data.cpu.freq_mhz/1000).toFixed(2)} GHz` : '';
    document.getElementById('rs-cpu').textContent =
      `${data.cpu.count} core${freqStr}`;

    // ── Memoria ──────────────────────────────────────────────
    document.getElementById('rv-mem').innerHTML =
      `${data.mem.percent.toFixed(1)}<span>%</span>`;
    const mMem = document.getElementById('rm-mem');
    mMem.style.width = `${data.mem.percent}%`;
    mMem.className = `meter-fill ${meterClass(data.mem.percent)}`;
    document.getElementById('rs-mem').textContent =
      `${fmtBytes(data.mem.used)} / ${fmtBytes(data.mem.total)}`;
    
    // ── Swap ─────────────────────────────────────────────────
    if (data.swap) {
      document.getElementById('rv-swap').innerHTML =
        `${data.swap.percent.toFixed(1)}<span>%</span>`;
      const mSwap = document.getElementById('rm-swap');
      mSwap.style.width = `${data.swap.percent}%`;
      mSwap.className = `meter-fill ${meterClass(data.swap.percent)}`;
      document.getElementById('rs-swap').textContent =
        `${fmtBytes(data.swap.used)} / ${fmtBytes(data.swap.total)}`;
    } else {
      document.getElementById('rc-swap').style.display = 'none';
    }

    // ── Temperature ──────────────────────────────────────────
    const tempEl = document.getElementById('temp-rows');
    const panelTemps = document.getElementById('panel-temps');
    if (tempEl && data.temps && Object.keys(data.temps).length > 0) {
      panelTemps.style.display = '';
      tempEl.innerHTML = Object.entries(data.temps).map(([label, t]) => {
        const pct = t.critical ? (t.current / t.critical) * 100 : (t.current / 100) * 100;
        const cls = t.critical && t.current >= t.critical * 0.9 ? 'crit'
                  : t.high    && t.current >= t.high            ? 'warn' : '';
        return `
          <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;align-items:baseline">
              <span style="font-size:12px;color:#fff">${label}</span>
              <span style="font-size:18px;font-weight:600;color:${cls === 'crit' ? 'var(--red)' : cls === 'warn' ? 'var(--amber)' : 'var(--teal)'}">${t.current}°C</span>
            </div>
            <div class="meter" style="height:4px">
              <div class="meter-fill ${cls}" style="width:${Math.min(pct,100)}%"></div>
            </div>
            ${t.high || t.critical ? `<div class="resource-sub" style="margin-top:6px">
              ${t.high ? `warn: ${t.high}°C` : ''} ${t.critical ? `· crit: ${t.critical}°C` : ''}
            </div>` : ''}
          </div>
        `;
      }).join('');
    }

    // ── Load ──────────────────────────────────────────────────
    document.getElementById('rl-1').textContent  = data.load.min1;
    document.getElementById('rl-5').textContent  = data.load.min5;
    document.getElementById('rl-15').textContent = data.load.min15;

    // ── Disco ─────────────────────────────────────────────────
    const diskEl = document.getElementById('disk-rows');
    if (diskEl && data.disks?.length) {
      diskEl.innerHTML = data.disks.map(d => `
        <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;align-items:baseline">
            <span style="font-size:12px;color:#fff">${d.mountpoint}</span>
            <span style="font-size:10px;color:var(--text-dim)">${d.device} · ${d.fstype}</span>
          </div>
          <div class="meter" style="height:6px">
            <div class="meter-fill ${meterClass(d.percent)}" style="width:${d.percent}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px">
            <span class="resource-sub">${fmtBytes(d.used)} usati</span>
            <span class="resource-sub">${fmtBytes(d.free)} liberi / ${fmtBytes(d.total)} totali &nbsp;·&nbsp; ${d.percent.toFixed(1)}%</span>
          </div>
        </div>
      `).join('');
    }

    // ── Rete ─────────────────────────────────────────────────
    const netEl = document.getElementById('net-rows');
    if (netEl && data.network?.length) {
      const interval = _prevNet ? (now - _prevNet.ts) / 1000 : null;

      const rows = data.network.map(n => {
        let rxRate = '—', txRate = '—';
        if (_prevNet && interval > 0) {
          const prev = _prevNet.ifaces[n.iface];
          if (prev) {
            rxRate = fmtBytes(((n.bytes_recv - prev.bytes_recv) / interval).toFixed(1)) + '/s';
            txRate = fmtBytes(((n.bytes_sent - prev.bytes_sent) / interval).toFixed(1)) + '/s';
          }
        }
        return `
          <tr>
            <td style="color:#fff">${n.iface}</td>

            <td style="color:var(--teal)">${rxRate}</td>
            <td style="color:var(--amber)">${txRate}</td>
            <td style="color:var(--text-dim)">${fmtBytes(n.bytes_recv)}</td>
            <td style="color:var(--text-dim)">${fmtBytes(n.bytes_sent)}</td>
          </tr>`;
      }).join('');

      netEl.innerHTML = `
        <table class="data-table" style="font-size:11px;table-layout:fixed;width:100%">

          <thead>
            <tr>
              <th>Interfaccia</th>
              <th style="white-space:nowrap">↓ RX/s</th>
              <th style="white-space:nowrap">↑ TX/s</th>
              <th style="white-space:nowrap">Tot RX</th>
              <th style="white-space:nowrap">Tot TX</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;

      const ifaceMap = {};
      data.network.forEach(n => { ifaceMap[n.iface] = n; });
      _prevNet = { ts: now, ifaces: ifaceMap };
    }
  }

  poll();
  _resourcesInterval = setInterval(poll, 2000);
}

function unloadResources() {
  if (_resourcesInterval) {
    clearInterval(_resourcesInterval);
    _resourcesInterval = null;
  }
  _prevNet = null;
}