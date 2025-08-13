class StoryArchiveExplorer {
    constructor() {
        this.archives = new Map(); // Map of date -> zip data
        this.currentStories = [];
        this.currentStoryIndex = 0;
        this.userStories = new Map(); // Map of username -> stories
        this.groupedStories = [];
        this.currentGroupIndex = 0;
        this.profilePictures = new Map(); // Map of username -> profile picture URL
        
        this.initializeEventListeners();
        this.loadProfilePictures();
    }
    
    initializeEventListeners() {
        // File input
        const folderInput = document.getElementById('folder-input');
        folderInput.addEventListener('change', (e) => this.handleFolderSelection(e));
        
        // View toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleView(e));
        });
        
        // Modal controls
        document.querySelector('.close-btn').addEventListener('click', () => this.closeModal());
        document.querySelector('.nav-btn.prev').addEventListener('click', () => this.previousStory());
        document.querySelector('.nav-btn.next').addEventListener('click', () => this.nextStory());
        
        // Close modal on background click
        document.getElementById('story-modal').addEventListener('click', (e) => {
            if (e.target.id === 'story-modal') {
                this.closeModal();
            }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (document.getElementById('story-modal').classList.contains('active')) {
                if (e.key === 'ArrowLeft') this.previousStory();
                if (e.key === 'ArrowRight') this.nextStory();
                if (e.key === 'Escape') this.closeModal();
            }
        });
    }
    
    loadProfilePictures() {
        // Define all the profile pictures available (including new ones)
        const profilePics = [
            '_theobergmann.jpg',
            'alexterreri.jpg',
            'allison.buch.jpg',
            'allison_buch.png',
            'amylouisesouthorn.jpg',
            'brad_shier_sfx_art.jpg',
            'brendan.connelly.jpg',
            'clairesdetox.jpg',
            'diy.heal.jpg',
            'drbradleycampbell.png',
            'drpompa.jpg',
            'elhamsliquidgold.jpg',
            'healingisapardi.jpg',
            'healingthesource.jpg',
            'healingthesourcepodcast.jpg',
            'herban.dictionary.jpg',
            'jamieanneaesthetics.jpg',
            'jryanmusic.jpg',
            'karmalitafox.jpg',
            'laurenwellbeing.png',
            'livsschmidt.png',
            'maidennewyorkla.jpg',
            'medicalmediumsurvivor.jpg',
            'medicalmediumsurvivors.jpg',
            'nutrition_elements.png',
            'oliviabudgen.jpg',
            'rasmussenkolbytaylor.jpg',
            'realfoodology.jpg',
            'rene.horbach.jpg',
            'santiagol3on.jpg',
            'sarah_serratore.png',
            'selenagomez.jpg',
            'shophealingthesource.png',
            'starchaser_the_sailboat.jpg',
            'theskinnisociete.jpg',
            'villagehealthandhealing.png',
            'vitalhealthcollective.jpg',
            'zarnaz_fouladi.jpg'
        ];
        
        // Create username to profile pic mapping
        profilePics.forEach(filename => {
            // Extract username from filename (remove extension)
            const username = filename.replace(/\.(jpg|png)$/, '').replace(/_/g, '').replace(/\./g, '');
            const usernameWithUnderscores = filename.replace(/\.(jpg|png)$/, '');
            const path = `profile_pictures/${filename}`;
            
            // Store multiple variations of the username for better matching
            this.profilePictures.set(username, path);
            this.profilePictures.set(usernameWithUnderscores, path); // With underscores/dots
            
            // Special cases for better matching
            if (filename === 'rene.horbach.jpg') {
                this.profilePictures.set('rene_horbach', path);
            }
            if (filename === 'allison.buch.jpg' || filename === 'allison_buch.png') {
                this.profilePictures.set('allison.buch', path);
                this.profilePictures.set('allison_buch', path);
            }
        });
    }
    
    async handleFolderSelection(event) {
        const files = Array.from(event.target.files);
        const zipFiles = files.filter(file => 
            file.name.endsWith('.zip') && 
            !file.name.startsWith('._') && // Exclude macOS metadata files
            file.size > 1000 // Exclude tiny files that are likely not real archives
        );
        
        if (zipFiles.length === 0) {
            alert('No ZIP files found in the selected folder');
            return;
        }
        
        // Check if JSZip is loaded
        if (typeof JSZip === 'undefined') {
            alert('JSZip library failed to load. Please refresh the page and try again.');
            return;
        }
        
        // Show loading state
        const button = document.querySelector('.file-input-button span');
        const originalText = button.textContent;
        button.textContent = 'Processing archives...';
        
        // Clear existing data
        this.archives.clear();
        this.userStories.clear();
        
        // Process each ZIP file
        let successCount = 0;
        for (const file of zipFiles) {
            try {
                await this.processZipFile(file);
                successCount++;
            } catch (error) {
                console.error(`Failed to process ${file.name}:`, error);
            }
        }
        
        // Restore button text
        button.textContent = originalText;
        
        if (successCount === 0) {
            alert('Failed to process any ZIP files. Please check the console for errors.');
            return;
        }
        
        // Switch to home view
        this.showHomeView();
    }
    
    async processZipFile(file) {
        try {
            console.log(`Processing: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            
            // Extract date from filename (assuming format: MassDownloader__stories_YYYY-MM-DD.zip)
            const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
            const date = dateMatch ? dateMatch[1] : file.name;
            
            // Read ZIP file using arrayBuffer for better compatibility
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            // Get all media files and their usernames
            const stories = [];
            
            console.log(`ZIP contains ${Object.keys(zip.files).length} entries`);
            
            zip.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir && this.isMediaFile(relativePath)) {
                    // Extract username from path (first folder in path)
                    const pathParts = relativePath.split('/');
                    const username = pathParts[0] || 'Unknown';
                    
                    // Store story metadata without loading the blob yet
                    const story = {
                        username,
                        zipEntry,  // Store the zip entry for lazy loading
                        type: this.getMediaType(relativePath),
                        filename: pathParts[pathParts.length - 1],
                        date,
                        relativePath
                    };
                    stories.push(story);
                    
                    // Add to user stories map
                    if (!this.userStories.has(username)) {
                        this.userStories.set(username, []);
                    }
                    this.userStories.get(username).push(story);
                }
            });
            
            console.log(`Found ${stories.length} stories for date ${date}`);
            this.archives.set(date, stories);
        } catch (error) {
            console.error('Error processing ZIP file:', error);
        }
    }
    
    isMediaFile(filename) {
        const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.webm'];
        return mediaExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }
    
    getMediaType(filename) {
        const videoExtensions = ['.mp4', '.mov', '.webm'];
        return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext)) ? 'video' : 'image';
    }
    
    showHomeView() {
        console.log('Switching to home view...');
        console.log('Archives found:', this.archives.size);
        console.log('Users found:', this.userStories.size);
        
        const pickerView = document.getElementById('file-picker-view');
        const homeView = document.getElementById('home-view');
        
        // Use inline styles directly for reliability
        if (pickerView) {
            pickerView.style.display = 'none';
            pickerView.classList.remove('active');
        }
        
        if (homeView) {
            homeView.style.display = 'block';
            homeView.classList.add('active');
        }
        
        this.renderDatesList();
        this.renderUsersList();
    }
    
    renderDatesList() {
        const datesList = document.getElementById('dates-list');
        console.log('Rendering dates list, element found:', !!datesList);
        datesList.innerHTML = '';
        
        // Sort dates in descending order
        const sortedDates = Array.from(this.archives.keys()).sort((a, b) => b.localeCompare(a));
        console.log('Sorted dates:', sortedDates);
        
        sortedDates.forEach(date => {
            const stories = this.archives.get(date);
            const dateCard = document.createElement('div');
            dateCard.className = 'date-card';
            dateCard.innerHTML = `
                <div class="date-text">${this.formatDate(date)}</div>
                <div class="story-count">${stories.length} stories</div>
            `;
            dateCard.addEventListener('click', () => this.openDateStories(date));
            datesList.appendChild(dateCard);
        });
        console.log('Date cards added:', datesList.children.length);
    }
    
    renderUsersList() {
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '';
        
        // Sort users alphabetically
        const sortedUsers = Array.from(this.userStories.keys()).sort((a, b) => 
            a.toLowerCase().localeCompare(b.toLowerCase())
        );
        
        sortedUsers.forEach(username => {
            const stories = this.userStories.get(username);
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            
            // Check for profile picture
            const profilePic = this.profilePictures.get(username);
            const avatarHTML = profilePic 
                ? `<div class="user-avatar" style="background-image: url('${profilePic}');"></div>`
                : `<div class="user-avatar"></div>`;
            
            userCard.innerHTML = `
                ${avatarHTML}
                <div class="user-name">${username}</div>
                <div class="user-story-count">${stories.length} stories</div>
            `;
            userCard.addEventListener('click', () => this.openUserStories(username));
            usersList.appendChild(userCard);
        });
    }
    
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            const options = { weekday: 'short', month: 'short', day: 'numeric' };
            return date.toLocaleDateString('en-US', options);
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateString;
        }
    }
    
    formatStoryDate(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                return 'yesterday';
            } else if (diffDays <= 7) {
                return `${diffDays} days ago`;
            } else {
                const options = { month: 'short', day: 'numeric' };
                return date.toLocaleDateString('en-US', options);
            }
        } catch (error) {
            console.error('Error formatting story date:', error);
            return dateString;
        }
    }
    
    toggleView(event) {
        const viewType = event.target.dataset.view;
        
        // Update toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Update content views
        document.querySelectorAll('.content-view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewType}-view`).classList.add('active');
    }
    
    openDateStories(date) {
        const allStories = this.archives.get(date) || [];
        // Group stories by user for date view
        this.groupedStories = this.groupStoriesByUser(allStories);
        this.currentGroupIndex = 0;
        this.currentStories = this.groupedStories[0]?.stories || [];
        this.currentStoryIndex = 0;
        this.showStoryModal();
    }
    
    openUserStories(username) {
        const userStories = this.userStories.get(username) || [];
        // Single group for user view
        this.groupedStories = [{
            username,
            stories: userStories
        }];
        this.currentGroupIndex = 0;
        this.currentStories = userStories;
        this.currentStoryIndex = 0;
        this.showStoryModal();
    }
    
    groupStoriesByUser(stories) {
        const grouped = new Map();
        
        stories.forEach(story => {
            if (!grouped.has(story.username)) {
                grouped.set(story.username, []);
            }
            grouped.get(story.username).push(story);
        });
        
        // Convert to array format
        return Array.from(grouped.entries()).map(([username, userStories]) => ({
            username,
            stories: userStories
        }));
    }
    
    showStoryModal() {
        if (this.currentStories.length === 0) return;
        
        const modal = document.getElementById('story-modal');
        modal.classList.add('active');
        
        this.renderProgressBar();
        this.showCurrentStory();
    }
    
    renderProgressBar() {
        const progressContainer = document.querySelector('.progress-segments');
        progressContainer.innerHTML = '';
        
        // Only show progress for current user's stories
        const currentGroup = this.groupedStories[this.currentGroupIndex];
        if (!currentGroup) return;
        
        currentGroup.stories.forEach((_, index) => {
            const segment = document.createElement('div');
            segment.className = 'progress-segment';
            segment.innerHTML = '<div class="progress-fill"></div>';
            progressContainer.appendChild(segment);
        });
    }
    
    async showCurrentStory() {
        if (this.currentStoryIndex < 0 || this.currentStoryIndex >= this.currentStories.length) return;
        
        const story = this.currentStories[this.currentStoryIndex];
        const mediaContainer = document.querySelector('.story-media');
        const username = document.querySelector('.username');
        const storyDate = document.querySelector('.story-date');
        const avatarCircle = document.querySelector('.avatar-circle');
        
        // Update username
        username.textContent = story.username;
        
        // Show date only when viewing by username (not by date)
        if (this.groupedStories.length === 1) {
            // Single user view - show the date
            storyDate.textContent = this.formatStoryDate(story.date);
            storyDate.style.display = 'block';
        } else {
            // Multiple users by date - hide the date
            storyDate.style.display = 'none';
        }
        
        // Update avatar with profile picture if available
        const profilePic = this.profilePictures.get(story.username);
        if (profilePic) {
            avatarCircle.style.backgroundImage = `url('${profilePic}')`;
            avatarCircle.style.backgroundSize = 'cover';
            avatarCircle.style.backgroundPosition = 'center';
        } else {
            // Reset to gradient if no profile pic
            avatarCircle.style.backgroundImage = 'linear-gradient(135deg, #405de6, #833ab4, #c13584, #fd1d1d)';
        }
        
        // Clear previous media
        mediaContainer.innerHTML = '<div class="loading"></div>';
        
        // Load media blob if not already loaded
        if (!story.url && story.zipEntry) {
            try {
                const blob = await story.zipEntry.async('blob');
                story.url = URL.createObjectURL(blob);
            } catch (error) {
                console.error('Failed to load media:', error);
                mediaContainer.innerHTML = '<p style="color: #999;">Failed to load media</p>';
                return;
            }
        }
        
        // Clear loading indicator
        mediaContainer.innerHTML = '';
        
        // Add new media
        if (story.type === 'image') {
            const img = document.createElement('img');
            img.src = story.url;
            img.alt = story.filename;
            mediaContainer.appendChild(img);
        } else if (story.type === 'video') {
            const video = document.createElement('video');
            video.src = story.url;
            video.controls = true;
            video.autoplay = true;
            video.muted = true;
            mediaContainer.appendChild(video);
        }
        
        // Update progress
        this.updateProgress();
        
        // Update navigation buttons
        const isFirstStory = this.currentStoryIndex === 0 && this.currentGroupIndex === 0;
        const isLastStory = this.currentStoryIndex === this.currentStories.length - 1 && 
                           this.currentGroupIndex === this.groupedStories.length - 1;
        
        document.querySelector('.nav-btn.prev').disabled = isFirstStory;
        document.querySelector('.nav-btn.next').disabled = isLastStory;
    }
    
    updateProgress() {
        const segments = document.querySelectorAll('.progress-segment');
        segments.forEach((segment, index) => {
            const fill = segment.querySelector('.progress-fill');
            if (index < this.currentStoryIndex) {
                fill.style.width = '100%';
            } else if (index === this.currentStoryIndex) {
                fill.style.width = '100%';
            } else {
                fill.style.width = '0%';
            }
        });
    }
    
    async previousStory() {
        if (this.currentStoryIndex > 0) {
            this.currentStoryIndex--;
            await this.showCurrentStory();
        } else if (this.currentGroupIndex > 0) {
            // Move to previous user's last story
            this.currentGroupIndex--;
            this.currentStories = this.groupedStories[this.currentGroupIndex].stories;
            this.currentStoryIndex = this.currentStories.length - 1;
            this.renderProgressBar();
            await this.showCurrentStory();
        }
    }
    
    async nextStory() {
        if (this.currentStoryIndex < this.currentStories.length - 1) {
            this.currentStoryIndex++;
            await this.showCurrentStory();
        } else if (this.currentGroupIndex < this.groupedStories.length - 1) {
            // Move to next user's first story
            this.currentGroupIndex++;
            this.currentStories = this.groupedStories[this.currentGroupIndex].stories;
            this.currentStoryIndex = 0;
            this.renderProgressBar();
            await this.showCurrentStory();
        }
    }
    
    closeModal() {
        const modal = document.getElementById('story-modal');
        modal.classList.remove('active');
        
        // Clean up object URLs to free memory
        this.currentStories.forEach(story => {
            if (story.url && story.url.startsWith('blob:')) {
                URL.revokeObjectURL(story.url);
            }
        });
        
        this.currentStories = [];
        this.currentStoryIndex = 0;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new StoryArchiveExplorer();
});