/**
 * Map Visualization Enhancement Module for DC Bike Dashboard
 * Handles network data and census data visualization capabilities
 */

// Visualization state
const vizState = {
    activeDataLayers: {
        roadNetwork: true,
        counterPoints: true,
        neighborhoods: true,
        censusData: false,
        networkMetrics: false,
        observedEstimatedTraffic: true    
    },

    censusDataType: 'population', // population, income, bikeCommute, etc.
    networkMetricType: 'connectivity', // connectivity, betweenness, etc.
    colorScales: {
        population: ["#f7fbff", "#d2e3ef", "#a6cee3", "#62b1dd", "#3182bd", "#08519c", "#083582", "#06266f", "#041e5a"],
        income: ["#f7fcf5", "#d3eecd", "#a1d99b", "#74c476", "#41ab5d", "#228a44", "#006d2c", "#00441b", "#002b10"],
        bikeCommute: ["#fff5eb", "#fde0c5", "#fdbe85", "#fd9242", "#fd8d3c", "#f16913", "#d94801", "#a63603", "#7f2704"],
        education: ["#edf8fb", "#b3d8e0", "#7ebccc", "#43a2ca", "#0868ac"], // More distinct education level colors
        connectivity: ["#fcfbfd", "#e2e1ef", "#c5c0da", "#9e8ec4", "#8a6bc1", "#7a51a8", "#61409b", "#54278f", "#3f007d"],
        bikeLaneType: {
            "Protected": "#006d2c",
            "Buffered": "#31a354", 
            "Conventional": "#74c476",
            "Sharrow": "#c2e699",
            "None": "#f7fcf5",
            "Unknown": "#e5f5e0"
        }
    },
    legend: null,
    tooltips: {},
    censusOpacity: 0.8,  // Increased default opacity
    networkOpacity: 0.9  // Increased default opacity
};

/**
 * Initialize visualization enhancements
 */
function initVisualization() {
    console.log("Initializing visualization enhancements...");
    
    try {
        // Create layer control panel
        createLayerControlPanel();
        
        // Create census data control panel
        createCensusDataControl();
        
        // Create network metrics control panel
        createNetworkMetricsControl();
        
        // Create and add legends
        createLegends();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initialize the layer checkboxes to match the state
        initializeLayerCheckboxes();
        
        // Create opacity controls
        createOpacityControls();
        
        console.log("Visualization enhancements initialized");
    } catch (error) {
        console.error("Error initializing visualization enhancements:", error);
        showError("Failed to initialize visualization tools. Some features may not be available.");
    }
}

/**
 * Create opacity controls for visualizations
 */
function createOpacityControls() {
    // Create container for opacity controls
    const opacityControls = document.createElement('div');
    opacityControls.className = 'opacity-controls';
    opacityControls.innerHTML = `
        <div class="opacity-control-header">
            <h3>Layer Opacity</h3>
        </div>
        <div class="opacity-control-content">
            <div class="opacity-item">
                <label for="census-opacity">Census Data:</label>
                <input type="range" id="census-opacity" min="0" max="1" step="0.1" value="${vizState.censusOpacity}">
                <span class="opacity-value">${Math.round(vizState.censusOpacity * 100)}%</span>
            </div>
            <div class="opacity-item">
                <label for="network-opacity">Network Data:</label>
                <input type="range" id="network-opacity" min="0" max="1" step="0.1" value="${vizState.networkOpacity}">
                <span class="opacity-value">${Math.round(vizState.networkOpacity * 100)}%</span>
            </div>
        </div>
    `;
    
    // Add to map container
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
        mapContainer.appendChild(opacityControls);
        
        // Add event listeners
        const censusOpacity = opacityControls.querySelector('#census-opacity');
        const networkOpacity = opacityControls.querySelector('#network-opacity');
        
        if (censusOpacity) {
            censusOpacity.addEventListener('input', function(e) {
                vizState.censusOpacity = parseFloat(e.target.value);
                opacityControls.querySelector('.opacity-item:first-child .opacity-value').textContent = 
                    Math.round(vizState.censusOpacity * 100) + '%';
                
                // Update census layer if active
                if (vizState.activeDataLayers.censusData) {
                    displayCensusDataLayer(vizState.censusDataType);
                }
            });
        }
        
        if (networkOpacity) {
            networkOpacity.addEventListener('input', function(e) {
                vizState.networkOpacity = parseFloat(e.target.value);
                opacityControls.querySelector('.opacity-item:last-child .opacity-value').textContent = 
                    Math.round(vizState.networkOpacity * 100) + '%';
                
                // Update network layer if active
                if (vizState.activeDataLayers.networkMetrics) {
                    displayNetworkMetricsLayer(vizState.networkMetricType);
                }
            });
        }
        
        // Show if any visualization layers are active
        opacityControls.style.display = (vizState.activeDataLayers.censusData || vizState.activeDataLayers.networkMetrics) ? 'block' : 'none';
    } else {
        console.error("Map container not found, cannot add opacity controls");
    }
}

/**
 * Initialize layer checkboxes based on active state
 */
