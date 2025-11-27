# Soundeo Artist Filter - Chrome Extension

A Chrome extension that highlights tracks on Soundeo.com based on artist blacklist/whitelist stored in a Google Sheet.

## Features

- 🚫 **Blacklist Highlighting**: Tracks by blacklisted artists are highlighted in red (configurable)
- ✅ **Whitelist Highlighting**: Tracks by verified artists are highlighted in green (configurable)
- 📊 **Google Sheets Integration**: Read from public Google Sheets + write via Apps Script
- 🔄 **Auto-Sync**: Periodically syncs data from your spreadsheet
- ➕ **Quick Add**: Add artists directly to your Google Sheet from the extension
- 🎨 **Customizable Colors**: Choose your own highlight colors

## Setup Instructions

### 1. Prepare Your Google Sheet

1. Create a new Google Sheet (or use an existing one)
2. Create two sheets/tabs named:
   - `Blacklist` - for artists to avoid
   - `Whitelist` - for verified artists
3. In each sheet, add artist names in **Column A** (one per row)
4. **Important**: Make the spreadsheet PUBLIC:
   - Click "Share" → "General access" → "Anyone with the link"
   - Set permission to "Viewer" (minimum required)

### 2. Get Your Spreadsheet ID

From your Google Sheet URL:
```
https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
```
Copy the `SPREADSHEET_ID` part. For example:
```
1KutVtqa2c8JCIvdHSKtwm9e6JdD9WuwNu_kNyLI46ac
```

### 3. Install the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder

### 4. Configure the Extension

1. Click the extension icon in Chrome toolbar
2. Enter your Spreadsheet ID
3. Click "Save & Sync"
4. That's it! Visit soundeo.com to see the highlighting in action

## Usage

### Viewing Tracks on Soundeo

Once configured, visit any page on soundeo.com:
- Tracks by **blacklisted** artists will have a red background
- Tracks by **whitelisted** artists will have a green background
- If a track has multiple artists and ANY of them is blacklisted, the track is marked as blacklisted

### Adding Artists

**Method 1: Quick Add (Recommended)**

If you've set up the Apps Script Web App (see below), artists are added directly to your Google Sheet:
1. Click the extension icon
2. Enter the artist name
3. Click "Add to Blacklist" or "Add to Whitelist"
4. The artist is immediately saved to your Google Sheet!

**Method 2: Edit Google Sheet Manually**
1. Click "Open Sheet" in the extension
2. Add the artist name to Column A in the appropriate sheet
3. Click "Refresh Data" in the extension

## Setting Up Direct Sheet Writing (Apps Script Web App)

To enable adding artists directly to your Google Sheet from the extension, you need to deploy a simple Google Apps Script:

### Step 1: Open Script Editor

1. Open your Google Sheet
2. Go to **Extensions** → **Apps Script**

### Step 2: Create the Script

Replace any existing code with:

```javascript
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;
  
  if (action === 'addArtist') {
    const sheetName = e.parameter.sheet || 'Blacklist';
    const artistName = e.parameter.artist;
    
    if (!artistName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No artist name provided'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    try {
      const targetSheet = sheet.getSheetByName(sheetName);
      if (!targetSheet) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: `Sheet "${sheetName}" not found`
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // Get existing artists to check for duplicates
      const data = targetSheet.getRange('A:A').getValues();
      const existingArtists = data.flat().map(a => a.toString().toLowerCase().trim());
      
      if (existingArtists.includes(artistName.toLowerCase().trim())) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Artist already exists in the list'
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // Find the last row with data and add the new artist
      const lastRow = targetSheet.getLastRow();
      targetSheet.getRange(lastRow + 1, 1).setValue(artistName);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: `Added "${artistName}" to ${sheetName}`
      })).setMimeType(ContentService.MimeType.JSON);
      
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Unknown action'
  })).setMimeType(ContentService.MimeType.JSON);
}
```

### Step 3: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon next to "Select type" → **Web app**
3. Configure:
   - **Description**: Soundeo Artist Filter API
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Click **Deploy**
5. **Authorize** the app when prompted (click through the warnings)
6. Copy the **Web App URL** (looks like `https://script.google.com/macros/s/AKfycb.../exec`)

### Step 4: Configure the Extension

1. Click the extension icon
2. Paste the Web App URL into the "Apps Script Web App URL" field
3. Click "Save & Sync"

Now when you use "Quick Add", artists will be saved directly to your Google Sheet!

### Customizing Colors

1. Click the extension icon
2. In "Highlight Colors" section, pick your preferred colors
3. Click "Save Colors"

## Spreadsheet Structure

### Blacklist Sheet
| A (Artist Name) |
|-----------------|
| Artist Name 1   |
| Artist Name 2   |
| Artist Name 3   |

### Whitelist Sheet
| A (Artist Name) |
|-----------------|
| Artist Name 1   |
| Artist Name 2   |
| Artist Name 3   |

## Troubleshooting

### "Failed to fetch" error
- Make sure your spreadsheet is PUBLIC (Anyone with link can view)
- Check that the Spreadsheet ID is correct
- Verify the sheet names match exactly ("Blacklist" and "Whitelist" by default)

### Tracks not highlighting
- Click "Refresh Data" to sync latest data
- Check if the artist name in your sheet matches exactly
- Reload the Soundeo page

### Extension not working
- Make sure you're on soundeo.com (https://soundeo.com/*)
- Try reloading the page
- Check Chrome DevTools console for errors

## How It Works

1. The extension fetches your Google Sheet data as CSV (public access required)
2. Artist names are normalized (lowercase) for case-insensitive matching
3. Content script scans track elements on Soundeo pages
4. Tracks are highlighted based on artist matches
5. MutationObserver watches for new tracks (infinite scroll support)

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension format)
- **Data Storage**: Chrome Sync Storage + Local Storage
- **Sync Interval**: Every 30 minutes (automatic)
- **Required Permissions**: storage, activeTab, alarms
- **Host Permissions**: soundeo.com, docs.google.com, script.google.com

## Privacy

- No user data is collected or transmitted to third parties
- Artist lists are stored locally in your browser and in your own Google Sheet
- Google Sheet reading uses public CSV export (no authentication)
- Google Sheet writing uses your own Apps Script (runs under your Google account)

## License

MIT License - Feel free to modify and share!
=======
# soundeo-filter
