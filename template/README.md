# Google Sheets Template

These CSV files are templates for your blacklist and whitelist in Google Sheets.

## How to Use

### Option 1: Import CSV files to Google Sheets

1. Go to [Google Drive](https://drive.google.com/)
2. Click "New" > "Google Sheets" > "Blank spreadsheet"
3. Rename the spreadsheet (e.g., "Soundeo Artist Filter")
4. In the first sheet, go to File > Import > Upload > select `blacklist.csv`
5. Choose "Replace current sheet"
6. Rename this sheet tab to "Blacklist"
7. Click the "+" button to add a new sheet
8. Import `whitelist.csv` into this new sheet
9. Rename this sheet tab to "Whitelist"

### Option 2: Create manually

Create a Google Sheet with two sheet tabs:

**Sheet 1: "Blacklist"**
In column A, add artist names you want to avoid:
```
Artist
Artist Name 1
Artist Name 2
Artist Name 3
```

**Sheet 2: "Whitelist"**
In column A, add verified artist names:
```
Artist
Verified Artist 1
Verified Artist 2
Verified Artist 3
```

## Notes

- The header row ("Artist") is optional but recommended
- One artist per row
- Names are matched case-insensitively
- Spaces and special characters are preserved

## Getting the Spreadsheet ID

After creating your spreadsheet, get the ID from the URL:

```
https://docs.google.com/spreadsheets/d/[THIS-IS-YOUR-SPREADSHEET-ID]/edit
```

Copy the part between `/d/` and `/edit`, then paste it into the extension settings.