function initializeLayerCheckboxes() {
    // Set checkbox states based on activeDataLayers
    const layerControls = [
        { id: 'layer-roads', layer: 'roadNetwork' },
        { id: 'layer-counters', layer: 'counterPoints' },
        { id: 'layer-neighborhoods', layer: 'neighborhoods' },
        { id: 'layer-census', layer: 'censusData' },
        { id: 'layer-network-metrics', layer: 'networkMetrics' }
    ];
    
    layerControls.forEach(control => {
        const checkbox = document.getElementById(control.id);
        if (checkbox) {
            checkbox.checked = vizState.activeDataLayers[control.layer];
        }
    });
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    console.error(message);
    
    // Use app module error function if available
    if (window.mapModule && window.mapModule.showNotification) {
        window.mapModule.showNotification(message, "error");
    } else {
        // Fallback to alert if no error handling is available
        alert("Visualization Error: " + message);
    }
}

/**
 * Create layer control panel
 */
function createLayerControlPanel() {
    // Create container for layer controls
    const layerControl = document.createElement('div');
    layerControl.className = 'layer-control-panel';
    layerControl.innerHTML = `
        <div class="layer-control-header">
            <h3>Data Layers</h3>
            <button class="layer-control-toggle" aria-label="Toggle layer control panel">▼</button>
        </div>
        <div class="layer-control-content">
            <div class="layer-item">
                <input type="checkbox" id="layer-roads" checked>
                <label for="layer-roads">Bike Volume Estimation</label>
            </div>
            <div class="layer-item">
                <input type="checkbox" id="layer-counters" checked>
                <label for="layer-counters">Counter Points</label>
            </div>
            <div class="layer-item">
                <input type="checkbox" id="layer-neighborhoods" checked>
                <label for="layer-neighborhoods">Neighborhoods</label>
            </div>
            <div class="layer-item">
                <input type="checkbox" id="layer-census">
                <label for="layer-census">Census Data</label>
            </div>
            <div class="layer-item">
                <input type="checkbox" id="layer-network-metrics">
                <label for="layer-network-metrics">Network Metrics</label>
            </div>
        </div>
    `;
    
    // Add to map container
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
        mapContainer.appendChild(layerControl);
        
        // Add toggle functionality
        const toggleBtn = layerControl.querySelector('.layer-control-toggle');
        const content = layerControl.querySelector('.layer-control-content');
        
        if (toggleBtn && content) {
            toggleBtn.addEventListener('click', function() {
                const isVisible = content.style.display !== 'none';
                content.style.display = isVisible ? 'none' : 'block';
                toggleBtn.textContent = isVisible ? '▲' : '▼';
                // Update ARIA expanded state
                toggleBtn.setAttribute('aria-expanded', !isVisible);
            });
        }
    } else {
        console.error("Map container not found, cannot add layer control panel");
    }
}

/**
 * Create census data control
 */
function createCensusDataControl() {
    // Create container for census data controls
    const censusControl = document.createElement('div');
    censusControl.className = 'census-control-panel';
    censusControl.style.display = 'none'; // Initially hidden
    censusControl.innerHTML = `
        <div class="census-control-header">
            <h3>Census Data</h3>
            <button class="close-control" aria-label="Close census data panel">×</button>
            <div class="control-help" title="Click to learn more">?</div>
        </div>
        <div class="census-control-content">
            <div class="radio-item">
                <input type="radio" id="census-population" name="census-type" value="population" checked>
                <label for="census-population">Population Density</label>
            </div>
            <div class="radio-item">
                <input type="radio" id="census-income" name="census-type" value="income">
                <label for="census-income">Median Income</label>
            </div>
            <div class="radio-item">
                <input type="radio" id="census-bike-commute" name="census-type" value="bikeCommute">
                <label for="census-bike-commute">Bike Commute %</label>
            </div>
            <div class="radio-item">
                <input type="radio" id="census-education" name="census-type" value="education">
                <label for="census-education">Education Level</label>
            </div>
            <div class="radio-item">
                <input type="radio" id="census-white" name="census-type" value="whitePercentage">
                <label for="census-white">Percentage of White</label>
            </div>
            <div class="radio-item">
                <input type="radio" id="census-rent" name="census-type" value="rent">
                <label for="census-rent">Median Rent</label>
            </div>
        </div>
    `;
    
    // Add to map container
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
        mapContainer.appendChild(censusControl);
        
        // Add help tooltip
        const helpBtn = censusControl.querySelector('.control-help');
        if (helpBtn) {
            helpBtn.addEventListener('click', function() {
                const helpText = "Census data shows demographic information by neighborhood. " +
                                "Choose a variable to see patterns across DC.";
                if (window.mapModule && window.mapModule.showNotification) {
                    window.mapModule.showNotification(helpText, "info");
                }
            });
        }
        
        // Add close button functionality
        const closeBtn = censusControl.querySelector('.close-control');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                // Find and uncheck the census data checkbox
                const censusCheckbox = document.getElementById('layer-census');
                if (censusCheckbox) {
                    censusCheckbox.checked = false;
                    // Trigger the change event manually
                    const event = new Event('change');
                    censusCheckbox.dispatchEvent(event);
                }
            });
        }
    } else {
        console.error("Map container not found, cannot add census control panel");
    }
}

/**
 * Create network metrics control
 */
