/**
 * Main application logic for DC Bike Dashboard
 */

// Initialize the application on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing application");
    
    // Welcome modal functionality
    const welcomeOverlay = document.getElementById('welcome-overlay');
    const welcomeModal = document.getElementById('welcome-modal');
    const closeBtn = document.getElementById('welcome-close');
    const startBtn = document.getElementById('start-btn');
    
    // Every time shows
    setTimeout(() => {
        welcomeOverlay.style.display = 'flex';
        welcomeOverlay.classList.add('show');
        welcomeModal.classList.add('show');
    }, 500);
    
    // Close the welcome modal
    function closeWelcomeModal() {
        welcomeOverlay.classList.remove('show');
        welcomeModal.classList.remove('show');
        
        // Wait for animation to complete
        setTimeout(() => {
            welcomeOverlay.style.display = 'none';
        }, 400);
    }
    
    // Event listeners for welcome modal
    if (closeBtn) closeBtn.addEventListener('click', closeWelcomeModal);
    if (startBtn) startBtn.addEventListener('click', closeWelcomeModal);
    
    // Close if clicking outside the modal
    welcomeOverlay.addEventListener('click', function(e) {
        if (e.target === welcomeOverlay) {
            closeWelcomeModal();
        }
    });
    
    // Show loading indicator
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    
    // Initialize map first
    if (window.mapModule) {
        window.mapModule.initMap();
        console.log("Map initialized");

        startAutoPlay();

        const hourSlider = document.getElementById('hourSlider');
    if (hourSlider) {
    hourSlider.addEventListener('input', function() {
        const hour = parseInt(this.value, 10);
        const currentHour = document.getElementById('currentHour');
        if (currentHour) {
            currentHour.textContent = `${hour}h`;
        }
        
        if (window.mapModule && window.mapModule.applyFakeHourEffect) {
            window.mapModule.applyFakeHourEffect(hour);
        }
    });
}

        // Then load data
        if (window.dataModule) {
            window.dataModule.initData()
                .then(dataState => {
                    console.log("Data loaded successfully");
                    
                    // Add debugging info for coordinates
                    if (dataState.roadNetworkData && dataState.roadNetworkData.features.length > 0) {
                        console.log("First road feature coordinates:", dataState.roadNetworkData.features[0].geometry.coordinates[0]);
                    }
                    
                    if (dataState.counterPointsData && dataState.counterPointsData.features.length > 0) {
                        console.log("First counter point coordinates:", dataState.counterPointsData.features[0].geometry.coordinates);
                    }
                    
                    if (dataState.neighborhoodBoundaries && dataState.neighborhoodBoundaries.features.length > 0) {
                        console.log("First neighborhood boundary coordinates:", 
                            dataState.neighborhoodBoundaries.features[0].geometry.coordinates[0][0]);
                    }
                    
                    // Display data bounds to ensure correct zooming
                    setTimeout(() => {
                        if (window.mapModule && window.mapModule.showDataBounds) {
                            //window.mapModule.showDataBounds();
                        }
                    }, 1000);
                    
                    // Hide loading indicator with a small delay to ensure rendering is complete
                    if (loadingOverlay) {
                        setTimeout(() => {
                            loadingOverlay.style.display = 'none';
                        }, 500);
                    }
                    
                    // Setup UI event listeners
                    setupUIListeners();
                    
                    // Initialize visualization enhancements if available
                    if (window.mapVisualization && window.mapVisualization.initVisualization) {
                        window.mapVisualization.initVisualization();
                    }
                })
                .catch(error => {
                    console.error("Error loading data:", error);
                    
                    // Hide loading indicator
                    if (loadingOverlay) {
                        loadingOverlay.style.display = 'none';
                    }
                    
                    // Show error using the map module's notification if available
                    if (window.mapModule && window.mapModule.showNotification) {
                        window.mapModule.showNotification(
                            "Error loading data: " + error.message, 
                            "error"
                        );
                    } else {
                        alert("Error loading data: " + error.message);
                    }
                });
        } else {
            console.error("Data module not found");
            // Hide loading indicator
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            // Show error
            alert("Data module not found. Application cannot function properly.");
        }
    } else {
        console.error("Map module not found");
        // Hide loading indicator
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        // Show error
        alert("Map module not found. Application cannot function properly.");
    }
    
    // Setup page navigation and other UI elements
    setupUIListeners();
    
    // Add resize handler with debouncing
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Adjust map size on resize
            if (window.mapModule && window.mapModule.getState().map) {
                window.mapModule.getState().map.invalidateSize();
            }
        }, 250);
    });
});

