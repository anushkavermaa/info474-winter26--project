// viz_bar.js
// Tableau-style horizontal bar chart: distinct cuisines by Seattle neighborhood.
(function () {
    var CSV_FILE = 'data/NEWRestaurants_Seattle.csv';
    var TOP_N = 10;

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
            var values = splitCsvLine(lines[i]);
            rows.push(values);
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

    function buildAreaCounts(parsed) {
        var headers = parsed.headers || [];
        var rows = parsed.rows || [];

        var areaCol = findColIndex(headers, ['Area', 'area', 'Neighborhood', 'neighborhood']);
        var catCol = findColIndex(headers, [
            'Category - Split 1',
            'Category - Split1',
            'Category Split 1',
            'Category - Split',
            'Category'
        ]);

        if (areaCol === -1 || catCol === -1) {
            return { data: [], niceMax: 1, error: 'Required columns not found in CSV.' };
        }

        var areaToCats = new Map();

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i] || [];
            var area = String(row[areaCol] || '').trim();
            var cat = String(row[catCol] || '').trim();

            if (!area || !cat) continue;

            if (!areaToCats.has(area)) areaToCats.set(area, new Set());
            areaToCats.get(area).add(cat);
        }

        var areaCounts = Array.from(areaToCats, function (entry) {
            return { area: entry[0], count: entry[1].size };
        }).sort(function (a, b) {
            return b.count - a.count;
        });

        if (TOP_N > 0) areaCounts = areaCounts.slice(0, TOP_N);

        var maxVal = 1;
        for (var j = 0; j < areaCounts.length; j++) {
            if (areaCounts[j].count > maxVal) maxVal = areaCounts[j].count;
        }

        return {
            data: areaCounts,
            niceMax: makeNiceMax(maxVal),
            error: null
        };
    }

    function ensureData(manager) {
        if (manager._vizBarLoaded || manager._vizBarLoading) return;

        manager._vizBarLoading = true;
        fetch(CSV_FILE)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Failed to load CSV: ' + response.status);
                }
                return response.text();
            })
            .then(function (text) {
                var parsed = parseCSV(text);
                var processed = buildAreaCounts(parsed);
                manager._vizBarData = processed.data;
                manager._vizBarMax = processed.niceMax;
                manager._vizBarError = processed.error;
                manager._vizBarLoaded = true;
                manager._vizBarLoading = false;
            })
            .catch(function (err) {
                manager._vizBarData = [];
                manager._vizBarMax = 1;
                manager._vizBarError = (err && err.message) ? err.message : 'Unable to load chart data.';
                manager._vizBarLoaded = true;
                manager._vizBarLoading = false;
            });
    }

    function drawMessage(p, manager, text) {
        var centerX = (manager.offsetX || 0) + (manager.width || 600) / 2;
        var centerY = (manager.offsetY || 0) + (manager.height || 520) / 2;

        p.push();
        p.noStroke();
        p.fill(70);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(18);
        p.text(text, centerX, centerY);
        p.pop();
    }

    function drawFittedTitle(p, text, x, y, maxWidth) {
        var size = 25;
        p.textAlign(p.LEFT, p.BASELINE);
        p.fill(28);
        p.noStroke();

        while (size > 14) {
            p.textSize(size);
            if (p.textWidth(text) <= maxWidth) break;
            size -= 1;
        }

        p.text(text, x, y);
    }

    function drawTooltip(p, manager, textLine1, textLine2) {
        var padX = 10;
        var padY = 8;
        var lineGap = 5;
        var x = p.mouseX + 14;
        var y = p.mouseY - 10;

        p.push();
        p.textSize(12);
        p.textAlign(p.LEFT, p.TOP);

        var w = Math.max(p.textWidth(textLine1), p.textWidth(textLine2)) + padX * 2;
        var h = 12 + 12 + lineGap + padY * 2;

        var maxX = (manager.canvasWidth || p.width) - w - 6;
        var maxY = (manager.canvasHeight || p.height) - h - 6;
        x = Math.min(Math.max(6, x), Math.max(6, maxX));
        y = Math.min(Math.max(6, y), Math.max(6, maxY));

        p.noStroke();
        p.fill(33, 33, 33, 230);
        p.rect(x, y, w, h, 6);

        p.fill(255);
        p.text(textLine1, x + padX, y + padY);
        p.fill(215);
        p.text(textLine2, x + padX, y + padY + 12 + lineGap);
        p.pop();
    }

    window.VizBar = {
        draw: function (p, manager, ai, progress) {
            ensureData(manager);

            if (!manager._vizBarLoaded) {
                drawMessage(p, manager, 'Loading cuisine diversity chart...');
                return;
            }

            if (manager._vizBarError) {
                drawMessage(p, manager, manager._vizBarError);
                return;
            }

            var areaCounts = manager._vizBarData || [];
            if (!areaCounts.length) {
                drawMessage(p, manager, 'No chart data available.');
                return;
            }

            var panelLeft = manager.offsetX || 20;
            var panelTop = manager.offsetY || 0;
            var panelWidth = manager.width || 600;
            var panelHeight = manager.height || 520;

            var chart = {
                marginTop: panelTop + 72,
                marginRight: 28,
                marginBottom: 58,
                marginLeft: 170,
                barH: 24,
                gap: 10
            };

            var x0 = panelLeft + chart.marginLeft;
            var x1 = panelLeft + panelWidth - chart.marginRight;
            var y0 = chart.marginTop;
            var y1 = y0 + areaCounts.length * (chart.barH + chart.gap) - chart.gap;
            var plotW = Math.max(1, x1 - x0);
            var niceMax = Math.max(1, manager._vizBarMax || 1);
            var titleText = "Seattle's Most Diverse Food Neighborhoods";
            var titleX = panelLeft + 8;
            var titleY = panelTop + 38;
            var titleMaxWidth = panelWidth - 16;
            var hovered = null;

            p.push();
            drawFittedTitle(p, titleText, titleX, titleY, titleMaxWidth);

            p.stroke(225);
            p.line(x0, y1 + 8, x1, y1 + 8);

            var ticks = 8;
            for (var t = 0; t <= ticks; t++) {
                var ratio = t / ticks;
                var tx = p.lerp(x0, x1, ratio);
                p.stroke(235);
                p.line(tx, y0 - 6, tx, y1 + 8);

                p.noStroke();
                p.fill(110);
                p.textSize(11);
                p.textAlign(p.CENTER, p.TOP);
                p.text(Math.round(p.lerp(0, niceMax, ratio)), tx, y1 + 13);
            }

            p.noStroke();
            p.fill(85);
            p.textSize(13);
            p.textStyle(p.BOLD);
            p.textAlign(p.LEFT, p.BOTTOM);
            p.text('Area', panelLeft + 8, y0 - 4);
            p.textStyle(p.NORMAL);

            for (var i = 0; i < areaCounts.length; i++) {
                var item = areaCounts[i];
                var y = y0 + i * (chart.barH + chart.gap);
                var barW = p.map(item.count, 0, niceMax, 0, plotW);
                var isHover = p.mouseX >= x0 && p.mouseX <= x0 + barW && p.mouseY >= y && p.mouseY <= y + chart.barH;

                p.noStroke();
                p.fill(90);
                p.textSize(13);
                p.textAlign(p.LEFT, p.CENTER);
                p.text(item.area, panelLeft + 8, y + chart.barH / 2);

                p.fill(isHover ? p.color(0, 120, 0) : p.color(0, 100, 0));
                p.rect(x0, y, barW, chart.barH, 2);

                p.fill(22);
                p.textAlign(p.LEFT, p.CENTER);
                p.text(item.count, x0 + barW + 8, y + chart.barH / 2);

                if (isHover) {
                    hovered = item;
                }
            }

            p.fill(80);
            p.noStroke();
            p.textSize(14);
            p.textStyle(p.BOLD);
            p.textAlign(p.CENTER, p.BASELINE);
            p.text('Number of Distinct Cuisines', (x0 + x1) / 2, y1 + 48);
            p.textStyle(p.NORMAL);

            if (hovered) {
                drawTooltip(
                    p,
                    manager,
                    hovered.area,
                    'Distinct cuisines: ' + hovered.count
                );
            }
            p.pop();
        }
    };
})();