function createNetworkMetricsControl() {
    // Create container for network metrics controls
    const networkControl = document.createElement('div');
    networkControl.className = 'network-control-panel';
    networkControl.style.display = 'none'; // Initially hidden
    networkControl.innerHTML = `
        <div class="network-control-header">
            <h3>Network Metrics</h3>
            <button class="close-control" aria-label="Close network metrics panel">×</button>
            <div class="control-help" title="Click to learn more">?</div>
        </div>
<div class="network-control-content">
            <div class="radio-item">
                <input type="radio" id="network-connectivity" name="network-type" value="connectivity" checked>
                <label for="network-connectivity">Connectivity</label>
            </div>
            <div class="radio-item">
                <input type="radio" id="network-betweenness" name="network-type" value="betweenness">
                <label for="network-betweenness">Betweenness Centrality</label>
            </div>
            <div class="radio-item">
                <input type="radio" id="network-closeness" name="network-type" value="closeness">
                <label for="network-closeness">Closeness Centrality</label>
            </div>
            <div class="radio-item">
                <input type="radio" id="network-bike-lanes" name="network-type" value="bikeLanes">
                <label for="network-bike-lanes">Bike Lane Types</label>
            </div>
        </div>
    `;
    
    // Add to map container
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
        mapContainer.appendChild(networkControl);
        
        // Add help tooltip
        const helpBtn = networkControl.querySelector('.control-help');
        if (helpBtn) {
            helpBtn.addEventListener('click', function() {
                const helpText = "Network metrics show road network properties. " +
                                "Connectivity displays intersection density, betweenness shows " +
                                "important route corridors, and closeness shows accessibility.";
                if (window.mapModule && window.mapModule.showNotification) {
                    window.mapModule.showNotification(helpText, "info");
                }
            });
        }
        
        // Add close button functionality
        const closeBtn = networkControl.querySelector('.close-control');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                // Find and uncheck the network metrics checkbox
                const networkCheckbox = document.getElementById('layer-network-metrics');
                if (networkCheckbox) {
                    networkCheckbox.checked = false;
                    // Trigger the change event manually
                    const event = new Event('change');
                    networkCheckbox.dispatchEvent(event);
                }
            });
        }
    } else {
        console.error("Map container not found, cannot add network metrics control panel");
    }
}

/**
 * Create legends for different visualization types
 */
function createLegends() {
    // Create container for dynamic legends
    const legendContainer = document.createElement('div');
    legendContainer.className = 'dynamic-legend';
    legendContainer.style.display = 'none'; // Initially hidden
    
    // Add close button to the legend
    const closeButton = document.createElement('button');
    closeButton.className = 'legend-close-btn';
    closeButton.innerHTML = '×';
    closeButton.setAttribute('aria-label', 'Close legend');
    closeButton.addEventListener('click', function() {
        legendContainer.style.display = 'none';
    });
    
    legendContainer.appendChild(closeButton);
    
    // Add to map container
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
        mapContainer.appendChild(legendContainer);
        vizState.legend = legendContainer;
    } else {
        console.error("Map container not found, cannot add legend");
    }
}

/**
 * Update legend based on active visualization
 * @param {string} dataType - Type of data being visualized
 */
function updateLegend(dataType) {
    if (!vizState.legend) return;
    
    let legendHTML = '<button class="legend-close-btn" aria-label="Close legend">×</button><div class="legend-title">';
    
    switch(dataType) {
        case 'population':
            legendHTML += 'Population Density</div><div class="legend-scale">';
            legendHTML += createColorScaleLegend(vizState.colorScales.population, ['Low', '2,500', '5,000', '7,500', '10,000+']);
            break;
            
        case 'income':
            legendHTML += 'Median Income</div><div class="legend-scale">';
            legendHTML += createColorScaleLegend(vizState.colorScales.income, ['$40k', '$80k', '$120k', '$160k', '$200k+']);
            break;
            
        case 'bikeCommute':
            legendHTML += 'Bike Commute %</div><div class="legend-scale">';
            legendHTML += createColorScaleLegend(vizState.colorScales.bikeCommute, ['0%', '2%', '4%', '6%', '8%+']);
            break;
            
        case 'education':
            legendHTML += 'Education Level (% with Bachelor\'s+)</div><div class="legend-scale">';
            legendHTML += createColorScaleLegend(vizState.colorScales.education, ['20%', '40%', '60%', '80%', '100%']);
            break;

        case 'whitePercentage':
            legendHTML += 'Percentage of White Population</div><div class="legend-scale">';
            legendHTML += createColorScaleLegend(vizState.colorScales.education, ['20%', '40%', '60%', '80%', '100%']);
            break;
            
        case 'rent':
            legendHTML += 'Median Rent</div><div class="legend-scale">';
            legendHTML += createColorScaleLegend(vizState.colorScales.income, ['$1000', '$1500', '$2000', '$2500', '$3000+']);
            break;
            
        case 'connectivity':
            legendHTML += 'Connectivity (# of Connections)</div><div class="legend-scale">';
            legendHTML += createColorScaleLegend(vizState.colorScales.connectivity, ['1', '2', '3', '4', '5+']);
            break;
            
        case 'betweenness':
            legendHTML += 'Betweenness Centrality</div><div class="legend-scale">';
            legendHTML += createColorScaleLegend(vizState.colorScales.connectivity, ['Low', '', 'Medium', '', 'High']);
            break;
            
        case 'closeness':
            legendHTML += 'Closeness Centrality</div><div class="legend-scale">';
            legendHTML += createColorScaleLegend(vizState.colorScales.connectivity, ['Low', '', 'Medium', '', 'High']);
            break;
            
        case 'bikeLanes':
            legendHTML += 'Bike Lane Types</div><div class="legend-categories">';
            for (const [type, color] of Object.entries(vizState.colorScales.bikeLaneType)) {
                legendHTML += `
                    <div class="legend-category">
                        <span class="color-box" style="background-color: ${color};"></span>
                        <span class="category-label">${type}</span>
                    </div>
                `;
            }
            break;
            
        default:
            legendHTML += 'Legend</div>';
            break;
    }
    
    legendHTML += '</div>';
    vizState.legend.innerHTML = legendHTML;
    vizState.legend.style.display = 'block';
    
    // Re-add close button event listener
    const closeBtn = vizState.legend.querySelector('.legend-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            vizState.legend.style.display = 'none';
        });
    }
}

