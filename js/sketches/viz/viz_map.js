// viz_map.js
// Seattle restaurant map for viz_3 slot.
(function () {
    var DATA_FILE = 'data/NEWRestaurants_Seattle.csv';
    var map = null;
    var tileLayer = null;
    var markersLayer = null;
    var mapContainer = null;
    var legendControl = null;
    var dataLoaded = false;
    var loading = false;

    var AREA_CENTERS = {
        'Capitol Hill': [47.6230, -122.3190],
        'Downtown': [47.6050, -122.3340],
        'South Lake Union': [47.6235, -122.3380],
        'Belltown': [47.6145, -122.3475],
        'Fremont': [47.6515, -122.3505],
        'Denny Triangle': [47.6178, -122.3335],
        'Chinatown': [47.5985, -122.3258],
        'Lower Queen Anne': [47.6263, -122.3560],
        'Ballard': [47.6685, -122.3850],
        'Pioneer Square': [47.6017, -122.3336],
        'First Hill': [47.6099, -122.3244],
        'Queen Anne': [47.6372, -122.3562],
        'Central District': [47.6080, -122.3060],
        'Interbay': [47.6413, -122.3765],
        'University District': [47.6612, -122.3130],
        'Madison Valley': [47.6250, -122.2915],
        'Little Saigon': [47.5980, -122.3168],
        'Wallingford': [47.6613, -122.3366],
        'Waterfront': [47.6078, -122.3422],
        'Eastlake': [47.6430, -122.3252],
        'Atlantic': [47.5955, -122.3045],
        'Madison Park': [47.6330, -122.2787],
        'Magnolia': [47.6402, -122.3995],
        'Chinatown International District': [47.5970, -122.3215],
        'Mapleleaf': [47.6965, -122.3115],
        'Westlake': [47.6298, -122.3470],
        'Beacon Hill': [47.5795, -122.3110],
        'Mount Baker': [47.5769, -122.2945],
        'Japantown': [47.5988, -122.3218],
        'Leschi': [47.6028, -122.2876],
        'SoDo': [47.5808, -122.3327],
        'Madrona': [47.6155, -122.2896],
        'Alki': [47.5798, -122.4080],
        'Haller Lake': [47.7187, -122.3375],
        'Phinney Ridge': [47.6748, -122.3558]
    };

    var AREA_SIZE_SCALE = {
        'Magnolia': 1.9,
        'Ballard': 1.8,
        'Beacon Hill': 1.8,
        'University District': 1.7,
        'Queen Anne': 1.6,
        'Capitol Hill': 1.5,
        'Central District': 1.5,
        'Interbay': 1.5,
        'Wallingford': 1.4,
        'Fremont': 1.35,
        'South Lake Union': 1.3,
        'Downtown': 1.25,
        'Belltown': 1.0,
        'Denny Triangle': 0.95,
        'Lower Queen Anne': 1.0,
        'Pioneer Square': 0.95,
        'First Hill': 1.0,
        'Chinatown': 0.9,
        'Little Saigon': 0.9,
        'Chinatown International District': 0.95,
        'Waterfront': 0.8,
        'Madison Valley': 1.1,
        'Madison Park': 1.05,
        'Mapleleaf': 1.4,
        'Westlake': 0.9,
        'Mount Baker': 1.2,
        'Leschi': 1.0,
        'SoDo': 1.6,
        'Madrona': 1.0,
        'Alki': 1.4,
        'Haller Lake': 1.6,
        'Phinney Ridge': 1.2,
        'Atlantic': 1.0,
        'Eastlake': 1.1,
        'Japantown': 0.8
    };

    function splitCsvLine(line) {
        var out = [];
        var cur = '';
        var inQuotes = false;

        for (var i = 0; i < line.length; i++) {
            var ch = line[i];
            if (ch === '"') {
                if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === ',' && !inQuotes) {
                out.push(cur);
                cur = '';
            } else {
                cur += ch;
            }
        }

        out.push(cur);
        return out;
    }

    function normalizeHeader(value) {
        return String(value || '').replace(/^\ufeff/, '').trim().toLowerCase();
    }

    function parseCSV(text) {
        var lines = String(text || '').split(/\r?\n/).filter(function (line) {
            return line.trim().length > 0;
        });
        if (!lines.length) return [];

        var headers = splitCsvLine(lines[0]).map(function (h) {
            return String(h || '').replace(/^\ufeff/, '').trim();
        });
        var rows = [];
        for (var i = 1; i < lines.length; i++) {
            var values = splitCsvLine(lines[i]);
            var row = {};
            for (var j = 0; j < headers.length; j++) {
                row[headers[j]] = values[j] || '';
            }
            rows.push(row);
        }
        return rows;
    }

    function buildAreaCounts(rows) {
        var counts = {};

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i] || {};
            var area = String(row.Area || row.area || '').trim();
            if (!area) continue;

            if (!counts[area]) counts[area] = 0;
            counts[area] += 1;
        }

        var out = [];
        for (var areaName in counts) {
            if (!Object.prototype.hasOwnProperty.call(counts, areaName)) continue;
            if (!AREA_CENTERS[areaName]) continue;
            out.push({
                area: areaName,
                count: counts[areaName],
                lat: AREA_CENTERS[areaName][0],
                lon: AREA_CENTERS[areaName][1]
            });
        }

        out.sort(function (a, b) { return b.count - a.count; });
        return out;
    }

    function interpolateColor(t) {
        t = Math.max(0, Math.min(1, t));
        var r = Math.round(248 + (152 - 248) * t);
        var g = Math.round(236 + (99 - 236) * t);
        var b = Math.round(214 + (60 - 214) * t);
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    function areaRadius(areaName) {
        var scale = AREA_SIZE_SCALE[areaName];
        if (!scale) scale = 1.0;
        return 220 + scale * 260;
    }

    function ensureLegend() {
        if (!map || legendControl) return;

        legendControl = L.control({ position: 'bottomright' });
        legendControl.onAdd = function () {
            var div = L.DomUtil.create('div', 'map-legend');
            div.style.background = 'rgba(255, 250, 241, 0.94)';
            div.style.padding = '8px 10px';
            div.style.border = '1px solid #d8c8ad';
            div.style.font = '12px/1.3 Arial, sans-serif';
            div.style.color = '#2f2923';
            div.innerHTML = '<strong>Area Heat</strong><br/><span style="color:#6b5948;">Color = restaurant count</span><br/><span style="color:#6b5948;">Size = neighborhood area</span>';
            return div;
        };
        legendControl.addTo(map);
    }

    function ensureContainer(manager) {
        var vis = document.getElementById('vis');
        if (!vis) return null;

        if (!mapContainer) {
            mapContainer = document.createElement('div');
            mapContainer.id = 'viz-map-container';
            mapContainer.style.position = 'relative';
            mapContainer.style.border = '1px solid #d8c8ad';
            mapContainer.style.background = 'rgba(255, 253, 248, 0.92)';
            vis.appendChild(mapContainer);
        }

        mapContainer.style.display = 'block';
        mapContainer.style.width = (manager.canvasWidth || 690) + 'px';
        mapContainer.style.height = (manager.canvasHeight || 560) + 'px';
        return mapContainer;
    }

    function ensureMap(manager) {
        var container = ensureContainer(manager);
        if (!container || !window.L) return;

        if (!map) {
            map = L.map(container, {
                zoomControl: true,
                scrollWheelZoom: false
            }).setView([47.6145, -122.3321], 12);

            tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            markersLayer = L.layerGroup().addTo(map);
            ensureLegend();
        }

        map.invalidateSize();
    }

    function loadPoints() {
        if (!map || !markersLayer || dataLoaded || loading) return;
        loading = true;

        fetch(DATA_FILE)
            .then(function (response) {
                if (!response.ok) throw new Error('Failed to load map data: ' + response.status);
                return response.text();
            })
            .then(function (text) {
                var rows = parseCSV(text);
                var areaCounts = buildAreaCounts(rows);
                areaCounts = areaCounts.filter(function (d) { return d.count >= 2; });
                var maxCount = 1;
                for (var i = 0; i < areaCounts.length; i++) {
                    if (areaCounts[i].count > maxCount) maxCount = areaCounts[i].count;
                }

                var drawOrder = areaCounts.slice().sort(function (a, b) {
                    return areaRadius(b.area) - areaRadius(a.area);
                });

                for (var j = 0; j < drawOrder.length; j++) {
                    var item = drawOrder[j];
                    var ratio = item.count / maxCount;
                    var marker = L.circle([item.lat, item.lon], {
                        radius: areaRadius(item.area),
                        color: '#6c4123',
                        weight: 0.8,
                        fillColor: interpolateColor(ratio),
                        fillOpacity: 0.24
                    });

                    marker.bindTooltip('<strong>' + item.area + '</strong><br/>Restaurants: ' + item.count, {
                        direction: 'top',
                        opacity: 0.95,
                        sticky: true
                    });
                    marker.addTo(markersLayer);
                }

                dataLoaded = true;
                loading = false;
            })
            .catch(function (err) {
                loading = false;
                try { console.error('VizMap error:', err); } catch (e) { }
            });
    }

    window.VizMap = {
        draw: function (p, manager, ai, progress) {
            if (p && p.canvas) p.canvas.style.display = 'none';
            ensureMap(manager);
            loadPoints();
        },

        hide: function (p) {
            if (mapContainer) mapContainer.style.display = 'none';
            if (p && p.canvas) p.canvas.style.display = 'block';
        }
    };
})();
