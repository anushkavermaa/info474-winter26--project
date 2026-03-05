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
            div.style.display = 'flex';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'flex-start';
            div.style.gap = '3px';
            var sel = document.createElement('select');
            sel.id = id;
            sel.innerHTML = '<option value="">All</option>';
            sel.style.width = '100%';
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
        arr.sort(function (a, b) {
            if (b.star !== a.star) return b.star - a.star;  // primary: stars descending
            return b.count - a.count;  // secondary: review count descending
        });
        return arr.slice(0, 5); // return full objects, not just names
    }

    function ensureTooltip(manager) {
        var container = document.getElementById('vis');
        if (!container || document.getElementById('chef-tooltip')) return;
        var div = document.createElement('div');
        div.id = 'chef-tooltip';
        div.style.position = 'absolute';
        div.style.pointerEvents = 'none';
        div.style.zIndex = '1000';
        div.style.background = 'rgba(52, 37, 24, 0.92)';
        div.style.color = '#fff7eb';
        div.style.padding = '6px 8px';
        div.style.borderRadius = '4px';
        div.style.fontSize = '12px';
        div.style.display = 'none';
        container.appendChild(div);
    }

    function showTooltip(p, manager, restaurant) {
        ensureTooltip(manager);
        var tt = document.getElementById('chef-tooltip');
        if (!tt || !restaurant) {
            if (tt) tt.style.display = 'none';
            return;
        }
        var lines = [
            'Name: ' + restaurant.name,
            'Rating: ' + restaurant.star.toFixed(1),
            'Reviews: ' + restaurant.count,
            'Cuisine: ' + restaurant.cuisine,
            'Area: ' + restaurant.area
        ].filter(function(l) { return l && l.length; });
        tt.innerHTML = lines.join('<br>');
        var x = p.mouseX + 14;
        var y = p.mouseY - 8;
        tt.style.left = x + 'px';
        tt.style.top = y + 'px';
        tt.style.display = 'block';
    }

    function hideTooltip() {
        var tt = document.getElementById('chef-tooltip');
        if (tt) tt.style.display = 'none';
    }

    function truncateLabel(text, maxChars) {
        var s = String(text || '');
        if (s.length <= maxChars) return s;
        return s.slice(0, Math.max(0, maxChars - 3)) + '...';
    }

    function drawCategoryIcon(p, cx, cy, iconText) {
        var iconColor = p.color(111, 76, 44);
        p.push();
        p.noStroke();
        p.fill(235, 217, 193);
        p.ellipse(cx, cy, 24, 24);

        if (iconText === 'pin') {
            // simple map-pin glyph
            p.fill(iconColor);
            p.ellipse(cx, cy - 2, 9, 9);
            p.triangle(cx - 3, cy + 1, cx + 3, cy + 1, cx, cy + 7);
            p.fill(245, 232, 214);
            p.ellipse(cx, cy - 2, 3, 3);
        } else if (iconText === 'burger') {
            // simple burger glyph
            p.fill(iconColor);
            p.arc(cx, cy - 1, 10, 7, Math.PI, 0, p.CHORD);
            p.rect(cx - 5, cy, 10, 2, 1);
            p.rect(cx - 4, cy + 3, 8, 2, 1);
        } else if (iconText === '$') {
            p.fill(iconColor);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(12);
            p.text('$', cx, cy + 1);
        } else {
            p.fill(iconColor);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(12);
            p.text(iconText, cx, cy + 1);
        }
        p.pop();
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

            var panelWidth = manager.width || 600;
            var panelHeight = manager.height || 520;
            var canvasWidth = manager.canvasWidth || p.width;
            var canvasHeight = manager.canvasHeight || p.height;
            var panelLeft = Math.max(0, (canvasWidth - panelWidth) / 2);
            var panelTop = Math.max(0, (canvasHeight - panelHeight) / 2);

            p.push();
            p.noStroke();
            p.fill(28);
            p.textAlign(p.LEFT, p.BASELINE);
            p.textSize(22);
            p.text('Top 5 Restaurants Based on Category', panelLeft + 5, panelTop + 40);
            p.pop();

            var cardsTop = panelTop + 100;
            var cardsHeight = panelHeight - 120;
            var cardGap = 12;
            var cardWidth = (panelWidth - cardGap * 2) / 3;
            var rowH = 56;
            var listStartOffset = 96;
            var hoveredRestaurant = null;

            var categories = [
                { title: 'Budget Picks', icon: '$', items: topBudget },
                { title: 'Cuisine Picks', icon: 'burger', items: topCuisine },
                { title: 'Area Picks', icon: 'pin', items: topArea }
            ];

            p.push();
            for (var c = 0; c < categories.length; c++) {
                var cat = categories[c];
                var cardX = panelLeft + c * (cardWidth + cardGap);
                var cardY = cardsTop;

                p.noStroke();
                p.fill(252, 246, 236);
                p.rect(cardX, cardY, cardWidth, cardsHeight, 10);

                p.stroke(216, 200, 173);
                p.strokeWeight(1);
                p.noFill();
                p.rect(cardX, cardY, cardWidth, cardsHeight, 10);
                p.noStroke();

                drawCategoryIcon(p, cardX + 16, cardY + 18, cat.icon);
                p.fill(46, 32, 20);
                p.textAlign(p.LEFT, p.CENTER);
                p.textSize(13);
                p.text(cat.title, cardX + 32, cardY + 18);

                for (var i = 0; i < 5; i++) {
                    var item = cat.items[i];
                    if (!item) continue;

                    var rowX = cardX + 8;
                    var rowY = cardY + listStartOffset + i * rowH;
                    var rowW = cardWidth - 16;
                    var rowHover = p.mouseX >= rowX && p.mouseX <= rowX + rowW && p.mouseY >= rowY && p.mouseY <= rowY + (rowH - 6);

                    p.noStroke();
                    p.fill(rowHover ? p.color(244, 231, 211) : p.color(247, 238, 223));
                    p.rect(rowX, rowY, rowW, rowH - 6, 8);

                    p.fill(143, 79, 36);
                    p.ellipse(rowX + 12, rowY + 12, 18, 18);
                    p.fill(255, 247, 235);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.textSize(11);
                    p.text(String(i + 1), rowX + 12, rowY + 12);

                    p.fill(44, 31, 22);
                    p.textAlign(p.LEFT, p.TOP);
                    p.textSize(11);
                    p.text(truncateLabel(item.name, 20), rowX + 24, rowY + 4);

                    p.fill(93, 69, 47);
                    p.textAlign(p.LEFT, p.TOP);
                    p.textSize(10);
                    p.text('★ ' + item.star.toFixed(1), rowX + 24, rowY + 21);
                    p.text(item.count + ' reviews', rowX + 24, rowY + 33);

                    if (rowHover) {
                        hoveredRestaurant = item;
                    }
                }
            }
            p.pop();

            // show/hide tooltip based on hover
            if (hoveredRestaurant) {
                showTooltip(p, manager, hoveredRestaurant);
            } else {
                hideTooltip();
            }
        }
    };


    function positionFilters(manager) {
        var panelWidth = manager.width || 600;
        var panelHeight = manager.height || 520;
        var canvasWidth = manager.canvasWidth || panelWidth;
        var canvasHeight = manager.canvasHeight || panelHeight;
        var panelLeft = Math.max(0, (canvasWidth - panelWidth) / 2);
        var panelTop = Math.max(0, (canvasHeight - panelHeight) / 2);
        var cardsTop = panelTop + 100;
        var cardGap = 12;
        var cardWidth = (panelWidth - cardGap * 2) / 3;
        var filterTop = cardsTop + 40;

        var ids = ['chef-budget-filter', 'chef-cuisine-filter', 'chef-area-filter'];
        for (var i = 0; i < ids.length; i++) {
            var ctrl = document.getElementById(ids[i]);
            if (ctrl && ctrl.parentElement && ctrl.parentElement.classList.contains('chef-filter-row')) {
                var div = ctrl.parentElement;
                div.style.top = filterTop + 'px';
                div.style.left = (panelLeft + i * (cardWidth + cardGap) + 8) + 'px';
                div.style.width = Math.max(120, cardWidth - 16) + 'px';
            }
        }
    }
})();