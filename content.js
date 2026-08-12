(() => {
  const CARD_SELECTOR = 'gpb-volume-card';
  const ORDER_STEP = 10;
  const LOG_PREFIX = '[Seriecita]';

  const KIND_RANK = { single: -1, volume: 0, sidestory: 1, extra: 2 };

  let enabled = true;
  let isApplying = false;
  let debounceTimer = null;
  let toggleButton = null;
  let filterChip = null;
  let authorFilter = null;
  const expandedKeys = new Set();

  function getGrid() {
    const card = document.querySelector(CARD_SELECTOR);
    return card ? card.parentElement : null;
  }

  function parseSeries(rawTitle) {
    const flags = [];
    let t = rawTitle
      .replace(/\s*\((완결|개정판)\)/g, (_, f) => {
        flags.push(f);
        return '';
      })
      .trim()
      .replace(/\s{2,}/g, ' ');

    let m;
    if ((m = t.match(/^(.*\S)\s+\(?외전\s*(\d+)?\)?$/))) {
      return { base: m[1], kind: 'sidestory', num: m[2] ? parseInt(m[2], 10) : 0, flags };
    }
    if ((m = t.match(/^(.*\S)\s+\(?번외\s*(\d+)?\)?$/))) {
      return { base: m[1], kind: 'extra', num: m[2] ? parseInt(m[2], 10) : 0, flags };
    }
    if ((m = t.match(/^(.*\S)\s+(\d+)권$/))) {
      return { base: m[1], kind: 'volume', num: parseInt(m[2], 10), flags };
    }
    if ((m = t.match(/^(.*\S)\s+(\d+)$/))) {
      return { base: m[1], kind: 'volume', num: parseInt(m[2], 10), flags };
    }
    return { base: t, kind: 'single', num: 0, flags };
  }

  function readCard(card) {
    const titleEl = card.querySelector('a.title');
    const title = (titleEl?.textContent || '').trim();
    const authorEl = card.querySelector('.metadata a[href*="/author?id="]');
    const author = (authorEl?.textContent || '').trim();
    return { card, title, author, ...parseSeries(title) };
  }

  function computeEntries(cards) {
    const parsed = cards.map(readCard);
    const originalIndex = new Map(parsed.map((item, i) => [item.card, i]));

    const byKey = new Map();
    for (const item of parsed) {
      const key = `${item.base}|${item.author}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(item);
    }

    const entries = [];
    for (const [key, items] of byKey) {
      if (items.length >= 2) {
        items.sort((a, b) => a.num - b.num || KIND_RANK[a.kind] - KIND_RANK[b.kind]);
        entries.push({
          type: 'group',
          key,
          minIndex: Math.min(...items.map((it) => originalIndex.get(it.card))),
          base: items[0].base,
          author: items[0].author,
          items,
        });
      } else {
        entries.push({
          type: 'single',
          minIndex: originalIndex.get(items[0].card),
          author: items[0].author,
          item: items[0],
        });
      }
    }

    entries.sort((a, b) => a.minIndex - b.minIndex);
    return entries;
  }

  function clearHeaders(grid) {
    grid.querySelectorAll('[data-seriecita-header]').forEach((el) => el.remove());
  }

  function clearBadges(grid) {
    grid.querySelectorAll('[data-seriecita-badge]').forEach((el) => el.remove());
  }

  function clearAuthorButtons(grid) {
    grid.querySelectorAll('[data-seriecita-author-btn]').forEach((el) => el.remove());
  }

  function findSelectButton(card) {
    return (
      Array.from(card.querySelectorAll('button')).find((b) => {
        const label = (b.getAttribute('aria-label') || '').trim().toLowerCase();
        return label === 'select' || label === '선택';
      }) || null
    );
  }

  function selectAllInGroup(items) {
    items.forEach((it) => {
      const btn = findSelectButton(it.card);
      if (btn) btn.click();
    });
  }

  function setAuthorFilter(author) {
    authorFilter = author;
    updateFilterChip();
    const grid = getGrid();
    if (grid) applyGrouping(grid);
  }

  function updateFilterChip() {
    if (!authorFilter) {
      filterChip?.remove();
      filterChip = null;
      return;
    }
    if (!filterChip) {
      filterChip = document.createElement('div');
      filterChip.className = 'seriecita-filter-chip';
      document.body.appendChild(filterChip);
    }
    filterChip.innerHTML = '';
    const label = document.createElement('span');
    label.textContent = `작가: ${authorFilter}`;
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = '✕';
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setAuthorFilter(null);
    });
    filterChip.append(label, clearBtn);
  }

  function ensureAuthorButtons(cards) {
    cards.forEach((card) => {
      const metadata = card.querySelector('.metadata');
      if (!metadata || metadata.querySelector('[data-seriecita-author-btn]')) return;
      const authorEl = metadata.querySelector('a[href*="/author?id="]');
      const author = (authorEl?.textContent || '').trim();
      if (!author) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seriecita-author-btn';
      btn.dataset.seriecitaAuthorBtn = 'true';
      btn.textContent = '모아보기';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setAuthorFilter(author);
      });
      metadata.appendChild(btn);
    });
  }

  function makeHeader(base, items, order, key) {
    const header = document.createElement('div');
    header.className = 'seriecita-header';
    header.dataset.seriecitaHeader = 'true';
    header.style.order = String(order);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'seriecita-header-title';
    titleSpan.textContent = base;

    const countSpan = document.createElement('span');
    countSpan.className = 'seriecita-header-count';
    countSpan.textContent = `${items.length}권`;

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.className = 'seriecita-select-all';
    selectAllBtn.textContent = '전체 선택';
    selectAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectAllInGroup(items);
    });

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'seriecita-collapse';
    collapseBtn.textContent = '접기 ^';
    collapseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      expandedKeys.delete(key);
      const grid = getGrid();
      if (grid) applyGrouping(grid);
    });

    header.append(titleSpan, countSpan, selectAllBtn, collapseBtn);
    return header;
  }

  function makeBadge(count, key) {
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'seriecita-badge';
    badge.dataset.seriecitaBadge = 'true';

    const label = document.createElement('span');
    label.textContent = `총 ${count}권`;
    const chevron = document.createElement('span');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '›';

    badge.append(label, chevron);
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      expandedKeys.add(key);
      const grid = getGrid();
      if (grid) applyGrouping(grid);
    });
    return badge;
  }

  function applyGrouping(grid) {
    const cards = Array.from(grid.querySelectorAll(CARD_SELECTOR));
    if (!cards.length) return;

    isApplying = true;
    clearHeaders(grid);
    clearBadges(grid);
    ensureAuthorButtons(cards);

    const entries = computeEntries(cards);
    let order = 0;
    let groupCount = 0;
    for (const entry of entries) {
      if (authorFilter && entry.author !== authorFilter) {
        const hideItems = entry.type === 'group' ? entry.items : [entry.item];
        hideItems.forEach((it) => {
          it.card.style.display = 'none';
        });
        continue;
      }

      order += ORDER_STEP;
      if (entry.type === 'group') {
        groupCount += 1;
        const rep = entry.items[0];

        if (expandedKeys.has(entry.key)) {
          grid.appendChild(makeHeader(entry.base, entry.items, order, entry.key));
          for (const it of entry.items) {
            order += ORDER_STEP;
            it.card.style.order = String(order);
            it.card.style.display = '';
          }
        } else {
          rep.card.style.order = String(order);
          rep.card.style.display = '';
          const cover = rep.card.querySelector('.cover');
          if (cover) cover.appendChild(makeBadge(entry.items.length, entry.key));
          for (const it of entry.items) {
            if (it !== rep) it.card.style.display = 'none';
          }
        }
      } else {
        entry.item.card.style.order = String(order);
        entry.item.card.style.display = '';
      }
    }

    console.log(`${LOG_PREFIX} grouped ${cards.length} books into ${groupCount} series`);

    requestAnimationFrame(() => {
      isApplying = false;
    });
  }

  function clearGrouping(grid) {
    isApplying = true;
    clearHeaders(grid);
    clearBadges(grid);
    clearAuthorButtons(grid);
    authorFilter = null;
    updateFilterChip();
    grid.querySelectorAll(CARD_SELECTOR).forEach((card) => {
      card.style.order = '';
      card.style.display = '';
    });
    requestAnimationFrame(() => {
      isApplying = false;
    });
  }

  function scheduleRun() {
    if (isApplying) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const grid = getGrid();
      if (!grid) return;
      if (enabled) {
        applyGrouping(grid);
      } else {
        clearGrouping(grid);
      }
    }, 300);
  }

  function createToggleButton() {
    if (toggleButton) return;
    toggleButton = document.createElement('button');
    toggleButton.className = 'seriecita-toggle';
    toggleButton.dataset.enabled = String(enabled);
    toggleButton.textContent = enabled ? 'Seriecita: ON' : 'Seriecita: OFF';
    toggleButton.addEventListener('click', () => {
      enabled = !enabled;
      toggleButton.dataset.enabled = String(enabled);
      toggleButton.textContent = enabled ? 'Seriecita: ON' : 'Seriecita: OFF';
      chrome.storage.local.set({ seriecitaEnabled: enabled });
      scheduleRun();
    });
    document.body.appendChild(toggleButton);
  }

  console.log(`${LOG_PREFIX} content script loaded on`, location.href);

  const observer = new MutationObserver(() => {
    if (isApplying) return;
    scheduleRun();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.storage.local.get({ seriecitaEnabled: true }, (result) => {
    enabled = result.seriecitaEnabled;
    createToggleButton();
    scheduleRun();
  });
})();
