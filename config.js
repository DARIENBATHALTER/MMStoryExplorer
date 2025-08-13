// Server configuration
const SERVER_CONFIG = {
    // Set this to the path where your archive files are located on the server
    // This should be a path accessible via HTTP from the web server
    ARCHIVE_PATH: '/archive',  // This will map to your NFS mount
    
    // Server mode - when true, skips file picker and loads directly
    SERVER_MODE: true,
    
    // Auto-load on page load
    AUTO_LOAD: true
};

// Export for use in other scripts
window.SERVER_CONFIG = SERVER_CONFIG;