// viz_price_rating.js
// Star distribution by Price as a true boxplot (replaces viz_4.png).
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

    function toPriceBucket(rawPrice) {
        var price = String(rawPrice || '').trim();
        if (price === '$' || price === '$$' || price === '$$$' || price === '$$$$') return price;
        return null;
    }

    function quantile(sortedValues, q) {
        if (!sortedValues.length) return NaN;
        if (sortedValues.length === 1) return sortedValues[0];
        var pos = (sortedValues.length - 1) * q;
        var base = Math.floor(pos);
        var rest = pos - base;
        var next = sortedValues[Math.min(base + 1, sortedValues.length - 1)];
        return sortedValues[base] + rest * (next - sortedValues[base]);
    }

    function processData(parsed) {
        var headers = parsed.headers || [];
        var rows = parsed.rows || [];

        var priceCol = findColIndex(headers, ['Price', 'price', 'Price Level', 'price level']);
        var starCol = findColIndex(headers, ['Star', 'Stars', 'Rating', 'Average Rating']);

        if (priceCol === -1 || starCol === -1) {
            return { data: [], error: 'Required columns (Price, Star) not found.' };
        }

        var groups = {
            '$': [],
            '$$': [],
            '$$$': [],
            '$$$$': []
        };

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i] || [];
            var bucket = toPriceBucket(row[priceCol]);
            if (!bucket) continue;

            var star = parseFloat(row[starCol]);
            if (!isFinite(star)) continue;
            groups[bucket].push(star);
        }

        var order = ['$', '$$', '$$$', '$$$$'];
        var out = [];

        for (var j = 0; j < order.length; j++) {
            var bucketName = order[j];
            var values = groups[bucketName].slice().sort(function (a, b) { return a - b; });
            if (!values.length) continue;

            var q1 = quantile(values, 0.25);
            var median = quantile(values, 0.5);
            var q3 = quantile(values, 0.75);
            var iqr = q3 - q1;
            var lowerFence = q1 - 1.5 * iqr;
            var upperFence = q3 + 1.5 * iqr;

            var whiskerLow = values[0];
            var whiskerHigh = values[values.length - 1];
            var outliers = [];
            var sum = 0;

            for (var k = 0; k < values.length; k++) {
                var value = values[k];
                sum += value;

                if (value < lowerFence || value > upperFence) {
                    outliers.push(value);
                } else {
                    whiskerLow = Math.min(whiskerLow, value);
                    whiskerHigh = Math.max(whiskerHigh, value);
                }
            }

            out.push({
                price: bucketName,
                count: values.length,
                mean: sum / values.length,
                q1: q1,
                median: median,
                q3: q3,
                whiskerLow: whiskerLow,
                whiskerHigh: whiskerHigh,
                outliers: outliers
            });
        }

        return { data: out, error: null };
    }

    function ensureData(manager) {
        if (manager._vizPriceLoaded || manager._vizPriceLoading) return;

        manager._vizPriceLoading = true;
        fetch(CSV_FILE)
            .then(function (response) {
                if (!response.ok) throw new Error('Failed to load CSV: ' + response.status);
                return response.text();
            })
            .then(function (text) {
                var parsed = parseCSV(text);
                var processed = processData(parsed);
                manager._vizPriceData = processed.data;
                manager._vizPriceError = processed.error;
                manager._vizPriceLoaded = true;
                manager._vizPriceLoading = false;
            })
            .catch(function (err) {
                manager._vizPriceData = [];
                manager._vizPriceError = (err && err.message) ? err.message : 'Unable to load chart data.';
                manager._vizPriceLoaded = true;
                manager._vizPriceLoading = false;
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

    window.VizPriceRating = {
        draw: function (p, manager, ai, progress) {
            ensureData(manager);

            if (!manager._vizPriceLoaded) {
                drawMessage(p, manager, 'Loading price vs rating chart...');
                return;
            }
            if (manager._vizPriceError) {
                drawMessage(p, manager, manager._vizPriceError);
                return;
            }

            var points = manager._vizPriceData || [];
            if (!points.length) {
                drawMessage(p, manager, 'No price/rating data available.');
                return;
            }

            var panelLeft = manager.offsetX || 20;
            var panelTop = manager.offsetY || 0;
            var panelWidth = manager.width || 600;
            var panelHeight = manager.height || 520;

            var chart = {
                left: panelLeft + 70,
                right: panelLeft + panelWidth - 30,
                top: panelTop + 86,
                bottom: panelTop + panelHeight - 86
            };

            var yMin = 1.5;
            var yMax = 5;

            p.push();
            p.noStroke();
            p.fill(28);
            p.textAlign(p.LEFT, p.BASELINE);
            p.textSize(24);
            p.text('Are Pricier Restaurants Actually Better Rated?', panelLeft + 8, panelTop + 40);

            p.stroke(225);
            p.line(chart.left, chart.bottom, chart.right, chart.bottom);
            p.line(chart.left, chart.top, chart.left, chart.bottom);

            for (var yTick = yMin; yTick <= yMax + 0.001; yTick += 0.5) {
                var ty = p.map(yTick, yMin, yMax, chart.bottom, chart.top);
                p.stroke(235);
                p.line(chart.left, ty, chart.right, ty);
                p.noStroke();
                p.fill(105);
                p.textSize(11);
                p.textAlign(p.RIGHT, p.CENTER);
                p.text(yTick.toFixed(1), chart.left - 8, ty);
            }

            var span = Math.max(1, points.length - 1);
            var centerX = (chart.left + chart.right) / 2;
            var step = 72;
            p.textStyle(p.NORMAL);

            for (var i = 0; i < points.length; i++) {
                var item = points[i];
                var x = centerX + (i - span / 2) * step;
                var yQ1 = p.map(item.q1, yMin, yMax, chart.bottom, chart.top);
                var yMedian = p.map(item.median, yMin, yMax, chart.bottom, chart.top);
                var yQ3 = p.map(item.q3, yMin, yMax, chart.bottom, chart.top);
                var yLow = p.map(item.whiskerLow, yMin, yMax, chart.bottom, chart.top);
                var yHigh = p.map(item.whiskerHigh, yMin, yMax, chart.bottom, chart.top);
                var yMean = p.map(item.mean, yMin, yMax, chart.bottom, chart.top);
                var boxW = 54;

                p.stroke(80, 120, 80);
                p.line(x, yHigh, x, yQ3);
                p.line(x, yQ1, x, yLow);
                p.line(x - 11, yHigh, x + 11, yHigh);
                p.line(x - 11, yLow, x + 11, yLow);

                p.stroke(0);
                p.strokeWeight(1);
                p.fill(0, 110, 0, 170);
                p.rectMode(p.CENTER);
                p.rect(x, (yQ1 + yQ3) / 2, boxW, Math.max(2, yQ1 - yQ3));
                p.rectMode(p.CORNER);

                p.stroke(25);
                p.strokeWeight(2);
                p.line(x - boxW / 2, yMedian, x + boxW / 2, yMedian);
                p.strokeWeight(1);

                p.stroke(0);
                p.strokeWeight(2);
                p.line(x - boxW / 2, yMean, x + boxW / 2, yMean);
                p.strokeWeight(1);

                for (var o = 0; o < item.outliers.length; o++) {
                    var outY = p.map(item.outliers[o], yMin, yMax, chart.bottom, chart.top);
                    p.fill(130, 50, 30);
                    p.ellipse(x, outY, 5, 5);
                }

                p.noStroke();
                p.fill(30);
                p.textSize(12);
                p.textAlign(p.CENTER, p.TOP);
                p.text(item.price, x, chart.bottom + 10);
            }

            p.fill(70);
            p.textSize(13);
            p.textStyle(p.BOLD);
            p.textAlign(p.LEFT, p.BOTTOM);
            p.text('Average Star Rating', panelLeft + 8, chart.top - 8);

            p.textStyle(p.BOLD);
            p.textAlign(p.CENTER, p.BASELINE);
            p.text('Price', (chart.left + chart.right) / 2, chart.bottom + 46);
            p.textStyle(p.NORMAL);
            p.pop();
        }
    };
})();
