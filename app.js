class StoryArchiveExplorer {
    constructor() {
        this.archives = new Map(); // Map of date -> stories
        this.currentStories = [];
        this.currentStoryIndex = 0;
        this.userStories = new Map(); // Map of username -> stories
        this.groupedStories = [];
        this.currentGroupIndex = 0;
        this.profilePictures = new Map(); // Map of username -> profile picture URL
        this.avatarFiles = new Map(); // Map of filename -> file object
        this.profileSnapshots = new Map(); // Map of username -> profile snapshots
        this.exportHandler = null; // Will be initialized based on availability
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // Auto-load button
        const autoLoadBtn = document.getElementById('auto-load-btn');
        autoLoadBtn.addEventListener('click', () => {
            this.tryAutoLoad();
        });
        
        // File input
        const folderInput = document.getElementById('folder-input');
        const folderLabel = document.querySelector('.file-input-label');
        
        // Show NFS loading when label is clicked
        folderLabel.addEventListener('click', () => {
            this.showNFSLoading();
        });
        
        folderInput.addEventListener('change', (e) => {
            // Only process if files were actually selected
            if (e.target.files.length > 0) {
                this.handleFolderSelection(e);
            }
        });
        
        // View toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleView(e));
        });
        
        // Back button
        document.querySelector('.back-btn').addEventListener('click', () => this.showDatesView());
        
        // Modal controls
        document.querySelector('.close-btn').addEventListener('click', () => this.closeModal());
        document.querySelector('.nav-btn.prev').addEventListener('click', () => this.previousMedia());
        document.querySelector('.nav-btn.next').addEventListener('click', () => this.nextMedia());
        
        // Export button - toggle dropdown
        document.querySelector('.export-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExportDropdown();
        });
        
        // Export dropdown options
        document.querySelectorAll('.export-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const exportType = option.dataset.exportType;
                this.handleExportOption(exportType);
            });
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            this.closeExportDropdown();
        });
        
        // Close modal on background click
        document.getElementById('story-modal').addEventListener('click', (e) => {
            if (e.target.id === 'story-modal') {
                this.closeModal();
            }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (document.getElementById('story-modal').classList.contains('active')) {
                if (e.key === 'ArrowLeft') this.previousMedia();
                if (e.key === 'ArrowRight') this.nextMedia();
                if (e.key === 'Escape') this.closeModal();
            }
        });
    }
    
    
    showLoading(text = 'Processing files...') {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = document.querySelector('.loading-text');
        loadingText.textContent = text;
        overlay.classList.add('active');
    }
    
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.remove('active');
    }
    
    updateProgress(percentage, text = '') {
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = text || `${Math.round(percentage)}%`;
    }
    
    showNFSLoading() {
        const overlay = document.getElementById('nfs-loading-overlay');
        overlay.classList.add('active');
    }
    
    hideNFSLoading() {
        const overlay = document.getElementById('nfs-loading-overlay');
        overlay.classList.remove('active');
    }
    
    isNFSLoadingVisible() {
        const overlay = document.getElementById('nfs-loading-overlay');
        return overlay.classList.contains('active');
    }
    
    async tryAutoLoad() {
        this.showNFSLoading();
        
        try {
            // Try to access the default directory via file API
            // Note: This is a simplified approach - in a real deployment, 
            // this would be handled server-side or through the NFS mount
            alert('Auto-load functionality requires server-side implementation.\nPlease use "Choose Different Folder" to browse your files.');
            this.hideNFSLoading();
        } catch (error) {
            console.error('Auto-load failed:', error);
            alert('Could not access default archive location.\nPlease use "Choose Different Folder" to browse your files.');
            this.hideNFSLoading();
        }
    }
    
    loadAvatarFiles(files) {
        // Clear existing profile pictures
        this.profilePictures.clear();
        this.avatarFiles.clear();
        
        const avatarFiles = files.filter(file => {
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            return parts.length >= 3 && parts[1] === 'Avatars';
        });
        
        let loadedCount = 0;
        avatarFiles.forEach((file, index) => {
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            const filename = parts[2];
            
            // Match pattern: username_avatar_YYYYMMDD.jpg/jpeg
            const match = filename.match(/^(.+)_avatar_\d{8}\.(jpg|jpeg)$/i);
            
            if (match) {
                const username = match[1];
                const fileUrl = URL.createObjectURL(file);
                
                // Store with exact username match
                this.profilePictures.set(username, fileUrl);
                this.avatarFiles.set(filename, file);
                loadedCount++;
            }
        });
        
        console.log(`Successfully loaded ${loadedCount} avatars`);
    }
    
    loadProfileSnapshots(files) {
        // Clear existing profile snapshots
        this.profileSnapshots.clear();
        
        const snapshotFiles = files.filter(file => {
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            // Look for files in AccountCaptures folders: /AutoExport/YYYYMMDD/AccountCaptures/
            return parts.length >= 4 && 
                   /^\d{8}$/.test(parts[1]) && // Date folder
                   parts[2] === 'AccountCaptures' &&
                   this.isImageFile(parts[3]); // Only image files
        });
        
        let loadedCount = 0;
        snapshotFiles.forEach(file => {
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            const dateFolder = parts[1];
            const filename = parts[3];
            
            // Extract username from filename - try different patterns
            let username = this.extractUsernameFromSnapshot(filename);
            
            // Skip medicalmedium from profile snapshots
            if (username && username !== 'medicalmedium') {
                if (!this.profileSnapshots.has(username)) {
                    this.profileSnapshots.set(username, []);
                }
                
                this.profileSnapshots.get(username).push({
                    file: file,
                    filename: filename,
                    date: dateFolder,
                    path: path,
                    url: null // Will be created when needed
                });
                
                loadedCount++;
            }
        });
        
        console.log(`Successfully loaded ${loadedCount} profile snapshots for ${this.profileSnapshots.size} users`);
    }
    
    isImageFile(filename) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }
    
    extractUsernameFromSnapshot(filename) {
        // Remove file extension
        const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
        
        console.log('Extracting username from:', filename, '-> nameWithoutExt:', nameWithoutExt);
        
        let extractedUsername = null;
        
        // Try different patterns that might be used for profile snapshots
        // Pattern 1: username_profile_YYYYMMDD_HHMMSS
        let match = nameWithoutExt.match(/^(.+)_profile_\d{8}_\d{6}$/);
        if (match) {
            extractedUsername = match[1];
            console.log('Pattern 1 matched:', extractedUsername);
        }
        
        // Pattern 2: username_YYYYMMDD_HHMMSS  
        if (!extractedUsername) {
            match = nameWithoutExt.match(/^(.+)_\d{8}_\d{6}$/);
            if (match) {
                extractedUsername = match[1];
                console.log('Pattern 2 matched:', extractedUsername);
            }
        }
        
        // Pattern 3: username_screenshot_YYYYMMDD
        if (!extractedUsername) {
            match = nameWithoutExt.match(/^(.+)_screenshot_\d{8}$/);
            if (match) {
                extractedUsername = match[1];
                console.log('Pattern 3 matched:', extractedUsername);
            }
        }
        
        // Pattern 4: username_YYYYMMDD
        if (!extractedUsername) {
            match = nameWithoutExt.match(/^(.+)_\d{8}$/);
            if (match) {
                extractedUsername = match[1];
                console.log('Pattern 4 matched:', extractedUsername);
            }
        }
        
        // Pattern 5: username_profile (without timestamp)
        if (!extractedUsername) {
            match = nameWithoutExt.match(/^(.+)_profile$/);
            if (match) {
                extractedUsername = match[1];
                console.log('Pattern 5 matched:', extractedUsername);
            }
        }
        
        // Pattern 6: Just username if it doesn't contain timestamp patterns
        if (!extractedUsername && !/\d{8}/.test(nameWithoutExt) && !/\d{6}/.test(nameWithoutExt)) {
            extractedUsername = nameWithoutExt;
            console.log('Pattern 6 matched:', extractedUsername);
        }
        
        // Fallback: try to extract everything before the last underscore and numbers
        if (!extractedUsername) {
            match = nameWithoutExt.match(/^(.+?)_[\d_]+$/);
            if (match) {
                extractedUsername = match[1];
                console.log('Fallback pattern matched:', extractedUsername);
            }
        }
        
        // Final fallback: use the full filename without extension
        if (!extractedUsername) {
            extractedUsername = nameWithoutExt;
            console.log('Using full filename:', extractedUsername);
        }
        
        // Normalize the username - clean up all variations
        let normalizedUsername = extractedUsername;
        
        // Remove common suffixes
        normalizedUsername = normalizedUsername.replace(/_profile$/, '').replace(/_screenshot$/, '');
        normalizedUsername = normalizedUsername.replace(/_profile_.*$/, '');
        
        // Clean up leading/trailing underscores and dots
        normalizedUsername = normalizedUsername.replace(/^[._]+|[._]+$/g, '');
        
        console.log('Normalized username:', normalizedUsername);
        return normalizedUsername;
    }
    
    getProfilePictureForSnapshot(username) {
        // Enhanced avatar matching specifically for profile snapshots
        // Try exact match first
        if (this.profilePictures.has(username)) {
            return this.profilePictures.get(username);
        }
        
        // Try with underscores replaced by dots
        const usernameWithDots = username.replace(/_/g, '.');
        if (this.profilePictures.has(usernameWithDots)) {
            return this.profilePictures.get(usernameWithDots);
        }
        
        // Try with dots replaced by underscores
        const usernameWithUnderscores = username.replace(/\./g, '_');
        if (this.profilePictures.has(usernameWithUnderscores)) {
            return this.profilePictures.get(usernameWithUnderscores);
        }
        
        // Try normalized matching (remove all special chars and lowercase)
        const normalizedUsername = username.replace(/[._-]/g, '').toLowerCase();
        for (const [key, value] of this.profilePictures.entries()) {
            const normalizedKey = key.replace(/[._-]/g, '').toLowerCase();
            if (normalizedKey === normalizedUsername) {
                return value;
            }
        }
        
        // Try partial matching - check if username is contained in any profile picture name
        for (const [key, value] of this.profilePictures.entries()) {
            if (key.toLowerCase().includes(username.toLowerCase()) || 
                username.toLowerCase().includes(key.toLowerCase())) {
                return value;
            }
        }
        
        console.log(`No avatar found for profile snapshot user: ${username}`);
        return null;
    }
    
    async handleFolderSelection(event) {
        const files = Array.from(event.target.files);
        
        if (files.length === 0) {
            alert('No files selected');
            return;
        }
        
        try {
            // Hide NFS loading and show main loading overlay
            this.hideNFSLoading();
            this.showLoading('Analyzing folder structure...');
            
            // Update progress
            this.updateProgress(10, 'Clearing existing data...');
            
            // Clear existing data
            this.archives.clear();
            this.userStories.clear();
            this.profileSnapshots.clear();
            
            // Update progress
            this.updateProgress(20, 'Loading avatars...');
            
            // Load avatar files
            this.loadAvatarFiles(files);
            
            // Update progress
            this.updateProgress(30, 'Loading profile snapshots...');
            
            // Load profile snapshots
            this.loadProfileSnapshots(files);
            
            // Update progress
            this.updateProgress(50, 'Building folder structure...');
            
            // Build folder structure from file paths
            const folderStructure = this.buildFolderStructure(files);
            
            // Update progress
            this.updateProgress(80, 'Processing stories...');
            
            // Process the folder structure
            this.processFolderStructure(folderStructure);
            
            // Update progress
            this.updateProgress(90, 'Finalizing...');
            
            if (this.archives.size === 0) {
                this.hideLoading();
                this.hideNFSLoading(); // Ensure NFS loading is also hidden
                alert('No valid story archives found. Please select the AutoExport folder.');
                return;
            }
            
            // Update progress
            this.updateProgress(100, 'Complete!');
            
            
            // Hide loading and switch to home view
            setTimeout(() => {
                this.hideLoading();
                this.hideNFSLoading(); // Ensure NFS loading is also hidden
                this.showHomeView();
            }, 500);
            
        } catch (error) {
            this.hideLoading();
            this.hideNFSLoading(); // Ensure NFS loading is also hidden on error
            alert(`Error processing files: ${error.message}`);
        }
    }
    
    buildFolderStructure(files) {
        const structure = {};
        let processedFiles = 0;
        let skippedFiles = 0;
        
        const mediaFiles = files.filter(file => {
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            
            // Skip if not enough path depth (need at least folder/date/user/file)
            if (parts.length < 4) return false;
            
            const dateFolder = parts[1];
            const userFolder = parts[2];
            const filename = parts[parts.length - 1];
            
            // Skip if not a valid date folder (8 digits)
            if (!/^\d{8}$/.test(dateFolder)) return false;
            
            // Skip AccountCaptures folder
            if (userFolder === 'AccountCaptures') return false;
            
            // Skip non-media files
            if (!this.isMediaFile(filename)) return false;
            
            return true;
        });
        
        
        mediaFiles.forEach((file, index) => {
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            const dateFolder = parts[1];
            const userFolder = parts[2];
            const filename = parts[parts.length - 1];
            
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
            
            processedFiles++;
            
        });
        
        // Sort files within each user folder by filename (they're numbered)
        let totalUsers = 0;
        Object.entries(structure).forEach(([date, dateData]) => {
            const userCount = Object.keys(dateData).length;
            totalUsers += userCount;
            
            Object.entries(dateData).forEach(([user, userFiles]) => {
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
                        path: fileData.path,
                        reshareInfo: this.extractReshareInfo(username, fileData.filename)
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
    
    extractReshareInfo(username, filename) {
        // Only process reshares for medicalmedium
        if (username !== 'medicalmedium') {
            return null;
        }
        
        // Look for reshare pattern in filename
        // Updated regex to capture everything until the next _reshare_ or end of filename
        const reshareMatches = filename.match(/_reshare_([^.]+?)(?=_reshare_|\.)/g);
        if (!reshareMatches) {
            // Fallback: try to match reshare pattern at the end of filename
            const singleReshareMatch = filename.match(/_reshare_(.+?)(?=\.[^.]*$)/);
            if (singleReshareMatch) {
                return {
                    originalUser: singleReshareMatch[1],
                    reshareCount: 1
                };
            }
            return null;
        }
        
        // Extract the last reshare username (most recent in chain)
        const lastReshare = reshareMatches[reshareMatches.length - 1];
        const reshareUsername = lastReshare.replace('_reshare_', '');
        
        return {
            originalUser: reshareUsername,
            reshareCount: reshareMatches.length
        };
    }
    
    showHomeView() {
        console.log('Switching to home view...');
        console.log('Archives found:', this.archives.size);
        console.log('Users found:', this.userStories.size);
        
        const pickerView = document.getElementById('file-picker-view');
        const homeView = document.getElementById('home-view');
        
        // Hide file picker view
        if (pickerView) {
            pickerView.classList.remove('active');
        }
        
        // Show home view
        if (homeView) {
            homeView.classList.add('active');
        }
        
        this.renderDatesList();
        this.renderUsersList();
        this.renderProfilesList();
    }
    
    renderDatesList() {
        const datesList = document.getElementById('dates-list');
        datesList.innerHTML = '';
        datesList.className = 'dates-list'; // Change from grid to list
        
        // Sort dates in descending order
        const sortedDates = Array.from(this.archives.keys()).sort((a, b) => b.localeCompare(a));
        
        sortedDates.forEach(date => {
            const stories = this.archives.get(date);
            
            // Format YYYYMMDD to readable date
            const year = date.substring(0, 4);
            const month = date.substring(4, 6);
            const day = date.substring(6, 8);
            const formattedDate = new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
            
            // Group stories by user
            const userStoriesMap = new Map();
            stories.forEach(story => {
                if (!userStoriesMap.has(story.username)) {
                    userStoriesMap.set(story.username, []);
                }
                userStoriesMap.get(story.username).push(story);
            });
            
            // Sort users with medicalmedium first, then by story count
            const sortedUsers = Array.from(userStoriesMap.entries()).sort((a, b) => {
                // Always put medicalmedium first
                if (a[0] === 'medicalmedium') return -1;
                if (b[0] === 'medicalmedium') return 1;
                
                const countDiff = b[1].length - a[1].length;
                if (countDiff !== 0) return countDiff;
                return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
            });
            
            // Create expandable date item
            const dateItem = document.createElement('div');
            dateItem.className = 'date-list-item';
            
            const uniqueUsers = new Set(stories.map(s => s.username));
            
            dateItem.innerHTML = `
                <div class="date-list-header">
                    <div class="date-list-info">
                        <div class="date-list-title">${formattedDate}</div>
                        <div class="date-list-subtitle">${stories.length} stories from ${uniqueUsers.size} users</div>
                    </div>
                    <div class="date-expand-icon">▶</div>
                </div>
                <div class="date-users-container">
                    <div class="date-inline-users" id="users-${date}">
                        <!-- Users will be populated here -->
                    </div>
                </div>
            `;
            
            // Add expand/collapse functionality
            const header = dateItem.querySelector('.date-list-header');
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDateExpansion(dateItem, date, sortedUsers);
            });
            
            datesList.appendChild(dateItem);
        });
    }
    
    toggleDateExpansion(dateItem, date, sortedUsers) {
        const isExpanded = dateItem.classList.contains('expanded');
        
        if (isExpanded) {
            // Collapse
            dateItem.classList.remove('expanded');
        } else {
            // Expand and populate users if not already done
            dateItem.classList.add('expanded');
            
            const usersContainer = dateItem.querySelector(`#users-${date}`);
            if (usersContainer.children.length === 0) {
                this.populateInlineUsers(usersContainer, sortedUsers);
            }
        }
    }
    
    populateInlineUsers(container, sortedUsers) {
        sortedUsers.forEach(([username, userStories]) => {
            const userItem = document.createElement('div');
            userItem.className = 'date-inline-user';
            
            const profilePic = this.getProfilePicture(username);
            const imageCount = userStories.filter(s => s.type === 'image').length;
            const videoCount = userStories.filter(s => s.type === 'video').length;
            
            // Build stats text
            const stats = [];
            if (imageCount > 0) stats.push(`${imageCount} photos`);
            if (videoCount > 0) stats.push(`${videoCount} videos`);
            const statsText = stats.join(' • ');
            
            userItem.innerHTML = `
                <div class="date-inline-user-content">
                    <div class="date-inline-avatar" style="${profilePic ? `background-image: url('${profilePic}');` : ''}"></div>
                    <div class="date-inline-info">
                        <div class="date-inline-name">${username}</div>
                        <div class="date-inline-stats">${userStories.length} stories${statsText ? ' • ' + statsText : ''}</div>
                    </div>
                </div>
                <button class="export-visual-btn" data-username="${username}" data-date="${container.id.replace('users-', '')}" title="Export Visual Experience">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"></path>
                    </svg>
                    Export
                </button>
            `;
            
            userItem.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target.closest('.export-visual-btn')) return; // Don't open if clicking export button
                this.openUserStoriesFromDate(username, userStories);
            });
            
            // Add export visual experience functionality
            const exportBtn = userItem.querySelector('.export-visual-btn');
            exportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const date = exportBtn.dataset.date;
                this.exportVisualExperience('user-date', `${username}_${date}`, userStories);
            });
            
            container.appendChild(userItem);
        });
    }
    
    renderUsersList() {
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '';
        usersList.className = 'users-list'; // Change from grid to list
        
        // Sort users with medicalmedium first, then alphabetically
        const sortedUsers = Array.from(this.userStories.entries()).sort((a, b) => {
            // Always put medicalmedium first
            if (a[0] === 'medicalmedium') return -1;
            if (b[0] === 'medicalmedium') return 1;
            
            // Sort alphabetically for everyone else
            return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
        });
        
        sortedUsers.forEach(([username, stories]) => {
            // Group stories by date for this user
            const dateStoriesMap = new Map();
            stories.forEach(story => {
                if (!dateStoriesMap.has(story.date)) {
                    dateStoriesMap.set(story.date, []);
                }
                dateStoriesMap.get(story.date).push(story);
            });
            
            // Sort dates in descending order
            const sortedDates = Array.from(dateStoriesMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
            
            // Calculate statistics
            const stats = this.calculateUserStats(stories, sortedDates);
            
            // Create expandable user item
            const userItem = document.createElement('div');
            userItem.className = 'user-list-item';
            
            const profilePic = this.getProfilePicture(username);
            
            userItem.innerHTML = `
                <div class="user-list-header">
                    <div class="user-list-avatar" style="${profilePic ? `background-image: url('${profilePic}');` : ''}"></div>
                    <div class="user-list-details">
                        <div class="user-list-name">${username}</div>
                        <div class="user-list-stats">
                            Total Stories: ${stats.totalStories} • Avg/Day: ${stats.avgPerDay} • Avg/Week: ${stats.avgPerWeek} • ${sortedDates.length} dates
                        </div>
                    </div>
                    <div class="user-expand-icon">▶</div>
                </div>
                <div class="user-dates-container">
                    <div class="user-inline-dates">
                        <!-- Dates will be populated here -->
                    </div>
                </div>
            `;
            
            // Add expand/collapse functionality
            const header = userItem.querySelector('.user-list-header');
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleUserExpansion(userItem, username, sortedDates);
            });
            
            usersList.appendChild(userItem);
        });
    }
    
    calculateUserStats(stories, sortedDates) {
        const totalStories = stories.length;
        const totalDates = sortedDates.length;
        
        if (totalDates === 0) {
            return {
                totalStories,
                avgPerDay: '0.0',
                avgPerWeek: '0.0'
            };
        }
        
        // Calculate date range
        const dates = sortedDates.map(([date]) => date).sort();
        const firstDate = new Date(
            dates[0].substring(0, 4),
            parseInt(dates[0].substring(4, 6)) - 1,
            dates[0].substring(6, 8)
        );
        const lastDate = new Date(
            dates[dates.length - 1].substring(0, 4),
            parseInt(dates[dates.length - 1].substring(4, 6)) - 1,
            dates[dates.length - 1].substring(6, 8)
        );
        
        // Calculate time span in days
        const timespanDays = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1);
        
        // Calculate averages
        const avgPerDay = (totalStories / timespanDays).toFixed(1);
        const avgPerWeek = (totalStories / (timespanDays / 7)).toFixed(1);
        
        return {
            totalStories,
            avgPerDay,
            avgPerWeek
        };
    }
    
    toggleUserExpansion(userItem, username, sortedDates) {
        const isExpanded = userItem.classList.contains('expanded');
        
        if (isExpanded) {
            // Collapse
            userItem.classList.remove('expanded');
        } else {
            // Expand and populate dates if not already done
            userItem.classList.add('expanded');
            
            // Use a more robust selector that doesn't rely on ID with special characters
            const datesContainer = userItem.querySelector('.user-inline-dates');
            if (datesContainer && datesContainer.children.length === 0) {
                this.populateInlineUserDates(datesContainer, username, sortedDates);
            } else if (!datesContainer) {
                console.error('Dates container not found for user:', username);
            }
        }
    }
    
    populateInlineUserDates(container, username, sortedDates) {
        sortedDates.forEach(([date, dateStories]) => {
            const dateItem = document.createElement('div');
            dateItem.className = 'user-inline-date';
            
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
            
            const imageCount = dateStories.filter(s => s.type === 'image').length;
            const videoCount = dateStories.filter(s => s.type === 'video').length;
            
            // Build stats text
            const stats = [];
            if (imageCount > 0) stats.push(`${imageCount} photos`);
            if (videoCount > 0) stats.push(`${videoCount} videos`);
            const statsText = stats.join(' • ');
            
            dateItem.innerHTML = `
                <div class="user-inline-date-info">
                    <div class="user-inline-date-name">${formattedDate}</div>
                    <div class="user-inline-date-stats">${dateStories.length} stories${statsText ? ' • ' + statsText : ''}</div>
                </div>
                <button class="export-visual-btn" data-username="${username}" data-date="${date}" title="Export Visual Experience">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"></path>
                    </svg>
                    Export
                </button>
                <div class="user-inline-date-arrow">→</div>
            `;
            
            dateItem.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target.closest('.export-visual-btn')) return; // Don't open if clicking export button
                this.openUserStoriesFromDate(username, dateStories);
            });
            
            // Add export visual experience functionality
            const exportBtn = dateItem.querySelector('.export-visual-btn');
            exportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.exportVisualExperience('user-date', `${username}_${date}`, dateStories);
            });
            
            container.appendChild(dateItem);
        });
    }
    
    getProfilePicture(username) {
        // Try exact match first (most common case)
        if (this.profilePictures.has(username)) {
            return this.profilePictures.get(username);
        }
        
        // Try with underscores replaced (for users like ava.lanelle vs ava_lanelle)
        const usernameWithUnderscores = username.replace(/\./g, '_');
        if (this.profilePictures.has(usernameWithUnderscores)) {
            return this.profilePictures.get(usernameWithUnderscores);
        }
        
        // Try with dots replaced (for users like rene_horbach vs rene.horbach)
        const usernameWithDots = username.replace(/_/g, '.');
        if (this.profilePictures.has(usernameWithDots)) {
            return this.profilePictures.get(usernameWithDots);
        }
        
        // Try partial matches for complex cases
        for (const [key, value] of this.profilePictures.entries()) {
            // Remove dots and underscores for fuzzy matching
            const normalizedKey = key.replace(/[._]/g, '').toLowerCase();
            const normalizedUsername = username.replace(/[._]/g, '').toLowerCase();
            
            if (normalizedKey === normalizedUsername) {
                return value;
            }
        }
        
        console.log(`No avatar found for: ${username}`);
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
    
    showUsersForDate(date) {
        const stories = this.archives.get(date) || [];
        
        // Hide dates and users views
        document.getElementById('dates-view').classList.remove('active');
        document.getElementById('users-view').classList.remove('active');
        
        // Show date users view
        const dateUsersView = document.getElementById('date-users-view');
        dateUsersView.classList.add('active');
        
        // Update the date title
        const year = date.substring(0, 4);
        const month = date.substring(4, 6);
        const day = date.substring(6, 8);
        const formattedDate = new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        document.querySelector('.date-title').textContent = formattedDate;
        
        // Group stories by user
        const userStoriesMap = new Map();
        stories.forEach(story => {
            if (!userStoriesMap.has(story.username)) {
                userStoriesMap.set(story.username, []);
            }
            userStoriesMap.get(story.username).push(story);
        });
        
        // Render users list
        this.renderDateUsersList(date, userStoriesMap);
    }
    
    showDatesView() {
        // Hide date users view
        document.getElementById('date-users-view').classList.remove('active');
        
        // Show dates view (maintain current toggle state)
        const activeToggle = document.querySelector('.toggle-btn.active');
        const viewType = activeToggle?.dataset.view || 'dates';
        document.getElementById(`${viewType}-view`).classList.add('active');
    }
    
    renderDateUsersList(date, userStoriesMap) {
        const usersList = document.getElementById('date-users-list');
        usersList.innerHTML = '';
        
        // Sort users by story count (descending) then alphabetically
        const sortedUsers = Array.from(userStoriesMap.entries()).sort((a, b) => {
            const countDiff = b[1].length - a[1].length;
            if (countDiff !== 0) return countDiff;
            return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
        });
        
        sortedUsers.forEach(([username, userStories]) => {
            const userItem = document.createElement('div');
            userItem.className = 'user-list-item';
            
            const profilePic = this.getProfilePicture(username);
            const imageCount = userStories.filter(s => s.type === 'image').length;
            const videoCount = userStories.filter(s => s.type === 'video').length;
            
            // Build stats text
            const stats = [];
            if (imageCount > 0) stats.push(`${imageCount} photos`);
            if (videoCount > 0) stats.push(`${videoCount} videos`);
            const statsText = stats.join(' • ');
            
            userItem.innerHTML = `
                <div class="user-list-avatar" style="${profilePic ? `background-image: url('${profilePic}');` : ''}"></div>
                <div class="user-list-info">
                    <div class="user-list-name">@${username}</div>
                    <div class="user-list-stats">${userStories.length} stories${statsText ? ' • ' + statsText : ''}</div>
                </div>
                <div class="user-list-arrow">→</div>
            `;
            
            userItem.addEventListener('click', () => this.openUserStoriesFromDate(username, userStories));
            usersList.appendChild(userItem);
        });
    }
    
    openUserStoriesFromDate(username, userStories) {
        // Single group for user view from specific date
        this.groupedStories = [{
            username,
            stories: userStories
        }];
        this.currentGroupIndex = 0;
        this.currentStories = userStories;
        this.currentStoryIndex = 0;
        this.showStoryModal();
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
        
        // Handle reshare info for medicalmedium
        const reshareInfo = document.querySelector('.reshare-info');
        const reshareUsername = document.querySelector('.reshare-username');
        
        if (story.reshareInfo && story.username === 'medicalmedium') {
            reshareUsername.textContent = `@${story.reshareInfo.originalUser}`;
            reshareInfo.style.display = 'flex';
        } else {
            reshareInfo.style.display = 'none';
        }
        
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
        
        try {
            // Create fresh object URL each time to avoid blob reference issues
            if (story.url && story.url.startsWith('blob:')) {
                URL.revokeObjectURL(story.url);
                story.url = null;
            }
            
            if (!story.url && story.file) {
                // Verify the file is still accessible
                if (story.file.size === undefined || story.file.size === 0) {
                    throw new Error('File is no longer accessible');
                }
                story.url = URL.createObjectURL(story.file);
            }
            
            if (!story.url) {
                throw new Error('Unable to create file URL');
            }
            
            // Clear loading indicator
            mediaContainer.innerHTML = '';
            
            // Add new media with error handling
            if (story.type === 'image') {
                const img = document.createElement('img');
                img.onload = () => {
                    // Image loaded successfully
                    console.log(`Loaded image: ${story.filename}`);
                };
                img.onerror = (e) => {
                    console.error(`Failed to load image: ${story.filename}`, e);
                    mediaContainer.innerHTML = '<div class="error-message">Failed to load image</div>';
                };
                img.src = story.url;
                img.alt = story.filename;
                mediaContainer.appendChild(img);
            } else if (story.type === 'video') {
                const video = document.createElement('video');
                video.onloadeddata = () => {
                    console.log(`Loaded video: ${story.filename}`);
                };
                video.onerror = (e) => {
                    console.error(`Failed to load video: ${story.filename}`, e);
                    mediaContainer.innerHTML = '<div class="error-message">Failed to load video</div>';
                };
                video.src = story.url;
                video.controls = true;
                video.autoplay = true;
                video.muted = true;
                mediaContainer.appendChild(video);
            }
        } catch (error) {
            console.error(`Error loading story ${story.filename}:`, error);
            mediaContainer.innerHTML = `<div class="error-message">Error loading ${story.filename}<br><small>${error.message}</small></div>`;
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
        modal.classList.remove('active', 'profile-snapshot-mode');
        
        // Clean up object URLs to free memory, but only for stories not currently in use
        this.currentStories.forEach(story => {
            if (story.url && story.url.startsWith('blob:')) {
                URL.revokeObjectURL(story.url);
                story.url = null;
            }
        });
        
        // Clean up profile snapshots URLs
        if (this.currentProfileSnapshots) {
            this.currentProfileSnapshots.forEach(snapshot => {
                if (snapshot.url && snapshot.url.startsWith('blob:')) {
                    URL.revokeObjectURL(snapshot.url);
                    snapshot.url = null;
                }
            });
            this.currentProfileSnapshots = [];
            this.currentSnapshotIndex = 0;
            this.currentProfileUsername = null;
        }
        
        this.currentStories = [];
        this.currentStoryIndex = 0;
    }
    
    async initializeExportHandler() {
        // Try FFmpeg first if available
        if (window.ffmpegAvailable && window.ExportHandler) {
            try {
                this.exportHandler = new window.ExportHandler();
                // Test initialize to catch CORS/security errors
                await this.exportHandler.initialize();
                console.log('Using FFmpeg export handler');
                return;
            } catch (error) {
                console.warn('FFmpeg failed to initialize (likely CORS/security error), falling back to Canvas:', error);
                this.exportHandler = null;
                // Mark FFmpeg as unavailable for this session
                window.ffmpegAvailable = false;
            }
        }
        
        // Fallback to Canvas export
        if (window.CanvasExportHandler) {
            this.exportHandler = new window.CanvasExportHandler();
            console.log('Using Canvas export handler (fallback)');
        } else {
            console.error('No export handler available');
        }
    }

    showExportToast(title, message, progress = 0, state = 'progress') {
        const toast = document.getElementById('export-toast');
        const toastTitle = toast.querySelector('.toast-title');
        const toastMessage = toast.querySelector('.toast-message');
        const progressFill = toast.querySelector('.toast-progress-fill');
        const progressText = toast.querySelector('.toast-progress-text');
        
        // Update content
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
        
        // Update state classes
        toast.className = 'export-toast active';
        if (state !== 'progress') {
            toast.classList.add(state);
        }
        
        // Show toast
        toast.classList.add('active');
    }
    
    hideExportToast(delay = 3000) {
        const toast = document.getElementById('export-toast');
        setTimeout(() => {
            toast.classList.remove('active');
            // Reset state after animation completes
            setTimeout(() => {
                toast.className = 'export-toast';
            }, 400);
        }, delay);
    }
    
    updateExportProgress(progress, message) {
        const toast = document.getElementById('export-toast');
        const toastMessage = toast.querySelector('.toast-message');
        const progressFill = toast.querySelector('.toast-progress-fill');
        const progressText = toast.querySelector('.toast-progress-text');
        
        if (message) toastMessage.textContent = message;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
    }
    
    truncateFileName(fileName, maxLength) {
        if (fileName.length <= maxLength) {
            return fileName;
        }
        
        // Split filename and extension
        const lastDotIndex = fileName.lastIndexOf('.');
        const name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
        const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
        
        // Calculate how much space we have for the name part
        const availableLength = maxLength - extension.length - 3; // 3 for "..."
        
        if (availableLength <= 0) {
            return '...' + extension;
        }
        
        // Calculate how to split the available space
        const startLength = Math.ceil(availableLength / 2);
        const endLength = Math.floor(availableLength / 2);
        
        const truncatedName = name.substring(0, startLength) + '...' + name.substring(name.length - endLength);
        return truncatedName + extension;
    }
    

    async exportCurrentStory() {
        const exportBtn = document.querySelector('.export-btn');
        
        try {
            // Initialize export handler if not already done
            if (!this.exportHandler) {
                await this.initializeExportHandler();
            }
            
            if (!this.exportHandler) {
                throw new Error('Export functionality not available');
            }
            
            // Show loading state on button
            exportBtn.classList.add('loading');
            
            // Show initial toast
            this.showExportToast('Exporting Story', 'Initializing export...', 0);
            
            // Get current story
            const story = this.currentStories[this.currentStoryIndex];
            if (!story) {
                throw new Error('No story selected');
            }
            
            // Update progress - loading profile picture
            this.updateExportProgress(10, 'Loading profile picture...');
            
            // Get profile picture blob if available
            let profilePicBlob = null;
            const profilePicUrl = this.getProfilePicture(story.username);
            if (profilePicUrl) {
                try {
                    const response = await fetch(profilePicUrl);
                    profilePicBlob = await response.blob();
                } catch (error) {
                    console.warn('Could not fetch profile picture:', error);
                }
            }
            
            // Update progress - preparing
            this.updateExportProgress(25, 'Preparing media files...');
            
            // Start the actual export process
            this.updateExportProgress(30, 'Processing video export...');
            const videoBlob = await this.exportHandler.exportStoryAsVideo(story, profilePicBlob);
            
            // Update progress - finalizing
            this.updateExportProgress(90, 'Finalizing export...');
            
            // Generate filename
            const fileName = this.exportHandler.formatFileName(story.filename);
            
            // Update progress - downloading
            this.updateExportProgress(95, 'Starting download...');
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Download the exported video
            await this.exportHandler.downloadBlob(videoBlob, fileName);
            
            // Show success state with truncated filename
            const truncatedFileName = this.truncateFileName(fileName, 40);
            this.updateExportProgress(100, `Successfully exported ${truncatedFileName}`);
            this.showExportToast('Export Complete!', `Downloaded ${truncatedFileName}`, 100, 'success');
            
            // Hide toast after delay
            this.hideExportToast(4000);
            
        } catch (error) {
            console.error('Export failed:', error);
            
            // Show error state
            this.showExportToast('Export Failed', error.message || 'An error occurred during export', 0, 'error');
            this.hideExportToast(5000);
        } finally {
            // Reset button state
            exportBtn.classList.remove('loading');
        }
    }
    
    toggleExportDropdown() {
        const dropdown = document.querySelector('.export-dropdown');
        const isVisible = dropdown.classList.contains('visible');
        
        if (isVisible) {
            this.closeExportDropdown();
        } else {
            dropdown.classList.add('visible');
        }
    }
    
    closeExportDropdown() {
        const dropdown = document.querySelector('.export-dropdown');
        dropdown.classList.remove('visible');
    }
    
    async handleExportOption(exportType) {
        this.closeExportDropdown();
        
        const story = this.currentStories[this.currentStoryIndex];
        if (!story) {
            console.error('No story selected');
            return;
        }
        
        switch (exportType) {
            case 'original':
                await this.exportOriginalFile(story);
                break;
            case 'recording':
                await this.exportCurrentStory();
                break;
            case 'screenshot':
                await this.exportScreenshot(story);
                break;
            default:
                console.error('Unknown export type:', exportType);
        }
    }
    
    async exportOriginalFile(story) {
        try {
            // Show toast notification
            this.showExportToast('Downloading Original File', 'Starting download...', 0);
            
            // Use original filename
            const originalFileName = story.filename;
            
            // Download original file
            const response = await fetch(story.url);
            const blob = await response.blob();
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = originalFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Show success
            const truncatedFileName = this.truncateFileName(originalFileName, 40);
            this.showExportToast('Download Complete!', `Downloaded ${truncatedFileName}`, 100, 'success');
            this.hideExportToast(4000);
            
        } catch (error) {
            console.error('Failed to download original file:', error);
            this.showExportToast('Download Failed', error.message || 'Failed to download original file', 0, 'error');
            this.hideExportToast(5000);
        }
    }
    
    async exportScreenshot(story) {
        try {
            // Initialize export handler if not already done
            if (!this.exportHandler) {
                await this.initializeExportHandler();
            }
            
            if (!this.exportHandler) {
                throw new Error('Export functionality not available');
            }
            
            // Show toast notification
            this.showExportToast('Creating Screenshot', 'Preparing image...', 0);
            
            // Get profile picture blob if available
            let profilePicBlob = null;
            const profilePicUrl = this.getProfilePicture(story.username);
            if (profilePicUrl) {
                try {
                    const response = await fetch(profilePicUrl);
                    profilePicBlob = await response.blob();
                } catch (error) {
                    console.warn('Could not fetch profile picture:', error);
                }
            }
            
            // Simulate some progress
            this.updateExportProgress(25, 'Loading media...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Create canvas for screenshot
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 1080;
            canvas.height = 1920;
            
            // Load the media (handle both images and videos)
            let mediaElement;
            let dimensions;
            
            if (story.type === 'video') {
                // For videos, create a video element and capture first frame
                const video = document.createElement('video');
                video.src = story.url;
                video.crossOrigin = 'anonymous';
                video.muted = true;
                
                await new Promise((resolve, reject) => {
                    video.onloadedmetadata = () => resolve();
                    video.onerror = (error) => {
                        console.error('Failed to load video for screenshot:', error);
                        reject(new Error('Failed to load video for screenshot'));
                    };
                });
                
                // Seek to first frame
                video.currentTime = 0;
                await new Promise((resolve) => {
                    video.onseeked = () => resolve();
                    video.currentTime = 0;
                });
                
                mediaElement = video;
                dimensions = this.getVideoDimensions(video, canvas.width, canvas.height);
            } else {
                // For images
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = story.url;
                await new Promise((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = (error) => {
                        console.error('Failed to load image for screenshot:', error);
                        reject(new Error('Failed to load image for screenshot'));
                    };
                });
                
                mediaElement = img;
                dimensions = this.getImageDimensions(img, canvas.width, canvas.height);
            }
            
            this.updateExportProgress(50, 'Composing image...');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Get dimensions and draw
            const { x, y, width, height } = dimensions;
            
            // Fill background with black
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw the main media
            ctx.drawImage(mediaElement, x, y, width, height);
            
            // Draw overlay (reuse logic from canvas export handler)
            await this.drawOverlayForScreenshot(ctx, story, profilePicBlob);
            
            this.updateExportProgress(75, 'Finalizing screenshot...');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Convert to blob and download
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create screenshot blob'));
                    }
                }, 'image/png');
            });
            
            // Generate filename with _screenshot suffix
            const nameWithoutExt = story.filename.replace(/\.[^/.]+$/, '');
            const fileName = `${nameWithoutExt}_screenshot.png`;
            
            // Download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Show success
            const truncatedFileName = this.truncateFileName(fileName, 40);
            this.updateExportProgress(100, `Successfully exported ${truncatedFileName}`);
            this.showExportToast('Screenshot Complete!', `Downloaded ${truncatedFileName}`, 100, 'success');
            this.hideExportToast(4000);
            
        } catch (error) {
            console.error('Screenshot export failed:', error);
            this.showExportToast('Screenshot Failed', error.message || 'Failed to create screenshot', 0, 'error');
            this.hideExportToast(5000);
        }
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
    
    async drawOverlayForScreenshot(ctx, story, profilePicBlob) {
        const profileSize = 80;
        const profileX = 40;
        const profileY = 60;
        const username = story.username;

        // Draw profile picture with circle mask
        if (profilePicBlob) {
            try {
                const profileImg = new Image();
                profileImg.src = URL.createObjectURL(profilePicBlob);
                let imageLoaded = false;
                
                await new Promise((resolve, reject) => {
                    profileImg.onload = () => {
                        imageLoaded = true;
                        resolve();
                    };
                    profileImg.onerror = (error) => {
                        console.warn('Failed to load profile image for screenshot overlay:', error);
                        resolve(); // Continue without profile image
                    };
                });

                // Only draw if image actually loaded
                if (imageLoaded && profileImg.complete && profileImg.naturalWidth > 0) {
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
                    // Draw placeholder circle if profile image failed to load
                    ctx.fillStyle = '#333';
                    ctx.beginPath();
                    ctx.arc(profileX + profileSize/2, profileY + profileSize/2, profileSize/2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 4;
                    ctx.stroke();
                }
            } catch (error) {
                console.warn('Error processing profile image for screenshot:', error);
                // Draw placeholder circle on any error
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.arc(profileX + profileSize/2, profileY + profileSize/2, profileSize/2, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'white';
                ctx.lineWidth = 4;
                ctx.stroke();
            }
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
    
    async exportVisualExperience(type, identifier, stories) {
        try {
            console.log('Starting visual experience export:', {type, identifier, storyCount: stories.length});
            
            // Initialize export handler if not already done
            if (!this.exportHandler) {
                await this.initializeExportHandler();
            }
            
            if (!this.exportHandler) {
                throw new Error('Export functionality not available');
            }
            
            // Sort stories chronologically
            const sortedStories = [...stories].sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
                return a.filename.localeCompare(b.filename);
            });
            
            const totalStories = sortedStories.length;
            
            // Generate filename based on type
            let exportFilename;
            if (type === 'user-date') {
                // identifier format: "username_YYYYMMDD"
                const [username, date] = identifier.split('_');
                exportFilename = `visual_experience_${username}_${date}_${totalStories}stories.mp4`;
            } else if (type === 'date') {
                const year = identifier.substring(0, 4);
                const month = identifier.substring(4, 6);
                const day = identifier.substring(6, 8);
                const formattedDate = `${year}${month}${day}`;
                exportFilename = `visual_experience_${formattedDate}_${totalStories}stories.mp4`;
            } else if (type === 'user') {
                exportFilename = `visual_experience_${identifier}_${totalStories}stories.mp4`;
            }
            
            // Show initial toast
            this.showExportToast('Exporting Visual Experience', `Preparing ${totalStories} stories...`, 0);
            
            // Process each story and create video segments
            const videoSegments = [];
            
            for (let i = 0; i < sortedStories.length; i++) {
                const story = sortedStories[i];
                const progressPercent = Math.round((i / totalStories) * 90); // Reserve 10% for final assembly
                
                this.updateExportProgress(progressPercent, `Rendering story ${i + 1}/${totalStories}...`);
                
                try {
                    // Ensure story has a valid URL
                    if (!story.url && story.file) {
                        story.url = URL.createObjectURL(story.file);
                    }
                    
                    if (!story.url) {
                        console.warn(`Skipping story ${story.filename} - no valid URL`);
                        continue;
                    }
                    
                    // Get profile picture blob if available
                    let profilePicBlob = null;
                    const profilePicUrl = this.getProfilePicture(story.username);
                    if (profilePicUrl) {
                        try {
                            const response = await fetch(profilePicUrl);
                            profilePicBlob = await response.blob();
                        } catch (error) {
                            console.warn('Could not fetch profile picture:', error);
                        }
                    }
                    
                    // Create video segment for this story
                    let videoBlob;
                    if (story.type === 'image') {
                        // For images, create a 6-second video
                        videoBlob = await this.createImageVideoSegment(story, profilePicBlob);
                    } else {
                        // For videos, use the existing export system
                        if (!story.url && story.file) {
                            story.url = URL.createObjectURL(story.file);
                        }
                        videoBlob = await this.exportHandler.exportStoryAsVideo(story, profilePicBlob);
                    }
                    
                    videoSegments.push(videoBlob);
                } catch (error) {
                    console.error(`Failed to process story ${i + 1}/${totalStories}:`, error);
                    // Continue processing other stories even if one fails
                }
            }
            
            if (videoSegments.length === 0) {
                throw new Error('No stories could be processed successfully');
            }
            
            // Combine all video segments
            this.updateExportProgress(90, 'Combining video segments...');
            const finalVideoBlob = await this.combineVideoSegments(videoSegments, exportFilename);
            
            // Download the final video
            this.updateExportProgress(95, 'Starting download...');
            await this.exportHandler.downloadBlob(finalVideoBlob, exportFilename);
            
            // Show success
            const truncatedFileName = this.truncateFileName(exportFilename, 40);
            this.updateExportProgress(100, `Successfully exported ${truncatedFileName}`);
            this.showExportToast('Export Complete!', `Downloaded ${truncatedFileName}`, 100, 'success');
            this.hideExportToast(4000);
            
        } catch (error) {
            console.error('Visual experience export failed:', error);
            this.showExportToast('Export Failed', error.message || 'Failed to export visual experience', 0, 'error');
            this.hideExportToast(5000);
        }
    }
    
    async createImageVideoSegment(story, profilePicBlob) {
        try {
            // Ensure story has a valid URL
            if (!story.url && story.file) {
                story.url = URL.createObjectURL(story.file);
            }
            
            // Use Canvas export handler to create a 6-second video from image
            const canvasHandler = new CanvasExportHandler();
            return await canvasHandler.exportImageAsVideo(story, profilePicBlob);
        } catch (error) {
            console.error('Failed to create image video segment:', error);
            throw error;
        }
    }
    
    async combineVideoSegments(videoSegments, filename) {
        if (videoSegments.length === 1) {
            return videoSegments[0];
        }
        
        try {
            // Use FFmpeg for proper video concatenation if available
            if (this.exportHandler && typeof this.exportHandler.concatenateVideos === 'function') {
                console.log(`Concatenating ${videoSegments.length} video segments with FFmpeg`);
                return await this.exportHandler.concatenateVideos(videoSegments, filename);
            } else {
                // Fallback: return first segment
                console.warn(`FFmpeg not available. Exporting first of ${videoSegments.length} segments only.`);
                return videoSegments[0];
            }
        } catch (error) {
            console.error('Video concatenation failed, using first segment:', error);
            return videoSegments[0];
        }
    }
    
    renderProfilesList() {
        const profilesList = document.getElementById('profiles-list');
        if (!profilesList) return;
        
        profilesList.innerHTML = '';
        profilesList.className = 'profiles-list';
        
        if (this.profileSnapshots.size === 0) {
            profilesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📷</div>
                    <div class="empty-title">No Profile Snapshots Found</div>
                    <div class="empty-subtitle">Profile snapshots from AccountCaptures folders will appear here</div>
                </div>
            `;
            return;
        }
        
        // Sort users alphabetically
        const sortedUsers = Array.from(this.profileSnapshots.entries()).sort((a, b) => {
            return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
        });
        
        sortedUsers.forEach(([rawUsername, snapshots]) => {
            // Additional cleanup: ensure no _profile suffix in display
            const username = rawUsername.replace(/_profile$/, '');
            const dateSnapshotsMap = new Map();
            snapshots.forEach(snapshot => {
                if (!dateSnapshotsMap.has(snapshot.date)) {
                    dateSnapshotsMap.set(snapshot.date, []);
                }
                dateSnapshotsMap.get(snapshot.date).push(snapshot);
            });
            
            const sortedDates = Array.from(dateSnapshotsMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
            const profilePic = this.getProfilePictureForSnapshot(username);
            
            const userItem = document.createElement('div');
            userItem.className = 'profile-list-item';
            userItem.innerHTML = `
                <div class="profile-list-header">
                    <div class="profile-list-avatar" style="${profilePic ? `background-image: url('${profilePic}');` : ''}"></div>
                    <div class="profile-list-details">
                        <div class="profile-list-name">${username}</div>
                        <div class="profile-list-stats">${snapshots.length} snapshots • ${sortedDates.length} dates</div>
                    </div>
                    <div class="profile-expand-icon">▶</div>
                </div>
                <div class="profile-dates-container">
                    <div class="profile-inline-dates"></div>
                </div>
            `;
            
            const header = userItem.querySelector('.profile-list-header');
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleProfileExpansion(userItem, rawUsername, sortedDates);
            });
            
            profilesList.appendChild(userItem);
        });
    }
    
    toggleProfileExpansion(userItem, username, sortedDates) {
        const isExpanded = userItem.classList.contains('expanded');
        if (isExpanded) {
            userItem.classList.remove('expanded');
        } else {
            userItem.classList.add('expanded');
            const datesContainer = userItem.querySelector('.profile-inline-dates');
            if (datesContainer && datesContainer.children.length === 0) {
                this.populateInlineProfileDates(datesContainer, username, sortedDates);
            }
        }
    }
    
    populateInlineProfileDates(container, username, sortedDates) {
        sortedDates.forEach(([date, dateSnapshots]) => {
            const dateItem = document.createElement('div');
            dateItem.className = 'profile-inline-date';
            
            const year = date.substring(0, 4);
            const month = date.substring(4, 6);
            const day = date.substring(6, 8);
            const formattedDate = new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            });
            
            dateItem.innerHTML = `
                <div class="profile-inline-date-info">
                    <div class="profile-inline-date-name">${formattedDate}</div>
                    <div class="profile-inline-date-stats">${dateSnapshots.length} snapshots</div>
                </div>
                <div class="profile-inline-date-arrow">→</div>
            `;
            
            dateItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openProfileSnapshotsForDate(username, date);
            });
            
            container.appendChild(dateItem);
        });
    }
    
    openProfileSnapshotsForDate(username, targetDate) {
        // Get all snapshots for this user
        console.log('Opening profile snapshots for user:', username, 'target date:', targetDate);
        console.log('Available users in profileSnapshots:', Array.from(this.profileSnapshots.keys()));
        const allUserSnapshots = this.profileSnapshots.get(username) || [];
        console.log('Found snapshots for user:', allUserSnapshots.length);
        
        // Sort all snapshots chronologically (by date, then by filename for order within date)
        const sortedSnapshots = [...allUserSnapshots].sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.filename.localeCompare(b.filename);
        });
        
        // Find the index of the first snapshot for the target date
        const startIndex = sortedSnapshots.findIndex(snapshot => snapshot.date === targetDate);
        
        // Open with all snapshots and set the correct starting index
        this.openProfileSnapshots(username, sortedSnapshots, startIndex >= 0 ? startIndex : 0);
    }
    
    openProfileSnapshots(username, snapshots, startIndex = 0) {
        this.currentProfileSnapshots = snapshots;
        this.currentSnapshotIndex = startIndex;
        this.currentProfileUsername = username; // Store the username for navigation
        this.showProfileSnapshotModal(username);
    }
    
    showProfileSnapshotModal(username) {
        if (this.currentProfileSnapshots.length === 0) return;
        const modal = document.getElementById('story-modal');
        modal.classList.add('active', 'profile-snapshot-mode');
        this.renderProfileProgressBar();
        this.showCurrentProfileSnapshot(username);
    }
    
    renderProfileProgressBar() {
        const progressContainer = document.querySelector('.progress-segments');
        progressContainer.innerHTML = '';
        this.currentProfileSnapshots.forEach(() => {
            const segment = document.createElement('div');
            segment.className = 'progress-segment';
            segment.innerHTML = '<div class="progress-fill"></div>';
            progressContainer.appendChild(segment);
        });
    }
    
    async showCurrentProfileSnapshot(username) {
        if (this.currentSnapshotIndex < 0 || this.currentSnapshotIndex >= this.currentProfileSnapshots.length) return;
        
        const snapshot = this.currentProfileSnapshots[this.currentSnapshotIndex];
        const mediaContainer = document.querySelector('.story-media');
        const usernameEl = document.querySelector('.username');
        const storyDate = document.querySelector('.story-date');
        const avatarCircle = document.querySelector('.avatar-circle');
        const reshareInfo = document.querySelector('.reshare-info');
        
        usernameEl.textContent = username + ' Profile';
        reshareInfo.style.display = 'none';
        storyDate.textContent = this.formatStoryDate(snapshot.date);
        storyDate.style.display = 'block';
        
        const profilePic = this.getProfilePictureForSnapshot(username);
        if (profilePic) {
            avatarCircle.style.backgroundImage = `url('${profilePic}')`;
            avatarCircle.style.backgroundSize = 'cover';
            avatarCircle.style.backgroundPosition = 'center';
        } else {
            avatarCircle.style.backgroundImage = 'linear-gradient(135deg, #405de6, #833ab4, #c13584, #fd1d1d)';
        }
        
        mediaContainer.innerHTML = '<div class="loading"></div>';
        
        try {
            if (!snapshot.url && snapshot.file) {
                snapshot.url = URL.createObjectURL(snapshot.file);
            }
            if (!snapshot.url) throw new Error('Unable to create file URL');
            
            mediaContainer.innerHTML = '';
            const img = document.createElement('img');
            img.onload = () => console.log(`Loaded profile snapshot: ${snapshot.filename}`);
            img.onerror = () => mediaContainer.innerHTML = '<div class="error-message">Failed to load profile snapshot</div>';
            img.src = snapshot.url;
            img.alt = snapshot.filename;
            mediaContainer.appendChild(img);
        } catch (error) {
            console.error(`Error loading profile snapshot ${snapshot.filename}:`, error);
            mediaContainer.innerHTML = `<div class="error-message">Error loading ${snapshot.filename}</div>`;
        }
        
        this.updateProfileProgress();
        
        const isFirstSnapshot = this.currentSnapshotIndex === 0;
        const isLastSnapshot = this.currentSnapshotIndex === this.currentProfileSnapshots.length - 1;
        
        const prevBtn = document.querySelector('.nav-btn.prev');
        const nextBtn = document.querySelector('.nav-btn.next');
        
        // Hide buttons completely instead of disabling them
        prevBtn.style.display = isFirstSnapshot ? 'none' : 'flex';
        nextBtn.style.display = isLastSnapshot ? 'none' : 'flex';
    }
    
    updateProfileProgress() {
        const segments = document.querySelectorAll('.progress-segment');
        segments.forEach((segment, index) => {
            const fill = segment.querySelector('.progress-fill');
            if (index < this.currentSnapshotIndex) {
                fill.style.width = '100%';
            } else if (index === this.currentSnapshotIndex) {
                fill.style.width = '100%';
            } else {
                fill.style.width = '0%';
            }
        });
    }
    
    // Navigation methods that work for both stories and profile snapshots
    async previousMedia() {
        const modal = document.getElementById('story-modal');
        if (modal.classList.contains('profile-snapshot-mode')) {
            await this.previousProfileSnapshot();
        } else {
            await this.previousStory();
        }
    }
    
    async nextMedia() {
        const modal = document.getElementById('story-modal');
        if (modal.classList.contains('profile-snapshot-mode')) {
            await this.nextProfileSnapshot();
        } else {
            await this.nextStory();
        }
    }
    
    async previousProfileSnapshot() {
        if (this.currentSnapshotIndex > 0) {
            this.currentSnapshotIndex--;
            await this.showCurrentProfileSnapshot(this.currentProfileUsername);
        }
    }
    
    async nextProfileSnapshot() {
        if (this.currentSnapshotIndex < this.currentProfileSnapshots.length - 1) {
            this.currentSnapshotIndex++;
            await this.showCurrentProfileSnapshot(this.currentProfileUsername);
        }
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new StoryArchiveExplorer();
});