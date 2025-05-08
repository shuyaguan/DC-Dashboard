/**
 * Map module for DC Bike Dashboard
 * Handles map initialization, visualization and interaction
 */

// Map state
const mapState = {
    map: null,
    roadLayer: null,
    counterLayer: null,
    residualLayer: null,
    heatmapLayer: null,
    neighborhoodLayer: null,
    censusLayer: null,
    networkMetricsLayer: null,
    currentFilters: {
        neighborhood: "all",
        volumeFilter: "all",
        counterType: "all"
    },
    selectedSegment: null,
    hoverInfoElement: null,
    searchResults: [],
    locationPanel: null
};

/**
 * Initialize the map
 * @returns {Object} The created Leaflet map instance
 */
function initMap() {
    console.log("Initializing map...");
    
    try {
        // Create map centered on DC
        mapState.map = L.map('map', {
            center: [38.9072, -77.0369], // DC coordinates
            zoom: 12, // Better default zoom level for DC
            zoomControl: true,
            attributionControl: true
        });
        
        console.log("Map object created");
        
        // Add Esri World Gray Canvas basemap
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16
}).addTo(mapState.map);

        
        // Add scale control
        L.control.scale({imperial: true, metric: false}).addTo(mapState.map);
        
        // Setup map controls
        setupMapControls();
        
        // Create legend
        createLegend();
        
        // Initialize search bar
        initSearchBar();
        
        // Initialize hover info element
        createHoverInfoElement();
        
        // Initialize detail sidebar
        createDetailSidebar();
        
        // Initialize location panel
        createLocationPanel();
        
        // Initialize export control
        initExportControl();
        
        // Add map click handler
        setupMapClickHandler();
        
        // Setup event listeners for the data module
        setupDataEventListeners();
        
        // Dispatch a map-ready event
        document.dispatchEvent(new CustomEvent('map-ready'));
        
        console.log("Map initialization complete");
        
        return mapState.map;
    } catch (error) {
        console.error("Error initializing map:", error);
        showError("Map initialization failed: " + error.message);
        return null;
    }
}

/**
 * Setup event listeners for data module integration
 */
function setupDataEventListeners() {
    // Listen for data loaded event
    document.addEventListener('data:loaded', function() {
        console.log("Data loaded event received");
        
        if (window.dataModule && window.dataModule.getState) {
            const dataState = window.dataModule.getState();
            
            // Get filtered data with default filters
            const filteredData = window.dataModule.getFilteredRoadData(mapState.currentFilters);
            
            if (filteredData) {
                // Display data on the map
                displayGeoJsonData(filteredData, mapState.currentFilters);
                
                // Populate neighborhood filter if available
                if (dataState.neighborhoodsList && dataState.neighborhoodsList.length > 0) {
                    populateNeighborhoodFilter(dataState.neighborhoodsList);
                }
                
                // Update statistics display
                updateStatisticsDisplay(dataState.statistics);
                
                // Show the data bounds to help with debugging
                //setTimeout(() => showDataBounds(), 1000);
            }
        }
    });
    
    // Listen for filter change events
    document.addEventListener('filter-change', function(event) {
        console.log("Filter change event received", event.detail);
        
        if (event.detail && event.detail.filters) {
            // Update current filters
            mapState.currentFilters = event.detail.filters;
            
            // Update map layers
            updateMapLayers();
        }
    });
}

/**
 * Debug function to show bounds of data
 */
function showDataBounds() {
    try {
        if (!window.dataModule || !window.dataModule.getState()) {
            console.warn("Data module not available for showing bounds");
            return false;
        }
        
        const dataState = window.dataModule.getState();
        
        // Only proceed if we have data
        if (!dataState.roadNetworkData || !dataState.roadNetworkData.features || 
            dataState.roadNetworkData.features.length === 0) {
            console.warn("No road network data available for bounds");
            return false;
        }
        
        // Create bounds object for road data
        let combinedBounds;
        
        try {
            const roadBounds = L.geoJSON(dataState.roadNetworkData).getBounds();
            console.log("Road network bounds:", roadBounds.toString());
            combinedBounds = roadBounds;
        } catch (error) {
            console.error("Error getting road network bounds:", error);
        }
        
        // Try to add neighborhood bounds if available
        if (dataState.neighborhoodBoundaries && 
            dataState.neighborhoodBoundaries.features && 
            dataState.neighborhoodBoundaries.features.length > 0) {
            try {
                const neighborhoodBounds = L.geoJSON(dataState.neighborhoodBoundaries).getBounds();
                console.log("Neighborhood bounds:", neighborhoodBounds.toString());
                if (combinedBounds) {
                    combinedBounds = combinedBounds.extend(neighborhoodBounds);
                } else {
                    combinedBounds = neighborhoodBounds;
                }
            } catch (error) {
                console.error("Error getting neighborhood bounds:", error);
            }
        }
        
        // Try to add counter bounds if available
        if (dataState.counterPointsData && 
            dataState.counterPointsData.features && 
            dataState.counterPointsData.features.length > 0) {
            try {
                const counterBounds = L.geoJSON(dataState.counterPointsData).getBounds();
                console.log("Counter points bounds:", counterBounds.toString());
                if (combinedBounds) {
                    combinedBounds = combinedBounds.extend(counterBounds);
                } else {
                    combinedBounds = counterBounds;
                }
            } catch (error) {
                console.error("Error getting counter bounds:", error);
            }
        }
        
        // Fit map to bounds if we have any
        if (combinedBounds) {
            console.log("Combined bounds:", combinedBounds.toString());
            mapState.map.fitBounds(combinedBounds);
            return true;
        } else {
            console.warn("No bounds could be calculated from the data");
            return false;
        }
    } catch (error) {
        console.error("Error showing data bounds:", error);
        return false;
    }
}

/**
 * Update the statistics display
 */
function updateStatisticsDisplay(statistics) {
    if (!statistics) return;
    
    const observedElement = document.getElementById('total-observed');
    const estimatedElement = document.getElementById('total-estimated');
    const bikeLaneElement = document.getElementById('bike-lane-coverage');
    
    if (observedElement) {
        observedElement.textContent = statistics.totalObserved.toLocaleString();
    }
    
    if (estimatedElement) {
        estimatedElement.textContent = statistics.totalEstimated.toLocaleString();
    }
    
    if (bikeLaneElement) {
        bikeLaneElement.textContent = statistics.bikeLaneCoverage + '%';
    }
}

/**
 * Display an error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    console.error(message);
    
    // Create notification element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.innerHTML = `
        <div class="error-message">${message}</div>
        <button class="error-close">&times;</button>
    `;
    
    // Add to document
    document.body.appendChild(errorDiv);
    
    // Add close button event
    errorDiv.querySelector('.error-close').addEventListener('click', function() {
        errorDiv.remove();
    });
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.classList.add('fade-out');
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 500);
        }
    }, 10000);
}

/**
 * Show a notification message
 * @param {string} message - Message to display
 * @param {string} type - Notification type (info, success, warning, error)
 */
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('map-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'map-notification';
        notification.className = 'map-notification';
        document.body.appendChild(notification);
    }
    
    // Clear any existing classes
    notification.className = 'map-notification';
    
    // Add type class
    notification.classList.add(`notification-${type}`);
    
    // Set message and show
    notification.textContent = message;
    notification.classList.add('show');
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
        notification.classList.remove('show');
    });
    notification.appendChild(closeBtn);
    
    // Hide after 5 seconds
    setTimeout(() => {
        if (notification.classList.contains('show')) {
            notification.classList.remove('show');
        }
    }, 5000);
}

/**
 * Setup map click handler
 */
function setupMapClickHandler() {
    // Add click handler to map
    mapState.map.on('click', function(e) {
        // Hide any search results panel
        const searchResults = document.querySelector('.search-results');
        if (searchResults) {
            searchResults.style.display = 'none';
        }
        
        // Log the coordinates for debugging
        console.log("Map clicked at:", e.latlng.lat, e.latlng.lng);
    });
}

/**
 * Create hover info element for segment hover
 */
function createHoverInfoElement() {
    // Remove any existing hover info element
    const existingElement = document.querySelector('.segment-hover-info');
    if (existingElement) {
        existingElement.remove();
    }
    
    // Create new element
    const element = document.createElement('div');
    element.className = 'segment-hover-info';
    element.style.display = 'none';
    element.setAttribute('aria-live', 'polite');
    element.setAttribute('role', 'tooltip');
    document.body.appendChild(element);
    
    mapState.hoverInfoElement = element;
}