/**
 * Create color scale legend HTML
 * @param {Array} colors - Array of color values
 * @param {Array} labels - Array of labels for the scale
 * @returns {string} HTML for the color scale
 */
function createColorScaleLegend(colors, labels) {
    let html = '';
    const usedColors = colors.filter((_, i) => i % Math.floor(colors.length / 5) === 0).slice(0, 5);
    
    for (let i = 0; i < usedColors.length; i++) {
        html += `
            <div class="legend-item">
                <span class="color-box" style="background-color: ${usedColors[i]};"></span>
                <span class="value-label">${labels[i] || ''}</span>
            </div>
        `;
    }
    
    return html;
}

/**
 * Setup event listeners for controls
 */
function setupEventListeners() {
    // Layer control checkboxes
    setupLayerControlEvents();
    
    // Census data type radios
    setupCensusControlEvents();
    
    // Network metrics type radios
    setupNetworkControlEvents();
}

/**
 * Setup layer control events
 */
function setupLayerControlEvents() {
    const layerControls = [
        { id: 'layer-roads', layer: 'roadNetwork' },
        { id: 'layer-counters', layer: 'counterPoints' },
        { id: 'layer-neighborhoods', layer: 'neighborhoods' },
        { id: 'layer-census', layer: 'censusData' },
        { id: 'layer-network-metrics', layer: 'networkMetrics' }
    ];
    
    layerControls.forEach(control => {
        const element = document.getElementById(control.id);
        if (element) {
            element.addEventListener('change', function(e) {
                vizState.activeDataLayers[control.layer] = e.target.checked;
                
                // Show/hide opacity controls
                const opacityControls = document.querySelector('.opacity-controls');
                if (opacityControls) {
                    opacityControls.style.display = 
                        (vizState.activeDataLayers.censusData || vizState.activeDataLayers.networkMetrics) ? 
                        'block' : 'none';
                }
                
                // Handle special cases for some layers
                if (control.layer === 'neighborhoods' && e.target.checked) {
                    if (window.mapModule && window.mapModule.getState && !window.mapModule.getState().neighborhoodLayer) {
                        // If we need to call the map module to display neighborhoods
                        displayNeighborhoodLayer();
                    }
                } else if (control.layer === 'censusData') {
                    document.querySelector('.census-control-panel').style.display = 
                        e.target.checked ? 'block' : 'none';
                    
                    if (e.target.checked) {
                        displayCensusDataLayer(vizState.censusDataType);
                    } else {
                        if (vizState.legend) vizState.legend.style.display = 'none';
                    }
                } else if (control.layer === 'networkMetrics') {
                    document.querySelector('.network-control-panel').style.display = 
                        e.target.checked ? 'block' : 'none';
                    
                    if (e.target.checked) {
                        displayNetworkMetricsLayer(vizState.networkMetricType);
                    } else {
                        if (vizState.legend) vizState.legend.style.display = 'none';
                    }
                }
                
                // Update map layers
                updateMapLayers();
            });
        }
    });
}

/**
 * Setup census control events
 */
function setupCensusControlEvents() {
    const censusRadios = document.querySelectorAll('input[name="census-type"]');
    censusRadios.forEach(radio => {
        radio.addEventListener('change', function(e) {
            if (e.target.checked) {
                vizState.censusDataType = e.target.value;
                displayCensusDataLayer(vizState.censusDataType);
            }
        });
    });
}

/**
 * Setup network control events
 */
function setupNetworkControlEvents() {
    const networkRadios = document.querySelectorAll('input[name="network-type"]');
    networkRadios.forEach(radio => {
        radio.addEventListener('change', function(e) {
            if (e.target.checked) {
                vizState.networkMetricType = e.target.value;
                displayNetworkMetricsLayer(vizState.networkMetricType);
            }
        });
    });
}

/**
 * Update map layers based on active data layers
 */
function updateMapLayers() {
    const mapState = window.mapModule ? window.mapModule.getState() : null;
    if (!mapState || !mapState.map) {
        console.error("Map not initialized");
        return;
    }
    
    const map = mapState.map;
    
    // Update road layer visibility
    toggleLayerVisibility(map, mapState.roadLayer, vizState.activeDataLayers.roadNetwork);
    
    // Update counter layer visibility
    toggleLayerVisibility(map, mapState.counterLayer, vizState.activeDataLayers.counterPoints);
    
    // Update neighborhood layer visibility
    toggleLayerVisibility(map, mapState.neighborhoodLayer, vizState.activeDataLayers.neighborhoods);
    
    // Update census layer visibility
    toggleLayerVisibility(map, mapState.censusLayer, vizState.activeDataLayers.censusData);
    
    // Update network metrics layer visibility
    toggleLayerVisibility(map, mapState.networkMetricsLayer, vizState.activeDataLayers.networkMetrics);
    
    // Hide legend when relevant layers are hidden
    if ((!vizState.activeDataLayers.censusData && !vizState.activeDataLayers.networkMetrics) && 
        vizState.legend) {
        vizState.legend.style.display = 'none';
    }
    
    console.log("Updated map layers based on current state:", vizState.activeDataLayers);
}

