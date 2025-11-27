// Soundeo Artist Filter - Content Script

(function() {
  'use strict';

  // State
  let blacklist = [];
  let whitelist = [];
  let blacklistColor = '#ff4444';
  let whitelistColor = '#44ff44';
  let observer = null;
  let initialized = false;

  // Initialize
  async function init() {
    if (initialized) return;
    initialized = true;
    
    // Load settings from storage
    await loadSettings();
    
    // Initial highlighting
    highlightTracks();
    
    // Watch for new tracks being loaded (infinite scroll, page navigation)
    setupMutationObserver();
    
    console.log('Soundeo Artist Filter initialized');
  }

  async function loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getArtistLists' });
      if (response.success) {
        blacklist = response.blacklist || [];
        whitelist = response.whitelist || [];
        blacklistColor = response.blacklistColor || '#ff4444';
        whitelistColor = response.whitelistColor || '#44ff44';
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Try to load directly from storage as fallback
      try {
        const result = await chrome.storage.sync.get(['blacklist', 'whitelist', 'blacklistColor', 'whitelistColor']);
        blacklist = result.blacklist || [];
        whitelist = result.whitelist || [];
        blacklistColor = result.blacklistColor || '#ff4444';
        whitelistColor = result.whitelistColor || '#44ff44';
      } catch (e) {
        console.error('Fallback storage load failed:', e);
      }
    }
  }

  function setupMutationObserver() {
    // Disconnect existing observer if any
    if (observer) {
      observer.disconnect();
    }

    // Watch for changes in the main content area
    const targetNode = document.body;
    const config = { childList: true, subtree: true };

    observer = new MutationObserver((mutationsList) => {
      let shouldHighlight = false;
      
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if new track items were added
              if (node.classList?.contains('trackitem') || 
                  node.querySelector?.('.trackitem')) {
                shouldHighlight = true;
                break;
              }
            }
          }
        }
        if (shouldHighlight) break;
      }
      
      if (shouldHighlight) {
        // Debounce to avoid too many calls
        clearTimeout(window.highlightTimeout);
        window.highlightTimeout = setTimeout(highlightTracks, 100);
      }
    });

    observer.observe(targetNode, config);
  }

  function highlightTracks() {
    const trackItems = document.querySelectorAll('.trackitem');
    
    trackItems.forEach(trackItem => {
      // Skip if already processed and lists haven't changed
      if (trackItem.dataset.safProcessed === 'true' && 
          trackItem.dataset.safBlacklist === blacklist.length.toString() &&
          trackItem.dataset.safWhitelist === whitelist.length.toString()) {
        return;
      }
      
      // Get track title element
      const titleElement = trackItem.querySelector('.info strong a');
      if (!titleElement) return;
      
      const trackTitle = titleElement.textContent || '';
      
      // Extract artists from the track title
      // Format: "Artist1, Artist2 - Track Name (Mix Type)"
      const artists = extractArtists(trackTitle);
      
      // Check against lists
      const matchResult = checkArtistMatch(artists);
      
      // Apply highlighting
      applyHighlight(trackItem, matchResult);
      
      // Mark as processed
      trackItem.dataset.safProcessed = 'true';
      trackItem.dataset.safBlacklist = blacklist.length.toString();
      trackItem.dataset.safWhitelist = whitelist.length.toString();
    });
  }

  function extractArtists(trackTitle) {
    // Track format: "Artist1, Artist2 - Track Name (Mix Type)"
    // We need to get everything before " - "
    const dashIndex = trackTitle.indexOf(' - ');
    if (dashIndex === -1) {
      // No standard format, try to extract any name
      return [trackTitle.trim()];
    }
    
    const artistsPart = trackTitle.substring(0, dashIndex);
    
    // Split by comma and clean up
    const artists = artistsPart.split(',').map(a => a.trim()).filter(a => a.length > 0);
    
    // Also handle "feat.", "ft.", "&", "and", "x" collaborations
    const expandedArtists = [];
    artists.forEach(artist => {
      // Split by common collaboration indicators
      const parts = artist.split(/\s+(?:feat\.?|ft\.?|&|and|x|vs\.?)\s+/i);
      parts.forEach(p => {
        const cleaned = p.trim();
        if (cleaned.length > 0) {
          expandedArtists.push(cleaned);
        }
      });
    });
    
    return expandedArtists;
  }

  function checkArtistMatch(artists) {
    let isBlacklisted = false;
    let isWhitelisted = false;
    let matchedBlacklistArtist = null;
    let matchedWhitelistArtist = null;
    
    for (const artist of artists) {
      const artistLower = artist.toLowerCase();
      
      // Check blacklist (case-insensitive)
      if (blacklist.some(b => b === artistLower)) {
        isBlacklisted = true;
        matchedBlacklistArtist = artist;
      }
      
      // Check whitelist (case-insensitive)
      if (whitelist.some(w => w === artistLower)) {
        isWhitelisted = true;
        matchedWhitelistArtist = artist;
      }
    }
    
    // Blacklist takes priority - if ANY artist is blacklisted, the whole track is flagged
    if (isBlacklisted) {
      return { type: 'blacklist', artist: matchedBlacklistArtist };
    }
    
    // Only show as whitelisted if ALL artists are verified (none blacklisted)
    if (isWhitelisted) {
      return { type: 'whitelist', artist: matchedWhitelistArtist };
    }
    
    return { type: 'none' };
  }

  function applyHighlight(trackItem, matchResult) {
    // Remove existing highlights
    trackItem.classList.remove('saf-blacklisted', 'saf-whitelisted');
    trackItem.style.removeProperty('--saf-highlight-color');
    
    // Remove existing badge if any
    const existingBadge = trackItem.querySelector('.saf-badge');
    if (existingBadge) {
      existingBadge.remove();
    }
    
    if (matchResult.type === 'blacklist') {
      trackItem.classList.add('saf-blacklisted');
      trackItem.style.setProperty('--saf-highlight-color', blacklistColor);
      
      // Add warning badge
      addBadge(trackItem, '⛔', `Blacklisted: ${matchResult.artist}`, 'blacklist');
      
    } else if (matchResult.type === 'whitelist') {
      trackItem.classList.add('saf-whitelisted');
      trackItem.style.setProperty('--saf-highlight-color', whitelistColor);
      
      // Add verified badge
      addBadge(trackItem, '✓', `Verified: ${matchResult.artist}`, 'whitelist');
    }
  }

  function addBadge(trackItem, icon, tooltip, type) {
    const badge = document.createElement('div');
    badge.className = `saf-badge saf-badge-${type}`;
    badge.innerHTML = icon;
    badge.title = tooltip;
    
    // Find a good place to insert the badge
    const infoDiv = trackItem.querySelector('.info');
    if (infoDiv) {
      infoDiv.style.position = 'relative';
      badge.style.cssText = `
        position: absolute;
        top: -5px;
        right: -5px;
        font-size: 16px;
        z-index: 100;
        cursor: help;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
      `;
      infoDiv.appendChild(badge);
    }
  }

  // Context menu for quick add
  function setupContextMenu() {
    document.addEventListener('contextmenu', (e) => {
      // Check if right-clicked on a track item
      const trackItem = e.target.closest('.trackitem');
      if (!trackItem) return;
      
      const titleElement = trackItem.querySelector('.info strong a');
      if (!titleElement) return;
      
      const trackTitle = titleElement.textContent || '';
      const artists = extractArtists(trackTitle);
      
      // Store for potential use by context menu
      window.safSelectedArtists = artists;
    });
  }

  // Message handler
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'refresh':
        loadSettings().then(() => {
          // Reset processed state and re-highlight
          document.querySelectorAll('.trackitem').forEach(item => {
            item.dataset.safProcessed = 'false';
          });
          highlightTracks();
        });
        sendResponse({ success: true });
        break;
        
      case 'updateColors':
        blacklistColor = request.blacklistColor;
        whitelistColor = request.whitelistColor;
        // Re-apply highlights with new colors
        document.querySelectorAll('.trackitem').forEach(item => {
          item.dataset.safProcessed = 'false';
        });
        highlightTracks();
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
    return true;
  });

  // Run initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also run when page becomes visible (for cached pages)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadSettings().then(highlightTracks);
    }
  });

  // Setup context menu functionality
  setupContextMenu();

})();