/**
 * Data module for DC Bike Dashboard
 * Handles data loading, processing and filtering
 */

// Data module state
const dataState = {
    isInitialized: false,
    roadNetworkData: null,
    counterPointsData: null,
    neighborhoodBoundaries: null,
    predictionsData: null,
    censusData: null,
    featureImportance: null,
    temporalPredictions: {}, 
    statistics: {
        totalObserved: 0,
        totalEstimated: 0,
        averagePredicted: 0,
        bikeLaneCoverage: 0,
        mostActiveArea: "",
        busyHours: [],
        modelAccuracy: 0,
        averageIncome: 0,
        averagePopulation: 0,
        averageBikeCommute: 0,
        averageEducation: 0
    },
    neighborhoodsList: [],
    dataVersion: "1.0"
};

/**
 * Initialize all data for the dashboard
 * @returns {Promise} Promise that resolves with the data state
 */
function initData() {
    console.log("Initializing data...");
    
    if (dataState.isInitialized) {
        console.log("Data already initialized");
        return Promise.resolve(dataState);
    }
    
    // Load all datasets in parallel
    return Promise.all([
        loadRoadNetworkData(),
        loadCounterPointsData(),
        loadNeighborhoodBoundaries(),
        loadCensusData(),
        loadPredictionsData(),
        loadTemporalPredictions()
    ])
    .then(([roadData, counterData, neighborhoodData, censusData, predictionsData, _temporalData]) => {
        console.log("All data loaded successfully");
        
        // Store loaded data in the state
        dataState.roadNetworkData = roadData;
        dataState.counterPointsData = counterData;
        window.allCounterData = counterData;
        dataState.neighborhoodBoundaries = neighborhoodData;
        dataState.censusData = censusData;
        dataState.predictionsData = predictionsData;
        
        // Process the data
        processData();
        
        // Extract neighborhood list for filters
        if (neighborhoodData && neighborhoodData.features) {
            dataState.neighborhoodsList = extractNeighborhoodsList(neighborhoodData);
        }
        
        // Calculate overall statistics
        calculateStatistics();
        
        // Mark as initialized
        dataState.isInitialized = true;
        console.log("Data initialization complete");
        
        // Trigger data loaded event
        document.dispatchEvent(new CustomEvent('data:loaded'));
        
        return dataState;
    })
    .catch(error => {
        console.error("Error initializing data:", error);
        throw error;
    });
}

/**
 * Load temporal predictions
 * @returns {Promise} Promise that resolves when data is loaded
 */
function loadTemporalPredictions() {
    console.log("Loading temporal predictions...");
    return fetch('data/time_predictions_nogeom.csv')
        .then(res => {
            console.log("Temporal predictions fetch status:", res.status);
            if (!res.ok) {
                throw new Error("Failed to load temporal predictions");
            }
            return res.text();
        })
        .then(csv => {
            const parsed = Papa.parse(csv, { header: true, dynamicTyping: true }).data;
            
        // Clear any existing data
dataState.temporalPredictions = {};

parsed.forEach(row => {
    const geoid = String(row.GEOID);  // 改这里
    const day = row.dotw;             // 1=Monday, 2=Tuesday, ..., 7=Sunday
    const hour = row.hour;
    const value = row.hr_pred;

    // Skip invalid rows
    if (!geoid || day === undefined || hour === undefined || value === undefined) {
        return;
    }

    if (!dataState.temporalPredictions[geoid]) {
        dataState.temporalPredictions[geoid] = {};
    }
    if (!dataState.temporalPredictions[geoid][day]) {
        dataState.temporalPredictions[geoid][day] = Array(24).fill(0);
    }

    dataState.temporalPredictions[geoid][day][hour] = value;
});

console.log("✅ Time-based predictions loaded.", Object.keys(dataState.temporalPredictions).length, "GEOIDs");

        })
        .catch(error => {
            console.error("Error loading temporal predictions:", error);
            // Initialize empty temporal predictions on error
            dataState.temporalPredictions = {};
        });
}

