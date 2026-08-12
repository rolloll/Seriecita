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
  let updateBanner = null;
  let classifyBar = null;
  let metaStatusEl = null;
  let selectModeButton = null;
  let selectBar = null;

  let authorFilter = null;
  let classifyMode = 'none'; // 'none' | 'author' | 'year' | 'publisher'
  let selectMode = false;

  const expandedKeys = new Set();
  const manualSelection = new Set(); // volume ids
  const customGroups = {}; // { [groupId]: { name, volumeIds: [] } }
  const metaCache = {}; // { [volumeId]: { publisher, year } }

  function getGrid() {
    const card = document.querySelector(CARD_SELECTOR);
    return card ? card.parentElement : null;
  }

  function getVolumeId(card) {
    const titleEl = card.querySelector('a.title');
    const href = titleEl?.getAttribute('href') || '';
    const m = href.match(/id=([^&]+)/);
    return m ? m[1] : null;
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
    const id = getVolumeId(card);
    return { card, id, title, author, ...parseSeries(title) };
  }

  function computeEntries(cards) {
    const parsed = cards.map(readCard);
    const originalIndex = new Map(parsed.map((item, i) => [item.card, i]));
    const byId = new Map(parsed.filter((p) => p.id).map((p) => [p.id, p]));

    const usedIds = new Set();
    const entries = [];

    for (const [groupId, group] of Object.entries(customGroups)) {
      const members = (group.volumeIds || []).map((id) => byId.get(id)).filter(Boolean);
      if (members.length < 2) continue;
      members.forEach((m) => usedIds.add(m.id));
      members.sort((a, b) => originalIndex.get(a.card) - originalIndex.get(b.card));
      entries.push({
        type: 'group',
        custom: true,
        groupId,
        key: `custom:${groupId}`,
        minIndex: Math.min(...members.map((it) => originalIndex.get(it.card))),
        base: group.name,
        author: members[0].author,
        items: members,
      });
    }

    const remaining = parsed.filter((p) => !p.id || !usedIds.has(p.id));
    const byKey = new Map();
    for (const item of remaining) {
      const key = `${item.base}|${item.author}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(item);
    }

    for (const [key, items] of byKey) {
      if (items.length >= 2) {
        items.sort((a, b) => a.num - b.num || KIND_RANK[a.kind] - KIND_RANK[b.kind]);
        entries.push({
          type: 'group',
          custom: false,
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

  // ---- classification (author / year / publisher) ----

  function entryRep(entry) {
    return entry.type === 'group' ? entry.items[0] : entry.item;
  }

  function entryYear(entry) {
    const rep = entryRep(entry);
    return (rep.id && metaCache[rep.id]?.year) || null;
  }

  function entryPublisher(entry) {
    const rep = entryRep(entry);
    return (rep.id && metaCache[rep.id]?.publisher) || null;
  }

  function classifyKey(entry) {
    if (classifyMode === 'author') return entry.author || '(작가 미확인)';
    if (classifyMode === 'year') return entryYear(entry) || '(연도 미확인)';
    if (classifyMode === 'publisher') return entryPublisher(entry) || '(출판사 미확인)';
    return null;
  }

  function buildBuckets(entries) {
    if (classifyMode === 'none') return [{ label: null, entries }];

    const map = new Map();
    entries.forEach((entry) => {
      const key = classifyKey(entry);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    });

    const buckets = Array.from(map.entries()).map(([label, ents]) => ({ label, entries: ents }));
    buckets.sort((a, b) => {
      if (classifyMode === 'year') {
        const na = parseInt(a.label, 10);
        const nb = parseInt(b.label, 10);
        if (Number.isNaN(na) && Number.isNaN(nb)) return 0;
        if (Number.isNaN(na)) return 1;
        if (Number.isNaN(nb)) return -1;
        return nb - na;
      }
      return String(a.label).localeCompare(String(b.label), 'ko');
    });
    return buckets;
  }

  function requestMissingMetadata(grid) {
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll(CARD_SELECTOR));
    const ids = cards.map(getVolumeId).filter((id) => id && !metaCache[id]);
    if (!ids.length) return;
    chrome.runtime.sendMessage({ type: 'seriecitaFetchMetadata', ids });
  }

  // ---- DOM cleanup helpers ----

  function clearHeaders(grid) {
    grid.querySelectorAll('[data-seriecita-header]').forEach((el) => el.remove());
  }

  function clearBadges(grid) {
    grid.querySelectorAll('[data-seriecita-badge]').forEach((el) => el.remove());
  }

  function clearClassifyHeaders(grid) {
    grid.querySelectorAll('[data-seriecita-classify-header]').forEach((el) => el.remove());
  }

  function clearAuthorButtons(grid) {
    grid.querySelectorAll('[data-seriecita-author-btn]').forEach((el) => el.remove());
  }

  // ---- native "select" integration (best-effort) ----

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

  // ---- author filter ----

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

  // ---- manual (custom) series grouping ----

  function saveCustomGroups() {
    chrome.storage.local.set({ seriecitaCustomGroups: customGroups });
  }

  function ensureSelectCheckboxes(cards) {
    cards.forEach((card) => {
      const cover = card.querySelector('.cover');
      const id = getVolumeId(card);
      if (!cover || !id || cover.querySelector('[data-seriecita-checkbox]')) return;

      const box = document.createElement('button');
      box.type = 'button';
      box.className = 'seriecita-checkbox';
      box.dataset.seriecitaCheckbox = 'true';
      box.dataset.volumeId = id;
      box.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (manualSelection.has(id)) {
          manualSelection.delete(id);
          box.classList.remove('seriecita-checked');
        } else {
          manualSelection.add(id);
          box.classList.add('seriecita-checked');
        }
        updateSelectBar();
      });
      cover.appendChild(box);
    });
  }

  function refreshCheckboxes() {
    document.querySelectorAll('[data-seriecita-checkbox]').forEach((box) => {
      box.classList.toggle('seriecita-checked', manualSelection.has(box.dataset.volumeId));
    });
  }

  function createCustomGroupFromSelection() {
    if (manualSelection.size < 2) {
      alert('2권 이상 선택해주세요.');
      return;
    }
    const name = prompt('시리즈 이름을 입력하세요.');
    if (!name || !name.trim()) return;

    const groupId = `custom-${Date.now()}`;
    customGroups[groupId] = { name: name.trim(), volumeIds: Array.from(manualSelection) };
    saveCustomGroups();

    manualSelection.clear();
    refreshCheckboxes();
    updateSelectBar();

    const grid = getGrid();
    if (grid) applyGrouping(grid);
  }

  function updateSelectBar() {
    if (!selectMode || manualSelection.size === 0) {
      selectBar?.remove();
      selectBar = null;
      return;
    }
    if (!selectBar) {
      selectBar = document.createElement('div');
      selectBar.className = 'seriecita-select-bar';
      document.body.appendChild(selectBar);
    }
    selectBar.innerHTML = '';
    const label = document.createElement('span');
    label.textContent = `${manualSelection.size}권 선택됨`;
    const groupBtn = document.createElement('button');
    groupBtn.type = 'button';
    groupBtn.textContent = '시리즈로 묶기';
    groupBtn.addEventListener('click', createCustomGroupFromSelection);
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = '선택 해제';
    clearBtn.addEventListener('click', () => {
      manualSelection.clear();
      refreshCheckboxes();
      updateSelectBar();
    });
    selectBar.append(label, groupBtn, clearBtn);
  }

  function createSelectModeButton() {
    if (selectModeButton) return;
    selectModeButton = document.createElement('button');
    selectModeButton.className = 'seriecita-select-mode-toggle';
    selectModeButton.dataset.enabled = String(selectMode);
    selectModeButton.textContent = '수동 묶기';
    selectModeButton.addEventListener('click', () => {
      selectMode = !selectMode;
      selectModeButton.dataset.enabled = String(selectMode);
      document.body.classList.toggle('seriecita-select-mode', selectMode);
      if (!selectMode) {
        manualSelection.clear();
        refreshCheckboxes();
      }
      updateSelectBar();
    });
    document.body.appendChild(selectModeButton);
  }

  // ---- classification bar ----

  const CLASSIFY_OPTIONS = [
    { value: 'none', label: '분류 없음' },
    { value: 'author', label: '작가별' },
    { value: 'year', label: '발행연도별' },
    { value: 'publisher', label: '출판사별' },
  ];

  function createClassifyBar() {
    if (classifyBar) return;
    classifyBar = document.createElement('div');
    classifyBar.className = 'seriecita-classify-bar';
    CLASSIFY_OPTIONS.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seriecita-classify-option';
      btn.dataset.value = opt.value;
      btn.textContent = opt.label;
      btn.addEventListener('click', () => setClassifyMode(opt.value));
      classifyBar.appendChild(btn);
    });
    metaStatusEl = document.createElement('span');
    metaStatusEl.className = 'seriecita-classify-status';
    classifyBar.appendChild(metaStatusEl);
    document.body.appendChild(classifyBar);
    updateClassifyBarActive();
  }

  function updateClassifyBarActive() {
    if (!classifyBar) return;
    classifyBar.querySelectorAll('.seriecita-classify-option').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === classifyMode);
    });
  }

  function setClassifyMode(mode) {
    classifyMode = mode;
    chrome.storage.local.set({ seriecitaClassifyMode: mode });
    updateClassifyBarActive();
    const grid = getGrid();
    if (grid) applyGrouping(grid);
    if (mode === 'year' || mode === 'publisher') requestMissingMetadata(grid);
  }

  function updateMetaStatus(progress) {
    if (!metaStatusEl) return;
    if (!progress || progress.done >= progress.total) {
      metaStatusEl.textContent = '';
      return;
    }
    metaStatusEl.textContent = `메타데이터 불러오는 중 (${progress.done}/${progress.total})`;
  }

  // ---- headers / badges ----

  function makeHeader(entry, order) {
    const header = document.createElement('div');
    header.className = 'seriecita-header';
    header.dataset.seriecitaHeader = 'true';
    header.style.order = String(order);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'seriecita-header-title';
    titleSpan.textContent = entry.base;

    const countSpan = document.createElement('span');
    countSpan.className = 'seriecita-header-count';
    countSpan.textContent = `${entry.items.length}권`;

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.className = 'seriecita-select-all';
    selectAllBtn.textContent = '전체 선택';
    selectAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectAllInGroup(entry.items);
    });

    header.append(titleSpan, countSpan, selectAllBtn);

    if (entry.custom) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'seriecita-delete-group';
      deleteBtn.textContent = '그룹 삭제';
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm(`"${entry.base}" 묶음을 삭제할까요? (책 자체는 삭제되지 않습니다)`)) return;
        delete customGroups[entry.groupId];
        saveCustomGroups();
        expandedKeys.delete(entry.key);
        const grid = getGrid();
        if (grid) applyGrouping(grid);
      });
      header.appendChild(deleteBtn);
    }

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'seriecita-collapse';
    collapseBtn.textContent = '접기 ^';
    collapseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      expandedKeys.delete(entry.key);
      const grid = getGrid();
      if (grid) applyGrouping(grid);
    });
    header.appendChild(collapseBtn);

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

  function makeClassifyHeader(label, entries, order) {
    const header = document.createElement('div');
    header.className = 'seriecita-classify-header';
    header.dataset.seriecitaClassifyHeader = 'true';
    header.style.order = String(order);
    const count = entries.reduce((sum, e) => sum + (e.type === 'group' ? e.items.length : 1), 0);
    header.textContent = `${label} (${count}권)`;
    return header;
  }

  // ---- main render ----

  function applyGrouping(grid) {
    const cards = Array.from(grid.querySelectorAll(CARD_SELECTOR));
    if (!cards.length) return;

    isApplying = true;
    clearHeaders(grid);
    clearBadges(grid);
    clearClassifyHeaders(grid);
    ensureAuthorButtons(cards);
    ensureSelectCheckboxes(cards);
    createClassifyBar();
    createSelectModeButton();

    let entries = computeEntries(cards);

    if (authorFilter) {
      const kept = [];
      entries.forEach((entry) => {
        if (entry.author === authorFilter) {
          kept.push(entry);
        } else {
          const hideItems = entry.type === 'group' ? entry.items : [entry.item];
          hideItems.forEach((it) => {
            it.card.style.display = 'none';
          });
        }
      });
      entries = kept;
    }

    const buckets = buildBuckets(entries);
    let order = 0;
    let groupCount = 0;

    buckets.forEach((bucket) => {
      if (bucket.label !== null) {
        order += ORDER_STEP;
        grid.appendChild(makeClassifyHeader(bucket.label, bucket.entries, order));
      }

      bucket.entries.forEach((entry) => {
        order += ORDER_STEP;
        if (entry.type === 'group') {
          groupCount += 1;
          const rep = entry.items[0];

          if (expandedKeys.has(entry.key)) {
            grid.appendChild(makeHeader(entry, order));
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
      });
    });

    console.log(`${LOG_PREFIX} grouped ${cards.length} books into ${groupCount} series`);

    requestAnimationFrame(() => {
      isApplying = false;
    });
  }

  function clearGrouping(grid) {
    isApplying = true;
    clearHeaders(grid);
    clearBadges(grid);
    clearClassifyHeaders(grid);
    clearAuthorButtons(grid);

    authorFilter = null;
    updateFilterChip();

    classifyBar?.remove();
    classifyBar = null;
    metaStatusEl = null;

    selectModeButton?.remove();
    selectModeButton = null;
    selectBar?.remove();
    selectBar = null;
    selectMode = false;
    manualSelection.clear();
    document.body.classList.remove('seriecita-select-mode');

    grid.querySelectorAll(CARD_SELECTOR).forEach((card) => {
      card.style.order = '';
      card.style.display = '';
    });
    grid.querySelectorAll('[data-seriecita-checkbox]').forEach((el) => el.remove());

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

  function renderUpdateBanner(info) {
    if (!info) {
      updateBanner?.remove();
      updateBanner = null;
      return;
    }
    if (!updateBanner) {
      updateBanner = document.createElement('a');
      updateBanner.className = 'seriecita-update-banner';
      updateBanner.target = '_blank';
      updateBanner.rel = 'noopener noreferrer';
      document.body.appendChild(updateBanner);
    }
    updateBanner.href = info.url;
    updateBanner.textContent = `Seriecita v${info.version} 업데이트 ›`;
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

  chrome.storage.local.get('seriecitaUpdateAvailable', (result) => {
    renderUpdateBanner(result.seriecitaUpdateAvailable);
  });

  chrome.storage.local.get({ seriecitaCustomGroups: {} }, (result) => {
    Object.assign(customGroups, result.seriecitaCustomGroups);
    scheduleRun();
  });

  chrome.storage.local.get({ seriecitaClassifyMode: 'none' }, (result) => {
    classifyMode = result.seriecitaClassifyMode;
    updateClassifyBarActive();
    scheduleRun();
    if (classifyMode === 'year' || classifyMode === 'publisher') {
      requestMissingMetadata(getGrid());
    }
  });

  chrome.storage.local.get({ seriecitaMetaCache: {} }, (result) => {
    Object.assign(metaCache, result.seriecitaMetaCache);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.seriecitaUpdateAvailable) {
      renderUpdateBanner(changes.seriecitaUpdateAvailable.newValue);
    }

    if (changes.seriecitaMetaCache) {
      Object.assign(metaCache, changes.seriecitaMetaCache.newValue || {});
      if (classifyMode === 'year' || classifyMode === 'publisher') {
        const grid = getGrid();
        if (grid) applyGrouping(grid);
      }
    }

    if (changes.seriecitaMetaFetchProgress) {
      updateMetaStatus(changes.seriecitaMetaFetchProgress.newValue);
    }
  });
})();
