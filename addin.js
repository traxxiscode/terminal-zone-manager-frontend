/**
 * Geotab Terminal Report Zones Add-in
 */
geotab.addin.terminalReportZones = function () {
    'use strict';

    let api;
    let state;
    let elAddin;
    
    // Global variables for zone management
    let terminalTypeId = null;
    let regularZones = [];
    let terminalZones = [];
    let filteredRegularZones = [];
    let filteredTerminalZones = [];

    /**
     * Make a Geotab API call
     */
    async function makeGeotabCall(method, typeName, parameters = {}) {
        if (!api) {
            throw new Error('Geotab API not initialized');
        }
        
        return new Promise((resolve, reject) => {
            const callParams = {
                typeName: typeName,
                ...parameters
            };
            
            api.call(method, callParams, resolve, reject);
        });
    }

    /**
     * Load zones from Geotab API
     */
    async function loadZones() {
        if (!api) {
            showAlert('Geotab API not initialized. Please refresh the page.', 'danger');
            return;
        }
        
        try {
            showAlert('Loading zones and checking zone types...', 'info');
            
            // Get zone types first
            const zoneTypes = await makeGeotabCall("Get", "ZoneType");
            
            // Check if "Terminal Report Zone" type exists
            terminalTypeId = null;
            for (const zoneType of zoneTypes) {
                if (zoneType.name === "Terminal Report Zone") {
                    terminalTypeId = zoneType.id;
                    break;
                }
            }
            
            // If "Terminal Report Zone" type doesn't exist, create it
            if (!terminalTypeId) {
                showAlert('Creating "Terminal Report Zone" zone type...', 'info');
                try {
                    const newZoneType = {
                        name: "Terminal Report Zone",
                        id: null,
                        version: null
                    };
                    
                    const result = await makeGeotabCall("Add", "ZoneType", { entity: newZoneType });
                    terminalTypeId = result;
                    showAlert('Successfully created "Terminal Report Zone" zone type', 'success');
                } catch (error) {
                    console.error('Error creating zone type:', error);
                    showAlert('Error creating "Terminal Report Zone" zone type: ' + error.message, 'danger');
                    return;
                }
            }
            
            // Now get all zones
            const zones = await makeGeotabCall("Get", "Zone");
            
            // Categorize zones
            regularZones = [];
            terminalZones = [];
            
            for (const zone of zones) {
                const zoneHasTerminalType = zone.zoneTypes && zone.zoneTypes.some(zt => zt.id === terminalTypeId);
                
                const zoneData = {
                    id: zone.id,
                    name: zone.name || 'Unnamed Zone',
                    zoneTypes: zone.zoneTypes || [],
                    points: zone.points || [],
                    version: zone.version
                };
                
                if (zoneHasTerminalType) {
                    terminalZones.push(zoneData);
                } else {
                    regularZones.push(zoneData);
                }
            }
            
            // Initialize filtered arrays
            filteredRegularZones = [...regularZones];
            filteredTerminalZones = [...terminalZones];
            
            renderZones();
            showAlert(`Loaded ${regularZones.length + terminalZones.length} zones successfully`, 'success');
            
        } catch (error) {
            console.error('Error loading zones:', error);
            showAlert('Error loading zones: ' + error.message, 'danger');
            showEmptyState('regularZonesList');
            showEmptyState('terminalZonesList');
        }
    }

    /**
     * Add Terminal Report Zone type to a zone
     */
    async function addTerminalType(zoneId) {
        if (!api || !terminalTypeId) {
            throw new Error('API not initialized or Terminal Report type not found');
        }
        
        // Get the current zone data
        const zones = await makeGeotabCall("Get", "Zone", { search: { id: zoneId } });
        if (!zones || zones.length === 0) {
            throw new Error('Zone not found');
        }
        
        const zone = zones[0];
        
        // Check if the zone already has the terminal type
        const existingZoneTypes = zone.zoneTypes || [];
        const hasTerminalType = existingZoneTypes.some(zt => zt.id === terminalTypeId);
        
        if (hasTerminalType) {
            throw new Error('Zone already has Terminal Report Zone type');
        }
        
        // Add the terminal type to the zone
        const updatedZoneTypes = [...existingZoneTypes, { id: terminalTypeId }];
        
        // Prepare the updated zone entity
        const updatedZone = {
            id: zone.id,
            name: zone.name,
            zoneTypes: updatedZoneTypes,
            points: zone.points || [],
            version: zone.version
        };
        
        // Update the zone using Set method
        const result = await makeGeotabCall("Set", "Zone", { entity: updatedZone });
        return result;
    }

    /**
     * Remove Terminal Report Zone type from a zone
     */
    async function removeTerminalType(zoneId) {
        if (!api || !terminalTypeId) {
            throw new Error('API not initialized or Terminal Report type not found');
        }
        
        // Get the current zone data
        const zones = await makeGeotabCall("Get", "Zone", { search: { id: zoneId } });
        if (!zones || zones.length === 0) {
            throw new Error('Zone not found');
        }
        
        const zone = zones[0];
        
        // Remove the terminal type from the zone
        const existingZoneTypes = zone.zoneTypes || [];
        const updatedZoneTypes = existingZoneTypes.filter(zt => zt.id !== terminalTypeId);
        
        // Prepare the updated zone entity
        const updatedZone = {
            id: zone.id,
            name: zone.name,
            zoneTypes: updatedZoneTypes,
            points: zone.points || [],
            version: zone.version
        };
        
        // Update the zone using Set method
        const result = await makeGeotabCall("Set", "Zone", { entity: updatedZone });
        return result;
    }

    /**
     * Open the create zone page in Geotab
     */
    function openCreateZone() {
        if (!api) {
            showAlert('Geotab API not initialized', 'danger');
            return;
        }
        
        // Get database name from the API session
        api.getSession(function(session) {
            const database = session.database || 'demo';
            const createZoneUrl = `https://my.geotab.com/${database}/#map,createNewZone:!t,drivers:all`;
            window.open(createZoneUrl, '_blank');
        });
    }

    /**
     * Show/hide button loading state
     */
    function setButtonLoading(buttonId, loading = true) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        const btnText = button.querySelector('.btn-text');
        const btnLoadingText = button.querySelector('.btn-loading-text');

        if (loading) {
            button.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (btnLoadingText) btnLoadingText.style.display = 'inline-flex';
        } else {
            button.disabled = false;
            if (btnText) btnText.style.display = 'inline-flex';
            if (btnLoadingText) btnLoadingText.style.display = 'none';
        }
    }

    /**
     * Log messages (alerts removed from UI)
     */
    function showAlert(message, type = 'info') {
        if (type === 'danger' || type === 'warning') {
            console.error(`[${type}] ${message}`);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    /**
     * Render zones in the UI
     */
    function renderZones() {
        renderZoneList('regularZonesList', filteredRegularZones, 'regular');
        renderZoneList('terminalZonesList', filteredTerminalZones, 'terminal');
        updateCounts();
    }

    /**
     * Filter zones based on search input
     */
    function filterZones(type) {
        const searchTerm = document.getElementById(type === 'regular' ? 'regularSearch' : 'terminalSearch').value.toLowerCase();
        
        if (type === 'regular') {
            filteredRegularZones = regularZones.filter(zone => 
                zone.name.toLowerCase().includes(searchTerm) || 
                zone.id.toLowerCase().includes(searchTerm)
            );
            renderZoneList('regularZonesList', filteredRegularZones, 'regular');
        } else {
            filteredTerminalZones = terminalZones.filter(zone => 
                zone.name.toLowerCase().includes(searchTerm) || 
                zone.id.toLowerCase().includes(searchTerm)
            );
            renderZoneList('terminalZonesList', filteredTerminalZones, 'terminal');
        }
        
        updateCounts();
    }

    /**
     * Render a list of zones
     */
    function renderZoneList(containerId, zones, type) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (zones.length === 0) {
            showEmptyState(containerId);
            return;
        }
        
        const zonesHtml = zones.map(zone => `
            <div class="zone-item ${type === 'terminal' ? 'terminal-zone' : ''}" 
                    draggable="true" 
                    ondragstart="drag(event)" 
                    data-zone-id="${zone.id}"
                    data-zone-name="${zone.name}"
                    data-current-type="${type}">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${zone.name}</strong>
                        <small class="d-block opacity-75">ID: ${zone.id}</small>
                    </div>
                    <i class="fas fa-grip-vertical"></i>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = zonesHtml;
    }

    /**
     * Show empty state message
     */
    function showEmptyState(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const type = containerId.includes('regular') ? 'regular' : 'terminal report';
        
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No ${type} zones available</p>
                <small>Drag zones here to ${type === 'regular' ? 'remove from' : 'add to'} Terminal Report Zones</small>
            </div>
        `;
    }

    /**
     * Update zone counts
     */
    function updateCounts() {
        const regularCountEl = document.getElementById('regularCount');
        const terminalCountEl = document.getElementById('terminalCount');
        
        if (regularCountEl) {
            regularCountEl.textContent = `${filteredRegularZones.length} of ${regularZones.length} zones`;
        }
        if (terminalCountEl) {
            terminalCountEl.textContent = `${filteredTerminalZones.length} of ${terminalZones.length} zones`;
        }
    }

    /**
     * Handle drag start
     */
    window.drag = function(event) {
        const zoneId = event.target.dataset.zoneId;
        const zoneName = event.target.dataset.zoneName;
        const currentType = event.target.dataset.currentType;
        
        event.dataTransfer.setData('text/plain', JSON.stringify({
            zoneId: zoneId,
            zoneName: zoneName,
            currentType: currentType
        }));
    };

    /**
     * Allow drop
     */
    window.allowDrop = function(event) {
        event.preventDefault();
    };

    /**
     * Handle drag enter
     */
    window.dragEnter = function(event) {
        event.preventDefault();
        event.currentTarget.classList.add('drag-over');
    };

    /**
     * Handle drag leave
     */
    window.dragLeave = function(event) {
        // Only remove the class if we're leaving the container itself, not a child
        if (!event.currentTarget.contains(event.relatedTarget)) {
            event.currentTarget.classList.remove('drag-over');
        }
    };

    /**
     * Handle drop
     */
    window.drop = async function(event, targetType) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        const { zoneId, zoneName, currentType } = data;
        
        // Don't do anything if dropping in the same container
        if (currentType === targetType) {
            return;
        }
        
        try {
            let action, actionText;
            
            if (targetType === 'terminal') {
                action = 'add';
                actionText = 'Adding';
            } else {
                action = 'remove';
                actionText = 'Removing';
            }
            
            showAlert(`${actionText} "${zoneName}" ${action === 'add' ? 'to' : 'from'} Terminal Report Zones...`, 'info');
            
            if (action === 'add') {
                await addTerminalType(zoneId);
            } else {
                await removeTerminalType(zoneId);
            }
            
            // Move zone between arrays
            if (targetType === 'terminal') {
                const zoneIndex = regularZones.findIndex(z => z.id === zoneId);
                if (zoneIndex !== -1) {
                    const zone = regularZones.splice(zoneIndex, 1)[0];
                    // Update the zone's zoneTypes to include the terminal type
                    zone.zoneTypes = [...(zone.zoneTypes || []), { id: terminalTypeId }];
                    terminalZones.push(zone);
                }
            } else {
                const zoneIndex = terminalZones.findIndex(z => z.id === zoneId);
                if (zoneIndex !== -1) {
                    const zone = terminalZones.splice(zoneIndex, 1)[0];
                    // Remove terminal type from zone's zoneTypes
                    zone.zoneTypes = (zone.zoneTypes || []).filter(zt => zt.id !== terminalTypeId);
                    regularZones.push(zone);
                }
            }
            
            // Update filtered arrays and re-render
            filteredRegularZones = [...regularZones];
            filteredTerminalZones = [...terminalZones];
            
            // Clear search boxes to show all zones
            const regularSearch = document.getElementById('regularSearch');
            const terminalSearch = document.getElementById('terminalSearch');
            if (regularSearch) regularSearch.value = '';
            if (terminalSearch) terminalSearch.value = '';
            
            renderZones();
            showAlert(`Successfully ${action === 'add' ? 'added' : 'removed'} "${zoneName}" ${action === 'add' ? 'to' : 'from'} Terminal Report Zones`, 'success');
            
        } catch (error) {
            console.error('Error updating zone:', error);
            showAlert('Error updating zone: ' + error.message, 'danger');
        }
    };

    /**
     * Clear search input and reset filtered zones
     */
    window.clearSearch = function(type) {
        const searchInput = document.getElementById(type === 'regular' ? 'regularSearch' : 'terminalSearch');
        if (searchInput) {
            searchInput.value = '';
            filterZones(type);
        }
    };

    /**
     * Refresh zones data
     */
    window.refreshZones = async function() {
        setButtonLoading('refreshBtn', true);
        try {
            await loadZones();
        } finally {
            setButtonLoading('refreshBtn', false);
        }
    };

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Add debounced search functionality
        let searchTimeout;
        
        function debounceSearch(type) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                filterZones(type);
            }, 300);
        }
        
        // Add event listeners for search inputs
        const regularSearch = document.getElementById('regularSearch');
        const terminalSearch = document.getElementById('terminalSearch');
        
        if (regularSearch) {
            regularSearch.addEventListener('input', () => debounceSearch('regular'));
        }
        
        if (terminalSearch) {
            terminalSearch.addEventListener('input', () => debounceSearch('terminal'));
        }

        // Handle keyboard shortcuts
        document.addEventListener('keydown', function(event) {
            // Ctrl/Cmd + R to refresh zones
            if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
                event.preventDefault();
                loadZones();
            }
            
            // Escape to clear search boxes
            if (event.key === 'Escape') {
                if (regularSearch && regularSearch.value) {
                    window.clearSearch('regular');
                }
                if (terminalSearch && terminalSearch.value) {
                    window.clearSearch('terminal');
                }
            }
        });
    }

    return {
        /**
         * initialize() is called only once when the Add-In is first loaded.
         */
        initialize: function (freshApi, freshState, initializeCallback) {
            api = freshApi;
            state = freshState;

            elAddin = document.getElementById('terminalReportZones');

            if (state.translate) {
                state.translate(elAddin || '');
            }
            
            initializeCallback();
        },

        /**
         * focus() is called whenever the Add-In receives focus.
         */
        focus: function (freshApi, freshState) {
            api = freshApi;
            state = freshState;

            // Setup event listeners
            setupEventListeners();
            
            // Load zones data
            loadZones();
            
            // Show main content
            if (elAddin) {
                elAddin.style.display = 'block';
            }

            // Make functions globally accessible
            window.filterZones = filterZones;
            window.openCreateZone = openCreateZone;
            window.loadZones = loadZones;
        },

        /**
         * blur() is called whenever the user navigates away from the Add-In.
         */
        blur: function () {
            // Hide main content
            if (elAddin) {
                elAddin.style.display = 'none';
            }
        }
    };
};