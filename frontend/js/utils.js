function dlgConfirm(message) {
  return new Promise(resolve => {
    const modal = document.getElementById('dialog-modal');
    document.getElementById('dialog-title').textContent = 'Conferma';
    document.getElementById('dialog-message').textContent = message;
    document.getElementById('dialog-input').style.display = 'none';
    modal.classList.remove('hidden');

    const ok  = document.getElementById('dialog-confirm');
    const no  = document.getElementById('dialog-cancel');
    const x   = document.getElementById('dialog-cancel-x');

    const cleanup = val => {
      modal.classList.add('hidden');
      ok.replaceWith(ok.cloneNode(true));
      no.replaceWith(no.cloneNode(true));
      x.replaceWith(x.cloneNode(true));
      resolve(val);
    };

    document.getElementById('dialog-confirm').addEventListener('click', () => cleanup(true));
    document.getElementById('dialog-cancel').addEventListener('click',  () => cleanup(false));
    document.getElementById('dialog-cancel-x').addEventListener('click', () => cleanup(false));
  });
}

function dlgPrompt(title, message, defaultVal = '') {
  return new Promise(resolve => {
    const modal = document.getElementById('dialog-modal');
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-message').textContent = message;
    const input = document.getElementById('dialog-input');
    input.style.display = 'block';
    input.value = defaultVal;
    modal.classList.remove('hidden');
    input.focus();

    const ok = document.getElementById('dialog-confirm');
    const no = document.getElementById('dialog-cancel');
    const x  = document.getElementById('dialog-cancel-x');

    const cleanup = val => {
      modal.classList.add('hidden');
      input.style.display = 'none';
      ok.replaceWith(ok.cloneNode(true));
      no.replaceWith(no.cloneNode(true));
      x.replaceWith(x.cloneNode(true));
      resolve(val);
    };

    document.getElementById('dialog-confirm').addEventListener('click', () => cleanup(input.value.trim() || null));
    document.getElementById('dialog-cancel').addEventListener('click',  () => cleanup(null));
    document.getElementById('dialog-cancel-x').addEventListener('click', () => cleanup(null));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') cleanup(input.value.trim() || null); });
  });
}

function dlgSelect(title, message, options, defaultVal = '') {
  return new Promise(resolve => {
    const modal = document.getElementById('dialog-modal');
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-message').textContent = message;

    const input = document.getElementById('dialog-input');
    input.style.display = 'none';

    const sel = document.createElement('select');
    sel.className = 'dlg-select';
    options.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value ?? o;
      opt.textContent = o.label ?? o;
      if ((o.value ?? o) === defaultVal) opt.selected = true;
      sel.appendChild(opt);
    });
    input.insertAdjacentElement('afterend', sel);
    modal.classList.remove('hidden');

    const ok = document.getElementById('dialog-confirm');
    const no = document.getElementById('dialog-cancel');
    const x  = document.getElementById('dialog-cancel-x');

    const cleanup = val => {
      modal.classList.add('hidden');
      sel.remove();
      input.style.display = 'none';
      ok.replaceWith(ok.cloneNode(true));
      no.replaceWith(no.cloneNode(true));
      x.replaceWith(x.cloneNode(true));
      resolve(val);
    };

    document.getElementById('dialog-confirm').addEventListener('click', () => cleanup(sel.value || null));
    document.getElementById('dialog-cancel').addEventListener('click',  () => cleanup(null));
    document.getElementById('dialog-cancel-x').addEventListener('click', () => cleanup(null));
  });
}

const sanitize = str => str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');








