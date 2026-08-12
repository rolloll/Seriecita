const input = document.getElementById('api-key');
const saveBtn = document.getElementById('save');
const status = document.getElementById('status');

chrome.storage.local.get('seriecitaBooksApiKey', (result) => {
  input.value = result.seriecitaBooksApiKey || '';
});

saveBtn.addEventListener('click', () => {
  const value = input.value.trim();
  chrome.storage.local.set({ seriecitaBooksApiKey: value }, () => {
    status.textContent = '저장했습니다.';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });
});
