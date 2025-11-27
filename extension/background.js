// Soundeo Artist Filter - Background Service Worker
// Uses public Google Sheets CSV export (no authentication required)

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true; // Keep message channel open for async response
});

async function handleMessage(request, sender) {
  switch (request.action) {
    case 'syncData':
      return await syncData();
    
    case 'addArtist':
      return await addArtistToSheet(request.listType, request.artistName);
    
    case 'addArtistLocal':
      return await addArtistLocal(request.listType, request.artistName);
    
    case 'getArtistLists':
      return await getArtistLists();
    
    case 'openSpreadsheet':
      return await openSpreadsheet();
    
    default:
      return { success: false, error: 'Unknown action' };
  }
}

async function syncData() {
  try {
    const settings = await chrome.storage.sync.get([
      'spreadsheetId',
      'blacklistSheet',
      'whitelistSheet'
    ]);

    if (!settings.spreadsheetId) {
      return { success: false, error: 'No spreadsheet ID configured' };
    }

    const blacklistSheetName = settings.blacklistSheet || 'Blacklist';
    const whitelistSheetName = settings.whitelistSheet || 'Whitelist';

    // Fetch both sheets as CSV
    const [blacklist, whitelist] = await Promise.all([
      fetchSheetAsCSV(settings.spreadsheetId, blacklistSheetName),
      fetchSheetAsCSV(settings.spreadsheetId, whitelistSheetName)
    ]);

    // Get local additions and merge
    const localData = await chrome.storage.local.get(['localBlacklist', 'localWhitelist']);
    const localBlacklist = localData.localBlacklist || [];
    const localWhitelist = localData.localWhitelist || [];

    // Merge and normalize to lowercase for case-insensitive matching
    const mergedBlacklist = [...new Set([...blacklist, ...localBlacklist])].map(a => a.toLowerCase());
    const mergedWhitelist = [...new Set([...whitelist, ...localWhitelist])].map(a => a.toLowerCase());

    // Store the merged data
    await chrome.storage.sync.set({
      blacklist: mergedBlacklist,
      whitelist: mergedWhitelist,
      lastSync: Date.now()
    });

    // Notify all Soundeo tabs to refresh highlighting
    const tabs = await chrome.tabs.query({ url: 'https://soundeo.com/*' });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'refresh' });
      } catch (e) {
        // Tab might not have content script loaded
      }
    }

    return { 
      success: true, 
      blacklistCount: mergedBlacklist.length, 
      whitelistCount: mergedWhitelist.length,
      message: `Loaded ${blacklist.length} blacklisted and ${whitelist.length} whitelisted artists from spreadsheet`
    };
  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, error: error.message };
  }
}

async function fetchSheetAsCSV(spreadsheetId, sheetName) {
  // Get the GID (sheet ID) first by fetching the spreadsheet
  // For public sheets, we can use the export URL format
  
  // First, try to get the sheet by name using a workaround
  // Google Sheets export URL format: 
  // https://docs.google.com/spreadsheets/d/{spreadsheetId}/gviz/tq?tqx=out:csv&sheet={sheetName}
  
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  
  console.log('Fetching:', url);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sheetName}: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  
  // Parse CSV - extract first column (artist names)
  const artists = parseCSVFirstColumn(csvText);
  
  return artists;
}

function parseCSVFirstColumn(csvText) {
  const lines = csvText.split('\n');
  const artists = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line - handle quoted values
    let value = '';
    if (line.startsWith('"')) {
      // Quoted value - find the closing quote
      const endQuote = line.indexOf('"', 1);
      if (endQuote > 0) {
        value = line.substring(1, endQuote);
      }
    } else {
      // Unquoted value - take until comma or end
      const commaIndex = line.indexOf(',');
      value = commaIndex > 0 ? line.substring(0, commaIndex) : line;
    }
    
    value = value.trim();
    
    // Skip header rows and empty values
    if (value && 
        value.toLowerCase() !== 'artist' && 
        value.toLowerCase() !== 'name' &&
        value.toLowerCase() !== 'artist name' &&
        value.toLowerCase() !== 'artists') {
      artists.push(value);
    }
  }
  
  return artists;
}