/**
 * Toggle layer visibility helper function
 * @param {Object} map - The Leaflet map instance
 * @param {Object} layer - The layer to toggle
 * @param {boolean} isVisible - Whether the layer should be visible
 */
function toggleLayerVisibility(map, layer, isVisible) {
    if (!map || !layer) return;
    
    const hasLayer = map.hasLayer(layer);
    
    if (isVisible && !hasLayer) {
        layer.addTo(map);
    } else if (!isVisible && hasLayer) {
        map.removeLayer(layer);
    }
}

/**
 * Display neighborhood boundaries layer
 */
function displayNeighborhoodLayer() {
    // This is just a wrapper to call the appropriate method in the map module
    if (window.mapModule && window.mapModule.addNeighborhoodLayer) {
        window.mapModule.addNeighborhoodLayer();
    } else {
        console.warn("Map module does not have addNeighborhoodLayer method");
    }
}

/**
 * Display census data layer
 * @param {string} dataType - Type of census data to display
 */
function displayCensusDataLayer(dataType) {
    // Get census data
    if (!window.dataModule) {
        console.warn("Data module not available");
        return;
    }
    
    const censusData = window.dataModule.getCensusDataForViz ? 
                      window.dataModule.getCensusDataForViz() : 
                      window.dataModule.getState().censusData;
    
    if (!censusData || !censusData.features || censusData.features.length === 0) {
        console.warn("No census data available");
        return;
    }
    
    console.log("Preparing to display census data layer:", dataType);
    console.log("Census data sample:", censusData.features[0]);
    
    try {
        // Get map state
        const mapState = window.mapModule ? window.mapModule.getState() : null;
        if (!mapState || !mapState.map) {
            console.error("Map not initialized");
            return;
        }
        
        // Clear existing census layer
        if (mapState.censusLayer) {
            mapState.map.removeLayer(mapState.censusLayer);
        }
        
        // Create new census layer - using line style instead of area style
        mapState.censusLayer = L.geoJSON(censusData, {
            style: feature => {
                const style = getCensusStyle(feature, dataType);
                return style;
            },
            onEachFeature: (feature, layer) => {
                // Add tooltip
                const props = feature.properties;
                let value = '';
                let label = '';
                
                switch(dataType) {
                    case 'population':
                        value = props.popltnE || props.POPULATION || props.populationE || 'N/A';
                        label = 'Population';
                        break;
                    case 'income':
                        value = props.mdn_ncE || props.MEDIAN_INCOME || props.median_incomeE || 'N/A';
                        value = value ? '$' + value.toLocaleString() : 'N/A';
                        label = 'Median Income';
                        break;
                    case 'bikeCommute':
                        value = props.cmmt_bE || props.BIKE_COMMUTE || props.commute_bicycleE || 'N/A';
                        value = value ? value + '%' : 'N/A';
                        label = 'Bike Commute';
                        break;
                    case 'education':
                        value = props.ed_bc_E || props.EDUCATION || props.edu_bachelors_plusE || 'N/A';
                        value = value ? value + '%' : 'N/A';
                        label = 'Bachelor\'s Degree or Higher';
                        break;
                    case 'whitePercentage':
                        value = props.pct_white;
                        value = value ? value.toFixed(1) + '%' : 'N/A';
                        label = 'White Population %';
                        break;
                    case 'rent':
                        value = props.rnt_prE || props.RENT_PRICE || props.rent_percentE || 'N/A';
                        value = value ? '$' + value.toLocaleString() : 'N/A';
                        label = 'Median Rent';
                        break;
                    default:
                        value = 'N/A';
                        label = 'Value';
                }
                
                // Add interactive tooltip
                const tooltipContent = `
                    <div class="census-tooltip">
                        <div class="tooltip-title">Census Data</div>
                        <div class="tooltip-data">
                            <strong>${label}:</strong> ${value}
                        </div>
                        <div class="tooltip-data">
                            <strong>GEOID:</strong> ${props.GEOID || 'N/A'}
                        </div>
                    </div>
                `;
                
                layer.bindTooltip(tooltipContent, {
                    sticky: true,
                    opacity: 0.9
                });
                
                // Add click handler
                layer.on('click', function() {
                    // Show more detailed information about this area
                    showCensusDetail(feature, dataType);
                });
            },
            // Use special style for lines
            className: 'leaflet-census-line'
        }).addTo(mapState.map);
        
        // Update legend
        updateLegend(dataType);
        
        // Ensure layer is on top
        mapState.censusLayer.bringToFront();
        
        console.log("Census data layer displayed successfully");
    } catch (error) {
        console.error("Error displaying census data layer:", error);
        showError("Failed to display census data: " + error.message);
    }
}

/**
 * Get neighborhood name from properties
 * @param {Object} props - The feature properties
 * @returns {string} The neighborhood name
 */
function getNeighborhoodName(props) {
    return props.DC_HPN_NAME || props.NAME || props.NEIGHBORHOOD || "Unknown Area";
}

/**
 * Show detailed census information
 * @param {Object} feature - The GeoJSON feature
 * @param {string} dataType - The type of census data
 */
