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

  return raw.split('\n').filter(l => l.trim()).map(line => {
    // Rimuovi codici ANSI
    line = line.replace(/\x1b\[[0-9;]*m/g, '');

    // Rimuovi timestamp Docker iniziale
    line = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '');

    // Estrai timestamp — vari formati
    let ts = '';
    // formato time="2026-05-31T19:35:05Z" level=info msg="..."  — gestisci prima
    const naviMatch = line.match(/time="(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})Z?"\s*level=\S*\s*msg="([^"]*)"/);
    if (naviMatch) {
      ts = `${naviMatch[1]} ${naviMatch[2]}`;
      line = naviMatch[3]; // prendi solo il msg
    }

    // formato ISO senza ms: 2026-05-31T13:43:42Z
    if (!ts) line = line.replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})Z/, (_, d, t) => { ts = `${d} ${t}`; return ''; });
    // formato slash o dash con spazio
    if (!ts) line = line.replace(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})\s+(\d{2}:\d{2}:\d{2})[\.\d]*/, (_, y, mo, d, t) => { ts = `${y}-${mo}-${d} ${t}`; return ''; });

    // Estrai livello log
    let level = '';
    let levelCls = '';
    const levelMap = [
      { re: /\b(ERROR|ERR|FATAL|CRITICAL|CRIT)\b/i, label: 'ERR', cls: 'log-err' },
      { re: /\b(WARN|WARNING)\b/i,                   label: 'WAR', cls: 'log-war' },
      { re: /\b(INFO|NOTICE|INF)\b/i,                label: 'INF', cls: 'log-inf' },
      { re: /\b(DEBUG|TRACE|DBG)\b/i,                label: 'DBG', cls: 'log-dbg' },
    ];

    // formato level=info
    line = line.replace(/\blevel\s*=\s*["']?(\w+)["']?/i, (_, l) => {
      const found = levelMap.find(m => m.re.test(l));
      if (found && !level) { level = found.label; levelCls = found.cls; }
      return '';
    });

    // match diretto sulla riga
    if (!level) {
      for (const { re, label, cls } of levelMap) {
        if (re.test(line)) {
          level = label;
          levelCls = cls;
          line = line.replace(re, '');
          break;
        }
      }
    }

    // Pulisci residui
    line = line.replace(/^[\s:\|\-\[\]>]+/, '').trim();

    // Salta righe vuote dopo pulizia
    if (!line && !ts && !level) return '';

    const tsHtml    = ts    ? `<span class="log-ts">${ts}</span>` : '';
    const levelHtml = level ? `<span class="log-lv ${levelCls}">${level}</span>` : '';

    return `<div class="log-line">${tsHtml}${levelHtml}<span class="log-msg">${line}</span></div>`;
  }).filter(Boolean).join('');
}