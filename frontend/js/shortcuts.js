async function loadShortcuts() {
  const el = document.getElementById('page-shortcuts');
  el.innerHTML = `
    <div class="page-title">Scorciatoie</div>
    <div class="page-subtitle">ACCESSO RAPIDO AI TUOI SERVIZI</div>
    <div class="cards-grid" id="sc-grid"><div class="spinner"></div></div>
  `;

  const grid = document.getElementById('sc-grid');

  async function render() {
    const items = await GET('/shortcuts');
    grid.innerHTML = '';

    items.forEach(sc => {
      const card = document.createElement('div');
      card.className = 'shortcut-card';
      card.innerHTML = `
        <button class="sc-del" data-id="${sc.id}" title="Rimuovi">✕</button>
        <div class="sc-icon">${sc.icon}</div>
        <div class="sc-name">${sc.name}</div>
        <div class="sc-url">${sc.url}</div>
      `;
      card.addEventListener('click', e => {
        if (e.target.classList.contains('sc-del')) return;
        window.open(sc.url, '_blank', 'noopener');
      });
      card.querySelector('.sc-del').addEventListener('click', async e => {
        e.stopPropagation();
        await DELETE(`/shortcuts/${sc.id}`);
        render();
      });
      grid.appendChild(card);
    });

    // Add card
    const add = document.createElement('div');
    add.className = 'shortcut-card add-card';
    add.textContent = '+';
    add.addEventListener('click', () => openShortcutModal(render));
    grid.appendChild(add);
  }

  render();
}

function openShortcutModal(onSave) {
  const modal = document.getElementById('shortcut-modal');
  modal.classList.remove('hidden');

  document.getElementById('shortcut-modal-close').onclick = () => modal.classList.add('hidden');

  document.getElementById('sc-save').onclick = async () => {
    const name = document.getElementById('sc-name').value.trim();
    const url  = document.getElementById('sc-url').value.trim();
    const icon = document.getElementById('sc-icon').value.trim() || '🔗';
    if (!name || !url) return;
    await POST('/shortcuts', { name, url, icon });
    modal.classList.add('hidden');
    document.getElementById('sc-name').value = '';
    document.getElementById('sc-url').value  = '';
    document.getElementById('sc-icon').value = '';
    onSave();
  };
}
