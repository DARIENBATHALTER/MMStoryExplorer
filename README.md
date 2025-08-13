# Instagram Story Archive Explorer

A luxurious, minimal web application for browsing Instagram stories that have been downloaded in ZIP format.

## Features

- Browse stories by date or username
- Instagram-style story viewer with progress indicators
- Reads ZIP files directly in the browser
- Clean, dark, minimal interface
- No server required - runs entirely client-side

## Usage

1. Open `index.html` in a modern web browser
2. Click "Choose Archive Folder" and select the folder containing your ZIP files
3. Browse stories by date or username
4. Click any card to view stories in an Instagram-style slideshow

## Troubleshooting

If you see "JSZip library failed to load" error:

1. **Check your internet connection** - The app needs to download the JSZip library from a CDN
2. **Try a different browser** - Some browsers may block CDN requests
3. **Download JSZip manually**:
   - Download jszip.min.js from https://github.com/Stuk/jszip/releases
   - Place it in the same folder as index.html
   - Update the script tag in index.html to: `<script src="jszip.min.js"></script>`

## Supported Formats

- ZIP files with the naming pattern: `MassDownloader__stories_YYYY-MM-DD.zip`
- Media files: JPG, JPEG, PNG, GIF, MP4, MOV, WEBM
- Stories organized in folders by username within the ZIP

## Browser Requirements

- Modern browser with File API support
- JavaScript enabled
- Sufficient memory to process ZIP files