function showCensusDetail(feature, dataType) {
    const props = feature.properties;
    const neighborhoodName = getNeighborhoodName(props);
    
    // Create popup content with more detailed information
    let content = `
        <div class="census-detail-popup">
            <h3>${neighborhoodName}</h3>
            <div class="census-data-table">
    `;
    
// Add relevant data rows
const dataPoints = [
    { label: "Population", value: props.popltnE || props.POPULATION || props.populationE || 'N/A', formatter: val => val.toLocaleString() },
    { label: "Median Income", value: props.mdn_ncE || props.MEDIAN_INCOME || props.median_incomeE || 'N/A', formatter: val => '$' + val.toLocaleString() },
    { label: "Bike Commute %", value: props.cmmt_bE || props.BIKE_COMMUTE || props.commute_bicycleE || 'N/A', formatter: val => val + '%' },
    { label: "Education (Bachelor's+)", value: props.ed_bc_E || props.EDUCATION || props.edu_bachelors_plusE || 'N/A', formatter: val => val + '%' },
    { label: "Median Rent", value: props.rnt_prE || props.RENT_PRICE || props.rent_percentE || 'N/A', formatter: val => '$' + val.toLocaleString() },
    { label: "Median Age", value: props.medn_gE || props.MEDIAN_AGE || props.median_ageE || 'N/A', formatter: val => val }
];

// Add rows to table
dataPoints.forEach(point => {
    if (point.value !== 'N/A') {
        let formattedValue = point.value;
        try {
            formattedValue = point.formatter(point.value);
        } catch (error) {
            console.warn("Error formatting value:", error);
        }
        
        // Highlight the current data type
        const isHighlighted = (
            (dataType === 'population' && point.label === 'Population') ||
            (dataType === 'income' && point.label === 'Median Income') ||
            (dataType === 'bikeCommute' && point.label === 'Bike Commute %') ||
            (dataType === 'education' && point.label === 'Education (Bachelor\'s+)') ||
            (dataType === 'rent' && point.label === 'Median Rent')
        );
        
        content += `
            <div class="data-row ${isHighlighted ? 'highlighted' : ''}">
                <div class="data-label">${point.label}:</div>
                <div class="data-value">${formattedValue}</div>
            </div>
        `;
    }
});

content += `
        </div>
    </div>
`;

// Show popup on map
const mapState = window.mapModule ? window.mapModule.getState() : null;
if (mapState && mapState.map) {
    // Get center of the feature for the popup
    const bounds = L.geoJSON(feature).getBounds();
    const center = bounds.getCenter();
    
    // Create popup
    L.popup()
        .setLatLng(center)
        .setContent(content)
        .openOn(mapState.map);
}
}

/**
* Get style for census feature based on data type
* @param {Object} feature - The GeoJSON feature
* @param {string} dataType - The type of census data
* @returns {Object} The style object for Leaflet
*/
function getCensusStyle(feature, dataType) {
    const props = feature.properties;
    let value = 0;
    let colorScale = [];

    // Get the appropriate value and color scale, supporting multiple possible field names
    switch(dataType) {
        case 'population':
            value = props.popltnE || props.POPULATION || props.populationE || 0;
            colorScale = vizState.colorScales.population;
            break;
        case 'income':
            value = props.mdn_ncE || props.MEDIAN_INCOME || props.median_incomeE || 0;
            colorScale = vizState.colorScales.income;
            break;
        case 'bikeCommute':
            value = props.cmmt_bE || props.BIKE_COMMUTE || props.commute_bicycleE || 0;
            colorScale = vizState.colorScales.bikeCommute;
            break;
        case 'education':
            value = props.ed_bc_E || props.EDUCATION || props.edu_bachelors_plusE || 0;
            colorScale = vizState.colorScales.education;
            break;
        case 'whitePercentage':
            value = props.pct_white || 0;
            colorScale = vizState.colorScales.education; // 先复用教育层级的配色
            break;            
        case 'rent':
            value = props.rnt_prE || props.RENT_PRICE || props.rent_percentE || 0;
            colorScale = vizState.colorScales.income;
            break;
        default:
            colorScale = vizState.colorScales.population;
    }

    // Get color based on value
    const color = getColorForValue(value, dataType, colorScale);

    // Return line style, not area style
    return {
        color: color,
        weight: 6,     // Increase line width
        opacity: 0.9,  // Slightly reduce opacity to make overlapping areas visible
        lineCap: 'round',
        lineJoin: 'round'
    };
}

/**
* Get color for value based on data type and scale
* @param {number} value - The value
* @param {string} dataType - The type of data
* @param {Array} colorScale - The color scale to use
* @returns {string} The color code
*/
function getColorForValue(value, dataType, colorScale) {
    if (dataType === 'whitePercentage') {
        if (value >= 80) return colorScale[4];
        if (value >= 60) return colorScale[3];
        if (value >= 40) return colorScale[2];
        if (value >= 20) return colorScale[1];
        return colorScale[0];
    }

    // 其他类型默认逻辑
    let range = 5;
    let max = 1;

    switch(dataType) {
        case 'population':
            range = 2000;
            max = 10000;
            break;
        case 'income':
            range = 40000;
            max = 200000;
            break;
        case 'bikeCommute':
            range = 2;
            max = 10;
            break;
        case 'education':
            range = 20;
            max = 100;
            break;
        case 'rent':
            range = 600;
            max = 3000;
            break;
    }

    const normalizedValue = Math.min(value, max * 1.2);
    const index = Math.floor((normalizedValue / max) * (colorScale.length - 1));
    return colorScale[Math.min(Math.max(index, 0), colorScale.length - 1)];
}


