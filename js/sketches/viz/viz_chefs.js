// viz_chefs.js
// Chef's Recommendations: top‑5 lists by budget, cuisine, and area with filters.
(function () {
    var CSV_FILE = 'data/NEWRestaurants_Seattle.csv';

    function normalizeHeader(value) {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

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
        if (!lines.length) return { headers: [], rows: [] };

        var headers = splitCsvLine(lines[0]).map(function (h) { return h.trim(); });
        var rows = [];
        for (var i = 1; i < lines.length; i++) rows.push(splitCsvLine(lines[i]));
        return { headers: headers, rows: rows };
    }

    function findColIndex(headers, candidates) {
        var normalized = headers.map(normalizeHeader);
        for (var i = 0; i < candidates.length; i++) {
            var idx = normalized.indexOf(normalizeHeader(candidates[i]));
            if (idx !== -1) return idx;
        }
        return -1;
    }

    function toPriceBucket(raw) {
        var price = String(raw || '').trim();
        if (price === '$' || price === '$$' || price === '$$$' || price === '$$$$') return price;
        return price || ''; // allow n/a or other text to pass through
    }

    function processData(parsed) {
        var headers = parsed.headers || [];
        var rows = parsed.rows || [];

        var areaCol = findColIndex(headers, ['Area', 'area', 'Neighborhood', 'neighborhood']);
        var cuisineCol = findColIndex(headers, [
            'Category - Split 1', 'Category - Split1', 'Category Split 1',
            'Category - Split', 'Category'
        ]);
        var priceCol = findColIndex(headers, ['Price', 'price', 'Price Level', 'price level']);
        var nameCol = findColIndex(headers, ['Name', 'Restaurant', 'business name']);
        var starCol = findColIndex(headers, ['Star', 'Stars', 'Rating', 'Average Rating']);
        var countCol = findColIndex(headers, ['Stars count', 'Review Count', 'Number of Reviews']);

        if (nameCol === -1 || starCol === -1 || countCol === -1) {
            return { data: [], error: 'Missing required columns in CSV.' };
        }

        var out = [];
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i] || [];
            var name = String(row[nameCol] || '').trim();
            var price = priceCol !== -1 ? toPriceBucket(row[priceCol]) : '';
            var cuisine = cuisineCol !== -1 ? String(row[cuisineCol] || '').trim() : '';
            var area = areaCol !== -1 ? String(row[areaCol] || '').trim() : '';
            var star = parseFloat(row[starCol]);
            var count = parseInt(row[countCol], 10);
            if (!name || !isFinite(star) || isNaN(count)) continue;
            out.push({ name: name, price: price, cuisine: cuisine, area: area, star: star, count: count });
        }
        return { data: out, error: null };
    }

    function ensureData(manager) {
        if (manager._chefsDataLoaded || manager._chefsDataLoading) return;
        manager._chefsDataLoading = true;
        fetch(CSV_FILE)
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to load CSV: ' + res.status);
                return res.text();
            })
            .then(function (text) {
                var parsed = parseCSV(text);
                var proc = processData(parsed);
                manager._chefsData = proc.data;
                manager._chefsError = proc.error;
                manager._chefsDataLoaded = true;
                manager._chefsDataLoading = false;
                buildFilterOptions(manager);
            })
            .catch(function (err) {
                manager._chefsData = [];
                manager._chefsError = (err && err.message) ? err.message : 'Unable to load chef data.';
                manager._chefsDataLoaded = true;
                manager._chefsDataLoading = false;
            });
    }

    function drawMessage(p, manager, text) {
        var cx = (manager.offsetX || 0) + (manager.width || 600) / 2;
        var cy = (manager.offsetY || 0) + (manager.height || 520) / 2;
        p.push();
        p.noStroke();
        p.fill(70);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(18);
        p.text(text, cx, cy);
        p.pop();
    }

    // build / update filter controls ------------------------------------------------
    function ensureFilters(manager) {
        var container = document.getElementById('vis');
        if (!container || document.getElementById('chef-budget-filter')) return;
        var div = document.createElement('div');
        div.className = 'chef-controls';

        var label;
        label = document.createElement('label');
        label.textContent = 'Budget:';
        div.appendChild(label);
        var budgetSel = document.createElement('select');
        budgetSel.id = 'chef-budget-filter';
        budgetSel.innerHTML = '<option value="">All</option>';
        div.appendChild(budgetSel);

        label = document.createElement('label');
        label.textContent = 'Cuisine:';
        div.appendChild(label);
        var cuisineSel = document.createElement('select');
        cuisineSel.id = 'chef-cuisine-filter';
        cuisineSel.innerHTML = '<option value="">All</option>';
        div.appendChild(cuisineSel);

        label = document.createElement('label');
        label.textContent = 'Area:';
        div.appendChild(label);
        var areaSel = document.createElement('select');
        areaSel.id = 'chef-area-filter';
        areaSel.innerHTML = '<option value="">All</option>';
        div.appendChild(areaSel);

        container.appendChild(div);

        [budgetSel, cuisineSel, areaSel].forEach(function (sel) {
            sel.addEventListener('change', function () { manager._filterDirty = true; });
        });
    }

    function buildFilterOptions(manager) {
        if (!manager._chefsDataLoaded || !manager._chefsData || manager._chefsFiltersBuilt) return;
        ensureFilters(manager);
        var budgets = new Set();
        var cuisines = new Set();
        var areas = new Set();
        manager._chefsData.forEach(function (d) {
            if (d.price) budgets.add(d.price);
            if (d.cuisine) cuisines.add(d.cuisine);
            if (d.area) areas.add(d.area);
        });

        var budgetSel = document.getElementById('chef-budget-filter');
        var cuisineSel = document.getElementById('chef-cuisine-filter');
        var areaSel = document.getElementById('chef-area-filter');

        if (budgetSel) {
            Array.from(budgets).sort().forEach(function (v) {
                var opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v || 'n/a';
                budgetSel.appendChild(opt);
            });
        }
        if (cuisineSel) {
            Array.from(cuisines).sort().forEach(function (v) {
                var opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                cuisineSel.appendChild(opt);
            });
        }
        if (areaSel) {
            Array.from(areas).sort().forEach(function (v) {
                var opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                areaSel.appendChild(opt);
            });
        }

        manager._chefsFiltersBuilt = true;
    }

    function rankTop5(data, key, value) {
        var arr = data.filter(function (d) {
            if (value && d[key] !== value) return false;
            return d.count >= 100;
        });
        arr.sort(function (a, b) { return b.star - a.star; });
        return arr.slice(0, 5).map(function (d) { return d.name; });
    }

    window.VizChefs = {
        draw: function (p, manager, ai, progress) {
            ensureData(manager);
            ensureFilters(manager);

            if (!manager._chefsDataLoaded) {
                drawMessage(p, manager, 'Loading chef recommendations...');
                return;
            }
            if (manager._chefsError) {
                drawMessage(p, manager, manager._chefsError);
                return;
            }
            var data = manager._chefsData || [];
            if (!data.length) {
                drawMessage(p, manager, 'No data available for chef recommendations.');
                return;
            }

            if (!manager._chefsFiltersBuilt) buildFilterOptions(manager);

            var budgetVal = document.getElementById('chef-budget-filter') && document.getElementById('chef-budget-filter').value;
            var cuisineVal = document.getElementById('chef-cuisine-filter') && document.getElementById('chef-cuisine-filter').value;
            var areaVal = document.getElementById('chef-area-filter') && document.getElementById('chef-area-filter').value;

            var topBudget = rankTop5(data, 'price', budgetVal);
            var topCuisine = rankTop5(data, 'cuisine', cuisineVal);
            var topArea = rankTop5(data, 'area', areaVal);

            var panelLeft = manager.offsetX || 20;
            var panelTop = manager.offsetY || 0;
            var panelWidth = manager.width || 600;
            var panelHeight = manager.height || 520;
            var colWidth = panelWidth / 3;

            // keep lists below the filter controls; filters occupy roughly 60px
            var filterHeight = 60;
            var headerY = panelTop + filterHeight + 10;
            var listStartY = headerY + 30;

            p.push();
            p.fill(28);
            p.textAlign(p.LEFT, p.TOP);
            p.textSize(18);
            p.text('Budget', panelLeft + 5, headerY);
            p.text('Cuisine', panelLeft + colWidth + 5, headerY);
            p.text('Area', panelLeft + colWidth * 2 + 5, headerY);

            p.textSize(14);
            var lineH = 20;
            for (var i = 0; i < 5; i++) {
                var y = listStartY + i * lineH;
                p.fill(0);
                p.text(topBudget[i] || '', panelLeft + 5, y);
                p.text(topCuisine[i] || '', panelLeft + colWidth + 5, y);
                p.text(topArea[i] || '', panelLeft + colWidth * 2 + 5, y);
            }
            p.pop();
        }
    };
})();