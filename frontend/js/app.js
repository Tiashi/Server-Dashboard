// ── Router ──────────────────────────────────────────────────────────────────
const pages = {
  shortcuts: { load: loadShortcuts   },
  docker:    { load: loadDocker      },
  tailscale: { load: loadTailscale   },
  resources: { load: loadResources, unload: unloadResources },
};

let currentPage = null;

function navigate(page) {
  // Unload current
  if (currentPage && pages[currentPage]?.unload) {
    pages[currentPage].unload();
  }

  // Switch nav highlight
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Switch page div
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${page}`);
  });

  currentPage = page;
  if (pages[page]?.load) pages[page].load();
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigate(el.dataset.page);
  });
});

// ── API helpers ─────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch('/api' + path, opts);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
const GET    = path        => api('GET',    path);
const POST   = (path, b)  => api('POST',   path, b);
const DELETE = path        => api('DELETE', path);

// ── Clock ───────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (b >= 1024 ** 3) 
    return +(b / 1024 ** 3).toFixed(1) + ' GiB';
  if (b >= 1024 ** 2)
    return +(b / 1024 ** 2).toFixed(1) + ' MiB';
  if (b >= 1024)
    return +(b / 1024).toFixed(1) + ' KiB';
  return b + ' B';
}

function meterClass(pct) {
  if (pct >= 90) return 'crit';
  if (pct >= 70) return 'warn';
  return '';
}

// ── Stop resources/terminal on browser close ────────────────────────────────
window.addEventListener('beforeunload', () => {
  if (currentPage === 'resources') fetch('/api/resources/stop', { method: 'POST', keepalive: true });
});

// ── Sidebar mobile toggle ────────────────────────────────────
const sidebar  = document.getElementById('sidebar');
const overlay  = document.getElementById('sidebar-overlay');
const menuBtn  = document.getElementById('menu-toggle');

function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('visible');
  menuBtn.classList.add('sidebar-open');
}
function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
  menuBtn.classList.remove('sidebar-open');
}

menuBtn.addEventListener('click', () => {
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});
overlay.addEventListener('click', closeSidebar);

// Chiudi sidebar dopo navigazione su mobile
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => {
    if (window.innerWidth <= 768) closeSidebar();
  });
});

// ── Initial page ─────────────────────────────────────────────────────────────
navigate('shortcuts');