/**
 * Create detail sidebar for comprehensive segment information
 */
function createDetailSidebar() {
    console.log("createDetailSidebar called");

    const existingSidebar = document.querySelector('.detail-sidebar');
    if (existingSidebar) {
        existingSidebar.remove();
    }

    const sidebar = document.createElement('div');
    sidebar.className = 'detail-sidebar';
    sidebar.innerHTML = `
    <div class="detail-header">
        <h3>Segment Details</h3>
        <span class="close-sidebar" aria-label="Close details">&times;</span>
    </div>

    <!-- Tab switcher -->
    <div id="segment-tab-switcher" style="display: flex; border-bottom: 1px solid #ccc; margin: 0 16px 8px 16px;">
        <button id="spatial-tab-btn" class="tab-btn active" onclick="showSpatial()">🗺️ Spatial</button>
        <button id="temporal-tab-btn" class="tab-btn" onclick="showTemporal()">⏱️ Temporal</button>
    </div>

    <div class="detail-content">
        <!-- SPATIAL TAB -->
        <div id="spatial-content" class="tab-content active">
        <div class="prediction-info">
        <div class="spatial-value">
            <span class="count" id="detail-predicted-count">-</span>
            <span class="unit">avg riders/hour</span>
        </div>
        <div class="traffic-level" id="detail-traffic-level">-</div>
    </div>    
            <div class="detail-section">
                <h4>Basic Information</h4>
                <div class="detail-item">
                    <span class="detail-label">Street Name:</span>
                    <span class="detail-value" id="detail-street-name">-</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">SUBBLOCKKEY:</span>
                    <span class="detail-value" id="detail-subblockkey">-</span>
                </div>
            </div>
            <div class="detail-section">
                <h4>Comparative Analysis</h4>
                <div id="comparison-stats" class="comparison-stats"></div>
            </div>
            <div class="detail-section">
                <h4>Street View</h4>
                <div class="streetview-link" id="detail-streetview-link"></div>
            </div>
        </div>

        <!-- TEMPORAL TAB -->
        <div id="temporal-content" class="tab-content" style="display: none;">
            <div class="detail-section">
                <h4>Temporal Flow</h4>
                <div id="temporal-flow-container">
                <select id="hour-select">
                ${Array.from({ length: 24 }).map((_, i) =>
                    `<option value="${i}" ${i === 8 ? 'selected' : ''}>${i.toString().padStart(2, '0')}:00</option>`
                ).join('')}
            </select>
                    <div id="temporal-flow-value" class="temporal-flow-value">Please select an hour</div>
                </div>
            </div>
        </div>
    </div>
`;

    document.body.appendChild(sidebar);
    console.log("Sidebar appended to body");

    const closeButton = sidebar.querySelector('.close-sidebar');
    if (closeButton) {
        closeButton.addEventListener('click', function () {
            sidebar.style.display = 'none';
            mapState.selectedSegment = null;
            if (mapState.roadLayer) {
                mapState.roadLayer.resetStyle();
            }
        });
    }
}

/**
 * Initialize search bar functionality
 */
function initSearchBar() {
    // Remove any existing search container
    const existingContainer = document.querySelector('.search-container');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    // Create search container
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.innerHTML = `
        <input type="text" class="search-input" placeholder="Search by SUBBLOCKKEY or street name..." aria-label="Search streets">
        <div class="search-results" role="listbox" aria-label="Search results"></div>
    `;
    
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
        mapContainer.appendChild(searchContainer);
        
        const searchInput = searchContainer.querySelector('.search-input');
        const searchResults = searchContainer.querySelector('.search-results');
        
        // Add event listener for input
        searchInput.addEventListener('input', debounce(function(e) {
            const query = e.target.value.trim().toLowerCase();
            
            if (query.length < 3) {
                searchResults.style.display = 'none';
                searchResults.innerHTML = '';
                return;
            }
            
            // Get matching features
            let matches = [];
            if (mapState.roadLayer) {
                mapState.roadLayer.eachLayer(layer => {
                    const props = layer.feature.properties;
                    const subblockKey = props.SUBBLOCKKEY || '';
                    const streetName = props.STREETNAME || props.FULLNAME || '';
                    
                    if (subblockKey.toLowerCase().includes(query) || 
                        streetName.toLowerCase().includes(query)) {
                        matches.push({
                            id: props.SUBBLOCKKEY,
                            name: props.STREETNAME || props.FULLNAME || 'Unnamed Road',
                            feature: layer.feature
                        });
                    }
                });
            }
            
            // Limit to top 10 matches
            matches = matches.slice(0, 10);
            mapState.searchResults = matches;
            
            // Display results
            if (matches.length > 0) {
                searchResults.innerHTML = matches.map((match, index) => 
                    `<div class="search-result-item" data-index="${index}" role="option">
                        ${match.name} (${match.id})
                    </div>`
                ).join('');
                
                searchResults.style.display = 'block';
                
                // Add click handlers to results
                searchResults.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', function() {
                        const index = parseInt(this.getAttribute('data-index'));
                        const selectedResult = mapState.searchResults[index];
                        
                        selectSearchResult(selectedResult);
                        
                        // Clear search
                        searchInput.value = '';
                        searchResults.style.display = 'none';
                    });
                });
            } else {
                searchResults.innerHTML = '<div class="search-result-item" role="option">No matches found</div>';
                searchResults.style.display = 'block';
            }
        }, 300)); // Debounce for better performance
        
        // Add keyboard navigation
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown' && searchResults.style.display !== 'none') {
                e.preventDefault();
                const firstResult = searchResults.querySelector('.search-result-item');
                if (firstResult) {
                    firstResult.focus();
                }
            } else if (e.key === 'Escape') {
                searchResults.style.display = 'none';
            }
        });
        
        searchResults.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const items = searchResults.querySelectorAll('.search-result-item');
                const currentIndex = Array.from(items).indexOf(document.activeElement);
                
                if (e.key === 'ArrowDown' && currentIndex < items.length - 1) {
                    items[currentIndex + 1].focus();
                } else if (e.key === 'ArrowUp') {
                    if (currentIndex === 0) {
                        searchInput.focus();
                    } else if (currentIndex > 0) {
                        items[currentIndex - 1].focus();
                    }
                }
            } else if (e.key === 'Enter' && document.activeElement.classList.contains('search-result-item')) {
                e.preventDefault();
                const index = parseInt(document.activeElement.getAttribute('data-index'));
                const selectedResult = mapState.searchResults[index];
                
                selectSearchResult(selectedResult);
                
                // Clear search
                searchInput.value = '';
                searchResults.style.display = 'none';
                searchInput.focus();
            } else if (e.key === 'Escape') {
                searchResults.style.display = 'none';
                searchInput.focus();
            }
        });
        
        // Hide results when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchContainer.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });
    } else {
        console.error("Map container not found, cannot add search bar");
    }
}

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Handle selection of a search result
 * @param {Object} result - The selected search result
 */
function selectSearchResult(result) {
    if (!result) return;
    
    // Select the segment
    selectSegment(result.feature);
    
    // Zoom to segment
    if (mapState.roadLayer && result.id) {
        mapState.roadLayer.eachLayer(layer => {
            if (layer.feature.properties.SUBBLOCKKEY === result.id) {
                try {
                    mapState.map.fitBounds(layer.getBounds(), {
                        padding: [50, 50],
                        maxZoom: 17
                    });
                } catch (error) {
                    console.error("Error zooming to segment:", error);
                    
                    // Fallback center on the layer coordinates
                    const coords = layer.feature.geometry.coordinates;
                    if (coords && coords.length > 0) {
                        let firstPoint;
                        
                        if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                            // MultiLineString
                            firstPoint = coords[0][0];
                        } else {
                            // LineString
                            firstPoint = coords[0];
                        }
                        
                        if (firstPoint && firstPoint.length >= 2) {
                            const latlng = L.latLng(firstPoint[1], firstPoint[0]);
                            mapState.map.setView(latlng, 16);
                        }
                    }
                }
            }
        });
    }
}

/**
 * Set up event listeners for map controls
 */