/**
 * Setup UI event listeners for page navigation and panel toggles
 */
function setupUIListeners() {
    // Setup stats panel toggle
    const statsToggle = document.querySelector('.stats-toggle');
    const statsPanel = document.querySelector('.mini-stats-panel');
    
    if (statsToggle && statsPanel) {
        statsToggle.addEventListener('click', function() {
            statsPanel.classList.toggle('expanded');
        });
    }
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Setup about modal
    const aboutLink = document.getElementById('about-link');
    const aboutModal = document.getElementById('about-modal');
    const modalClose = document.querySelector('.modal-close');
    
    if (aboutLink && aboutModal) {
        aboutLink.addEventListener('click', function(e) {
            e.preventDefault();
            aboutModal.style.display = 'flex';
        });
    }
    
    if (modalClose && aboutModal) {
        modalClose.addEventListener('click', function() {
            aboutModal.style.display = 'none';
        });
        
        // Close modal when clicking outside
        aboutModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    }
    
    // Add event delegation for popup detail buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('popup-details-btn') || 
            e.target.parentElement.classList.contains('popup-details-btn')) {
            
            // Close popup if open
            if (window.mapModule && window.mapModule.getState().map) {
                window.mapModule.getState().map.closePopup();
            }
        }
    });
}

/**
 * Setup keyboard shortcuts for the application
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Escape key closes open panels and dialogs
        if (e.key === 'Escape') {
            // Close welcome modal if open
            const welcomeOverlay = document.getElementById('welcome-overlay');
            if (welcomeOverlay && welcomeOverlay.classList.contains('show')) {
                const event = new Event('click');
                document.getElementById('welcome-close').dispatchEvent(event);
                return;
            }
            
            // Close modal if open
            const modal = document.getElementById('about-modal');
            if (modal && modal.style.display === 'flex') {
                modal.style.display = 'none';
                return;
            }
            
            // Close detail sidebar if open
            const sidebar = document.querySelector('.detail-sidebar');
            if (sidebar && sidebar.style.display !== 'none') {
                sidebar.style.display = 'none';
                // Reset selected segment if map module is available
                if (window.mapModule && window.mapModule.getState) {
                    const mapState = window.mapModule.getState();
                    mapState.selectedSegment = null;
                    if (mapState.roadLayer) {
                        mapState.roadLayer.resetStyle();
                    }
                }
                return;
            }
            
            // Close location panel if open
            const locationPanel = document.querySelector('.location-panel');
            if (locationPanel && locationPanel.style.display !== 'none') {
                locationPanel.style.display = 'none';
                return;
            }
            
            // Close search results if open
            const searchResults = document.querySelector('.search-results');
            if (searchResults && searchResults.style.display !== 'none') {
                searchResults.style.display = 'none';
                return;
            }
        }
        
        // Ctrl+F focuses search
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            const searchInput = document.querySelector('.search-input');
            if (searchInput) searchInput.focus();
        }
    });
}

let autoPlayInterval = null;

function startAutoPlay() {
    const hourSlider = document.getElementById('hourSlider');
    const currentHour = document.getElementById('currentHour');

    if (!hourSlider || !currentHour) {
        console.error('Hour slider or current hour display not found.');
        return;
    }

    let hour = parseInt(hourSlider.value, 10) || 0;


    if (autoPlayInterval) clearInterval(autoPlayInterval);

    autoPlayInterval = setInterval(() => {
        hour = (hour + 1) % 24; 
        hourSlider.value = hour;
        currentHour.textContent = `${hour}h`;

        if (window.mapModule && window.mapModule.applyFakeHourEffect) {
            window.mapModule.applyFakeHourEffect(hour);
        }
    }, 1000); 
}

function stopAutoPlay() {
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
    }
}

function showSpatial() {
    document.getElementById('spatial-content').style.display = 'block';
    document.getElementById('temporal-content').style.display = 'none';
    document.getElementById('spatial-tab-btn').classList.add('active');
    document.getElementById('temporal-tab-btn').classList.remove('active');
}

function showTemporal() {
    document.getElementById('spatial-content').style.display = 'none';
    document.getElementById('temporal-content').style.display = 'block';
    document.getElementById('spatial-tab-btn').classList.remove('active');
    document.getElementById('temporal-tab-btn').classList.add('active');
}
