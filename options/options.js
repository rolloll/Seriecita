const STRINGS = {
  ko: {
    heading: 'Seriecita 설정',
    languageHeading: '언어',
    localeAuto: '자동 감지',
    apiKeyHeading: 'Google Books API 키 (선택)',
    apiKeyHint:
      '발행연도/출판사별 분류 기능은 각 책의 정보를 Google Books API에서 가져옵니다. 키 없이도 동작하지만 ' +
      '비인증 요청은 한도가 낮아 책이 많으면 429 오류가 날 수 있습니다. ' +
      '<a href="https://console.cloud.google.com/apis/library/books.googleapis.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>' +
      '에서 "Books API"를 사용 설정하고 API 키를 만들어 등록하면 한도가 늘어납니다. 키는 이 확장의 브라우저 ' +
      '저장소(<code>chrome.storage.local</code>)에만 저장되며 다른 곳으로 전송되지 않습니다.',
    apiKeyPlaceholder: 'API 키 (비워두면 비인증으로 요청)',
    save: '저장',
    saved: '저장했습니다.',
  },
  en: {
    heading: 'Seriecita settings',
    languageHeading: 'Language',
    localeAuto: 'Auto-detect',
    apiKeyHeading: 'Google Books API key (optional)',
    apiKeyHint:
      'Year/publisher classification looks up each book on the Google Books API. It works without a key, but ' +
      'unauthenticated requests have a low quota and a large library may hit 429 errors. Enable "Books API" in the ' +
      '<a href="https://console.cloud.google.com/apis/library/books.googleapis.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a> ' +
      'and register your own key to raise the limit. The key is stored only in this extension’s own browser ' +
      'storage (<code>chrome.storage.local</code>) and is never sent anywhere else.',
    apiKeyPlaceholder: 'API key (leave blank to request unauthenticated)',
    save: 'Save',
    saved: 'Saved.',
  },
};

function detectLocale() {
  return (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

function applyStrings(locale) {
  const s = STRINGS[locale] || STRINGS.en;
  document.title = s.heading;
  document.getElementById('heading').textContent = s.heading;
  document.getElementById('language-heading').textContent = s.languageHeading;
  document.getElementById('locale-auto-option').textContent = s.localeAuto;
  document.getElementById('api-key-heading').textContent = s.apiKeyHeading;
  document.getElementById('api-key-hint').innerHTML = s.apiKeyHint;
  document.getElementById('api-key').placeholder = s.apiKeyPlaceholder;
  document.getElementById('save').textContent = s.save;
}

const localeSelect = document.getElementById('locale-select');
const input = document.getElementById('api-key');
const saveBtn = document.getElementById('save');
const status = document.getElementById('status');

chrome.storage.local.get({ seriecitaLocale: 'auto', seriecitaBooksApiKey: '' }, (result) => {
  localeSelect.value = result.seriecitaLocale;
  const resolved = result.seriecitaLocale === 'auto' ? detectLocale() : result.seriecitaLocale;
  applyStrings(resolved);
  input.value = result.seriecitaBooksApiKey || '';
});

localeSelect.addEventListener('change', () => {
  const pref = localeSelect.value;
  chrome.storage.local.set({ seriecitaLocale: pref });
  applyStrings(pref === 'auto' ? detectLocale() : pref);
});

saveBtn.addEventListener('click', () => {
  const value = input.value.trim();
  chrome.storage.local.set({ seriecitaBooksApiKey: value }, () => {
    const locale = localeSelect.value === 'auto' ? detectLocale() : localeSelect.value;
    status.textContent = STRINGS[locale].saved;
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });
});
