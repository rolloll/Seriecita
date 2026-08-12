(() => {
  const CARD_SELECTOR = 'gpb-volume-card';
  const ORDER_STEP = 10;
  const LOG_PREFIX = '[Seriecita]';

  const KIND_RANK = { single: -1, volume: 0, sidestory: 1, extra: 2 };

  const STRINGS = {
    ko: {
      toggleOn: 'Seriecita: ON',
      toggleOff: 'Seriecita: OFF',
      authorFilterLabel: (author) => `작가: ${author}`,
      collect: '모아보기',
      volumes: (n) => `${n}권`,
      selectAll: '전체 선택',
      rename: '이름 변경',
      addBooks: '책 추가',
      deleteGroup: '그룹 삭제',
      collapse: '접기 ^',
      badgeVolumes: (n) => `총 ${n}권`,
      classifyNone: '분류 없음',
      classifyAuthor: '작가별',
      classifyYear: '발행연도별',
      classifyPublisher: '출판사별',
      metaLoading: (done, total) => `메타데이터 불러오는 중 (${done}/${total})`,
      unknownAuthor: '(작가 미확인)',
      unknownYear: '(연도 미확인)',
      unknownPublisher: '(출판사 미확인)',
      manualGroupToggle: '수동 묶기',
      selectedCount: (n) => `${n}권 선택됨`,
      groupSelection: '시리즈로 묶기',
      clearSelection: '선택 해제',
      addToGroupLabel: (name, n) => `"${name}"에 추가할 책 선택 (${n}권)`,
      add: '추가',
      cancel: '취소',
      alertSelectAtLeastTwo: '2권 이상 선택해주세요.',
      promptGroupName: '시리즈 이름을 입력하세요.',
      alertSelectBooksToAdd: '추가할 책을 선택해주세요.',
      confirmRemoveFromGroup: (name) => `이 책을 "${name}"에서 뺄까요? (책 자체는 삭제되지 않습니다)`,
      promptRename: '새 이름을 입력하세요.',
      confirmDeleteGroup: (name) => `"${name}" 묶음을 삭제할까요? (책 자체는 삭제되지 않습니다)`,
      updateBanner: (version) => `Seriecita v${version} 업데이트 ›`,
      settingsTooltip: '설정',
      collapseClassifyBar: '분류 바 접기',
      expandClassifyBar: '분류 바 펼치기',
    },
    en: {
      toggleOn: 'Seriecita: ON',
      toggleOff: 'Seriecita: OFF',
      authorFilterLabel: (author) => `Author: ${author}`,
      collect: 'Collect',
      volumes: (n) => `${n} vol.`,
      selectAll: 'Select all',
      rename: 'Rename',
      addBooks: 'Add books',
      deleteGroup: 'Delete group',
      collapse: 'Collapse ^',
      badgeVolumes: (n) => `${n} vol.`,
      classifyNone: 'No grouping',
      classifyAuthor: 'By author',
      classifyYear: 'By year',
      classifyPublisher: 'By publisher',
      metaLoading: (done, total) => `Loading metadata (${done}/${total})`,
      unknownAuthor: '(Unknown author)',
      unknownYear: '(Unknown year)',
      unknownPublisher: '(Unknown publisher)',
      manualGroupToggle: 'Manual grouping',
      selectedCount: (n) => `${n} selected`,
      groupSelection: 'Group as series',
      clearSelection: 'Clear selection',
      addToGroupLabel: (name, n) => `Pick books to add to "${name}" (${n})`,
      add: 'Add',
      cancel: 'Cancel',
      alertSelectAtLeastTwo: 'Select at least 2 books.',
      promptGroupName: 'Enter a series name.',
      alertSelectBooksToAdd: 'Select books to add.',
      confirmRemoveFromGroup: (name) => `Remove this book from "${name}"? (The book itself won't be deleted.)`,
      promptRename: 'Enter a new name.',
      confirmDeleteGroup: (name) => `Delete the "${name}" grouping? (The books themselves won't be deleted.)`,
      updateBanner: (version) => `Seriecita v${version} update available ›`,
      settingsTooltip: 'Settings',
      collapseClassifyBar: 'Collapse classification bar',
      expandClassifyBar: 'Expand classification bar',
    },
  };

  let localePref = 'auto'; // 'auto' | 'ko' | 'en'
  let locale = 'en';

  function detectLocale() {
    const lang = (document.documentElement.lang || navigator.language || '').toLowerCase();
    return lang.startsWith('ko') ? 'ko' : 'en';
  }

  function resolveLocale() {
    locale = localePref === 'ko' || localePref === 'en' ? localePref : detectLocale();
  }

  function t(key, ...args) {
    const entry = (STRINGS[locale] || STRINGS.en)[key];
    return typeof entry === 'function' ? entry(...args) : entry;
  }

  let enabled = true;
  let isApplying = false;
  let debounceTimer = null;

  let toolbar = null;
  let toggleButton = null;
  let settingsButton = null;
  let filterChip = null;
  let updateBanner = null;
  let classifyBar = null;
  let classifyCollapseBtn = null;
  let metaStatusEl = null;
  let selectModeButton = null;
  let selectBar = null;

  let authorFilter = null;
  let classifyMode = 'none'; // 'none' | 'author' | 'year' | 'publisher'
  let classifyBarCollapsed = false;
  let selectMode = false;
  let addTargetGroupId = null; // set while picking books to add to an existing custom group
  let lastMetaProgress = null;

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
    let s = rawTitle
      .replace(/\s*\((완결|개정판)\)/g, (_, f) => {
        flags.push(f);
        return '';
      })
      .trim()
      .replace(/\s{2,}/g, ' ');

    let m;
    if ((m = s.match(/^(.*\S)\s+\(?외전\s*(\d+)?\)?$/))) {
      return { base: m[1], kind: 'sidestory', num: m[2] ? parseInt(m[2], 10) : 0, flags };
    }
    if ((m = s.match(/^(.*\S)\s+\(?번외\s*(\d+)?\)?$/))) {
      return { base: m[1], kind: 'extra', num: m[2] ? parseInt(m[2], 10) : 0, flags };
    }
    if ((m = s.match(/^(.*\S)\s+(\d+)권$/))) {
      return { base: m[1], kind: 'volume', num: parseInt(m[2], 10), flags };
    }
    if ((m = s.match(/^(.*\S)\s+(\d+)$/))) {
      return { base: m[1], kind: 'volume', num: parseInt(m[2], 10), flags };
    }
    return { base: s, kind: 'single', num: 0, flags };
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
    if (classifyMode === 'author') return entry.author || t('unknownAuthor');
    if (classifyMode === 'year') return entryYear(entry) || t('unknownYear');
    if (classifyMode === 'publisher') return entryPublisher(entry) || t('unknownPublisher');
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
      return String(a.label).localeCompare(String(b.label), locale);
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

  function clearRemoveButtons(grid) {
    grid.querySelectorAll('[data-seriecita-remove-btn]').forEach((el) => el.remove());
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
    label.textContent = t('authorFilterLabel', authorFilter);
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
      if (!metadata) return;
      const authorEl = metadata.querySelector('a[href*="/author?id="]');
      const author = (authorEl?.textContent || '').trim();
      if (!author) return;

      let btn = metadata.querySelector('[data-seriecita-author-btn]');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'seriecita-author-btn';
        btn.dataset.seriecitaAuthorBtn = 'true';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          setAuthorFilter(author);
        });
        metadata.appendChild(btn);
      }
      btn.textContent = t('collect');
    });
  }

  // ---- manual (custom) series grouping ----

  function saveCustomGroups() {
    chrome.storage.local.set({ seriecitaCustomGroups: customGroups });
  }

  function pruneGroupIfTooSmall(groupId) {
    const group = customGroups[groupId];
    if (group && group.volumeIds.length < 2) {
      delete customGroups[groupId];
      expandedKeys.delete(`custom:${groupId}`);
    }
  }

  function removeFromCustomGroup(groupId, volumeId) {
    const group = customGroups[groupId];
    if (!group) return;
    if (!confirm(t('confirmRemoveFromGroup', group.name))) return;
    group.volumeIds = group.volumeIds.filter((id) => id !== volumeId);
    pruneGroupIfTooSmall(groupId);
    saveCustomGroups();
    const grid = getGrid();
    if (grid) applyGrouping(grid);
  }

  function renameCustomGroup(groupId, currentName) {
    const group = customGroups[groupId];
    if (!group) return;
    const newName = prompt(t('promptRename'), currentName);
    if (!newName || !newName.trim()) return;
    group.name = newName.trim();
    saveCustomGroups();
    const grid = getGrid();
    if (grid) applyGrouping(grid);
  }

  function startAddingToGroup(groupId) {
    addTargetGroupId = groupId;
    selectMode = true;
    manualSelection.clear();
    document.body.classList.add('seriecita-select-mode');
    if (selectModeButton) selectModeButton.dataset.enabled = 'true';
    refreshCheckboxes();
    updateSelectBar();
  }

  function confirmAddToGroup() {
    if (!addTargetGroupId) return;
    if (manualSelection.size === 0) {
      alert(t('alertSelectBooksToAdd'));
      return;
    }
    const group = customGroups[addTargetGroupId];
    if (group) {
      group.volumeIds = Array.from(new Set([...group.volumeIds, ...manualSelection]));
      saveCustomGroups();
    }
    manualSelection.clear();
    addTargetGroupId = null;
    refreshCheckboxes();
    updateSelectBar();
    const grid = getGrid();
    if (grid) applyGrouping(grid);
  }

  function cancelAddToGroup() {
    addTargetGroupId = null;
    manualSelection.clear();
    refreshCheckboxes();
    updateSelectBar();
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
      alert(t('alertSelectAtLeastTwo'));
      return;
    }
    const name = prompt(t('promptGroupName'));
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
    const active = Boolean(addTargetGroupId) || manualSelection.size > 0;
    if (!selectMode || !active) {
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

    if (addTargetGroupId) {
      const group = customGroups[addTargetGroupId];
      const label = document.createElement('span');
      label.textContent = t('addToGroupLabel', group?.name || '', manualSelection.size);
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.textContent = t('add');
      addBtn.addEventListener('click', confirmAddToGroup);
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = t('cancel');
      cancelBtn.addEventListener('click', cancelAddToGroup);
      selectBar.append(label, addBtn, cancelBtn);
      return;
    }

    const label = document.createElement('span');
    label.textContent = t('selectedCount', manualSelection.size);
    const groupBtn = document.createElement('button');
    groupBtn.type = 'button';
    groupBtn.textContent = t('groupSelection');
    groupBtn.addEventListener('click', createCustomGroupFromSelection);
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = t('clearSelection');
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
    selectModeButton.addEventListener('click', () => {
      selectMode = !selectMode;
      selectModeButton.dataset.enabled = String(selectMode);
      document.body.classList.toggle('seriecita-select-mode', selectMode);
      if (!selectMode) {
        manualSelection.clear();
        addTargetGroupId = null;
        refreshCheckboxes();
      }
      updateSelectBar();
    });
    document.body.appendChild(selectModeButton);
    refreshStaticLabels();
  }

  // ---- classification bar ----

  const CLASSIFY_KEYS = [
    { value: 'none', stringKey: 'classifyNone' },
    { value: 'author', stringKey: 'classifyAuthor' },
    { value: 'year', stringKey: 'classifyYear' },
    { value: 'publisher', stringKey: 'classifyPublisher' },
  ];

  function createClassifyBar() {
    if (classifyBar) return;
    classifyBar = document.createElement('div');
    classifyBar.className = 'seriecita-classify-bar';
    CLASSIFY_KEYS.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seriecita-classify-option';
      btn.dataset.value = opt.value;
      btn.dataset.stringKey = opt.stringKey;
      btn.addEventListener('click', () => setClassifyMode(opt.value));
      classifyBar.appendChild(btn);
    });
    metaStatusEl = document.createElement('span');
    metaStatusEl.className = 'seriecita-classify-status';
    classifyBar.appendChild(metaStatusEl);

    classifyCollapseBtn = document.createElement('button');
    classifyCollapseBtn.type = 'button';
    classifyCollapseBtn.className = 'seriecita-classify-collapse-btn';
    classifyCollapseBtn.textContent = '▾';
    classifyCollapseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      classifyBarCollapsed = !classifyBarCollapsed;
      classifyBar.classList.toggle('collapsed', classifyBarCollapsed);
      classifyCollapseBtn.textContent = classifyBarCollapsed ? '▸' : '▾';
      classifyCollapseBtn.title = t(classifyBarCollapsed ? 'expandClassifyBar' : 'collapseClassifyBar');
    });
    classifyBar.appendChild(classifyCollapseBtn);

    document.body.appendChild(classifyBar);
    updateClassifyBarActive();
    refreshStaticLabels();
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
    lastMetaProgress = progress;
    if (!metaStatusEl) return;
    if (!progress || progress.done >= progress.total) {
      metaStatusEl.textContent = '';
      return;
    }
    metaStatusEl.textContent = t('metaLoading', progress.done, progress.total);
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
    countSpan.textContent = t('volumes', entry.items.length);

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.className = 'seriecita-select-all';
    selectAllBtn.textContent = t('selectAll');
    selectAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectAllInGroup(entry.items);
    });

    header.append(titleSpan, countSpan, selectAllBtn);

    if (entry.custom) {
      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'seriecita-rename-group';
      renameBtn.textContent = t('rename');
      renameBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        renameCustomGroup(entry.groupId, entry.base);
      });

      const addBooksBtn = document.createElement('button');
      addBooksBtn.type = 'button';
      addBooksBtn.className = 'seriecita-add-books';
      addBooksBtn.textContent = t('addBooks');
      addBooksBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startAddingToGroup(entry.groupId);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'seriecita-delete-group';
      deleteBtn.textContent = t('deleteGroup');
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm(t('confirmDeleteGroup', entry.base))) return;
        delete customGroups[entry.groupId];
        saveCustomGroups();
        expandedKeys.delete(entry.key);
        const grid = getGrid();
        if (grid) applyGrouping(grid);
      });

      header.append(renameBtn, addBooksBtn, deleteBtn);
    }

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'seriecita-collapse';
    collapseBtn.textContent = t('collapse');
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
    label.textContent = t('badgeVolumes', count);
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

  function makeRemoveButton(groupId, volumeId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seriecita-remove-btn';
    btn.dataset.seriecitaRemoveBtn = 'true';
    btn.textContent = '✕';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeFromCustomGroup(groupId, volumeId);
    });
    return btn;
  }

  function makeClassifyHeader(label, entries, order) {
    const header = document.createElement('div');
    header.className = 'seriecita-classify-header';
    header.dataset.seriecitaClassifyHeader = 'true';
    header.style.order = String(order);
    const count = entries.reduce((sum, e) => sum + (e.type === 'group' ? e.items.length : 1), 0);
    header.textContent = `${label} (${t('volumes', count)})`;
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
    clearRemoveButtons(grid);
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
              if (entry.custom) {
                const itCover = it.card.querySelector('.cover');
                if (itCover) itCover.appendChild(makeRemoveButton(entry.groupId, it.id));
              }
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
    clearRemoveButtons(grid);

    authorFilter = null;
    updateFilterChip();

    classifyBar?.remove();
    classifyBar = null;
    metaStatusEl = null;
    classifyCollapseBtn = null;
    classifyBarCollapsed = false;

    selectModeButton?.remove();
    selectModeButton = null;
    selectBar?.remove();
    selectBar = null;
    selectMode = false;
    addTargetGroupId = null;
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

  function ensureToolbar() {
    if (toolbar) return toolbar;
    toolbar = document.createElement('div');
    toolbar.className = 'seriecita-toolbar';
    document.body.appendChild(toolbar);
    return toolbar;
  }

  function createSettingsButton() {
    if (settingsButton) return;
    settingsButton = document.createElement('button');
    settingsButton.type = 'button';
    settingsButton.className = 'seriecita-settings-btn';
    settingsButton.textContent = '⚙';
    settingsButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(chrome.runtime.getURL('options/options.html'), '_blank');
    });
    ensureToolbar().appendChild(settingsButton);
    refreshStaticLabels();
  }

  function createToggleButton() {
    if (toggleButton) return;
    toggleButton = document.createElement('button');
    toggleButton.className = 'seriecita-toggle';
    toggleButton.dataset.enabled = String(enabled);
    toggleButton.addEventListener('click', () => {
      enabled = !enabled;
      toggleButton.dataset.enabled = String(enabled);
      toggleButton.textContent = enabled ? t('toggleOn') : t('toggleOff');
      chrome.storage.local.set({ seriecitaEnabled: enabled });
      scheduleRun();
    });
    ensureToolbar().appendChild(toggleButton);
    refreshStaticLabels();
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
    updateBanner.textContent = t('updateBanner', info.version);
  }

  // Re-applies the current locale to persistent UI chrome that's only
  // created once (so its text doesn't otherwise update on locale change).
  function refreshStaticLabels() {
    if (toggleButton) toggleButton.textContent = enabled ? t('toggleOn') : t('toggleOff');
    if (settingsButton) settingsButton.title = t('settingsTooltip');
    if (selectModeButton) selectModeButton.textContent = t('manualGroupToggle');
    if (classifyBar) {
      classifyBar.querySelectorAll('.seriecita-classify-option').forEach((btn) => {
        btn.textContent = t(btn.dataset.stringKey);
      });
    }
    if (classifyCollapseBtn) {
      classifyCollapseBtn.title = t(classifyBarCollapsed ? 'expandClassifyBar' : 'collapseClassifyBar');
    }
    updateMetaStatus(lastMetaProgress);
    updateFilterChip();
    updateSelectBar();
  }

  console.log(`${LOG_PREFIX} content script loaded on`, location.href);

  const observer = new MutationObserver(() => {
    if (isApplying) return;
    scheduleRun();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.storage.local.get({ seriecitaLocale: 'auto' }, (result) => {
    localePref = result.seriecitaLocale;
    resolveLocale();
    refreshStaticLabels();
  });

  chrome.storage.local.get({ seriecitaEnabled: true }, (result) => {
    enabled = result.seriecitaEnabled;
    createSettingsButton();
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

    if (changes.seriecitaLocale) {
      localePref = changes.seriecitaLocale.newValue || 'auto';
      resolveLocale();
      refreshStaticLabels();
      const grid = getGrid();
      if (grid && enabled) applyGrouping(grid);
    }
  });
})();
