const REPO = 'rolloll/Seriecita';
const CHECK_ALARM = 'seriecita-update-check';
const CHECK_INTERVAL_MINUTES = 360;

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

async function checkForUpdate() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return;
    const data = await res.json();
    const latestVersion = (data.tag_name || '').replace(/^v/, '');
    if (!latestVersion) return;

    const currentVersion = chrome.runtime.getManifest().version;
    const releaseUrl = data.html_url || `https://github.com/${REPO}/releases/latest`;

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      await chrome.storage.local.set({ seriecitaUpdateAvailable: null });
      return;
    }

    await chrome.storage.local.set({
      seriecitaUpdateAvailable: { version: latestVersion, url: releaseUrl },
    });

    const { seriecitaNotifiedVersion } = await chrome.storage.local.get('seriecitaNotifiedVersion');
    if (seriecitaNotifiedVersion !== latestVersion) {
      chrome.notifications.create(`seriecita-update-${latestVersion}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon128.png'),
        title: 'Seriecita 업데이트',
        message: `v${latestVersion} 버전이 나왔습니다. 클릭하면 릴리스 페이지로 이동합니다.`,
      });
      await chrome.storage.local.set({ seriecitaNotifiedVersion: latestVersion });
    }
  } catch (e) {
    console.error('[Seriecita] update check failed', e);
  }
}

chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId.startsWith('seriecita-update-')) return;
  chrome.storage.local.get('seriecitaUpdateAvailable', ({ seriecitaUpdateAvailable }) => {
    const url = seriecitaUpdateAvailable?.url || `https://github.com/${REPO}/releases/latest`;
    chrome.tabs.create({ url });
  });
  chrome.notifications.clear(notificationId);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(CHECK_ALARM, { delayInMinutes: 1, periodInMinutes: CHECK_INTERVAL_MINUTES });
  checkForUpdate();
});

chrome.runtime.onStartup.addListener(() => {
  checkForUpdate();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CHECK_ALARM) checkForUpdate();
});

const VOLUMES_API = 'https://www.googleapis.com/books/v1/volumes/';
const FETCH_DELAY_MS = 150;
let metadataQueue = [];
let metadataQueueRunning = false;
let metadataQueueTotal = 0;
let metadataQueueDone = 0;

function parseYear(publishedDate) {
  const m = (publishedDate || '').match(/^(\d{4})/);
  return m ? m[1] : null;
}

async function fetchOneVolume(id, apiKey) {
  const url = VOLUMES_API + encodeURIComponent(id) + (apiKey ? `?key=${encodeURIComponent(apiKey)}` : '');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const info = data.volumeInfo || {};
  return {
    publisher: info.publisher || null,
    year: parseYear(info.publishedDate),
  };
}

async function drainMetadataQueue() {
  if (metadataQueueRunning) return;
  metadataQueueRunning = true;
  try {
    const { seriecitaBooksApiKey } = await chrome.storage.local.get('seriecitaBooksApiKey');
    while (metadataQueue.length) {
      const id = metadataQueue.shift();
      try {
        const { seriecitaMetaCache = {} } = await chrome.storage.local.get('seriecitaMetaCache');
        if (!seriecitaMetaCache[id]) {
          seriecitaMetaCache[id] = await fetchOneVolume(id, seriecitaBooksApiKey);
          await chrome.storage.local.set({ seriecitaMetaCache });
        }
      } catch (e) {
        console.warn('[Seriecita] metadata fetch failed for', id, e);
      }
      metadataQueueDone += 1;
      await chrome.storage.local.set({
        seriecitaMetaFetchProgress: { done: metadataQueueDone, total: metadataQueueTotal },
      });
      await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
    }
  } finally {
    metadataQueueRunning = false;
    metadataQueueTotal = 0;
    metadataQueueDone = 0;
  }
}

async function enqueueMetadata(ids) {
  const { seriecitaMetaCache = {} } = await chrome.storage.local.get('seriecitaMetaCache');
  const known = new Set(metadataQueue);
  const fresh = [...new Set(ids)].filter((id) => id && !seriecitaMetaCache[id] && !known.has(id));
  if (!fresh.length) return;
  metadataQueue.push(...fresh);
  metadataQueueTotal += fresh.length;
  drainMetadataQueue();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'seriecitaFetchMetadata' && Array.isArray(message.ids)) {
    enqueueMetadata(message.ids);
  }
});
