let _termWs   = null;
let _termXterm = null;

async function loadTerminal() {
  const el = document.getElementById('page-terminal');
  el.innerHTML = `
    <div class="page-title">Terminale</div>
    <div class="page-subtitle">BASH INTERATTIVO</div>
    <div id="terminal-container"></div>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/xterm/5.3.0/xterm.min.css">
  `;

  // Load xterm.js dynamically
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xterm/5.3.0/xterm.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xterm/5.3.0/addon-fit/xterm-addon-fit.min.js');

  const container = document.getElementById('terminal-container');
  if (!container) return;

  const term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    theme: {
      background: '#0a0c0c',
      foreground: '#c8d8d0',
      cursor:     '#39ff84',
      selectionBackground: '#1a7a3e55',
      black:   '#0d0f0f', brightBlack:   '#2a3030',
      red:     '#ff4444', brightRed:     '#ff6666',
      green:   '#39ff84', brightGreen:   '#5cffa0',
      yellow:  '#f0c040', brightYellow:  '#f5d060',
      blue:    '#4488ff', brightBlue:    '#66aaff',
      magenta: '#cc88ff', brightMagenta: '#ddaaff',
      cyan:    '#44ddcc', brightCyan:    '#66eedd',
      white:   '#c8d8d0', brightWhite:   '#ffffff',
    },
    scrollback: 5000,
  });

  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(container);
  fitAddon.fit();
  _termXterm = term;

  // Resize observer
  const ro = new ResizeObserver(() => {
    fitAddon.fit();
    if (_termWs?.readyState === WebSocket.OPEN) {
      _termWs.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    }
  });
  ro.observe(container);

  // WebSocket
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws/terminal`);
  ws.binaryType = 'arraybuffer';
  _termWs = ws;

  ws.onopen = () => {
    // Send initial size
    ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    term.focus();
  };

  ws.onmessage = e => {
    const data = e.data instanceof ArrayBuffer
      ? new Uint8Array(e.data)
      : e.data;
    term.write(data);
  };

  ws.onclose = () => {
    term.writeln('\r\n\x1b[33m[Connessione terminale chiusa]\x1b[0m');
  };

  ws.onerror = () => {
    term.writeln('\r\n\x1b[31m[Errore WebSocket]\x1b[0m');
  };

  term.onData(data => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(new TextEncoder().encode(data));
    }
  });
}

function unloadTerminal() {
  if (_termWs) {
    _termWs.close();
    _termWs = null;
  }
  if (_termXterm) {
    _termXterm.dispose();
    _termXterm = null;
  }
}

// Helper: load script once
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}
