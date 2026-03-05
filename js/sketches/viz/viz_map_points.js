// viz_map_points.js
// Seattle restaurant point map for final (Dessert) section + cuisine dropdown filter.
(function () {
    var DATA_FILE = "data/NEWRestaurants_Seattle.csv";
    var map = null;
    var mapContainer = null;
    var uiContainer = null;
    var controlsContainer = null;
  
    var pointsLayer = null;
    var loaded = false;
    var loading = false;
  
    // NEW: store markers so we can filter without re-fetching
    var allMarkers = []; // { marker, cuisine }
    var cuisineSelect = null;
    var selectedCuisine = "ALL";
  
    function splitCsvLine(line) {
      var out = [];
      var cur = "";
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
        } else if (ch === "," && !inQuotes) {
          out.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
  
      out.push(cur);
      return out;
    }
  
    function parseCSV(text) {
      var lines = String(text || "")
        .split(/\r?\n/)
        .filter(function (line) {
          return line.trim().length > 0;
        });
      if (!lines.length) return [];
  
      var headers = splitCsvLine(lines[0]).map(function (h) {
        return String(h || "").replace(/^\ufeff/, "").trim();
      });
  
      var rows = [];
      for (var i = 1; i < lines.length; i++) {
        var values = splitCsvLine(lines[i]);
        var row = {};
        for (var j = 0; j < headers.length; j++) {
          row[headers[j]] = values[j] || "";
        }
        rows.push(row);
      }
      return rows;
    }
  
    function inSeattleBounds(lat, lon) {
      return lat >= 47.45 && lat <= 47.76 && lon >= -122.45 && lon <= -122.2;
    }
  
    // NEW: robustly read a cuisine-like field from the row
    function getCuisineValue(row) {
      if (!row) return "Unknown";
      var keysToTry = ["Cuisine", "cuisine", "Category - Split 1", "Type", "Categories"];
      for (var i = 0; i < keysToTry.length; i++) {
        var k = keysToTry[i];
        if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
      }
      return "Unknown";
    }
  
    // NEW: normalize for matching (optional but helps)
    function norm(s) {
      return String(s || "")
        .trim()
        .toLowerCase();
    }
  
    // NEW: build side-by-side layout container (controls + map)
    function ensureContainer(manager) {
      var vis = document.getElementById("vis");
      if (!vis) return null;
  
      if (!uiContainer) {
        uiContainer = document.createElement("div");
        uiContainer.id = "viz-map-points-ui";
        uiContainer.style.display = "flex";
        uiContainer.style.gap = "12px";
        uiContainer.style.alignItems = "stretch";
        uiContainer.style.border = "1px solid #d8c8ad";
        uiContainer.style.background = "rgba(255, 253, 248, 0.92)";
        uiContainer.style.padding = "10px";
        uiContainer.style.boxSizing = "border-box";
        vis.appendChild(uiContainer);
      }
  
      // Left: controls
      if (!controlsContainer) {
        controlsContainer = document.createElement("div");
        controlsContainer.id = "viz-map-points-controls";
        controlsContainer.style.width = "220px";
        controlsContainer.style.minWidth = "200px";
        controlsContainer.style.boxSizing = "border-box";
        controlsContainer.style.padding = "8px";
        controlsContainer.style.border = "1px solid #e6d7bf";
        controlsContainer.style.background = "rgba(255, 250, 241, 0.75)";
        controlsContainer.style.borderRadius = "6px";
  
        var title = document.createElement("div");
        title.textContent = "Filter";
        title.style.fontWeight = "700";
        title.style.marginBottom = "8px";
        title.style.color = "#2d2015";
        controlsContainer.appendChild(title);
  
        var label = document.createElement("label");
        label.textContent = "Cuisine type";
        label.style.display = "block";
        label.style.fontSize = "12px";
        label.style.marginBottom = "6px";
        label.style.color = "#2d2015";
        controlsContainer.appendChild(label);
  
        cuisineSelect = document.createElement("select");
        cuisineSelect.id = "viz-map-points-cuisine-select";
        cuisineSelect.style.width = "100%";
        cuisineSelect.style.padding = "8px";
        cuisineSelect.style.borderRadius = "6px";
        cuisineSelect.style.border = "1px solid #d8c8ad";
        cuisineSelect.style.background = "#fffaf2";
        cuisineSelect.style.color = "#2d2015";
        cuisineSelect.addEventListener("change", function () {
          selectedCuisine = cuisineSelect.value || "ALL";
          applyCuisineFilter();
        });
        controlsContainer.appendChild(cuisineSelect);
  
        var hint = document.createElement("div");
        hint.textContent = "Choose a cuisine to show only matching restaurants.";
        hint.style.fontSize = "11px";
        hint.style.marginTop = "8px";
        hint.style.color = "#5a4537";
        hint.style.lineHeight = "1.3";
        controlsContainer.appendChild(hint);
  
        uiContainer.appendChild(controlsContainer);
      }
  
      // Right: map
      if (!mapContainer) {
        mapContainer = document.createElement("div");
        mapContainer.id = "viz-map-points-container";
        mapContainer.style.position = "relative";
        mapContainer.style.flex = "1";
        mapContainer.style.border = "1px solid #d8c8ad";
        mapContainer.style.borderRadius = "6px";
        mapContainer.style.overflow = "hidden";
        uiContainer.appendChild(mapContainer);
      }
  
      uiContainer.style.display = "flex";
      // Total area matches your old canvas size, but map gets the bulk of it
      uiContainer.style.width = (manager.canvasWidth || 690) + "px";
      uiContainer.style.height = (manager.canvasHeight || 560) + "px";
  
      // Make map fill container height
      mapContainer.style.height = "100%";
      return mapContainer;
    }
  
    function ensureMap(manager) {
      var container = ensureContainer(manager);
      if (!container || !window.L) return;
  
      if (!map) {
        map = L.map(container, {
          zoomControl: true,
          scrollWheelZoom: false,
        }).setView([47.6097, -122.3331], 12);
  
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);
  
        pointsLayer = L.layerGroup().addTo(map);
      }
  
      map.invalidateSize();
    }
  
    // NEW: fill dropdown options from cuisines found
    function populateCuisineDropdown(cuisineSet) {
      if (!cuisineSelect) return;
  
      // Keep selection if possible
      var prev = selectedCuisine || "ALL";
  
      // Clear
      while (cuisineSelect.firstChild) cuisineSelect.removeChild(cuisineSelect.firstChild);
  
      // Add "All"
      var optAll = document.createElement("option");
      optAll.value = "ALL";
      optAll.textContent = "All cuisines";
      cuisineSelect.appendChild(optAll);
  
      // Add cuisines sorted
      var cuisines = Array.from(cuisineSet || []);
      cuisines.sort(function (a, b) {
        return String(a).localeCompare(String(b));
      });
  
      for (var i = 0; i < cuisines.length; i++) {
        var c = cuisines[i];
        var opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        cuisineSelect.appendChild(opt);
      }
  
      // Restore selection if it exists; otherwise default to ALL
      var canRestore = false;
      for (var j = 0; j < cuisineSelect.options.length; j++) {
        if (cuisineSelect.options[j].value === prev) {
          canRestore = true;
          break;
        }
      }
      cuisineSelect.value = canRestore ? prev : "ALL";
      selectedCuisine = cuisineSelect.value;
    }
  
    // NEW: apply filter by rebuilding the layer group
    function applyCuisineFilter() {
      if (!pointsLayer) return;
      pointsLayer.clearLayers();
  
      var sel = selectedCuisine || "ALL";
      var selNorm = norm(sel);
  
      for (var i = 0; i < allMarkers.length; i++) {
        var entry = allMarkers[i];
        if (!entry || !entry.marker) continue;
  
        if (sel === "ALL") {
          entry.marker.addTo(pointsLayer);
        } else {
          // Some rows might have multiple cuisines like "Thai, Dessert" or "Thai | Dessert"
          // We'll do a contains-match to be forgiving.
          var cNorm = norm(entry.cuisine);
          if (cNorm === selNorm || cNorm.indexOf(selNorm) !== -1) {
            entry.marker.addTo(pointsLayer);
          }
        }
      }
    }
  
    function loadPoints() {
      if (!map || !pointsLayer || loaded || loading) return;
      loading = true;
  
      fetch(DATA_FILE)
        .then(function (response) {
          if (!response.ok) throw new Error("Failed to load map points: " + response.status);
          return response.text();
        })
        .then(function (text) {
          var rows = parseCSV(text);
  
          allMarkers = [];
          var cuisineSet = new Set();
  
          for (var i = 0; i < rows.length; i++) {
            var row = rows[i] || {};
            var lat = parseFloat(row.Latitude);
            var lon = parseFloat(row.Longitude);
            if (!isFinite(lat) || !isFinite(lon)) continue;
            if (!inSeattleBounds(lat, lon)) continue;
  
            var name = String(row.Name || "Restaurant");
            var area = String(row.Area || "Unknown Area");
            var stars = String(row.Star || "N/A");
            var cuisine = getCuisineValue(row);
            cuisineSet.add(cuisine);
  
            var marker = L.circleMarker([lat, lon], {
              radius: 4,
              color: "#6c4123",
              weight: 1,
              fillColor: "#b27645",
              fillOpacity: 0.78,
            });
  
            marker.bindTooltip(
              "<strong>" +
                name +
                "</strong><br/>" +
                "Cuisine: " +
                cuisine +
                "<br/>" +
                "Area: " +
                area +
                "<br/>" +
                "Star: " +
                stars,
              { direction: "top", sticky: true, opacity: 0.95 }
            );
  
            allMarkers.push({ marker: marker, cuisine: cuisine });
          }
  
          // Fill dropdown and show markers according to selection
          populateCuisineDropdown(cuisineSet);
          applyCuisineFilter();
  
          loaded = true;
          loading = false;
        })
        .catch(function (err) {
          loading = false;
          try {
            console.error("VizMapPoints error:", err);
          } catch (e) {}
        });
    }
  
    window.VizMapPoints = {
      draw: function (p, manager) {
        if (p && p.canvas) p.canvas.style.display = "none";
        ensureMap(manager);
        loadPoints();
      },
      hide: function (p) {
        if (uiContainer) uiContainer.style.display = "none";
        if (p && p.canvas) p.canvas.style.display = "block";
      },
    };
  })();