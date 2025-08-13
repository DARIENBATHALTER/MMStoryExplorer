# Setting Up FFmpeg for Local Hosting

## Quick Setup

1. **Download FFmpeg files** from unpkg:
```bash
mkdir ffmpeg
cd ffmpeg

# Download the files
curl -O https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js
curl -O https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm
curl -O https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.worker.js
```

2. **Alternative: Use wget**:
```bash
wget https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js
wget https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm  
wget https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.worker.js
```

3. **Place the `ffmpeg` folder** in your project root (same level as index.html)

4. **Update your export-handler.js** to use local files (already configured in the code)

## File Structure
```
mm_story_archiver/
├── index.html
├── app.js
├── styles.css
├── export-handler.js
├── canvas-export-handler.js
└── ffmpeg/
    ├── ffmpeg-core.js
    ├── ffmpeg-core.wasm
    └── ffmpeg-core.worker.js
```

## Testing
1. Open browser console
2. Look for: "FFmpeg loaded successfully"
3. Try exporting a story
4. If successful, you'll see much faster exports!

## File Sizes
- ffmpeg-core.js: ~300KB
- ffmpeg-core.wasm: ~30MB
- ffmpeg-core.worker.js: ~3KB

Total: ~31MB added to your hosting