/**
* Display network metrics layer
* @param {string} metricType - Type of network metric to display
*/
function displayNetworkMetricsLayer(metricType) {
    console.log("Preparing to display network metrics layer:", metricType);

    // Get road network data
    if (!window.dataModule) {
        console.warn("Data module not available");
        return;
    }

    const roadData = window.dataModule.getNetworkMetricsForViz ? 
                    window.dataModule.getNetworkMetricsForViz() : 
                    window.dataModule.getState().roadNetworkData;

    if (!roadData || !roadData.features || roadData.features.length === 0) {
        console.warn("No road network data available");
        return;
    }

    console.log("Network data sample:", roadData.features[0]);

    try {
        // Get map state
        const mapState = window.mapModule ? window.mapModule.getState() : null;
        if (!mapState || !mapState.map) {
            console.error("Map not initialized");
            return;
        }
        
        // Clear existing network metrics layer
        if (mapState.networkMetricsLayer) {
            mapState.map.removeLayer(mapState.networkMetricsLayer);
        }
        
        // Create new network metrics layer
        mapState.networkMetricsLayer = L.geoJSON(roadData, {
            style: feature => {
                const style = getNetworkMetricStyle(feature, metricType);
                return style;
            },
            onEachFeature: (feature, layer) => {
                // Add tooltip
                const props = feature.properties;
                let value = '';
                let label = '';
                let streetName = props.STREETNAME || props.FULLNAME || props.ROUTENAME || 'Unnamed Road';
                
                switch(metricType) {
                    case 'connectivity':
                        value = props.DEGREE || props.degree_max || 0;
                        label = 'Connectivity';
                        break;
                    case 'betweenness':
                        value = props.BETWEEN || props.betweenness_max || 0;
                        label = 'Betweenness Centrality';
                        break;
                    case 'closeness':
                        value = props.CLOSENESS || props.closeness_max || 0;
                        value = value ? value.toFixed(3) : 0;
                        label = 'Closeness Centrality';
                        break;
                    case 'bikeLanes':
                        value = props.BIKE_FT || props.bike_facility_type || 'None';
                        label = 'Bike Lane Type';
                        break;
                    default:
                        value = 'N/A';
                        label = 'Value';
                }
                
                // Add enhanced tooltip
                const tooltipContent = `
                    <div class="network-tooltip">
                        <div class="tooltip-title">${streetName}</div>
                        <div class="tooltip-data">
                            <strong>${label}:</strong> ${value}
                        </div>
                        ${metricType !== 'bikeLanes' ? `
                        <div class="tooltip-data">
                            <strong>Bike Lane Type:</strong> ${props.BIKE_FT || props.bike_facility_type || 'None'}
                        </div>` : ''}
                        ${props.SEG_LEN || props.segment_length ? `
                        <div class="tooltip-data">
                            <strong>Length:</strong> ${((props.SEG_LEN || props.segment_length) * 0.000621371).toFixed(2)} miles
                        </div>` : ''}
                    </div>
                `;
                
                layer.bindTooltip(tooltipContent, {
                    sticky: true,
                    opacity: 0.9
                });
                
                // Add click handler
                layer.on('click', function() {
                    if (window.mapModule && window.mapModule.selectSegment) {
                        window.mapModule.selectSegment(feature);
                    } else {
                        // Fallback detailed display
                        showNetworkSegmentDetail(feature, metricType);
                    }
                });
            },
            // Add class name for CSS selector to apply styles
            className: 'leaflet-network-line'
        }).addTo(mapState.map);
        
        // Update legend
        updateLegend(metricType);
        
        // Ensure layer is on top
        mapState.networkMetricsLayer.bringToFront();
        
        console.log("Network metrics layer displayed successfully");
    } catch (error) {
        console.error("Error displaying network metrics layer:", error);
        showError("Failed to display network metrics: " + error.message);
    }
}

/**
* Show detailed network segment information
* @param {Object} feature - The GeoJSON feature
* @param {string} metricType - The type of network metric
*/
function showNetworkSegmentDetail(feature, metricType) {
    const props = feature.properties;
    const streetName = props.STREETNAME ||props.FULLNAME || props.ROUTENAME || props.road_class || 'Unnamed Street';

    // Create popup content with more detailed information
    let content = `
        <div class="network-detail-popup">
            <h3>${streetName}</h3>
            <div class="network-data-table">
    `;
// Add relevant data rows
const dataPoints = [
    { label: "Road Class", value: props.RD_CLASS || props.road_class || 'N/A' },
    { label: "Bike Lane Type", value: props.BIKE_FT || props.bike_facility_type || 'None' },
    { label: "Length", value: props.SEG_LEN || props.segment_length ? ((props.SEG_LEN || props.segment_length) * 0.000621371).toFixed(2) + ' miles' : 'N/A' },
    { label: "Speed Limit", value: props.SPD_LIM || props.speed_limit ? (props.SPD_LIM || props.speed_limit) + ' mph' : 'N/A' },
    { label: "Traffic Volume", value: props.AADT || props.AADT ? (props.AADT || props.AADT).toLocaleString() + ' vehicles/day' : 'N/A' },
    { label: "Connectivity", value: props.DEGREE || props.degree_max || 'N/A' },
    { label: "Betweenness", value: props.BETWEEN || props.betweenness_max || 'N/A' },
    { label: "Closeness", value: props.CLOSENESS || props.closeness_max ? (props.CLOSENESS || props.closeness_max).toFixed(3) : 'N/A' },
    { label: "Bike Count", value: props.predicted ? Math.round(props.predicted) + ' (predicted)' : 'N/A' }
];

// Add rows to table
dataPoints.forEach(point => {
    if (point.value !== 'N/A') {
        // Highlight the current metric type
        const isHighlighted = (
            (metricType === 'connectivity' && point.label === 'Connectivity') ||
            (metricType === 'betweenness' && point.label === 'Betweenness') ||
            (metricType === 'closeness' && point.label === 'Closeness') ||
            (metricType === 'bikeLanes' && point.label === 'Bike Lane Type')
        );
        
        content += `
            <div class="data-row ${isHighlighted ? 'highlighted' : ''}">
                <div class="data-label">${point.label}:</div>
                <div class="data-value">${point.value}</div>
            </div>
        `;
    }
});

content += `
        </div>
        <div class="segment-actions">
            <button class="view-details-btn">View Full Details</button>
        </div>
    </div>
`;

// Show popup on map
const mapState = window.mapModule ? window.mapModule.getState() : null;
if (mapState && mapState.map) {
    // Get center of the feature for the popup
    const bounds = L.geoJSON(feature).getBounds();
    const center = bounds.getCenter();
    
    // Create popup
    const popup = L.popup()
        .setLatLng(center)
        .setContent(content)
        .openOn(mapState.map);
    
    // Add event listener to view details button
    setTimeout(() => {
        const detailsBtn = document.querySelector('.view-details-btn');
        if (detailsBtn) {
            detailsBtn.addEventListener('click', function() {
                // Close popup
                mapState.map.closePopup(popup);
                
                // Call select segment if available
                if (window.mapModule && window.mapModule.selectSegment) {
                    window.mapModule.selectSegment(feature);
                }
            });
        }
    }, 100);
}
}