function formatLogs(raw) {
  if (!raw) return '<span style="color:var(--text-dim)">(nessun log)</span>';

  const lines = raw.split('\n').filter(l => l.trim());

  // Rileva il formato dominante
  const sample = lines.slice(0, 5).join('\n');
  let parser;
  if (/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}\.\d+ \[/.test(sample))       parser = parseAdguard;
  else if (/time=".*?"\s*level=/.test(sample))                               parser = parseNavidrome;
  else if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\s+[A-Z]{3}\s/.test(sample)) parser = parseHeadscale;
  else if (/\x1b\[/.test(sample))                                            parser = parseTraefik;
  else                                                                        parser = parseGeneric;

  return lines.map(line => parser(line)).filter(Boolean).join('');
}

// ── AdGuard: 2026/06/01 08:07:54.298278 [info] messaggio
function parseAdguard(line) {
  line = line.replace(/\x1b\[[0-9;]*m/g, '');
  line = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '');

  const m = line.match(/^(\d{4}\/\d{2}\/\d{2}) (\d{2}:\d{2}:\d{2})\.\d*\s*\[(\w+)\]\s*(.*)/s);
  if (!m) return renderLogLine('', '', line);

  const ts  = `${m[1].replace(/\//g, '-')} ${m[2]}`;
  const raw = m[3].toLowerCase();
  const msg = m[4];

  const { label, cls } = levelFromWord(raw);
  return renderLogLine(ts, label, msg, cls);
}

// ── Headscale: 2026-05-31T09:15:47Z INF messaggio
function parseHeadscale(line) {
  line = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '');

  const m = line.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})Z\s+([A-Z]{3})\s+(.*)/s);
  if (!m) return renderLogLine('', '', line);

  const ts  = `${m[1]} ${m[2]}`;
  const msg = m[4];
  const { label, cls } = levelFromWord(m[3]);
  return renderLogLine(ts, label, msg, cls);
}

// ── Navidrome: time="2026-05-31T19:35:05Z" level=info msg="..."
function parseNavidrome(line) {
  line = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '');

  const m = line.match(/time="(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})Z?"\s*level=(\S*)\s*msg="([^"]*)"/);
  if (!m) return renderLogLine('', '', line);

  const ts  = `${m[1]} ${m[2]}`;
  const msg = m[4];
  const { label, cls } = levelFromWord(m[3]);
  return renderLogLine(ts, label, msg, cls);
}

// ── Traefik: [90m2026-05-31T13:43:42Z[0m [31mERR[0m messaggio
function parseTraefik(line) {
  line = line.replace(/\x1b\[[0-9;]*m/g, '');
  line = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '');

  const m = line.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})Z?\s+([A-Z]+)\s+(.*)/s);
  if (!m) return renderLogLine('', '', line);

  const ts  = `${m[1]} ${m[2]}`;
  const msg = m[4];
  const { label, cls } = levelFromWord(m[3]);
  return renderLogLine(ts, label, msg, cls);
}

// ── Generico: best effort
function parseGeneric(line) {
  line = line.replace(/\x1b\[[0-9;]*m/g, '');
  line = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '');
  return renderLogLine('', '', line);
}

// ── Helpers ───────────────────────────────────────────────────
function levelFromWord(word) {
  word = (word || '').toLowerCase();
  if (/^(error|err|fatal|critical|crit)$/.test(word)) return { label: 'ERR', cls: 'log-err' };
  if (/^(warn|warning)$/.test(word))                   return { label: 'WAR', cls: 'log-war' };
  if (/^(info|inf|notice)$/.test(word))                return { label: 'INF', cls: 'log-inf' };
  if (/^(debug|trace|dbg)$/.test(word))                return { label: 'DBG', cls: 'log-dbg' };
  return { label: '', cls: '' };
}

function renderLogLine(ts, level, msg, cls = '') {
  if (!ts && !level && !msg.trim()) return '';
  const tsHtml    = ts    ? `<span class="log-ts">${ts}</span>` : '';
  const levelHtml = level ? `<span class="log-lv ${cls}">${level}</span>` : '';
  return `<div class="log-line">${tsHtml}${levelHtml}<span class="log-msg">${msg}</span></div>`;
}