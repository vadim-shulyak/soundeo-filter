// Soundeo Artist Filter - Popup Script (No Auth Version)

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const spreadsheetIdInput = document.getElementById('spreadsheet-id');
  const blacklistSheetInput = document.getElementById('blacklist-sheet');
  const whitelistSheetInput = document.getElementById('whitelist-sheet');
  const webAppUrlInput = document.getElementById('web-app-url');
  const saveSheetsBtn = document.getElementById('save-sheets-btn');
  const openSheetBtn = document.getElementById('open-sheet-btn');
  
  const blacklistColorInput = document.getElementById('blacklist-color');
  const blacklistColorText = document.getElementById('blacklist-color-text');
  const whitelistColorInput = document.getElementById('whitelist-color');
  const whitelistColorText = document.getElementById('whitelist-color-text');
  const saveColorsBtn = document.getElementById('save-colors-btn');
  
  const artistNameInput = document.getElementById('artist-name');
  const addBlacklistBtn = document.getElementById('add-blacklist-btn');
  const addWhitelistBtn = document.getElementById('add-whitelist-btn');
  
  const blacklistCount = document.getElementById('blacklist-count');
  const whitelistCount = document.getElementById('whitelist-count');
  const localBlacklistCount = document.getElementById('local-blacklist-count');
  const localWhitelistCount = document.getElementById('local-whitelist-count');
  const lastSync = document.getElementById('last-sync');
  const refreshBtn = document.getElementById('refresh-btn');
  
  const messageEl = document.getElementById('message');
  const quickAddHint = document.getElementById('quick-add-hint');

  // Initialize
  loadSettings();

  // Event Listeners
  saveSheetsBtn.addEventListener('click', saveSheetSettings);
  openSheetBtn.addEventListener('click', openSpreadsheet);
  saveColorsBtn.addEventListener('click', saveColorSettings);
  addBlacklistBtn.addEventListener('click', () => addArtist('blacklist'));
  addWhitelistBtn.addEventListener('click', () => addArtist('whitelist'));
  refreshBtn.addEventListener('click', refreshData);

  // Allow Enter key to add artist
  artistNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addArtist('blacklist'); // Default to blacklist on Enter
    }
  });

  // Sync color inputs
  blacklistColorInput.addEventListener('input', (e) => {
    blacklistColorText.value = e.target.value;
  });
  blacklistColorText.addEventListener('input', (e) => {
    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
      blacklistColorInput.value = e.target.value;
    }
  });
  whitelistColorInput.addEventListener('input', (e) => {
    whitelistColorText.value = e.target.value;
  });
  whitelistColorText.addEventListener('input', (e) => {
    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
      whitelistColorInput.value = e.target.value;
    }
  });

  // Functions
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'spreadsheetId',
        'blacklistSheet',
        'whitelistSheet',
        'webAppUrl',
        'blacklistColor',
        'whitelistColor',
        'blacklist',
        'whitelist',
        'lastSync'
      ]);
      
      const localData = await chrome.storage.local.get(['localBlacklist', 'localWhitelist']);

      if (result.spreadsheetId) {
        spreadsheetIdInput.value = result.spreadsheetId;
      }
      if (result.blacklistSheet) {
        blacklistSheetInput.value = result.blacklistSheet;
      }
      if (result.whitelistSheet) {
        whitelistSheetInput.value = result.whitelistSheet;
      }
      if (result.webAppUrl) {
        webAppUrlInput.value = result.webAppUrl;
      }
      if (result.blacklistColor) {
        blacklistColorInput.value = result.blacklistColor;
        blacklistColorText.value = result.blacklistColor;
      }
      if (result.whitelistColor) {
        whitelistColorInput.value = result.whitelistColor;
        whitelistColorText.value = result.whitelistColor;
      }

      // Update Quick Add hint based on Web App URL configuration
      if (result.webAppUrl) {
        quickAddHint.textContent = 'Artists will be added directly to your Google Sheet.';
        quickAddHint.classList.remove('warning');
      } else {
        quickAddHint.textContent = '⚠️ Web App URL not configured. Artists will be saved locally only.';
        quickAddHint.classList.add('warning');
      }

      // Update stats
      const blacklistArr = result.blacklist || [];
      const whitelistArr = result.whitelist || [];
      const localBlacklistArr = localData.localBlacklist || [];
      const localWhitelistArr = localData.localWhitelist || [];
      
      blacklistCount.textContent = blacklistArr.length;
      whitelistCount.textContent = whitelistArr.length;
      localBlacklistCount.textContent = `(+${localBlacklistArr.length} local)`;
      localWhitelistCount.textContent = `(+${localWhitelistArr.length} local)`;
      
      if (result.lastSync) {
        lastSync.textContent = new Date(result.lastSync).toLocaleString();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async function saveSheetSettings() {
    const spreadsheetId = spreadsheetIdInput.value.trim();
    const blacklistSheet = blacklistSheetInput.value.trim() || 'Blacklist';
    const whitelistSheet = whitelistSheetInput.value.trim() || 'Whitelist';
    const webAppUrl = webAppUrlInput.value.trim();

    if (!spreadsheetId) {
      showMessage('Please enter a Spreadsheet ID', 'error');
      return;
    }

    try {
      saveSheetsBtn.disabled = true;
      saveSheetsBtn.textContent = '⏳ Saving...';

      await chrome.storage.sync.set({
        spreadsheetId,
        blacklistSheet,
        whitelistSheet,
        webAppUrl
      });

      // Trigger data sync
      const response = await chrome.runtime.sendMessage({ action: 'syncData' });
      
      if (response.success) {
        showMessage(`✅ ${response.message}`, 'success');
        await loadSettings(); // Refresh stats
      } else {
        showMessage('❌ Sync failed: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Save error:', error);
      showMessage('❌ Error: ' + error.message, 'error');
    } finally {
      saveSheetsBtn.disabled = false;
      saveSheetsBtn.textContent = '💾 Save & Sync';
    }
  }

  async function openSpreadsheet() {
    try {
      const spreadsheetId = spreadsheetIdInput.value.trim();
      if (!spreadsheetId) {
        showMessage('Please enter a Spreadsheet ID first', 'error');
        return;
      }
      
      await chrome.storage.sync.set({ spreadsheetId });
      const response = await chrome.runtime.sendMessage({ action: 'openSpreadsheet' });
      
      if (!response.success) {
        showMessage('❌ ' + (response.error || 'Failed to open spreadsheet'), 'error');
      }
    } catch (error) {
      console.error('Open spreadsheet error:', error);
      showMessage('❌ Error: ' + error.message, 'error');
    }
  }

  async function saveColorSettings() {
    const blacklistColor = blacklistColorInput.value;
    const whitelistColor = whitelistColorInput.value;

    try {
      await chrome.storage.sync.set({
        blacklistColor,
        whitelistColor
      });

      // Notify content script to update colors
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url?.includes('soundeo.com')) {
        await chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'updateColors',
          blacklistColor,
          whitelistColor
        });
      }

      showMessage('✅ Colors saved!', 'success');
    } catch (error) {
      console.error('Save colors error:', error);
      showMessage('❌ Error: ' + error.message, 'error');
    }
  }

  async function addArtist(listType) {
    const artistName = artistNameInput.value.trim();
    
    if (!artistName) {
      showMessage('Please enter an artist name', 'error');
      return;
    }

    try {
      const btn = listType === 'blacklist' ? addBlacklistBtn : addWhitelistBtn;
      btn.disabled = true;
      btn.textContent = '⏳ Adding...';

      // Check if web app URL is configured
      const settings = await chrome.storage.sync.get(['webAppUrl']);
      const action = settings.webAppUrl ? 'addArtist' : 'addArtistLocal';

      const response = await chrome.runtime.sendMessage({
        action,
        listType,
        artistName
      });

      if (response.success) {
        showMessage(`✅ ${response.message}`, 'success');
        artistNameInput.value = '';
        await loadSettings(); // Refresh stats
        
        // Notify content script to re-highlight
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.url?.includes('soundeo.com')) {
          await chrome.tabs.sendMessage(tabs[0].id, { action: 'refresh' });
        }
      } else {
        showMessage('❌ ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Add artist error:', error);
      showMessage('❌ Error: ' + error.message, 'error');
    } finally {
      addBlacklistBtn.disabled = false;
      addBlacklistBtn.textContent = '🚫 Add to Blacklist';
      addWhitelistBtn.disabled = false;
      addWhitelistBtn.textContent = '✅ Add to Whitelist';
    }
  }

  async function refreshData() {
    try {
      refreshBtn.disabled = true;
      refreshBtn.textContent = '⏳ Refreshing...';

      const response = await chrome.runtime.sendMessage({ action: 'syncData' });
      
      if (response.success) {
        await loadSettings();
        showMessage(`✅ ${response.message}`, 'success');
        
        // Notify content script to re-highlight
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.url?.includes('soundeo.com')) {
          await chrome.tabs.sendMessage(tabs[0].id, { action: 'refresh' });
        }
      } else {
        showMessage('❌ Refresh failed: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Refresh error:', error);
      showMessage('❌ Error: ' + error.message, 'error');
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '🔄 Refresh Data';
    }
  }

  function showMessage(text, type = 'info') {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.classList.remove('hidden');
    
    setTimeout(() => {
      messageEl.classList.add('hidden');
    }, 5000);
  }
});