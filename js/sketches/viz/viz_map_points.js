// viz_map_points.js
// Seattle restaurant point map for final (Dessert) section.
(function () {
    var DATA_FILE = 'data/NEWRestaurants_Seattle.csv';
    var map = null;
    var mapContainer = null;
    var pointsLayer = null;
    var loaded = false;
    var loading = false;

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

    function inSeattleBounds(lat, lon) {
        return lat >= 47.45 && lat <= 47.76 && lon >= -122.45 && lon <= -122.20;
    }

    function ensureContainer(manager) {
        var vis = document.getElementById('vis');
        if (!vis) return null;

        if (!mapContainer) {
            mapContainer = document.createElement('div');
            mapContainer.id = 'viz-map-points-container';
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
            }).setView([47.6097, -122.3331], 12);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            pointsLayer = L.layerGroup().addTo(map);
        }

        map.invalidateSize();
    }

    function loadPoints() {
        if (!map || !pointsLayer || loaded || loading) return;
        loading = true;

        fetch(DATA_FILE)
            .then(function (response) {
                if (!response.ok) throw new Error('Failed to load map points: ' + response.status);
                return response.text();
            })
            .then(function (text) {
                var rows = parseCSV(text);

                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i] || {};
                    var lat = parseFloat(row.Latitude);
                    var lon = parseFloat(row.Longitude);
                    if (!isFinite(lat) || !isFinite(lon)) continue;
                    if (!inSeattleBounds(lat, lon)) continue;

                    var name = String(row.Name || 'Restaurant');
                    var area = String(row.Area || 'Unknown Area');
                    var stars = String(row.Star || 'N/A');
                    var marker = L.circleMarker([lat, lon], {
                        radius: 4,
                        color: '#2d2015',
                        weight: 1,
                        fillColor: '#8f4f24',
                        fillOpacity: 0.78
                    });

                    marker.bindTooltip(
                        '<strong>' + name + '</strong><br/>' +
                        'Area: ' + area + '<br/>' +
                        'Star: ' + stars,
                        { direction: 'top', sticky: true, opacity: 0.95 }
                    );
                    marker.addTo(pointsLayer);
                }

                loaded = true;
                loading = false;
            })
            .catch(function (err) {
                loading = false;
                try { console.error('VizMapPoints error:', err); } catch (e) { }
            });
    }

    window.VizMapPoints = {
        draw: function (p, manager) {
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
