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
    var allMarkers = []; // { marker, cuisine, price }
    var cuisineSelect = null;
    var priceSelect = null;
    var selectedCuisine = "ALL";
    var selectedPrice = "ALL";
  
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

    function getPriceValue(row) {
      if (!row) return "Unknown";
      var keysToTry = ["Price", "price", "Price Range", "Cost"];
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
          applyFilters();
        });
        controlsContainer.appendChild(cuisineSelect);

        var priceLabel = document.createElement("label");
        priceLabel.textContent = "Price range";
        priceLabel.style.display = "block";
        priceLabel.style.fontSize = "12px";
        priceLabel.style.marginTop = "12px";
        priceLabel.style.marginBottom = "6px";
        priceLabel.style.color = "#2d2015";
        controlsContainer.appendChild(priceLabel);

        priceSelect = document.createElement("select");
        priceSelect.id = "viz-map-points-price-select";
        priceSelect.style.width = "100%";
        priceSelect.style.padding = "8px";
        priceSelect.style.borderRadius = "6px";
        priceSelect.style.border = "1px solid #d8c8ad";
        priceSelect.style.background = "#fffaf2";
        priceSelect.style.color = "#2d2015";
        priceSelect.addEventListener("change", function () {
          selectedPrice = priceSelect.value || "ALL";
          applyFilters();
        });
        controlsContainer.appendChild(priceSelect);
  
        var hint = document.createElement("div");
        hint.textContent = "Choose a cuisine and/or price to show only matching restaurants.";
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

    function populatePriceDropdown(priceSet) {
      if (!priceSelect) return;
    
      var prev = selectedPrice || "ALL";
    
      while (priceSelect.firstChild) priceSelect.removeChild(priceSelect.firstChild);
    
      var optAll = document.createElement("option");
      optAll.value = "ALL";
      optAll.textContent = "All prices";
      priceSelect.appendChild(optAll);
    
      var prices = Array.from(priceSet || []);
      prices.sort(function (a, b) {
        return String(a).localeCompare(String(b));
      });
    
      for (var i = 0; i < prices.length; i++) {
        var p = prices[i];
        var opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        priceSelect.appendChild(opt);
      }
    
      var canRestore = false;
      for (var j = 0; j < priceSelect.options.length; j++) {
        if (priceSelect.options[j].value === prev) {
          canRestore = true;
          break;
        }
      }
    
      priceSelect.value = canRestore ? prev : "ALL";
      selectedPrice = priceSelect.value;
    }
  
    function applyFilters() {
      if (!pointsLayer) return;
      pointsLayer.clearLayers();
    
      var cuisineSel = selectedCuisine || "ALL";
      var cuisineNorm = norm(cuisineSel);
      var priceSel = selectedPrice || "ALL";
      var priceNorm = norm(priceSel);
    
      for (var i = 0; i < allMarkers.length; i++) {
        var entry = allMarkers[i];
        if (!entry || !entry.marker) continue;
    
        var cuisineMatch =
          cuisineSel === "ALL" ||
          norm(entry.cuisine) === cuisineNorm ||
          norm(entry.cuisine).indexOf(cuisineNorm) !== -1;
    
        var priceMatch =
          priceSel === "ALL" ||
          norm(entry.price) === priceNorm;
    
        if (cuisineMatch && priceMatch) {
          entry.marker.addTo(pointsLayer);
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
          var priceSet = new Set();
  
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
            var price = getPriceValue(row);
            cuisineSet.add(cuisine);
            priceSet.add(price);
  
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
                "Price: " +
                price +
                "<br/>" +
                "Area: " +
                area +
                "<br/>" +
                "Star: " +
                stars,
              { direction: "top", sticky: true, opacity: 0.95 }
            );
  
            allMarkers.push({ marker: marker, cuisine: cuisine, price: price });
          }
  
          // Fill dropdown and show markers according to selection
          populateCuisineDropdown(cuisineSet);
          populatePriceDropdown(priceSet);
          applyFilters();
  
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