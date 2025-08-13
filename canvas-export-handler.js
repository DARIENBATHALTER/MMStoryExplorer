class CanvasExportHandler {
    constructor() {
        this.isReady = true; // Canvas API is always available
    }

    async exportStoryAsVideo(story, profilePicBlob) {
        try {
            const isVideo = story.type === 'video';
            
            if (isVideo) {
                return await this.exportVideoWithOverlay(story, profilePicBlob);
            } else {
                return await this.exportImageAsVideo(story, profilePicBlob);
            }
        } catch (error) {
            console.error('Error exporting story:', error);
            throw error;
        }
    }

    async exportImageAsVideo(story, profilePicBlob) {
        // Create canvas for compositing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to Instagram story dimensions
        canvas.width = 1080;
        canvas.height = 1920;

        // Load the image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = story.url;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        // Pre-render the complete frame once
        const { x, y, width, height } = this.getImageDimensions(img, canvas.width, canvas.height);
        
        // Fill background with black
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the main image
        ctx.drawImage(img, x, y, width, height);

        // Draw overlay once (now includes reshare handling)
        await this.drawOverlay(ctx, story, profilePicBlob);

        // Create an ImageData copy of the final frame
        const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Create video using MediaRecorder
        const stream = canvas.captureStream(30); // 30 FPS
        const recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9'
        });

        const chunks = [];
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };

        return new Promise((resolve, reject) => {
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                resolve(blob);
            };

            recorder.onerror = reject;

            // Since it's a static image, we don't need to redraw each frame
            // The MediaRecorder will automatically repeat the canvas content
            recorder.start();
            setTimeout(() => {
                recorder.stop();
            }, 6000);
        });
    }

    async exportVideoWithOverlay(story, profilePicBlob) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1080;
        canvas.height = 1920;

        // Create video element to load the source
        const video = document.createElement('video');
        video.src = story.url;
        video.crossOrigin = 'anonymous';
        video.muted = true;
        
        await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
        });

        // Get video dimensions
        const { x, y, width, height } = this.getVideoDimensions(video, canvas.width, canvas.height);

        // Pre-render the overlay to a separate canvas to avoid flickering
        const overlayCanvas = document.createElement('canvas');
        overlayCanvas.width = canvas.width;
        overlayCanvas.height = canvas.height;
        const overlayCtx = overlayCanvas.getContext('2d');
        
        // Draw transparent background for overlay
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        await this.drawOverlay(overlayCtx, story, profilePicBlob);

        // Start recording
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9'
        });

        const chunks = [];
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };

        return new Promise((resolve, reject) => {
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                resolve(blob);
            };

            recorder.onerror = reject;

            // Animation loop with pre-rendered overlay
            const animate = () => {
                if (video.ended || video.paused) {
                    recorder.stop();
                    return;
                }

                // Clear canvas with black background
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Draw video frame
                ctx.drawImage(video, x, y, width, height);

                // Draw pre-rendered overlay (no async operations here)
                ctx.drawImage(overlayCanvas, 0, 0);

                requestAnimationFrame(animate);
            };

            // Start recording and video playback
            recorder.start();
            video.play().then(() => {
                animate();
            }).catch(reject);
        });
    }

    getImageDimensions(img, canvasWidth, canvasHeight) {
        const aspectRatio = img.width / img.height;
        const canvasAspectRatio = canvasWidth / canvasHeight;

        let width, height, x, y;

        if (aspectRatio > canvasAspectRatio) {
            // Image is wider than canvas
            width = canvasWidth;
            height = canvasWidth / aspectRatio;
            x = 0;
            y = (canvasHeight - height) / 2;
        } else {
            // Image is taller than canvas
            width = canvasHeight * aspectRatio;
            height = canvasHeight;
            x = (canvasWidth - width) / 2;
            y = 0;
        }

        return { x, y, width, height };
    }

    getVideoDimensions(video, canvasWidth, canvasHeight) {
        const aspectRatio = video.videoWidth / video.videoHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;

        let width, height, x, y;

        if (aspectRatio > canvasAspectRatio) {
            // Video is wider than canvas
            width = canvasWidth;
            height = canvasWidth / aspectRatio;
            x = 0;
            y = (canvasHeight - height) / 2;
        } else {
            // Video is taller than canvas
            width = canvasHeight * aspectRatio;
            height = canvasHeight;
            x = (canvasWidth - width) / 2;
            y = 0;
        }

        return { x, y, width, height };
    }

    async drawOverlay(ctx, story, profilePicBlob) {
        const profileSize = 80;
        const profileX = 40;
        const profileY = 60;
        const username = story.username;

        // Draw profile picture with circle mask
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
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    formatFileName(originalFilename) {
        // Remove extension and add _screencapture.webm
        const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
        return `${nameWithoutExt}_screencapture.webm`;
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
window.CanvasExportHandler = CanvasExportHandler;