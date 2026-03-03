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

        function makeControl(id, labelText) {
            var div = document.createElement('div');
            div.className = 'chef-filter-row';
            var label = document.createElement('label');
            label.textContent = labelText;
            div.appendChild(label);
            var sel = document.createElement('select');
            sel.id = id;
            sel.innerHTML = '<option value="">All</option>';
            div.appendChild(sel);
            container.appendChild(div);
            return sel;
        }

        var budgetSel = makeControl('chef-budget-filter', 'Budget:');
        var cuisineSel = makeControl('chef-cuisine-filter', 'Cuisine:');
        var areaSel = makeControl('chef-area-filter', 'Area:');

        [budgetSel, cuisineSel, areaSel].forEach(function (sel) {
            sel.addEventListener('change', function () { manager._filterDirty = true; });
        });
        positionFilters(manager);
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

        // reposition now that filters exist
        positionFilters(manager);
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
            positionFilters(manager);

            var topBudget = rankTop5(data, 'price', budgetVal);
            var topCuisine = rankTop5(data, 'cuisine', cuisineVal);
            var topArea = rankTop5(data, 'area', areaVal);

            var panelLeft = manager.offsetX || 20;
            var panelTop = manager.offsetY || 0;
            var panelWidth = manager.width || 600;
            var panelHeight = manager.height || 520;

            // overall title (match style used by other viz modules)
            p.push();
            p.noStroke();
            p.fill(28);
            p.textAlign(p.LEFT, p.BASELINE);
            p.textSize(24);
            p.text('Top 5 Restaurants Based on Category', panelLeft + 5, panelTop + 40);
            p.pop();

            var sectionGap = 160; // more vertical space between categories
            var lineH = 20;
            var filterHeight = 30; // approximate control height
            var startY = panelTop + 60 + 10 + filterHeight; // lists start below filters

            p.push();
            p.fill(0);
            p.textAlign(p.LEFT, p.TOP);
            p.textSize(14);

            // budget section
            for (var i = 0; i < 5; i++) {
                var y = startY + i * lineH;
                p.text(topBudget[i] || '', panelLeft + 5, y);
            }

            // cuisine section
            var cuisineY = startY + sectionGap;
            for (var i = 0; i < 5; i++) {
                var y = cuisineY + i * lineH;
                p.text(topCuisine[i] || '', panelLeft + 5, y);
            }

            // area section
            var areaY = cuisineY + sectionGap;
            for (var i = 0; i < 5; i++) {
                var y = areaY + i * lineH;
                p.text(topArea[i] || '', panelLeft + 5, y);
            }
            p.pop();
        }
    };


    function positionFilters(manager) {
        var panelTop = manager.offsetY || 0;
        var filterHeight = 30;
        var startY = panelTop + 60 + 10 + filterHeight; // match draw startY
        var sectionGap = 160;
        var offset = filterHeight + 8; // bigger gap above filter rows
        var rows = [startY, startY + sectionGap, startY + 2 * sectionGap];
        var ids = ['chef-budget-filter', 'chef-cuisine-filter', 'chef-area-filter'];
        for (var i = 0; i < ids.length; i++) {
            var ctrl = document.getElementById(ids[i]);
            if (ctrl && ctrl.parentElement && ctrl.parentElement.classList.contains('chef-filter-row')) {
                var div = ctrl.parentElement;
                div.style.top = (rows[i] - offset) + 'px';
                div.style.left = '20px';
            }
        }
    }
})();