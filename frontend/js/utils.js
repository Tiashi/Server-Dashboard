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





const formatLogs = (() => {
  let _cache = null;

  async function _loadParsers() {
    if (_cache) return _cache;
    try { _cache = await GET('/docker/log-parsers'); }
    catch(e) { _cache = {}; }
    return _cache;
  }

  function _findParser(parsers, containerName) {
    if (!containerName) return null;
    const name = containerName.toLowerCase();
    return Object.values(parsers).find(p =>
      (p.containers || []).some(c => name.includes(c.toLowerCase()))
    ) || null;
  }

  function _levelFromWord(word) {
    word = (word || '').toLowerCase();
    if (/^(error|err|fatal|critical|crit)$/.test(word)) return { label: 'ERR', cls: 'log-err' };
    if (/^(warn|warning|wrn)$/.test(word))               return { label: 'WAR', cls: 'log-war' };
    if (/^(info|inf|notice)$/.test(word))                return { label: 'INF', cls: 'log-inf' };
    if (/^(debug|trace|dbg)$/.test(word))                return { label: 'DBG', cls: 'log-dbg' };
    return { label: '', cls: '' };
  }

  function _renderLine(ts, level, msg, cls = '') {
    if (!ts && !level && !msg.trim()) return '';
    const tsHtml  = ts    ? `<span class="log-ts">${ts}</span>`       : '';
    const lvHtml  = level ? `<span class="log-lv ${cls}">${level}</span>` : '';
    return `<div class="log-line">${tsHtml}${lvHtml}<span class="log-msg">${msg}</span></div>`;
  }

  function _parseLine(line, parser) {
    line = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '');

    if (!parser || parser.strip_ansi) {
      line = line.replace(/\x1b\[[0-9;]*m/g, '');
    }

    if (!line.trim()) return '';

    let ts = '', msg = line, level = '', levelCls = '';

    if (parser) {
      if (parser.message?.pattern) {
        const m = line.match(new RegExp(parser.message.pattern));
        if (m) { msg = m[1]; }
      } else {
        // Rimuovi timestamp da msg
        if (parser.timestamp?.pattern) {
          const m = msg.match(new RegExp(parser.timestamp.pattern));
          if (m) {
            ts = parser.timestamp.format
              .replace('$1', m[1] || '').replace('$2', m[2] || '')
              .replace('$3', m[3] || '').replace('$4', m[4] || '').trim();
            msg = msg.replace(new RegExp(parser.timestamp.pattern), '').trim();
          }
        }

        // Rimuovi livello da msg — ora msg NON contiene più il timestamp
        if (parser.level?.pattern) {
          // Cerca il livello nella riga originale (per estrarre il gruppo corretto)
          const mOrig = line.match(new RegExp(parser.level.pattern));
          if (mOrig) {
            const r = _levelFromWord(mOrig[parser.level.group || 1]);
            level = r.label; levelCls = r.cls;
          }
          // Rimuovi da msg usando solo la parola del livello estratta
          if (level) {
            msg = msg.replace(new RegExp(`^\\s*${level}\\s*`, 'i'), '').trim();
            // fallback: rimuovi qualsiasi parola maiuscola sola all'inizio
            msg = msg.replace(/^[A-Z]{2,5}\s+/, '').trim();
          }
        }
      }
    }

    msg = msg.replace(/^[\s:\|\-\[\]>]+/, '').trim();
    if (!ts && !level && !msg) return '';
    return _renderLine(ts, level, msg, levelCls);
  }

  return async function formatLogs(raw, containerName) {
    if (!raw) return '<span style="color:var(--text-dim)">(nessun log)</span>';
    const parsers = await _loadParsers();
    const parser  = _findParser(parsers, containerName);
    return raw.split('\n')
      .filter(l => l.trim())
      .map(line => _parseLine(line, parser))
      .filter(Boolean)
      .join('');
  };
})();