function setupMapControls() {
    // Neighborhood filter
    const neighborhoodFilter = document.getElementById('neighborhood-filter');
    if (neighborhoodFilter) {
        neighborhoodFilter.addEventListener('change', function(e) {
            mapState.currentFilters.neighborhood = e.target.value;
            updateMapLayers();
            
            // Highlight selected neighborhood
            highlightSelectedNeighborhood(e.target.value);
        });
    }
    
    // Counter type filter
    const counterTypeFilter = document.getElementById('counter-type');
    if (counterTypeFilter) {
        counterTypeFilter.addEventListener('change', function(e) {
            mapState.currentFilters.counterType = e.target.value;
            updateMapLayers();
        });
    }
}

/**
 * Create and add map legend
 */
function createLegend() {
    const legend = document.getElementById('map-legend');
    
    if (!legend) {
        console.warn("Legend element not found");
        return;
    }
    
    legend.innerHTML = `
        <h4>Bike Volume Estimation</h4>
        <div class="legend-item">
            <input type="checkbox" class="legend-filter" data-volume="high" checked>
<span class="legend-color" style="background-color: #6200EA;"></span>
            <span>High (80+ riders)</span>
        </div>
        <div class="legend-item">
            <input type="checkbox" class="legend-filter" data-volume="medium-high" checked>
            <span class="legend-color" style="background-color: #7C4DFF;"></span>
            <span>Medium-High (50-80)</span>
        </div>
        <div class="legend-item">
            <input type="checkbox" class="legend-filter" data-volume="medium" checked>
            <span class="legend-color" style="background-color: #B388FF;"></span>
            <span>Medium (30-50)</span>
        </div>
        <div class="legend-item">
            <input type="checkbox" class="legend-filter" data-volume="medium-low" checked>
            <span class="legend-color" style="background-color: #D1C4E9;"></span>
            <span>Medium-Low (10-30)</span>
        </div>
        <div class="legend-item">
            <input type="checkbox" class="legend-filter" data-volume="low" checked>
            <span class="legend-color" style="background-color: #EDE7F6;"></span>
            <span>Low (0-10)</span>
        </div>
        <div class="legend-line-types">
            <div class="legend-item">
                <span class="legend-line-solid"></span>
                <span>Observed</span>
            </div>
            <div class="legend-item">
                <span class="legend-line-dashed"></span>
                <span>Estimated</span>
            </div>
        </div>
    `;
    
    // Add event listeners to legend checkboxes
    legend.querySelectorAll('.legend-filter').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // If all are unchecked, check this one again
            const anyChecked = Array.from(legend.querySelectorAll('.legend-filter')).some(cb => cb.checked);
            if (!anyChecked) {
                this.checked = true;
                return;
            }
            
            // Update filter and redraw
            updateVolumeFilter();
        });
    });
    
    // Create residual legend (initially hidden)
    const residualLegend = document.createElement('div');
    residualLegend.id = 'residual-legend';
    residualLegend.className = 'residual-legend';
    residualLegend.style.display = 'none';
    residualLegend.innerHTML = `
        <h4>Model Residuals</h4>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #d32f2f;"></span>
            <span>Underestimated (> 50%)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #ff5722;"></span>
            <span>Slightly Under (20-50%)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #4caf50;"></span>
            <span>Accurate (±20%)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #2196f3;"></span>
            <span>Slightly Over (20-50%)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #0d47a1;"></span>
            <span>Overestimated (> 50%)</span>
        </div>
    `;
    legend.appendChild(residualLegend);
    
    // Create counter points legend
    const counterLegend = document.createElement('div');
    counterLegend.id = 'counter-legend';
    counterLegend.className = 'counter-legend';
    counterLegend.innerHTML = `
        <div class="legend-item">
            <div class="counter-point"></div>
            <span>Counter Location</span>
        </div>
    `;
    legend.appendChild(counterLegend);
    
    // Add neighborhood legend section
    const neighborhoodLegend = document.createElement('div');
    neighborhoodLegend.id = 'neighborhood-legend';
    neighborhoodLegend.className = 'neighborhood-legend';
    neighborhoodLegend.innerHTML = `
        <div class="legend-item">
            <span class="legend-color" style="background-color: #CE93D8; opacity: 0.4;"></span>
            <span>Neighborhood Boundary</span>
        </div>
    `;
    legend.appendChild(neighborhoodLegend);
}

/**
 * Update volume filter based on legend checkboxes
 */
function updateVolumeFilter() {
    const checkedVolumes = [];
    document.querySelectorAll('.legend-filter').forEach(checkbox => {
        if (checkbox.checked) {
            checkedVolumes.push(checkbox.getAttribute('data-volume'));
        }
    });
    
    // If none are checked, default to all
    if (checkedVolumes.length === 0) {
        mapState.currentFilters.volumeFilter = 'all';
    } else if (checkedVolumes.length === 5) {
        // If all are checked
        mapState.currentFilters.volumeFilter = 'all';
    } else {
        // Set to the list of checked volumes
        mapState.currentFilters.volumeFilter = checkedVolumes;
    }
    
    // Update map
    updateMapLayers();
}

/**
 * Create location panel
 */
function createLocationPanel() {
    // Create panel element
    const panel = document.createElement('div');
    panel.className = 'location-panel';
    panel.style.display = 'none';
    
    // Add content
    panel.innerHTML = `
        <div class="location-panel-header">
            <h3>Location Details</h3>
            <span class="location-panel-close" aria-label="Close location panel">&times;</span>
        </div>
        <div class="location-tabs">
            <button class="tab-btn active" data-tab="info" aria-selected="true">Info</button>
            <button class="tab-btn" data-tab="census" aria-selected="false">Census</button>
            <button class="tab-btn" data-tab="network" aria-selected="false">Network</button>
            <button class="tab-btn" data-tab="streetview" aria-selected="false">Street View</button>
        </div>
        <div class="location-content">
            <div id="info-tab" class="tab-content active" aria-hidden="false">
                <div class="location-info"></div>
            </div>
            <div id="census-tab" class="tab-content" aria-hidden="true">
                <div class="census-viz"></div>
            </div>
            <div id="network-tab" class="tab-content" aria-hidden="true">
                <div class="network-viz"></div>
            </div>
<div id="streetview-tab" class="tab-content" aria-hidden="true">
                <div class="streetview-container">
                    <div id="streetview"></div>
                </div>
            </div>
        </div>
    `;
    
    // Add to document
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
        mapContainer.appendChild(panel);
        
        // Store reference
        mapState.locationPanel = panel;
        
        // Add event listeners
        panel.querySelector('.location-panel-close').addEventListener('click', function() {
            panel.style.display = 'none';
        });
        
        // Tab switching
        const tabButtons = panel.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons and content
                tabButtons.forEach(btn => {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-selected', 'false');
                });
                panel.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                    content.setAttribute('aria-hidden', 'true');
                });
                
                // Add active class to clicked button and corresponding content
                this.classList.add('active');
                this.setAttribute('aria-selected', 'true');
                const tabId = this.getAttribute('data-tab') + '-tab';
                const tabContent = panel.querySelector('#' + tabId);
                tabContent.classList.add('active');
                tabContent.setAttribute('aria-hidden', 'false');
            });
        });
    } else {
        console.error("Map container not found, cannot add location panel");
    }
}

/**
 * Initialize export control for map
 */
function initExportControl() {
    // Create custom Leaflet control for export
    const ExportControl = L.Control.extend({
        options: {
            position: 'topleft'
        },
        
        onAdd: function() {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control export-control');
            container.innerHTML = `
                <div class="export-button-group">
                    <a href="#" title="Export as CSV" class="export-csv-btn" aria-label="Export data as CSV">
                        <span class="export-icon">📊</span>
                    </a>
                </div>
            `;
            
            // Prevent click events from propagating to the map
            L.DomEvent.disableClickPropagation(container);
            
            // Add event listeners
            container.querySelector('.export-csv-btn').addEventListener('click', exportDataAsCSV);
            
            return container;
        }
    });
    
    // Add control to map
    new ExportControl().addTo(mapState.map);
}

/**
 * Export current data as CSV
 * @param {Event} e - Click event
 */