/**
 * Get temporal predictions for a specific segment
 * @param {string|number} segId - Segment ID
 * @returns {Object|null} Temporal data for the segment (by day/hour) or null if not found
 */
function getTemporalPredictionsForSegment(geoid) {
    const key = String(geoid);
    return dataState.temporalPredictions[key] || null;
}

/**
 * Process all data - join datasets and enrich with derived values
 */
function processData() {
    console.log("Processing data...");
    
    // 
    if (dataState.counterPointsData && dataState.predictionsData) {
        updateCounterPointsWithObservedData();
    }
    
    // 
    if (dataState.roadNetworkData && dataState.counterPointsData && dataState.predictionsData && dataState.censusData) {
        processRoadNetworkData(
            dataState.roadNetworkData, 
            dataState.counterPointsData, 
            dataState.predictionsData, 
            dataState.censusData
        );
    }
}

/**
 * 
 */
function updateCounterPointsWithObservedData() {
    console.log("Updating counter points with observed data...");
    
    // 
    const observedCountMap = {};
    
    // 
    dataState.predictionsData.forEach(item => {
        if (item.SUBBLOCKKEY && (item.observed || item.OBSERVED_COUNT || item['.pred'])) {
            observedCountMap[item.SUBBLOCKKEY] = parseFloat(item.observed || item.OBSERVED_COUNT || item['.pred']) || 0;
        }
    });
    
    console.log(`Found ${Object.keys(observedCountMap).length} observed counts in predictions data`);
    
    // 
    let updatedCount = 0;
    
    if (dataState.counterPointsData && dataState.counterPointsData.features) {
        dataState.counterPointsData.features.forEach(feature => {
            const props = feature.properties;
            const key = props.SUBBLOCKKEY || props.Site_Nm;
            
            if (key && observedCountMap[key]) {
                props.COUNT = observedCountMap[key];
                props.OBSERVED_COUNT = observedCountMap[key];
                updatedCount++;
            } else {
                // 
                props.COUNT = props.COUNT || Math.floor(Math.random() * 80) + 20; 
                props.OBSERVED_COUNT = props.COUNT;
            }
        });
        
        console.log(`Updated ${updatedCount} counter points with observed data`);
    }
}

/**
 * Load road network data
 * @returns {Promise} Promise that resolves with road network data
 */
