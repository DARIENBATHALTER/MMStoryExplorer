class ExportHandler {
    constructor() {
        this.ffmpeg = null;
        this.isLoading = false;
        this.isReady = false;
    }

    async initialize() {
        if (this.isReady) return;
        if (this.isLoading) {
            // Wait for existing initialization
            while (this.isLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }

        this.isLoading = true;
        try {
            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile } = window.FFmpegUtil;
            
            this.ffmpeg = new FFmpeg();
            this.ffmpeg.on('log', ({ message }) => {
                console.log('[FFmpeg]:', message);
            });

            // Use CDN for FFmpeg core files (they work reliably)
            await this.ffmpeg.load({
                coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
                wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
                // Worker URL is optional and handled internally by FFmpeg
            });
            console.log('FFmpeg loaded successfully');

            this.fetchFile = fetchFile;
            this.isReady = true;
        } catch (error) {
            console.error('Failed to initialize FFmpeg:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    async exportStoryAsVideo(story, profilePicBlob) {
        if (!this.isReady) {
            await this.initialize();
        }

        try {
            const isVideo = story.type === 'video';
            const inputFileName = isVideo ? 'input.mp4' : 'input.jpg';
            const outputFileName = 'output.mp4';

            // Write input media file
            const mediaData = await this.fetchFile(story.url);
            await this.ffmpeg.writeFile(inputFileName, mediaData);

            // Prepare overlay assets
            const overlayCanvas = await this.createOverlayCanvas(story, profilePicBlob);
            const overlayBlob = await this.canvasToBlob(overlayCanvas);
            const overlayData = await this.fetchFile(overlayBlob);
            await this.ffmpeg.writeFile('overlay.png', overlayData);

            // Build FFmpeg command
            let ffmpegCommand;
            if (isVideo) {
                // For video: overlay the PNG on top of the video
                ffmpegCommand = [
                    '-i', inputFileName,
                    '-i', 'overlay.png',
                    '-filter_complex', '[0:v][1:v]overlay=0:0',
                    '-c:a', 'copy',
                    '-preset', 'fast',
                    outputFileName
                ];
            } else {
                // For image: create a 6-second video with the overlay
                ffmpegCommand = [
                    '-loop', '1',
                    '-i', inputFileName,
                    '-i', 'overlay.png',
                    '-filter_complex', '[0:v][1:v]overlay=0:0',
                    '-t', '6',
                    '-pix_fmt', 'yuv420p',
                    '-preset', 'fast',
                    outputFileName
                ];
            }

            // Execute FFmpeg command
            await this.ffmpeg.exec(ffmpegCommand);

            // Read the output file
            const outputData = await this.ffmpeg.readFile(outputFileName);
            const outputBlob = new Blob([outputData.buffer], { type: 'video/mp4' });

            // Clean up temporary files
            await this.ffmpeg.deleteFile(inputFileName);
            await this.ffmpeg.deleteFile('overlay.png');
            await this.ffmpeg.deleteFile(outputFileName);

            return outputBlob;
        } catch (error) {
            console.error('Error exporting story:', error);
            throw error;
        }
    }

    async createOverlayCanvas(story, profilePicBlob) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size to match typical Instagram story dimensions
        canvas.width = 1080;
        canvas.height = 1920;

        // Clear canvas with transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw profile picture with circle mask
        const profileSize = 80;
        const profileX = 40;
        const profileY = 60;
        const username = story.username;

        if (profilePicBlob) {
            const profileImg = new Image();
            profileImg.src = URL.createObjectURL(profilePicBlob);
            await new Promise(resolve => profileImg.onload = resolve);

            // Create circular clipping path
            ctx.save();
            ctx.beginPath();
            ctx.arc(profileX + profileSize/2, profileY + profileSize/2, profileSize/2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            // Draw profile image
            ctx.drawImage(profileImg, profileX, profileY, profileSize, profileSize);
            ctx.restore();

            // Add white border around profile picture
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(profileX + profileSize/2, profileY + profileSize/2, profileSize/2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // Draw placeholder circle if no profile picture
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(profileX + profileSize/2, profileY + profileSize/2, profileSize/2, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'white';
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // Set up text shadow for all text
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Draw username text
        ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'middle';
        
        const textX = profileX + profileSize + 20;
        let currentY = profileY + profileSize/2;
        
        ctx.fillText(username, textX, currentY);

        // Handle reshare info for medicalmedium
        if (story.reshareInfo && username === 'medicalmedium') {
            // Draw reshare icon
            const iconSize = 24;
            const iconX = textX;
            const iconY = currentY + 40;
            
            // Draw a simple reshare/repost icon (curved arrow)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Draw the reshare icon manually
            ctx.beginPath();
            // Main curve
            ctx.arc(iconX + iconSize/2, iconY + iconSize/2, iconSize/3, Math.PI * 0.2, Math.PI * 1.8, false);
            // Arrow head
            ctx.moveTo(iconX + iconSize/2 - iconSize/4, iconY + iconSize/4);
            ctx.lineTo(iconX + iconSize/2, iconY);
            ctx.lineTo(iconX + iconSize/2 + iconSize/4, iconY + iconSize/4);
            ctx.stroke();
            
            // Draw original username text
            ctx.font = 'normal 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.textBaseline = 'middle';
            
            const reshareTextX = iconX + iconSize + 10;
            const reshareTextY = iconY + iconSize/2;
            
            ctx.fillText(`@${story.reshareInfo.originalUser}`, reshareTextX, reshareTextY);
        }

        return canvas;
    }

    canvasToBlob(canvas) {
        return new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), 'image/png');
        });
    }

    formatFileName(originalFilename) {
        // Remove extension and add _screencapture.mp4
        const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
        return `${nameWithoutExt}_screencapture.mp4`;
    }
    
    async concatenateVideos(videoBlobs, outputFilename) {
        if (!this.isReady) {
            await this.initialize();
        }
        
        if (videoBlobs.length === 1) {
            return videoBlobs[0];
        }
        
        try {
            // Write all input videos to FFmpeg
            const inputFiles = [];
            for (let i = 0; i < videoBlobs.length; i++) {
                const inputName = `input${i}.mp4`;
                const videoData = await this.fetchFile(videoBlobs[i]);
                await this.ffmpeg.writeFile(inputName, videoData);
                inputFiles.push(inputName);
            }
            
            // Create concat list file
            const concatList = inputFiles.map((file, i) => `file '${file}'`).join('\n');
            await this.ffmpeg.writeFile('concat_list.txt', new TextEncoder().encode(concatList));
            
            // Run FFmpeg concat command
            await this.ffmpeg.exec([
                '-f', 'concat',
                '-safe', '0',
                '-i', 'concat_list.txt',
                '-c', 'copy',
                outputFilename
            ]);
            
            // Read the output
            const outputData = await this.ffmpeg.readFile(outputFilename);
            const outputBlob = new Blob([outputData.buffer], { type: 'video/mp4' });
            
            // Clean up
            for (const file of inputFiles) {
                await this.ffmpeg.deleteFile(file);
            }
            await this.ffmpeg.deleteFile('concat_list.txt');
            await this.ffmpeg.deleteFile(outputFilename);
            
            return outputBlob;
            
        } catch (error) {
            console.error('Video concatenation failed:', error);
            throw error;
        }
    }

    async downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Export as global for use in app.js
window.ExportHandler = ExportHandler;