function exportDataAsCSV(e) {
    if (e) e.preventDefault();
    
    // Get filtered data
    const csvData = window.dataModule.exportToCSV ? 
                   window.dataModule.exportToCSV(mapState.currentFilters) : 
                   "No data available for export";
    
    if (!csvData) {
        showNotification("No data available to export.", "warning");
        return;
    }
    
    try {
        // Create download link
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `dc_bike_data_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.display = 'none';
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
        
        showNotification("CSV file downloaded successfully!", "success");
    } catch (error) {
        console.error("Error exporting data:", error);
        showNotification("Error exporting data: " + error.message, "error");
    }
}

/**
 * Populate the neighborhood filter dropdown with data from the dataset
 * @param {Array} neighborhoods - List of neighborhood names
 */
function populateNeighborhoodFilter(neighborhoods) {
    const select = document.getElementById('neighborhood-filter');
    if (!select) return;
    
    // Keep the "All Neighborhoods" option
    select.innerHTML = '<option value="all" selected>All Neighborhoods</option>';
    
    // Add each neighborhood as an option
    if (neighborhoods && neighborhoods.length > 0) {
        neighborhoods.forEach(neighborhood => {
            const option = document.createElement('option');
            option.value = neighborhood;
            option.textContent = neighborhood;
            select.appendChild(option);
        });
        
        console.log("Populated neighborhood filter with", neighborhoods.length, "neighborhoods");
    } else {
        console.warn("No neighborhoods provided to populate filter");
    }
}

/**
 * Highlight selected neighborhood
 * @param {string} neighborhoodName - The selected neighborhood name
 */
function highlightSelectedNeighborhood(neighborhoodName) {
    if (!mapState.neighborhoodLayer || neighborhoodName === 'all') {
        return;
    }
    
    // Reset all neighborhood styles
    mapState.neighborhoodLayer.eachLayer(layer => {
        layer.setStyle({
            color: '#9C27B0',
            weight: 2,
            opacity: 0.7,
            fillColor: '#CE93D8',
            fillOpacity: 0.1
        });
    });
    
    // Highlight selected neighborhood
    if (neighborhoodName !== 'all') {
        mapState.neighborhoodLayer.eachLayer(layer => {
            const name = layer.feature.properties.DC_HPN_NAME || 
                        (layer.feature.properties.NAME ? layer.feature.properties.NAME.split(' ').slice(1).join(' ') : '');
            
            // Check if neighborhood name matches
            if (name.toUpperCase() === neighborhoodName.toUpperCase() ||
                name.includes(neighborhoodName) ||
                neighborhoodName.includes(name)) {
                
                layer.setStyle({
                    color: '#E91E63',
                    weight: 3,
                    opacity: 1,
                    fillColor: '#F8BBD0',
                    fillOpacity: 0.3
                });
                
                // Bring layer to front
                layer.bringToFront();
                
                // Fit map to the selected neighborhood
                try {
                    mapState.map.fitBounds(layer.getBounds(), {
                        padding: [50, 50]
                    });
                } catch (error) {
                    console.error("Error zooming to neighborhood:", error);
                }
            }
        });
    }
}

/**
 * Load and display GeoJSON data on the map
 * @param {Object} roadData - The road network GeoJSON data
 * @param {Object} filters - Filter settings for the display
 */
function displayGeoJsonData(roadData, filters) {
    // Clear existing layers
    clearMapLayers();
    
    if (!roadData || !roadData.features) {
        console.error("No road data to display");
        showNotification("No road data to display", "error");
        return;
    }
    
    // Make sure map is initialized
    if (!mapState.map) {
        console.error("Map not initialized");
        return;
    }
    
    console.log("Displaying GeoJSON data with", roadData.features.length, "features");
    
    try {
        // Add neighborhood boundaries layer first (so it's beneath other layers)
        addNeighborhoodLayer();
        
        // Create the road layer with filtered data
        mapState.roadLayer = L.geoJSON(roadData, {
            style: feature => getFeatureStyle(feature, filters),
            onEachFeature: (feature, layer) => {
                // Add popup
                layer.bindPopup(createPopupContent(feature));
                
                // Add click event for segment selection
                layer.on('click', function() {
                    selectSegment(feature);
                });
                
                // Add mouseover events for hover info
                layer.on('mouseover', function(e) {
                    showHoverInfo(e, feature);
                });
                
                layer.on('mouseout', function() {
                    hideHoverInfo();
                });
                
                layer.on('mousemove', function(e) {
                    updateHoverInfoPosition(e);
                });
            }
        }).addTo(mapState.map);
        
        // Add counter points layer
        displayCounterPoints(filters);
        
        // Highlight selected neighborhood if any
        if (filters.neighborhood !== 'all') {
            highlightSelectedNeighborhood(filters.neighborhood);
        } else if (roadData.features.length > 0) {
            // Fit map to the filtered data bounds
            try {
                mapState.map.fitBounds(mapState.roadLayer.getBounds());
            } catch (error) {
                console.error("Error fitting map to data bounds:", error);
            }
        }
    } catch (error) {
        console.error("Error displaying GeoJSON data:", error);
        showError("Failed to display map data: " + error.message);
    }
}

/**
 * Add neighborhood boundaries layer to the map
 */
function addNeighborhoodLayer() {
    // Get neighborhood data from data module
    if (!window.dataModule || !window.dataModule.getState) {
        console.warn("Data module not available for neighborhood layer");
        return;
    }
    
    const neighborhoodData = window.dataModule.getState().neighborhoodBoundaries;
    
    if (!neighborhoodData || !neighborhoodData.features || neighborhoodData.features.length === 0) {
        console.warn("No neighborhood data available for display");
        return;
    }
    
    console.log("Adding neighborhood layer with", neighborhoodData.features.length, "areas");
    
    try {
        // Create neighborhood layer
        mapState.neighborhoodLayer = L.geoJSON(neighborhoodData, {
            style: {
                color: '#9C27B0',
                weight: 2,
                opacity: 0.7,
                fillColor: '#CE93D8',
                fillOpacity: 0.1
            },
            onEachFeature: (feature, layer) => {
                // For each neighborhood, add tooltip and click handler
                if (feature.properties) {
                    const neighborhoodName = feature.properties.DC_HPN_NAME || 
                                        (feature.properties.NAME ? feature.properties.NAME.replace(/^\w+\s+/, '') : 'Unknown');
                    
                    layer.bindTooltip(neighborhoodName, {
                        permanent: false,
                        direction: 'center',
                        className: 'neighborhood-tooltip'
                    });
                    
                    layer.on('click', function() {
                        // When clicking on a neighborhood, set the filter to this neighborhood
                        const neighborhoodSelect = document.getElementById('neighborhood-filter');
                        
                        if (neighborhoodSelect) {
                            // Find a matching option
                            let found = false;
                            
                            // Try to find exact match first
                            for (let i = 0; i < neighborhoodSelect.options.length; i++) {
                                const option = neighborhoodSelect.options[i];
                                if (option.text === neighborhoodName) {
                                    neighborhoodSelect.value = option.value;
                                    found = true;
                                    break;
                                }
                            }
                            
                            // If no exact match, try partial match
                            if (!found) {
                                for (let i = 0; i < neighborhoodSelect.options.length; i++) {
                                    const option = neighborhoodSelect.options[i];
                                    if (option.text.includes(neighborhoodName) || 
                                        neighborhoodName.includes(option.text)) {
                                        neighborhoodSelect.value = option.value;
                                        found = true;
                                        break;
                                    }
                                }
                            }
                            
                            // If found, trigger change event
                            if (found) {
                                // Trigger change event to update filters
                                const event = new Event('change');
                                neighborhoodSelect.dispatchEvent(event);
                            } else {
                                console.warn("Could not find matching neighborhood option for", neighborhoodName);
                            }
                        }
                    });
                }
            }
        }).addTo(mapState.map);
    } catch (error) {
        console.error("Error adding neighborhood layer:", error);
    }
}

/**
 * Display counter points layer - UPDATED to connect with filter
 * @param {Object} filters - The current filter settings
 */
function displayCounterPoints(filters) {
    // Get counter points data with applied filters
    if (!window.dataModule || !window.dataModule.getFilteredCounterData) {
        console.warn("Data module not available for counter points");
        return;
    }
    
    const counterData = window.dataModule.getFilteredCounterData(filters);
    
    // Also check the dropdown filter in addition to the passed filters
    const counterTypeFilter = document.getElementById('counter-type');
    const selectedCounterType = counterTypeFilter ? counterTypeFilter.value : 'all';
    
    if (!counterData || !counterData.features || counterData.features.length === 0) {
        console.warn("No counter data available or all filtered out");
        return;
    }
    
    console.log("Displaying", counterData.features.length, "counter points with filter:", selectedCounterType);
    
    // Create counter layer
    mapState.counterLayer = L.geoJSON(counterData, {
        filter: function(feature) {
            // Apply additional filtering based on dropdown
            if (selectedCounterType === 'all') {
                return true;
            }
            
            const counterType = (feature.properties.cntr_ty || 'unknown').toUpperCase();
            return counterType === selectedCounterType.toUpperCase();
        },
        pointToLayer: function(feature, latlng) {
            // Get count value for circle size
            const count = feature.properties.COUNT || feature.properties.Flow_Count || 10;
            const radius = Math.max(5, Math.min(15, Math.sqrt(count)));
            
            const counterType = (feature.properties.cntr_ty || 'unknown').toLowerCase();

            let color;
            if (counterType === 'auto') {
                color = '#7B1FA2'; // Auto - purple
            } else if (counterType === 'manual') {
                color = '#F06292'; // Manual - pink
            } else {
                color = '#9E9E9E'; // Other - gray
            }
            
            // Create circle marker
            return L.circleMarker(latlng, {
                radius: radius,
                fillColor: color,
                color: "#fff",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });
        },
        
        onEachFeature: (feature, layer) => {
            // Create tooltip content
            const count = feature.properties.COUNT || feature.properties.Flow_Count || 'N/A';
            const location = feature.properties.LOCATION || feature.properties.Site_Nm || feature.properties.SUBBLOCKKEY || 'Unknown';
            const counterType = feature.properties.COUNTER_TYPE || feature.properties.cntr_ty || 'Unknown';
            
            layer.bindTooltip(`
                <div class="counter-tooltip">
                    <strong>${location}</strong><br>
                    Count: ${count} riders<br>
                    Type: ${counterType}
                </div>
            `);
            
            // Add click handler
            layer.on('click', function() {
                // Find and display the corresponding road segment
                if ((feature.properties.SUBBLOCKKEY || feature.properties.Site_Nm) && mapState.roadLayer) {
                    let segmentFound = false;
                    
                    mapState.roadLayer.eachLayer(roadLayer => {
                        const roadFeature = roadLayer.feature;
                        const roadProps = roadFeature.properties;
                        const counterKey = feature.properties.SUBBLOCKKEY || feature.properties.Site_Nm;
                        
                        if (roadProps.SUBBLOCKKEY === counterKey || 
                            roadProps.Site_Name === counterKey) {
                            selectSegment(roadFeature);
                            segmentFound = true;
                        }
                    });
                    
                    if (!segmentFound) {
                        // Show info about this counter point
                        showCounterDetails(feature);
                    }
                } else {
                    showCounterDetails(feature);
                }
            });
        }
    }).addTo(mapState.map);
    
    console.log("Counter layer added to map");
}

// Update the setupMapControls function to properly handle counter type changes
function setupMapControls() {
    // Neighborhood filter
    const neighborhoodFilter = document.getElementById('neighborhood-filter');
    if (neighborhoodFilter) {
        neighborhoodFilter.addEventListener('change', function(e) {
            mapState.currentFilters.neighborhood = e.target.value;
            updateMapLayers();
            
            // Highlight selected neighborhood
            highlightSelectedNeighborhood(e.target.value);
        });
    }
    
    // Counter type filter - UPDATED to properly update map layers
    const counterTypeFilter = document.getElementById('counter-type');
    if (counterTypeFilter) {
        counterTypeFilter.addEventListener('change', function(e) {
            mapState.currentFilters.counterType = e.target.value;
            updateMapLayers(); // This will now properly handle the counter filter
        });
    }
}

/**
 * Clear all map layers
 */
function clearMapLayers() {
    // Remove existing layers safely
    const layers = [
        'roadLayer', 'counterLayer', 'residualLayer', 'heatmapLayer', 
        'neighborhoodLayer', 'censusLayer', 'networkMetricsLayer'
    ];
    
    layers.forEach(layerName => {
        if (mapState[layerName]) {
            mapState.map.removeLayer(mapState[layerName]);
            mapState[layerName] = null;
        }
    });
}

/**
 * Show hover information for a segment
 * @param {Object} e - The mouse event
 * @param {Object} feature - The GeoJSON feature
 */
function showHoverInfo(e, feature) {
    const props = feature.properties;
    const streetName = props.STREETNAME || props.FULLNAME || props.ROUTENAME || 'Unnamed Street';
    const observedCount = props.OBSERVED_COUNT || 'N/A';
    const predictedCount = props.predicted ? Math.round(props.predicted) : 'N/A';
    const subblockKey = props.SUBBLOCKKEY || props.SUBBLOK || 'N/A';
    const bikeLane = props.BIKE_FT || props.BIKELANE_CONVENTIONAL || 'None';

    // Create hover content
    mapState.hoverInfoElement.innerHTML = `
    <strong>${streetName}</strong><br>
    Predicted: <strong>${predictedCount}</strong> avg riders/hour<br>
    Observed: ${observedCount !== 'N/A' ? `<strong>${observedCount}</strong> avg riders/hour` : 'N/A'}<br>
    Bike Lane: ${bikeLane}
`;


    // Update position and show
    updateHoverInfoPosition(e);
    mapState.hoverInfoElement.style.display = 'block';
}

/**
 * Update the position of the hover info element
 * @param {Object} e - The mouse event
 */
function updateHoverInfoPosition(e) {
    if (mapState.hoverInfoElement) {
        const offset = 15; // Offset from cursor
        
        // Calculate position based on cursor position
        let left = e.originalEvent.pageX + offset;
        let top = e.originalEvent.pageY + offset;
        
        // Get info element dimensions
        const width = mapState.hoverInfoElement.offsetWidth;
        const height = mapState.hoverInfoElement.offsetHeight;
        
        // Adjust position if it would go off screen
        if (left + width > window.innerWidth) {
            left = e.originalEvent.pageX - width - offset;
        }
        
        if (top + height > window.innerHeight) {
            top = e.originalEvent.pageY - height - offset;
        }
        
        // Set position
        mapState.hoverInfoElement.style.left = `${left}px`;
        mapState.hoverInfoElement.style.top = `${top}px`;
    }
}

/**
 * Hide hover information
 */
function hideHoverInfo() {
    if (mapState.hoverInfoElement) {
        mapState.hoverInfoElement.style.display = 'none';
    }
}

/**
 * Get the style for a feature based on its properties and current filters
 * @param {Object} feature - The GeoJSON feature
 * @param {Object} filters - The current filter settings
 * @returns {Object} The style object for Leaflet
 */
function getFeatureStyle(feature, filters) {
    const props = feature.properties;
    let count = props.predicted || 0;

    if (props.OBSERVED_COUNT) {
        count = props.OBSERVED_COUNT;
    }

    const color = getCountColor(count);
    const isObserved = props.OBSERVED_COUNT > 0;
    const dashArray = !isObserved ? "5, 5" : null;

    const style = {
        color: color,
        weight: 5,     // 更粗
        opacity: 1.0   // 更实
    };

    if (dashArray) {
        style.dashArray = dashArray;
    }

    if (props.BIKE_FT && props.BIKE_FT !== "None" && props.BIKE_FT !== "NA") {
        style.weight = 6;  // 如果是有Bike Lane的路段，稍微更粗
    }

    return style;
}

/**
 * Get color for a count value (adjusted for gray basemap)
 * @param {number} count - The count value
 * @returns {string} The color code
 */
function getCountColor(count) {
    if (count >= 80) return '#2E003E'; // 极深紫 almost black
    if (count >= 50) return '#6A0DAD'; // 正宗深紫
    if (count >= 30) return '#B100E8'; // 鲜艳紫，偏粉
    if (count >= 10) return '#E86BE8'; // 很亮的粉紫
    return '#FAD6FA';                  // 接近白的淡粉
}

/**
 * Create popup content for a feature
 * @param {Object} feature - The GeoJSON feature
 * @returns {string} HTML content for the popup
 */
function createPopupContent(feature) {
    const props = feature.properties;
    const streetName = props.STREETNAME || props.FULLNAME || props.ROUTENAME || 'Unnamed Street';
    const observedCount = props.OBSERVED_COUNT || 'N/A';
    const predictedCount = props.predicted ? Math.round(props.predicted) : 'N/A';
    const subblockKey = props.SUBBLOCKKEY || props.SUBBLOK || 'N/A';

    // Include counter type if available
    let counterTypeInfo = '';
    if (props.COUNTER_TYPE) {
        counterTypeInfo = `
            <div class="popup-item">
                <div class="popup-label">Counter Type:</div>
                <div class="popup-value">${props.COUNTER_TYPE}</div>
            </div>
        `;
    }

    return `
        <div class="popup-content">
            <div class="popup-header">${streetName}</div>
            <div class="popup-data">
                <div class="popup-item">
                    <div class="popup-label">ID:</div>
                    <div class="popup-value">${subblockKey}</div>
                </div>
                <div class="popup-item">
                <div class="popup-label">Predicted:</div>
                <div class="popup-value">
                    <span class="rider-count"><strong>${predictedCount}</strong></span>
                    <span class="rider-unit"> avg riders/hour</span>
                </div>
            </div>
            <div class="popup-item">
    <div class="popup-label">Observed:</div>
    <div class="popup-value">
        <span class="rider-count"><strong>${observedCount}</strong></span>
        <span class="rider-unit"> avg riders/hour</span>
    </div>
</div>
                ${counterTypeInfo}
            </div>
            <div class="popup-footer">
                <button class="popup-details-btn">View Details</button>
            </div>
        </div>
    `;
}

/**
 * Show details of a counter point in the detail sidebar
 * @param {Object} feature - Counter point feature
 */
function showCounterDetails(feature) {
    const props = feature.properties;
    const counterType = props.COUNTER_TYPE || props.cntr_ty || 'Unknown';
    const count = props.COUNT || props.Flow_Count || 0;

    // Update detail sidebar with counter information
    document.getElementById('detail-street-name').textContent = props.LOCATION || props.Site_Nm || 'Counter Location';
    document.getElementById('detail-subblockkey').textContent = props.SUBBLOCKKEY || 'N/A';
    document.getElementById('detail-neighborhood').textContent = props.NEIGHBORHOOD || 'N/A';
    document.getElementById('detail-counter-type').textContent = counterType;
    document.getElementById('detail-observed').textContent = count ? `${count} riders` : 'N/A';
    document.getElementById('detail-predicted').textContent = props.predicted ? `${Math.round(props.predicted)} riders` : 'N/A';
    document.getElementById('detail-bike-lane').textContent = 'N/A';
    
    // Update prediction info display
    const predictionInfo = document.querySelector('.prediction-info');
    if (predictionInfo) {
        predictionInfo.innerHTML = `
            <div class="prediction-summary">
                <div class="prediction-count">${count}</div>
                <div class="prediction-label">Observed Riders</div>
                <div class="prediction-type">${counterType} Counter</div>
            </div>
        `;
    }
    
    // Add coordinates and street view link if available
    if (props.lat && props.lng) {
        addStreetViewLink(props.lat, props.lng);
    } else if (feature.geometry && feature.geometry.coordinates) {
        // For point features, coordinates are directly available
        addStreetViewLink(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
    }
    
    // Reset comparison stats and wind rose sections
    document.querySelector('.comparison-stats').innerHTML = '';
    document.querySelector('.wind-rose-chart').innerHTML = '';
    
    // Show the detail sidebar
    document.querySelector('.detail-sidebar').style.display = 'block';
}

/**
 * Add street view link to sidebar
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 */
function addStreetViewLink(lat, lng) {
    const streetViewUrl = window.dataModule.getStreetViewUrl ? 
                         window.dataModule.getStreetViewUrl(lat, lng) : 
                         `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    
    const streetviewLink = document.querySelector('.streetview-link');
    if (streetviewLink) {
        streetviewLink.innerHTML = `
            <div class="coordinates">
                <span>${lat.toFixed(6)}, ${lng.toFixed(6)}</span>
            </div>
            <a href="${streetViewUrl}" target="_blank" class="street-view-btn">
                <span class="view-icon">🔍</span> Open in Street View
            </a>
        `;
    }
}

/**
 * Create comparison stats visualization
 * @param {Object} props - Segment properties
 * @param {HTMLElement} container - Container element
 */
function createComparisonStats(props, container) {
    container.innerHTML = '';

    if (!window.dataModule || !window.dataModule.compareWithAverage) {
        container.innerHTML = '<div class="comparison-error">Comparison data not available</div>';
        return;
    }

    const comparison = window.dataModule.compareWithAverage(props);

    const comparisonHtml = Object.entries(comparison).map(([key, data]) => {
        const label = key === 'bikeCount' ? 'Predicted Volume' :
                      key === 'income' ? 'Median Income' :
                      key === 'bikeCommute' ? 'Bike Commute %' :
                      key === 'population' ? 'Population' : key;

        const formattedValue = typeof data.value === 'number' ? data.value.toLocaleString() : data.value;
        const formattedAverage = typeof data.average === 'number' ? data.average.toLocaleString() : data.average;

        return `
            <div class="comparison-simple-item">
                <div class="comparison-simple-label">${label}</div>
                <div class="comparison-simple-values">
                    <span class="current-value">${formattedValue}</span>
                    <span class="vs-text">vs</span>
                    <span class="average-value">(avg ${formattedAverage})</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = comparisonHtml;
}

/**
 * Update temporal flow display with bar chart
 * @param {Object} props - Segment properties
 */
function updateTemporalFlowDisplay(props) {
    const container = document.getElementById('temporal-flow-value');
    const select = document.getElementById('hour-select');

    if (!container || !select) return;

    const segmentId = props.GEOID || props.SUBBLOCKKEY || props.SUBBLOK;
    if (!segmentId) {
        container.innerHTML = '<div style="color: #888; text-align: center;">⚠️ No segment ID available</div>';
        return;
    }

    let temporalData = null;

    try {
        if (typeof dataModule.getTemporalPredictionsForSegment === 'function') {
            temporalData = dataModule.getTemporalPredictionsForSegment(segmentId);
        }
    } catch (err) {
        console.error("Error fetching temporal data:", err);
    }

    if (!temporalData || typeof temporalData !== 'object') {
        container.innerHTML = '<div style="color: #888; text-align: center;">⚠️ No temporal data available for this segment</div>';
        return;
    }

    const hour = parseInt(select.value, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
        container.innerHTML = '<div style="color: #888; text-align: center;">⚠️ Invalid hour selected</div>';
        return;
    }

    // Create bar chart for temporal flow
    createTemporalFlowBarChart(temporalData, hour, container);
}

/**
 * Create bar chart for temporal flow data
 * @param {Object} temporalData - Temporal data for the segment
 * @param {number} hour - Selected hour (0-23)
 * @param {HTMLElement} container - Container element
 */
function createTemporalFlowBarChart(temporalData, hour, container) {
    // Clear container
    container.innerHTML = '';
    
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let dayData = [];
    
    days.forEach((dayName, index) => {
        const dayIndex = index + 1; // Day of week (1-7)
        const hourData = temporalData[dayIndex];
        
        if (hourData && hourData[hour] !== undefined) {
            dayData.push({
                day: dayName,
                value: hourData[hour]
            });
        } else {
            dayData.push({
                day: dayName,
                value: 0
            });
        }
    });
    
    // Create SVG bar chart - MADE WIDER
    const width = Math.max(container.clientWidth - 20, 320); // Ensure minimum width
    const height = 270; // Increased height for bottom margin
    const margin = { top: 40, right: 20, bottom: 50, left: 40 }; // Increased bottom margin
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    
    // Title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', width / 2);
    title.setAttribute('y', 25);
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-size', '14px');
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('fill', '#4a148c');
    title.textContent = `Estimated Riders at ${hour}:00 (riders)`;
    svg.appendChild(title);
    
    // Chart group
    const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chartGroup.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);
    svg.appendChild(chartGroup);
    
    // Find max value for scaling
    const maxValue = Math.max(...dayData.map(d => d.value));
    const yScale = chartHeight / (maxValue * 1.1); // Add 10% padding
    
    // Calculate bar width and spacing - EVEN MORE SPACING
    const barSpacing = chartWidth / days.length;
    const barWidth = Math.min(barSpacing * 0.7, 30); // Max width of 30px
    
    // Draw bars
    dayData.forEach((data, index) => {
        const barHeight = data.value * yScale;
        const x = index * barSpacing + (barSpacing - barWidth) / 2;
        const y = chartHeight - barHeight;
        
        // Bar
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bar.setAttribute('x', x);
        bar.setAttribute('y', y);
        bar.setAttribute('width', barWidth);
        bar.setAttribute('height', barHeight);
        bar.setAttribute('fill', '#6200EA');
        bar.setAttribute('rx', 4); // rounded corners
        chartGroup.appendChild(bar);
        
        // Day label - ROTATED 45 DEGREES
        const dayLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        dayLabel.setAttribute('x', x + barWidth / 2);
        dayLabel.setAttribute('y', chartHeight + 15);
        dayLabel.setAttribute('text-anchor', 'end');
        dayLabel.setAttribute('font-size', '12px');
        dayLabel.setAttribute('fill', '#666');
        dayLabel.setAttribute('transform', `rotate(-45, ${x + barWidth / 2}, ${chartHeight + 15})`);
        dayLabel.textContent = data.day;
        chartGroup.appendChild(dayLabel);
        
        // Value label above bar
        if (data.value > 0) {
            const valueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            valueLabel.setAttribute('x', x + barWidth / 2);
            valueLabel.setAttribute('y', y - 5);
            valueLabel.setAttribute('text-anchor', 'middle');
            valueLabel.setAttribute('font-size', '11px');
            valueLabel.setAttribute('fill', '#4a148c');
            valueLabel.textContent = Math.round(data.value);
            chartGroup.appendChild(valueLabel);
        }
    });
    
    // Y-axis line
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', 0);
    yAxis.setAttribute('y1', 0);
    yAxis.setAttribute('x2', 0);
    yAxis.setAttribute('y2', chartHeight);
    yAxis.setAttribute('stroke', '#999');
    yAxis.setAttribute('stroke-width', 1);
    chartGroup.appendChild(yAxis);
    
    // X-axis line
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', 0);
    xAxis.setAttribute('y1', chartHeight);
    xAxis.setAttribute('x2', chartWidth);
    xAxis.setAttribute('y2', chartHeight);
    xAxis.setAttribute('stroke', '#999');
    xAxis.setAttribute('stroke-width', 1);
    chartGroup.appendChild(xAxis);
    
    // Y-axis label
    const yAxisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yAxisLabel.setAttribute('x', -chartHeight / 2);
    yAxisLabel.setAttribute('y', -25);
    yAxisLabel.setAttribute('transform', `rotate(-90, ${-chartHeight / 2}, -25)`);
    yAxisLabel.setAttribute('text-anchor', 'middle');
    yAxisLabel.setAttribute('font-size', '12px');
    yAxisLabel.setAttribute('fill', '#666');
    yAxisLabel.textContent = 'Number of Riders';
    chartGroup.appendChild(yAxisLabel);
    
    container.appendChild(svg);
}

// Add event listener for the hour select dropdown
const hourSelect = document.getElementById('hour-select');
if (hourSelect) {
    hourSelect.addEventListener('change', function() {
        const currentSegment = mapState.selectedSegment;
        if (currentSegment) {
            // Find the feature with this segment ID and update the display
            if (mapState.roadLayer) {
                mapState.roadLayer.eachLayer(layer => {
                    const props = layer.feature.properties;
                    const segmentId = props.SUBBLOCKKEY || props.SUBBLOK;
                    
                    if (segmentId === currentSegment) {
                        updateTemporalFlowDisplay(props);
                    }
                });
            }
        }
    });
}

/**
 * Update the detail sidebar with segment properties
 * @param {Object} props - The feature properties
 */
function updateDetailSidebar(props) {
    console.log("updateDetailSidebar props:", props);

    // 更新 Street Name
    const streetNameElement = document.getElementById('detail-street-name');
    if (streetNameElement) {
        streetNameElement.textContent = props.STREETNAME || props.FULLNAME || props.ROUTENAME || 'Unnamed Street';
    }

    // 更新 SUBBLOCKKEY
    const subblockKeyElement = document.getElementById('detail-subblockkey');
    if (subblockKeyElement) {
        subblockKeyElement.textContent = props.SUBBLOCKKEY || props.SUBBLOK || 'N/A';
    }

    // 更新 Predicted Count 大数字
    const predictedCountElement = document.getElementById('detail-predicted-count');
    const trafficLevelElement = document.getElementById('detail-traffic-level');
    if (predictedCountElement && trafficLevelElement) {
        const predicted = Math.round(props.predicted || 0);
        predictedCountElement.textContent = predicted;

        if (predicted >= 80) {
            trafficLevelElement.textContent = "HIGH TRAFFIC";
        } else if (predicted >= 40) {
            trafficLevelElement.textContent = "MEDIUM TRAFFIC";
        } else {
            trafficLevelElement.textContent = "LOW TRAFFIC";
        }
    }

    // 更新街景链接
    const streetViewLink = document.getElementById('detail-streetview-link');
    if (streetViewLink) {
        if (props.lat && props.lng) {
            streetViewLink.innerHTML = `
                <a class="street-view-btn" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${props.lat},${props.lng}" target="_blank">
                    View Street
                </a>
            `;
        } else {
            streetViewLink.innerHTML = `<span style="color: #888;">No Street View Available</span>`;
        }
    }

// 更新 Comparative Analysis
const comparisonStats = document.getElementById('comparison-stats');
if (comparisonStats) {
    comparisonStats.innerHTML = '';

    const comparisons = compareWithAverage(props); // 还是用原来的props
    Object.keys(comparisons).forEach(key => {
        const comp = comparisons[key];
        const item = document.createElement('div');
        item.className = 'comparison-item';

        // 计算宽度
        const segmentValue = Number(comp.value) || 0;
        const avgValue = Number(comp.average) || 1; // 防止除0
        const segmentPercent = Math.min(100, (segmentValue / avgValue) * 100);
        const avgPercent = 100; // average在基准线默认100%

        item.innerHTML = `
            <div class="comparison-label">${formatComparisonLabel(key)}</div>
            <div class="bar-wrapper">
                <div class="bar-background">
                    <div class="bar-fill" style="width: ${Math.min(100, segmentPercent)}%; background-color: ${getComparisonColor(comp.status)};"></div>
                    <div class="bar-average" style="left: 50%;"></div> <!-- 基准线靠中间 -->
                </div>
            </div>
            <div class="bar-numbers">
                <span class="segment-value">${formatNumber(segmentValue)}</span> vs 
                <span class="average-value">(avg ${formatNumber(avgValue)})</span>
            </div>
        `;
        comparisonStats.appendChild(item);
    });
}

// Update temporal flow display
updateTemporalFlowDisplay(props);
    
// Set up hour select listener - this section should be updated
const hourSelect = document.getElementById('hour-select');
if (hourSelect) {
    // Remove any existing listeners to avoid duplicates
    hourSelect.removeEventListener('change', handleHourChange);
    hourSelect.addEventListener('change', handleHourChange);
    
    // Initial temporal flow display
    updateTemporalFlowDisplay(props);
}
}

// Create a named function for the event handler
function handleHourChange() {
const currentSegment = mapState.selectedSegment;
if (currentSegment) {
    // Find the feature with this segment ID and update the display
    if (mapState.roadLayer) {
        mapState.roadLayer.eachLayer(layer => {
            const props = layer.feature.properties;
            const segmentId = props.SUBBLOCKKEY || props.SUBBLOK;
            
            if (segmentId === currentSegment) {
                updateTemporalFlowDisplay(props);
            }
        });
    }
}
}

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0';
    }
    return Number(num).toLocaleString(); // 加逗号分隔，10000 -> 10,000
}

function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    if (typeof num === 'number') {
        if (Math.abs(num) > 1000) {
            return Math.round(num).toLocaleString();
        } else {
            return Math.round(num);
        }
    }
    return num;
}

function formatComparisonLabel(key) {
    switch (key) {
        case 'bikeCount': return 'Predicted Volume';
        case 'income': return 'Median Income';
        case 'bikeCommute': return 'Bike Commute %';
        case 'population': return 'Population';
        default: return key;
    }
}

function getComparisonColor(status) {
    switch (status) {
        case 'very-high': return '#4caf50'; // green
        case 'high': return '#8bc34a'; // light green
        case 'normal': return '#2196f3'; // blue
        case 'low': return '#ff9800'; // orange
        case 'very-low': return '#f44336'; // red
        default: return '#9e9e9e'; // grey
    }
}

/**
 * Compare a segment's statistics with city average
 * @param {Object} segmentProps - Segment properties
 * @returns {Object} Comparison results
 */
function compareWithAverage(segmentProps) {
    const comparison = {
        bikeCount: {
            value: segmentProps.predicted || 0,
            average: dataState.statistics.averagePredicted,
            percentDiff: 0,
            status: 'normal'
        },
        income: {
            value: segmentProps.MEDIAN_INCOME || segmentProps.median_incomeE || 0,
            average: dataState.statistics.averageIncome,
            percentDiff: 0,
            status: 'normal'
        },
        bikeCommute: {
            value: segmentProps.BIKE_COMMUTE || segmentProps.commute_bicycleE || 0,
            average: dataState.statistics.averageBikeCommute,
            percentDiff: 0,
            status: 'normal'
        },
        population: {
            value: segmentProps.POPULATION || segmentProps.populationE || 0,
            average: dataState.statistics.averagePopulation,
            percentDiff: 0,
            status: 'normal'
        }
    };
    
    // Calculate percentages and status
    Object.keys(comparison).forEach(key => {
        const item = comparison[key];
        if (item.average !== 0) {
            item.percentDiff = Math.round((item.value - item.average) / item.average * 100);
            
            // Enhanced status determination with more granular categories
            if (item.percentDiff > 50) {
                item.status = 'very-high';
            } else if (item.percentDiff > 20) {
                item.status = 'high';
            } else if (item.percentDiff < -50) {
                item.status = 'very-low';
            } else if (item.percentDiff < -20) {
                item.status = 'low';
            } else {
                item.status = 'normal';
            }
        }
    });
    
    return comparison;
}

/**
 * Highlight the currently selected segment on the map
 */
function highlightSelectedSegment() {
    if (!mapState.roadLayer || !mapState.selectedSegment) return;

    // Reset all layer styles
    mapState.roadLayer.resetStyle();

    // Find and highlight the selected segment
    mapState.roadLayer.eachLayer(layer => {
        const featureId = layer.feature.properties.SUBBLOCKKEY || layer.feature.properties.SUBBLOK;
        if (featureId === mapState.selectedSegment) {
            layer.setStyle({
                weight: 7,
                color: '#6200EA',
                opacity: 1
            });
            layer.bringToFront();
        }
    });
}

/**
 * Create and add map legend with correct colors to match the actual map
 */
function createLegend() {
    const legend = document.getElementById('map-legend');
    
    if (!legend) {
        console.warn("Legend element not found");
        return;
    }
    
    legend.innerHTML = `
        <h4>Bike Volume Estimation</h4>
        <div class="legend-item">
            <input type="checkbox" class="legend-filter" data-volume="high" checked>
            <span class="legend-color" style="background-color: #2E003E;"></span>
            <span>High (80+ riders)</span>
        </div>
        <div class="legend-item">
            <input type="checkbox" class="legend-filter" data-volume="medium-high" checked>
            <span class="legend-color" style="background-color: #6A0DAD;"></span>
            <span>Medium-High (50-80)</span>
        </div>
        <div class="legend-item">
            <input type="checkbox" class="legend-filter" data-volume="medium" checked>
            <span class="legend-color" style="background-color: #B100E8;"></span>
            <span>Medium (30-50)</span>
        </div>
        <div class="legend-item">
            <input type="checkbox" class="legend-filter" data-volume="medium-low" checked>
            <span class="legend-color" style="background-color: #E86BE8;"></span>
            <span>Medium-Low (10-30)</span>
        </div>
        <div class="legend-item">
            <input type="checkbox" class="legend-filter" data-volume="low" checked>
            <span class="legend-color" style="background-color: #FAD6FA;"></span>
            <span>Low (0-10)</span>
        </div>
        <div class="legend-line-types">
            <div class="legend-item">
                <span class="legend-line-solid"></span>
                <span>Observed</span>
            </div>
            <div class="legend-item">
                <span class="legend-line-dashed"></span>
                <span>Estimated</span>
            </div>
        </div>
    `;
    
    // Add event listeners to legend checkboxes
    legend.querySelectorAll('.legend-filter').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // If all are unchecked, check this one again
            const anyChecked = Array.from(legend.querySelectorAll('.legend-filter')).some(cb => cb.checked);
            if (!anyChecked) {
                this.checked = true;
                return;
            }
            
            // Update filter and redraw
            updateVolumeFilter();
        });
    });
    
    // Create residual legend (initially hidden)
    const residualLegend = document.createElement('div');
    residualLegend.id = 'residual-legend';
    residualLegend.className = 'residual-legend';
    residualLegend.style.display = 'none';
    residualLegend.innerHTML = `
        <h4>Model Residuals</h4>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #d32f2f;"></span>
            <span>Underestimated (> 50%)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #ff5722;"></span>
            <span>Slightly Under (20-50%)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #4caf50;"></span>
            <span>Accurate (±20%)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #2196f3;"></span>
            <span>Slightly Over (20-50%)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #0d47a1;"></span>
            <span>Overestimated (> 50%)</span>
        </div>
    `;
    legend.appendChild(residualLegend);
    
    // Create counter points legend
    const counterLegend = document.createElement('div');
    counterLegend.id = 'counter-legend';
    counterLegend.className = 'counter-legend';
    counterLegend.innerHTML = `
        <div class="legend-item">
            <div class="counter-point"></div>
            <span>Counter Location</span>
        </div>
    `;
    legend.appendChild(counterLegend);
    
    // Add neighborhood legend section
    const neighborhoodLegend = document.createElement('div');
    neighborhoodLegend.id = 'neighborhood-legend';
    neighborhoodLegend.className = 'neighborhood-legend';
    neighborhoodLegend.innerHTML = `
        <div class="legend-item">
            <span class="legend-color" style="background-color: #CE93D8; opacity: 0.4;"></span>
            <span>Neighborhood Boundary</span>
        </div>
    `;
    legend.appendChild(neighborhoodLegend);
}
/**
 * Update map with new filter settings
 */
function updateMapLayers() {
    try {
        // Get filtered data based on current filter settings
        if (!window.dataModule || !window.dataModule.getFilteredRoadData) {
            console.warn("Data module not available for updating map layers");
            return;
        }
        
        const filteredData = window.dataModule.getFilteredRoadData(mapState.currentFilters);

        if (filteredData) {
            // Display the filtered data on the map
            displayGeoJsonData(filteredData, mapState.currentFilters);

            // Highlight selected segment if there is one
            if (mapState.selectedSegment) {
                highlightSelectedSegment();
            }
            
            // Update filter info
            updateFilterInfo();
        }

        console.log("Map layers updated with filters:", mapState.currentFilters);
    } catch (error) {
        console.error("Error updating map layers:", error);
        showError("Error updating map display: " + error.message);
    }
}

/**
 * Update filter information display
 */
function updateFilterInfo() {
    const filterInfo = document.getElementById('filter-info');
    if (!filterInfo) return;
    
    let activeFilters = [];
    
    // Neighborhood
    if (mapState.currentFilters.neighborhood !== "all") {
        activeFilters.push(`Neighborhood: ${mapState.currentFilters.neighborhood}`);
    }
    
    // Counter type
    if (mapState.currentFilters.counterType !== "all") {
        activeFilters.push(`Counter: ${mapState.currentFilters.counterType}`);
    }
    
    // Volume filter
    if (mapState.currentFilters.volumeFilter !== "all") {
        let volumeText = "Volume: ";
        if (Array.isArray(mapState.currentFilters.volumeFilter)) {
            volumeText += mapState.currentFilters.volumeFilter.join(", ");
        } else {
            volumeText += mapState.currentFilters.volumeFilter;
        }
        activeFilters.push(volumeText);
    }
    
    // Update the filter info display
    if (activeFilters.length > 0) {
        filterInfo.textContent = `Active Filters: ${activeFilters.join(" | ")}`;
        filterInfo.style.display = "block";
    } else {
        filterInfo.style.display = "none";
    }
}

/**
 * Handle segment selection
 * @param {Object} feature - The selected GeoJSON feature
 */
function selectSegment(feature) {
    const props = feature.properties;
    mapState.selectedSegment = props.SUBBLOCKKEY || props.SUBBLOK;

    // Update the detail sidebar
    updateDetailSidebar(props);

    // Show the detail sidebar
    document.querySelector('.detail-sidebar').style.display = 'block';

    // Highlight the selected segment
    highlightSelectedSegment();
}

window.mapModule = {
    initMap,
    displayGeoJsonData,
    updateMapLayers,
    populateNeighborhoodFilter,
    getState: () => mapState,
    clearMapLayers,
    showNotification,
    showDataBounds,
    addNeighborhoodLayer,
    selectSegment 
};