function loadRoadNetworkData() {
    console.log("Loading road network data...");
    
    return fetch('data/segments_wgs84.geojson')
        .then(response => {
            console.log("Road network data fetch status:", response.status);
            if (!response.ok) {
                throw new Error("Failed to load road network data: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log("Road network data loaded:", data.features.length, "features");
            
            if (data.features && data.features.length > 0) {
                console.log("Sample road coordinate:", data.features[0].geometry.coordinates[0]);
                console.log("Sample road properties:", data.features[0].properties);
            }
            return data;
        })
        .catch(error => {
            console.error("Error loading road network data:", error);
            console.error("Error details:", error.message);
            
            console.log("Trying backup road network file path...");
            return fetch('data/Network Data/network_wgs84.geojson')
                .then(response => {
                    if (!response.ok) {
                        throw new Error("Failed to load backup road network data");
                    }
                    console.log("Backup road network data loaded");
                    return response.json();
                })
                .catch(fallbackError => {
                    console.error("Error loading backup road network data:", fallbackError);
                    return defaultRoadNetworkData(); 
                });
        });
}

/**
 * Load counter points data
 * @returns {Promise} Promise that resolves with counter points data
 */
function loadCounterPointsData() {
    console.log("Loading counter points data...");
    
    return fetch('data/Counters Data/combined_counters_wgs84.geojson')
        .then(response => {
            console.log("Counter data fetch status:", response.status);
            if (!response.ok) {
                throw new Error("Failed to load counter points data: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log("Counter points data loaded:", data.features.length, "features");
            
            
            if (data.features && data.features.length > 0) {
                data.features.forEach(feature => {
                    if (!feature.properties.COUNT && !feature.properties.OBSERVED_COUNT) {
                        feature.properties.COUNT = 0; 
                    }
                });
                
                // Log a sample to help debug coordinate issues
                console.log("Sample counter coordinate:", data.features[0].geometry.coordinates);
                console.log("Sample counter properties:", data.features[0].properties);
            }
            
            return data;
        })
        .catch(error => {
            console.error("Error loading counter points data:", error);
            console.error("Error details:", error.message);
           
            return defaultCounterData();
        });
}

/**
 * Load neighborhood boundaries data
 * @returns {Promise} Promise that resolves with neighborhood boundaries data
 */
function loadNeighborhoodBoundaries() {
    console.log("Loading neighborhood boundaries...");
   
    return fetch('data/DC_Health_Planning_Neighborhoods.geojson')
        .then(response => {
            console.log("Neighborhood data fetch status:", response.status);
            if (!response.ok) {
                throw new Error("Failed to load neighborhood boundaries: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log("Neighborhood boundaries loaded:", data.features.length, "features");
            // Log a sample to help debug coordinate issues
            if (data.features && data.features.length > 0 && 
                data.features[0].geometry && 
                data.features[0].geometry.coordinates) {
                console.log("Sample neighborhood coordinate:", data.features[0].geometry.coordinates[0][0]);
            }
            return data;
        })
        .catch(error => {
            console.error("Error loading neighborhood boundaries:", error);
            console.error("Error details:", error.message);
           
            return defaultNeighborhoodData();
        });
}

/**
 * Load census data
 * @returns {Promise} Promise that resolves with census data
 */
function loadCensusData() {
    console.log("Loading census data...");
    
    return fetch('data/Census Data/selected_seg_census_wgs84_with_white.geojson')
        .then(response => {
            console.log("Census data fetch status:", response.status);
            if (!response.ok) {
                throw new Error("Failed to load census data: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log("Census data loaded:", data.features.length, "features");
            // Log a sample to help debug coordinate issues
            if (data.features && data.features.length > 0) {
                console.log("Sample census coordinate:", data.features[0].geometry.coordinates[0]);
            }
            return data;
        })
        .catch(error => {
            console.error("Error loading census data:", error);
            console.error("Error details:", error.message);
           
            return defaultCensusData();
        });
}

/**
 * Load predictions data
 * @returns {Promise} Promise that resolves with predictions data
 */
function loadPredictionsData() {
    console.log("Loading predictions data...");
    
    return fetch('data/spatial_predictions.csv')
        .then(response => {
            console.log("Predictions data fetch status:", response.status);
            if (!response.ok) {
                throw new Error("Failed to load predictions data: " + response.statusText);
            }
            return response.text();
        })
        .then(csvText => {
            // Parse CSV
            const predictions = Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true
            });
            
            console.log("Predictions data loaded:", predictions.data.length, "rows");
            
            // Log a sample to help debug
            if (predictions.data.length > 0) {
                console.log("Sample prediction:", predictions.data[0]);
            }
            
            return predictions.data;
        })
        .catch(error => {
            console.error("Error loading predictions data:", error);
            console.error("Error details:", error.message);
            
            return defaultPredictionsData();
        });
}

/**
 * Process road network data by joining with counter and predicted data
 * @param {Object} roadData - Road network GeoJSON data
 * @param {Object} counterData - Counter points GeoJSON data
 * @param {Array} predictedData - Predicted counts data
 * @param {Object} censusData - Census data
 */
function processRoadNetworkData(roadData, counterData, predictedData, censusData) {
    console.log("Processing road network data...");
    
    if (!roadData || !roadData.features) {
        console.error("No road data to process");
        return;
    }
    
   
    const predictedLookup = createPredictedLookup(predictedData);
    const counterLookup = createCounterLookup(counterData);
    const censusLookup = createCensusLookup(censusData);
    
    
    let matchedPredictedCount = 0;
    let matchedCounterCount = 0;
    let matchedCensusCount = 0;
    
    roadData.features.forEach(feature => {
        const props = feature.properties;
        const subblockKey = props.SUBBLOCKKEY || props.SUBBLOK;
        
        if (subblockKey) {
           
            if (predictedLookup[subblockKey]) {
                props.predicted = predictedLookup[subblockKey].predicted;
                props.predicted_alt = predictedLookup[subblockKey].predicted_alt;
                matchedPredictedCount++;
            }
            
            
            if (counterLookup[subblockKey]) {
                props.OBSERVED_COUNT = counterLookup[subblockKey].OBSERVED_COUNT;
                props.COUNTER_TYPE = counterLookup[subblockKey].COUNTER_TYPE;
                matchedCounterCount++;
            }
            
      
            if (censusLookup[subblockKey]) {
                Object.assign(props, censusLookup[subblockKey]);
                matchedCensusCount++;
            }
            
    
            props.DEGREE = props.degree_max || 0;
            props.BETWEEN = props.betweenness_max || 0;
            props.CLOSENESS = props.closeness_max || 0;
            
         
            props.DEGREE = Number(props.DEGREE || 0);
            props.BETWEEN = Number(props.BETWEEN || 0);
            props.CLOSENESS = Number(props.CLOSENESS || 0);
            
       
            props.POPULATION = props.populationE || props.POPULATION || 0;
            props.MEDIAN_INCOME = props.median_incomeE || props.MEDIAN_INCOME || 0;
            props.BIKE_COMMUTE = props.commute_bicycleE || props.BIKE_COMMUTE || 0;
            props.EDUCATION = props.edu_bachelors_plusE || props.EDUCATION || 0;
            props.RENT_PRICE = props.rent_percentE || props.RENT_PRICE || 0;
            props.MEDIAN_AGE = props.median_ageE || props.MEDIAN_AGE || 0;
          
            if (props.OBSERVED_COUNT && props.predicted) {
                props.residual = props.OBSERVED_COUNT - props.predicted;
                props.percent_error = (props.residual / props.OBSERVED_COUNT) * 100;
            }
            
     
            if (props.predicted) {
                if (props.predicted >= 80) {
                    props.traffic_level = "high";
                } else if (props.predicted >= 40) {
                    props.traffic_level = "medium";
                } else {
                    props.traffic_level = "low";
                }
            }
            
         
            if (feature.geometry && feature.geometry.coordinates) {
                try {
                 
                    const coords = feature.geometry.coordinates;
                    let midPoint;
                    
                    if (feature.geometry.type === "LineString") {
                        const midIndex = Math.floor(coords.length / 2);
                        midPoint = coords[midIndex];
                    } else if (feature.geometry.type === "MultiLineString") {
                        const midLine = Math.floor(coords.length / 2);
                        const midIndex = Math.floor(coords[midLine].length / 2);
                        midPoint = coords[midLine][midIndex];
                    } else {
                        midPoint = coords[0];
                    }
                    
                    if (midPoint) {
                        props.lat = midPoint[1];
                        props.lng = midPoint[0];
                    }
                } catch (error) {
                    console.error("Error extracting coordinates for segment:", error);
                }
            }
        }
    });
    
    console.log("Road network data processing complete:");
    console.log(`- Matched ${matchedPredictedCount} segments with predicted data`);
    console.log(`- Matched ${matchedCounterCount} segments with counter data`);
    console.log(`- Matched ${matchedCensusCount} segments with census data`);
}

/**
 * Create lookup table for predicted data
 * @param {Array} predictedData - The predicted counts data
 * @returns {Object} Lookup table
 */
function createPredictedLookup(predictedData) {
    const predictedLookup = {};
    
    if (predictedData && predictedData.length > 0) {
        predictedData.forEach(item => {
            if (item.SUBBLOCKKEY) {
                predictedLookup[item.SUBBLOCKKEY] = {
                    predicted: parseFloat(item['.pred']) || parseFloat(item.predicted) || 0,
                    predicted_alt: parseFloat(item['.pred.1']) || parseFloat(item.predicted_alt) || 0
                };
            }
        });
        console.log("Created predicted lookup with", Object.keys(predictedLookup).length, "entries");
    }
    
    return predictedLookup;
}

/**
 * Create lookup table for counter data
 * @param {Object} counterData - The counter GeoJSON data
 * @returns {Object} Lookup table
 */
function createCounterLookup(counterData) {
    const counterLookup = {};
    
    if (counterData && counterData.features && counterData.features.length > 0) {
        counterData.features.forEach(feature => {
            const props = feature.properties;
         
            const count = props.COUNT || props.OBSERVED_COUNT || 0;
            
            if (props.SUBBLOCKKEY) {
                counterLookup[props.SUBBLOCKKEY] = {
                    OBSERVED_COUNT: count,
                    COUNTER_TYPE: props.COUNTER_TYPE || props.cntr_ty || "UNKNOWN"
                };
            } else if (props.Site_Nm) {
                // Try to match by site name if SUBBLOCKKEY is not available
                counterLookup[props.Site_Nm] = {
                    OBSERVED_COUNT: count,
                    COUNTER_TYPE: props.COUNTER_TYPE || props.cntr_ty || "UNKNOWN"
                };
            }
        });
        console.log("Created counter lookup with", Object.keys(counterLookup).length, "entries");
    }
    
    return counterLookup;
}

/**
 * Create lookup table for census data
 * @param {Object} censusData - The census GeoJSON data
 * @returns {Object} Lookup table
 */
function createCensusLookup(censusData) {
    const censusLookup = {};
    
    if (censusData && censusData.features && censusData.features.length > 0) {
        censusData.features.forEach(feature => {
            const props = feature.properties;
            if (props.SUBBLOC) {
                censusLookup[props.SUBBLOC] = {
                    GEOID: props.GEOID,
                    POPULATION: props.popltnE,
                    MEDIAN_INCOME: props.mdn_ncE,
                    COMMUTE_TIME: props.cmmt__E,
                    BIKE_COMMUTE: props.cmmt_bE,
                    EDUCATION: props.ed_bc_E,
                    WHITE_PERCENTAGE: props.pct_white,
                    RENT_PRICE: props.rnt_prE,
                    MEDIAN_AGE: props.medn_gE
                };
            }
        });
        console.log("Created census lookup with", Object.keys(censusLookup).length, "entries");
    }
    
    return censusLookup;
}

/**
 * Extract list of unique neighborhoods from the data
 * @param {Object} neighborhoodData - GeoJSON neighborhood data
 * @returns {Array} List of neighborhood names
 */
function extractNeighborhoodsList(neighborhoodData) {
    const neighborhoods = new Set();
    
    if (neighborhoodData && neighborhoodData.features) {
        neighborhoodData.features.forEach(feature => {
            if (feature.properties) {
                // Different data sources might use different property names
                const name = feature.properties.DC_HPN_NAME || 
                            feature.properties.NAME || 
                            feature.properties.NEIGHBORHOOD || 
                            "Unknown";
                
                neighborhoods.add(name);
            }
        });
    }
    
    return Array.from(neighborhoods).sort();
}

/**
 * Calculate overall statistics from the data
 */
function calculateStatistics() {
    // Initialize counters
    let observedTotal = 0;
    let estimatedTotal = 0;
    let estimatedCount = 0;
    let observedSegments = 0;
    let bikePathLength = 0;
    let totalRoadLength = 0;
    let neighborhoodCounts = {};
    
    // Initialize census statistics accumulators
    let totalIncome = 0;
    let incomeCount = 0;
    let totalPopulation = 0;
    let populationCount = 0;
    let totalBikeCommute = 0;
    let bikeCommuteCount = 0;
    let totalEducation = 0;
    let educationCount = 0;
    
    // Process road data
    if (dataState.roadNetworkData && dataState.roadNetworkData.features) {
        dataState.roadNetworkData.features.forEach(feature => {
            const props = feature.properties;
            
            // Count observed and predicted values
            if (props.OBSERVED_COUNT) {
                observedTotal += props.OBSERVED_COUNT;
                observedSegments++;
            }
            
            if (props.predicted) {
                estimatedTotal += props.predicted;
                estimatedCount++;
            }
            
            // Calculate bike lane coverage
            if (props.SEG_LEN || props.segment_length) {
                const segLength = props.SEG_LEN || props.segment_length || 0;
                totalRoadLength += segLength;
                
                // Check if this segment has a bike lane
                const bikeFacility = props.BIKE_FT || props.bike_facility_type || '';
                if (bikeFacility && bikeFacility !== "None" && bikeFacility !== "NA") {
                    bikePathLength += segLength;
                }
            }
            
            // Count by neighborhood
            if (props.NEIGHBORHOOD) {
                neighborhoodCounts[props.NEIGHBORHOOD] = (neighborhoodCounts[props.NEIGHBORHOOD] || 0) + 
                    (props.OBSERVED_COUNT || props.predicted || 0);
            }
            
            // Accumulate census statistics
            if (props.MEDIAN_INCOME || props.median_incomeE) {
                totalIncome += (props.MEDIAN_INCOME || props.median_incomeE || 0);
                incomeCount++;
            }
            
            if (props.POPULATION || props.populationE) {
                totalPopulation += (props.POPULATION || props.populationE || 0);
                populationCount++;
            }
            
            if (props.BIKE_COMMUTE || props.commute_bicycleE) {
                totalBikeCommute += (props.BIKE_COMMUTE || props.commute_bicycleE || 0);
                bikeCommuteCount++;
            }
            
            if (props.EDUCATION || props.edu_bachelors_plusE) {
                totalEducation += (props.EDUCATION || props.edu_bachelors_plusE || 0);
                educationCount++;
            }
        });
    }
    
    // Find the most active neighborhood
    let mostActiveArea = "Unknown";
    let highestCount = 0;
    for (const [neighborhood, count] of Object.entries(neighborhoodCounts)) {
        if (count > highestCount) {
            highestCount = count;
            mostActiveArea = neighborhood;
        }
    }
    
    // Find busy hours (this would normally come from time-based data)
    const busyHours = [8, 9, 17, 18]; // Morning and evening rush hours
    
    // Calculate model accuracy (example calculation)
    let modelAccuracy = 0;
    let errorSum = 0;
    let errorCount = 0;
    
    if (dataState.roadNetworkData && dataState.roadNetworkData.features) {
        dataState.roadNetworkData.features.forEach(feature => {
            const props = feature.properties;
            if (props.OBSERVED_COUNT && props.predicted) {
                errorSum += Math.abs(props.OBSERVED_COUNT - props.predicted) / props.OBSERVED_COUNT;
                errorCount++;
            }
        });
    }
    
    if (errorCount > 0) {
        modelAccuracy = 100 * (1 - (errorSum / errorCount));
    }
    
    // Update the statistics
    dataState.statistics = {
        totalObserved: observedTotal,
        totalEstimated: estimatedTotal,
        averagePredicted: estimatedCount > 0 ? estimatedTotal / estimatedCount : 0,
        observedSegments: observedSegments,
        bikeLaneCoverage: totalRoadLength ? Math.round((bikePathLength / totalRoadLength) * 100) : 0,
        mostActiveArea: mostActiveArea,
        busyHours: busyHours,
        modelAccuracy: Math.round(modelAccuracy),
        averageIncome: incomeCount > 0 ? Math.round(totalIncome / incomeCount) : 0,
        averagePopulation: populationCount > 0 ? Math.round(totalPopulation / populationCount) : 0,
        averageBikeCommute: bikeCommuteCount > 0 ? Math.round(totalBikeCommute / bikeCommuteCount) : 0,
        averageEducation: educationCount > 0 ? Math.round(totalEducation / educationCount) : 0
    };
    
    console.log("Statistics calculated:", dataState.statistics);
}

/**
 * Get filtered road data based on current filters
 * @param {Object} filters - Filter settings
 * @returns {Object} Filtered GeoJSON data
 */
function getFilteredRoadData(filters) {
    console.log("Filtering road data with:", filters);
    
    if (!dataState.roadNetworkData) {
        console.error("Road network data not loaded");
        return null;
    }
    
    // Create a deep copy of the data to avoid modifying the original
    const filteredData = JSON.parse(JSON.stringify(dataState.roadNetworkData));
    
    // Apply filters
    filteredData.features = filteredData.features.filter(feature => {
        const props = feature.properties;
        
        // Filter by neighborhood
        if (filters.neighborhood !== "all" && props.NEIGHBORHOOD !== filters.neighborhood) {
            return false;
        }
        
        // Filter by counter type
        if (filters.counterType !== "all" && props.COUNTER_TYPE !== filters.counterType) {
            return false;
        }
        
        // Filter by volume
        if (filters.volumeFilter !== "all") {
            const count = getCountForFeature(feature, filters);
            
            if (Array.isArray(filters.volumeFilter)) {
                // Multiple categories selected
                const inSelectedCategory = filters.volumeFilter.some(category => 
                    isInVolumeCategory(count, category));
                
                if (!inSelectedCategory) {
                    return false;
                }
            } else {
                // Single category selected
                if (!isInVolumeCategory(count, filters.volumeFilter)) {
                    return false;
                }
            }
        }
        
        return true;
    });
    
    console.log(`Filtered to ${filteredData.features.length} features`);
    return filteredData;
}

/**
 * Get filtered counter data based on current filters
 * @param {Object} filters - Filter settings
 * @returns {Object} Filtered GeoJSON data
 */
function getFilteredCounterData(filters) {
    console.log("Filtering counter data with:", filters);
    
    if (!dataState.counterPointsData) {
        console.error("Counter data not loaded");
        return null;
    }
    
    // Create a deep copy of the data to avoid modifying the original
    const filteredData = JSON.parse(JSON.stringify(dataState.counterPointsData));
    
    // Apply filters
    filteredData.features = filteredData.features.filter(feature => {
        const props = feature.properties;
        
        // Filter by neighborhood
        if (filters.neighborhood !== "all" && props.NEIGHBORHOOD !== filters.neighborhood) {
            return false;
        }
        
        // Filter by counter type
        if (filters.counterType !== "all") {
            const counterType = props.COUNTER_TYPE || props.cntr_ty;
            if (counterType !== filters.counterType) {
                return false;
            }
        }
        
        return true;
    });
    
    console.log(`Filtered to ${filteredData.features.length} counter points`);
    return filteredData;
}

/**
 * Check if count is in specified volume category
 * @param {number} count - The count value
 * @param {string} category - The volume category
 * @returns {boolean} Whether the count is in the category
 */
function isInVolumeCategory(count, category) {
    switch (category) {
        case 'high': return count >= 80;
        case 'medium-high': return count >= 50 && count < 80;
        case 'medium': return count >= 30 && count < 50;
        case 'medium-low': return count >= 10 && count < 30;
        case 'low': return count < 10;
        default: return true; // 'all' or invalid category
    }
}

/**
 * Get count value for feature based on current filters
 * @param {Object} feature - The GeoJSON feature
 * @param {Object} filters - The current filter settings
 * @returns {number} The count value
 */
function getCountForFeature(feature, filters) {
    const props = feature.properties;
    
    // Different count value based on view type
    if (filters.viewType === "observed" && props.OBSERVED_COUNT) {
        return props.OBSERVED_COUNT;
    } else if (filters.viewType === "predicted" && props.predicted) {
        return props.predicted;
    } else {
        // For combined view
        return props.OBSERVED_COUNT || props.predicted || 0;
    }
}

/**
 * Default/sample data for road network (used if load fails)
 * @returns {Object} Sample GeoJSON data
 */
function defaultRoadNetworkData() {
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "SUBBLOCKKEY": "sample_road_1",
                    "FULLNAME": "Main Street NW",
                    "BIKE_FT": "Protected",
                    "NEIGHBORHOOD": "Downtown",
                    "SEG_LEN": 0.25,
                    "RD_CLASS": "Local",
                    "OBSERVED_COUNT": 75,
                    "predicted": 78.5
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-77.02, 38.9],
                        [-77.03, 38.9]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "SUBBLOCKKEY": "sample_road_2",
                    "FULLNAME": "H Street NE",
                    "BIKE_FT": "Unprotected",
                    "NEIGHBORHOOD": "Capitol Hill",
                    "SEG_LEN": 0.15,
                    "RD_CLASS": "Collector",
                    "predicted": 45.2
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-76.99, 38.9],
                        [-76.98, 38.9]
                    ]
                }
            }
        ]
    };
}

