class StoryArchiveExplorer {
    constructor() {
        this.archives = new Map(); // Map of date -> stories
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
        
        profilePics.forEach(filename => {
            const username = filename.replace(/\.(jpg|png)$/, '').replace(/_/g, '').replace(/\./g, '');
            const usernameWithUnderscores = filename.replace(/\.(jpg|png)$/, '');
            const path = `profile_pictures/${filename}`;
            
            this.profilePictures.set(username, path);
            this.profilePictures.set(usernameWithUnderscores, path);
            this.profilePictures.set(username.toLowerCase(), path);
        });
    }
    
    async handleFolderSelection(event) {
        const files = Array.from(event.target.files);
        
        if (files.length === 0) {
            alert('No files selected');
            return;
        }
        
        // Show loading state
        const button = document.querySelector('.file-input-button span');
        const originalText = button.textContent;
        button.textContent = 'Processing archive folder...';
        
        // Clear existing data
        this.archives.clear();
        this.userStories.clear();
        
        // Build folder structure from file paths
        const folderStructure = this.buildFolderStructure(files);
        
        // Process the folder structure
        this.processFolderStructure(folderStructure);
        
        // Restore button text
        button.textContent = originalText;
        
        if (this.archives.size === 0) {
            alert('No valid story archives found. Please select the AutoExport folder.');
            return;
        }
        
        // Switch to home view
        this.showHomeView();
    }
    
    buildFolderStructure(files) {
        const structure = {};
        
        files.forEach(file => {
            // Get the relative path from webkitRelativePath
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            
            // Skip if not enough path depth (need at least folder/date/user/file)
            if (parts.length < 4) return;
            
            // Extract components
            // parts[0] = root folder (AutoExport or whatever was selected)
            // parts[1] = date folder (YYYYMMDD)
            // parts[2] = user folder
            // parts[3] = filename
            
            const dateFolder = parts[1];
            const userFolder = parts[2];
            const filename = parts[parts.length - 1];
            
            // Skip if not a valid date folder (8 digits)
            if (!/^\d{8}$/.test(dateFolder)) return;
            
            // Skip AccountCaptures folder
            if (userFolder === 'AccountCaptures') return;
            
            // Skip non-media files
            if (!this.isMediaFile(filename)) return;
            
            // Initialize structure
            if (!structure[dateFolder]) {
                structure[dateFolder] = {};
            }
            if (!structure[dateFolder][userFolder]) {
                structure[dateFolder][userFolder] = [];
            }
            
            // Add file with metadata
            structure[dateFolder][userFolder].push({
                file: file,
                filename: filename,
                path: path
            });
        });
        
        // Sort files within each user folder by filename (they're numbered)
        Object.values(structure).forEach(dateData => {
            Object.values(dateData).forEach(userFiles => {
                userFiles.sort((a, b) => {
                    // Extract numbers from filenames for proper sorting
                    const numA = this.extractNumberFromFilename(a.filename);
                    const numB = this.extractNumberFromFilename(b.filename);
                    return numA - numB;
                });
            });
        });
        
        return structure;
    }
    
    extractNumberFromFilename(filename) {
        // Extract the story number from filenames like "username_story_20250808_01.jpg"
        const match = filename.match(/_(\d+)\.(jpg|jpeg|png|mp4)/i);
        return match ? parseInt(match[1]) : 0;
    }
    
    processFolderStructure(structure) {
        Object.entries(structure).forEach(([date, users]) => {
            const stories = [];
            
            Object.entries(users).forEach(([username, files]) => {
                files.forEach(fileData => {
                    const story = {
                        username: username,
                        file: fileData.file,
                        type: this.getMediaType(fileData.filename),
                        filename: fileData.filename,
                        date: date,
                        path: fileData.path
                    };
                    
                    stories.push(story);
                    
                    // Add to user stories map
                    if (!this.userStories.has(username)) {
                        this.userStories.set(username, []);
                    }
                    this.userStories.get(username).push(story);
                });
            });
            
            if (stories.length > 0) {
                this.archives.set(date, stories);
            }
        });
        
        console.log(`Processed ${this.archives.size} dates with ${this.userStories.size} users`);
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
        datesList.innerHTML = '';
        
        // Sort dates in descending order
        const sortedDates = Array.from(this.archives.keys()).sort((a, b) => b.localeCompare(a));
        
        sortedDates.forEach(date => {
            const stories = this.archives.get(date);
            const dateCard = document.createElement('div');
            dateCard.className = 'date-card';
            
            // Format YYYYMMDD to readable date
            const year = date.substring(0, 4);
            const month = date.substring(4, 6);
            const day = date.substring(6, 8);
            const formattedDate = new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            
            // Count unique users
            const uniqueUsers = new Set(stories.map(s => s.username));
            
            dateCard.innerHTML = `
                <div class="date-text">${formattedDate}</div>
                <div class="story-count">${stories.length} stories from ${uniqueUsers.size} users</div>
            `;
            dateCard.addEventListener('click', () => this.openDateStories(date));
            datesList.appendChild(dateCard);
        });
    }
    
    renderUsersList() {
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '';
        
        // Sort users by story count (descending) then alphabetically
        const sortedUsers = Array.from(this.userStories.entries()).sort((a, b) => {
            const countDiff = b[1].length - a[1].length;
            if (countDiff !== 0) return countDiff;
            return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
        });
        
        sortedUsers.forEach(([username, stories]) => {
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            
            // Check for profile picture
            const profilePic = this.getProfilePicture(username);
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
    
    getProfilePicture(username) {
        // Clean username for matching
        const cleanUsername = username.replace(/[._]/g, '').toLowerCase();
        
        // Try exact match first
        if (this.profilePictures.has(username)) {
            return this.profilePictures.get(username);
        }
        
        // Try cleaned version
        if (this.profilePictures.has(cleanUsername)) {
            return this.profilePictures.get(cleanUsername);
        }
        
        // Try partial matches
        for (const [key, value] of this.profilePictures.entries()) {
            if (key.includes(cleanUsername) || cleanUsername.includes(key)) {
                return value;
            }
        }
        
        return null;
    }
    
    formatStoryDate(dateString) {
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        const date = new Date(`${year}-${month}-${day}`);
        
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
        const profilePic = this.getProfilePicture(story.username);
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
        
        // Create object URL for the file if not already created
        if (!story.url && story.file) {
            story.url = URL.createObjectURL(story.file);
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