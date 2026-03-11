// viz_scatter.js
// Scatterplot: star rating (y) vs review count (x), highlighting hidden gems.
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
        for (var i = 1; i < lines.length; i++) {
            rows.push(splitCsvLine(lines[i]));
        }
        return { headers: headers, rows: rows };
    }

    function findColIndex(headers, candidateNames) {
        var normalized = headers.map(normalizeHeader);
        for (var i = 0; i < candidateNames.length; i++) {
            var idx = normalized.indexOf(normalizeHeader(candidateNames[i]));
            if (idx !== -1) return idx;
        }
        return -1;
    }

    function makeNiceMax(maxValue) {
        if (maxValue <= 5) return 5;
        if (maxValue <= 10) return 10;
        if (maxValue <= 20) return 20;
        if (maxValue <= 30) return 30;
        if (maxValue <= 40) return 40;
        var p = Math.pow(10, Math.floor(Math.log10(maxValue)));
        return Math.ceil(maxValue / p) * p;
    }

    function processData(parsed) {
        var headers = parsed.headers || [];
        var rows = parsed.rows || [];

        // find the columns we'll need
        var ratingCol = findColIndex(headers, ['Star', 'Stars', 'Rating', 'Average Rating']);
        var countCol = findColIndex(headers, ['Stars count', 'Review Count', 'Number of Reviews']);
        var gemCol = findColIndex(headers, ['Hidden Gem', 'hidden gem']);
        var areaCol = findColIndex(headers, ['Area', 'area', 'Neighborhood', 'neighborhood']);
        var cuisineCol = findColIndex(headers, [
            'Category - Split 1', 'Category - Split1', 'Category Split 1',
            'Category - Split', 'Category'
        ]);

        if (ratingCol === -1 || countCol === -1) {
            return { data: [], error: 'Required columns not found in CSV.' };
        }

        var out = [];
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i] || [];
            var rating = parseFloat(row[ratingCol]);
            var count = parseInt(row[countCol], 10);
            if (!isFinite(rating) || isNaN(count)) continue;
            // only include high ratings
            if (rating < 4.5 || count > 150) continue;

            var gem = false;
            if (gemCol !== -1) {
                var v = String(row[gemCol] || '').trim().toLowerCase();
                if (v === 'hidden gem') gem = true;
            }

            var area = areaCol !== -1 ? String(row[areaCol] || '').trim() : '';
            var cuisine = cuisineCol !== -1 ? String(row[cuisineCol] || '').trim() : '';

            out.push({ rating: rating, count: count, gem: gem, area: area, cuisine: cuisine });
        }
        return { data: out, error: null };
    }

    function ensureData(manager) {
        if (manager._vizScatterLoaded || manager._vizScatterLoading) return;
        manager._vizScatterLoading = true;
        fetch(CSV_FILE)
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to load CSV: ' + res.status);
                return res.text();
            })
            .then(function (text) {
                var parsed = parseCSV(text);
                var processed = processData(parsed);
                manager._vizScatterData = processed.data;
                manager._vizScatterError = processed.error;
                manager._vizScatterLoaded = true;
                manager._vizScatterLoading = false;
                buildFilterOptions(manager);
            })
            .catch(function (err) {
                manager._vizScatterData = [];
                manager._vizScatterError = (err && err.message) ? err.message : 'Unable to load scatter data.';
                manager._vizScatterLoaded = true;
                manager._vizScatterLoading = false;
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

    // filter UI helpers ----------------------------------------------------
    function ensureFilters(manager) {
        var container = document.getElementById('vis');
        if (!container || document.getElementById('scatter-area-filter')) return;
        var div = document.createElement('div');
        div.className = 'scatter-controls';

        var areaSel = document.createElement('select');
        areaSel.id = 'scatter-area-filter';
        areaSel.innerHTML = '<option value="">All areas</option>';
        div.appendChild(areaSel);

        var cuisineSel = document.createElement('select');
        cuisineSel.id = 'scatter-cuisine-filter';
        cuisineSel.innerHTML = '<option value="">All cuisines</option>';
        div.appendChild(cuisineSel);

        container.appendChild(div);

        areaSel.addEventListener('change', function () { manager._filterDirty = true; });
        cuisineSel.addEventListener('change', function () { manager._filterDirty = true; });
    }

    function buildFilterOptions(manager) {
        if (!manager._vizScatterLoaded || !manager._vizScatterData || manager._filtersBuilt) return;
        ensureFilters(manager);
        var areas = new Set();
        var cuisines = new Set();
        manager._vizScatterData.forEach(function (pt) {
            if (pt.area) areas.add(pt.area);
            if (pt.cuisine) cuisines.add(pt.cuisine);
        });
        var areaSel = document.getElementById('scatter-area-filter');
        var cuisineSel = document.getElementById('scatter-cuisine-filter');
        if (areaSel) {
            Array.from(areas).sort().forEach(function (a) {
                var opt = document.createElement('option');
                opt.value = a;
                opt.textContent = a;
                areaSel.appendChild(opt);
            });
        }
        if (cuisineSel) {
            Array.from(cuisines).sort().forEach(function (c) {
                var opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                cuisineSel.appendChild(opt);
            });
        }
        manager._filtersBuilt = true;
    }

    // HTML tooltip element floats above filters
    function ensureTooltip(manager) {
        var container = document.getElementById('vis');
        if (!container || document.getElementById('scatter-tooltip')) return;
        var div = document.createElement('div');
        div.id = 'scatter-tooltip';
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

    function drawTooltip(p, manager, item) {
        ensureTooltip(manager);
        var tt = document.getElementById('scatter-tooltip');
        if (!tt || !item) {
            if (tt) tt.style.display = 'none';
            return;
        }
        var lines = [
            'Rating: ' + item.rating.toFixed(1),
            'Reviews: ' + item.count,
            'Area: ' + item.area,
            'Cuisine: ' + item.cuisine,
            (item.gem ? 'Hidden Gem' : '')
        ].filter(function(l) { return l && l.length; });
        tt.innerHTML = lines.join('<br>');
        var x = p.mouseX + 14;
        var y = p.mouseY - 8;
        tt.style.left = x + 'px';
        tt.style.top = y + 'px';
        tt.style.display = 'block';
    }

    window.VizScatter = {
        draw: function (p, manager, ai, progress) {
            ensureData(manager);
            // make sure controls exist each time we draw (they’re removed when not active)
            ensureFilters(manager);

            if (!manager._vizScatterLoaded) {
                drawMessage(p, manager, 'Loading scatter plot...');
                return;
            }
            if (manager._vizScatterError) {
                drawMessage(p, manager, manager._vizScatterError);
                return;
            }
            var points = manager._vizScatterData || [];
            if (!points.length) {
                drawMessage(p, manager, 'No scatter data available.');
                return;
            }
            // apply area/cuisine filters if present
            var areaFilter = document.getElementById('scatter-area-filter') && document.getElementById('scatter-area-filter').value;
            var cuisineFilter = document.getElementById('scatter-cuisine-filter') && document.getElementById('scatter-cuisine-filter').value;
            if (areaFilter || cuisineFilter) {
                points = points.filter(function (pt) {
                    if (areaFilter && pt.area !== areaFilter) return false;
                    if (cuisineFilter && pt.cuisine !== cuisineFilter) return false;
                    return true;
                });
            }
            if (!points.length) {
                drawMessage(p, manager, 'No restaurants match those filters.');
                return;
            }

            var panelWidth = manager.width || 600;
            var panelHeight = manager.height || 520;
            var canvasWidth = manager.canvasWidth || p.width;
            var canvasHeight = manager.canvasHeight || p.height;
            var panelLeft = Math.max(0, (canvasWidth - panelWidth) / 2);
            var panelTop = Math.max(0, (canvasHeight - panelHeight) / 2);

            var chart = {
                left: panelLeft + 60,
                right: panelLeft + panelWidth - 160,
                top: panelTop + 120,
                bottom: panelTop + 290
            };

            // fixed y range 4.0-5 (only high ratings will be plotted >= 4.5) and compute nice x max
            var yMin = 4.0;
            var yMax = 5;
            var maxCount = 0;
            for (var i = 0; i < points.length; i++) {
                if (points[i].count > maxCount) maxCount = points[i].count;
            }
            var xMin = 0;
            var xMax = 150;

            p.push();
            // title
            p.noStroke();
            p.fill(28);
            p.textAlign(p.LEFT, p.BASELINE);
            p.textSize(24);
            p.text('Hidden Gems in Seattle', panelLeft + 8, panelTop + 40);

            // axes
            p.stroke(225);
            p.line(chart.left, chart.bottom, chart.right, chart.bottom);
            p.line(chart.left, chart.top, chart.left, chart.bottom);

            // legend/key placed on right side, aligned with chart
            p.push();
            p.noStroke();
            p.textSize(12);
            var controlsRightX = chart.right + 20;
            var controlsTopY = chart.top - 25;
            // hidden gems first (capitalized)
            p.fill(p.color('#8f4f24'));
            p.ellipse(controlsRightX, controlsTopY, 8, 8);
            p.fill(105);
            p.textAlign(p.LEFT, p.CENTER);
            p.text('Hidden Gems', controlsRightX + 12, controlsTopY);
            // other (capitalized)
            p.fill(80);
            p.ellipse(controlsRightX, controlsTopY + 20, 8, 8);
            p.fill(105);
            p.text('Other', controlsRightX + 12, controlsTopY + 20);
            p.pop();

            // y ticks (only label 4.5 and 5.0, but draw gridline for 4.0)
            for (var yTick = yMin; yTick <= yMax + 0.001; yTick += 0.25) {
                var ty = p.map(yTick, yMin, yMax, chart.bottom, chart.top);
                // gridline for all ticks
                p.stroke(235);
                p.line(chart.left, ty, chart.right, ty);
                // label only for 4.5 and 5.0
                if (yTick === 4.5 || yTick === 5.0) {
                    p.noStroke();
                    p.fill(105);
                    p.textSize(11);
                    p.textAlign(p.RIGHT, p.CENTER);
                    p.text(yTick.toFixed(1), chart.left - 8, ty);
                }
            }

            // x ticks: choose a nice constant step based on the current maximum
            // label every 1000; compute how many ticks we need so no multiples are skipped
            var step = 25;
            if (xMax < step) {
                // if max is smaller than step, just draw one tick at the max
                step = xMax;
            }
            for (var value = 0; value <= xMax; value += step) {
                var ratio = xMax > 0 ? value / xMax : 0;
                var tx = p.lerp(chart.left, chart.right, ratio);
                p.stroke(235);
                p.line(tx, chart.top, tx, chart.bottom);
                p.noStroke();
                p.fill(105);
                p.textSize(11);
                p.textAlign(p.CENTER, p.TOP);
                p.text(Math.round(value), tx, chart.bottom + 6);
            }

            // draw points
            var hovered = null;
            for (var i = 0; i < points.length; i++) {
                var item = points[i];
                var px = p.map(item.count, xMin, xMax, chart.left, chart.right);
                var py = p.map(item.rating, yMin, yMax, chart.bottom, chart.top);
                var r = 6;
                var isHover = p.dist(p.mouseX, p.mouseY, px, py) <= r + 2;
                if (isHover) hovered = item;

                p.noStroke();
                if (item.gem) {
                    p.fill(isHover ? p.color(143, 79, 36, 220) : p.color(178, 118, 69, 190));
                } else {
                    p.fill(isHover ? p.color(131, 107, 81, 140) : p.color(131, 107, 81, 110));
                }
                p.ellipse(px, py, r * 2, r * 2);
            }

            // axis labels
            p.fill(70);
            p.textSize(13);
            p.textStyle(p.BOLD);
            p.textAlign(p.LEFT, p.BOTTOM);
            p.text('Star Rating', panelLeft + 8, chart.top - 25);

            p.textAlign(p.CENTER, p.BASELINE);
            p.text('Review Count', (chart.left + chart.right) / 2, chart.bottom + 46);
            p.textStyle(p.NORMAL);

            // draw tooltip regardless; passing null will cause it to hide
            drawTooltip(p, manager, hovered);

            p.pop();
        }
    };
})();