/**
* Get style for network feature based on metric type
* @param {Object} feature - The GeoJSON feature
* @param {string} metricType - The type of network metric
* @returns {Object} The style object for Leaflet
*/
function getNetworkMetricStyle(feature, metricType) {
const props = feature.properties;
let color = '#333'; // Use deeper default color
let weight = 6;     // Increase default line width

// Get color based on metric type
switch(metricType) {
    case 'connectivity':
        const degree = props.DEGREE || props.degree_max || 0;
        color = getNetworkMetricColor(degree, 0, 4, vizState.colorScales.connectivity);
        // Adjust width based on connectivity
        weight = 4 + Math.min(degree, 4);
        break;
    case 'betweenness':
        const betweenness = props.BETWEEN || props.betweenness_max || 0;
        color = getNetworkMetricColor(betweenness, 0, 10, vizState.colorScales.connectivity);
        // Adjust width based on centrality
        weight = 4 + Math.min(Math.floor(betweenness / 2), 4);
        break;
    case 'closeness':
        const closeness = props.CLOSENESS || props.closeness_max || 0;
        color = getNetworkMetricColor(closeness, 0, 1, vizState.colorScales.connectivity);
        weight = 5; // Fixed thicker width
        break;
    case 'bikeLanes':
        const bikeType = props.BIKE_FT || props.bike_facility_type || 'None';
        // Ensure bike lane type matches color scale
        const normalizedBikeType = normalizeBikeLaneType(bikeType);
        color = vizState.colorScales.bikeLaneType[normalizedBikeType] || vizState.colorScales.bikeLaneType['Unknown'];
        // Bike lane lines thicker
        if (normalizedBikeType === 'Protected') {
            weight = 8;
        } else if (normalizedBikeType === 'Buffered' || normalizedBikeType === 'Conventional') {
            weight = 7;
        } else {
            weight = 6;
        }
        break;
}

// Return with high opacity
return {
    color: color,
    weight: weight,
    opacity: Math.min(vizState.networkOpacity + 0.1, 1.0), // Increase opacity
    lineCap: 'round',
    lineJoin: 'round'
};
}

/**
* Helper function: normalize bike lane type
* @param {string} bikeType - Original bike lane type
* @returns {string} Normalized bike lane type
*/
function normalizeBikeLaneType(bikeType) {
if (!bikeType) return 'None';

// Map various possible bike lane type names to standard types
const bikeTypeStr = bikeType.toString().toLowerCase();
if (bikeTypeStr.includes('protect')) return 'Protected';
if (bikeTypeStr.includes('buffer')) return 'Buffered';
if (bikeTypeStr.includes('convention')) return 'Conventional';
if (bikeTypeStr.includes('sharrow')) return 'Sharrow';
if (bikeTypeStr === 'none' || bikeTypeStr === 'na' || bikeTypeStr === '') return 'None';

return 'Unknown';
}

/**
* Get color for network metric value
* @param {number} value - The metric value
* @param {number} min - The minimum value of the range
* @param {number} max - The maximum value of the range
* @param {Array} colorScale - The color scale to use
* @returns {string} The color code
*/
function getNetworkMetricColor(value, min, max, colorScale) {
// Improved color calculation - adjust range for better color distribution
const adjustedMax = max * 0.8; // Adjusted maximum value to make colors more prominent
const normalized = Math.max(0, Math.min(1, (value - min) / (adjustedMax - min)));

// Map to color scale index
const index = Math.floor(normalized * (colorScale.length - 1));
return colorScale[Math.max(0, Math.min(index, colorScale.length - 1))];
}

/**
* Add the visualization module to the window object
*/
window.mapVisualization = {
initVisualization,
displayCensusDataLayer,
displayNetworkMetricsLayer,
displayNeighborhoodLayer,
updateLegend,
updateMapLayers,
getState: () => vizState
};