async function addArtistToSheet(listType, artistName) {
  try {
    const settings = await chrome.storage.sync.get(['webAppUrl']);
    
    if (!settings.webAppUrl) {
      return { success: false, error: 'No Google Apps Script Web App URL configured. Please set it up in the extension settings.' };
    }

    const sheetName = listType === 'blacklist' ? 'Blacklist' : 'Whitelist';
    
    // Call the Google Apps Script web app
    const url = `${settings.webAppUrl}?action=addArtist&sheet=${encodeURIComponent(sheetName)}&artist=${encodeURIComponent(artistName)}`;
    
    console.log('Adding artist to sheet:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to add artist: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      // Also update local cache immediately
      const syncKey = listType === 'blacklist' ? 'blacklist' : 'whitelist';
      const syncData = await chrome.storage.sync.get([syncKey]);
      const mergedList = syncData[syncKey] || [];
      if (!mergedList.includes(artistName.toLowerCase())) {
        mergedList.push(artistName.toLowerCase());
        await chrome.storage.sync.set({ [syncKey]: mergedList });
      }
      
      return { success: true, message: `Added "${artistName}" to ${listType} in Google Sheet!` };
    } else {
      return { success: false, error: result.error || 'Unknown error from Google Apps Script' };
    }
  } catch (error) {
    console.error('Add artist to sheet error:', error);
    return { success: false, error: error.message };
  }
}

async function addArtistLocal(listType, artistName) {
  try {
    // Store locally
    const storageKey = listType === 'blacklist' ? 'localBlacklist' : 'localWhitelist';
    const localData = await chrome.storage.local.get([storageKey]);
    const artists = localData[storageKey] || [];
    
    // Check if already exists
    if (artists.map(a => a.toLowerCase()).includes(artistName.toLowerCase())) {
      return { success: false, error: 'Artist already in list' };
    }
    
    artists.push(artistName);
    await chrome.storage.local.set({ [storageKey]: artists });
    
    // Also update the sync storage (merged list used by content script)
    const syncKey = listType === 'blacklist' ? 'blacklist' : 'whitelist';
    const syncData = await chrome.storage.sync.get([syncKey]);
    const mergedList = syncData[syncKey] || [];
    mergedList.push(artistName.toLowerCase());
    await chrome.storage.sync.set({ [syncKey]: mergedList });

    return { success: true, message: `Added "${artistName}" to local ${listType}. Don't forget to add it to your Google Sheet as well!` };
  } catch (error) {
    console.error('Add artist error:', error);
    return { success: false, error: error.message };
  }
}

async function getArtistLists() {
  try {
    const result = await chrome.storage.sync.get(['blacklist', 'whitelist', 'blacklistColor', 'whitelistColor']);
    const localData = await chrome.storage.local.get(['localBlacklist', 'localWhitelist']);
    
    return {
      success: true,
      blacklist: result.blacklist || [],
      whitelist: result.whitelist || [],
      localBlacklist: localData.localBlacklist || [],
      localWhitelist: localData.localWhitelist || [],
      blacklistColor: result.blacklistColor || '#ff4444',
      whitelistColor: result.whitelistColor || '#44ff44'
    };
  } catch (error) {
    console.error('Get artist lists error:', error);
    return { success: false, error: error.message };
  }
}

async function openSpreadsheet() {
  try {
    const settings = await chrome.storage.sync.get(['spreadsheetId']);
    if (settings.spreadsheetId) {
      const url = `https://docs.google.com/spreadsheets/d/${settings.spreadsheetId}/edit`;
      await chrome.tabs.create({ url });
      return { success: true };
    }
    return { success: false, error: 'No spreadsheet configured' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default values
    await chrome.storage.sync.set({
      blacklistSheet: 'Blacklist',
      whitelistSheet: 'Whitelist',
      blacklistColor: '#ff4444',
      whitelistColor: '#44ff44',
      blacklist: [],
      whitelist: [],
      webAppUrl: ''
    });
    
    await chrome.storage.local.set({
      localBlacklist: [],
      localWhitelist: []
    });
    
    console.log('Soundeo Artist Filter installed');
  }
});

// Periodically sync data (every 30 minutes when browser is active)
chrome.alarms.create('syncData', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'syncData') {
    const settings = await chrome.storage.sync.get(['spreadsheetId']);
    if (settings.spreadsheetId) {
      await syncData();
    }
  }
});