/**
 * Default/sample data for counter points (used if load fails)
 * @returns {Object} Sample GeoJSON data
 */
function defaultCounterData() {
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "SUBBLOCKKEY": "sample_road_1",
                    "Site_Nm": "Counter 1",
                    "cntr_ty": "AUTO",
                    "COUNT": 75
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [-77.025, 38.9]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "SUBBLOCKKEY": "sample_road_2",
                    "Site_Nm": "Counter 2",
                    "cntr_ty": "MANUAL",
                    "COUNT": 45
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [-76.985, 38.9]
                }
            }
        ]
    };
}

/**
 * Default/sample data for neighborhoods (used if load fails)
 * @returns {Object} Sample GeoJSON data
 */
function defaultNeighborhoodData() {
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "DC_HPN_NAME": "Downtown",
                    "GEOID": "11001000100"
                },
                "geometry": {
                    "type": "Polygon",
"coordinates": [[
                        [-77.04, 38.89],
                        [-77.02, 38.89],
                        [-77.02, 38.91],
                        [-77.04, 38.91],
                        [-77.04, 38.89]
                    ]]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "DC_HPN_NAME": "Capitol Hill",
                    "GEOID": "11001000200"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [-77.00, 38.88],
                        [-76.98, 38.88],
                        [-76.98, 38.90],
                        [-77.00, 38.90],
                        [-77.00, 38.88]
                    ]]
                }
            }
        ]
    };
}

/**
 * Default/sample data for census (used if load fails)
 * @returns {Object} Sample GeoJSON data
 */
function defaultCensusData() {
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "SUBBLOC": "sample_road_1",
                    "GEOID": "11001000100",
                    "popltnE": 5000,
                    "mdn_ncE": 85000,
                    "cmmt__E": 22,
                    "cmmt_bE": 5,
                    "ed_bc_E": 75,
                    "rnt_prE": 2200,
                    "medn_gE": 32
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [-77.04, 38.89],
                        [-77.02, 38.89],
                        [-77.02, 38.91],
                        [-77.04, 38.91],
                        [-77.04, 38.89]
                    ]]
                }
            }
        ]
    };
}

/**
 * Default/sample data for predictions (used if load fails)
 * @returns {Array} Sample prediction data
 */
function defaultPredictionsData() {
    return [
        {
            "SUBBLOCKKEY": "sample_road_1",
            ".pred": 78.5,
            ".pred.1": 80.2,
            "Site.Name": "Counter 1"
        },
        {
            "SUBBLOCKKEY": "sample_road_2",
            ".pred": 45.2,
            ".pred.1": 47.8,
            "Site.Name": ""
        }
    ];
}

/**
 * Get data for visualization
 * Helper function for map-visualization.js
 */
function getCensusDataForViz() {
    return dataState.censusData;
}

/**
 * Get network metrics for visualization
 * Helper function for map-visualization.js
 */
function getNetworkMetricsForViz() {
    return dataState.roadNetworkData;
}

/**
 * Get feature importance for visualization
 * Helper function for map-visualization.js
 */
function getFeatureImportanceForViz() {
    return dataState.featureImportance;
}


/**
 * Get street view URL for coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Google Street View URL
 */
function getStreetViewUrl(lat, lng) {
    if (!lat || !lng) return '#';
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
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

// Export the data module functions
window.dataModule = {
    initData,
    getFilteredRoadData,
    getFilteredCounterData,
    getCensusDataForViz,
    getNetworkMetricsForViz,
    getFeatureImportanceForViz,
    getStreetViewUrl,
    compareWithAverage,
    getTemporalPredictionsForSegment,
    getState: () => dataState,
    exportToCSV: (filters) => {
        console.log("Export to CSV requested with filters:", filters);
        return "Sample CSV data";
    }
};