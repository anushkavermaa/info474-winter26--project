// replaced titles with screenshots of images for deliverable

(function () {
    let imgs = [];
  
    const imageFiles = [
      "images/viz_1.png",
      "images/viz_2.png",
      "images/viz_3.png",
      "images/viz_4.png",
      "images/viz_5.png",
      "images/viz_6.png"
    ];
  
    window.VizTitle = {
      draw: function (p, manager, ai, progress) {

        if (ai !== 0 && window.VizMap && typeof window.VizMap.hide === 'function') {
          window.VizMap.hide(p);
        }

        if (ai !== 5 && window.VizMapPoints && typeof window.VizMapPoints.hide === 'function') {
          window.VizMapPoints.hide(p);
        }

        // remove scatter controls & tooltip when leaving that slot
        if (ai !== 2) {
          var ctrl = document.querySelector('#vis .scatter-controls');
          if (ctrl) ctrl.remove();
          var tt = document.getElementById('scatter-tooltip');
          if (tt) tt.remove();
          // allow filters to be rebuilt next time
          manager._filtersBuilt = false;
        }
        // remove chef filters and tooltip when leaving the course 4 slot
        if (ai !== 4) {
          var rows = document.querySelectorAll('#vis .chef-filter-row');
          rows.forEach(function (r) { r.remove(); });
          var tooltip = document.getElementById('chef-tooltip');
          if (tooltip) tooltip.remove();
          manager._chefsFiltersBuilt = false;
        }

        // Show map as the first visualization.
        // ai=0 is the first section/visual slot.
        if (ai === 0 && window.VizMap && typeof window.VizMap.draw === 'function') {
          window.VizMap.draw(p, manager, ai, progress);
          return;
        }

        // Replace viz_2 screenshot with the real chart visualization.
        // ai=1 maps to imageFiles[1] which was "images/viz_2.png".
        if (ai === 1 && window.VizBar && typeof window.VizBar.draw === 'function') {
          window.VizBar.draw(p, manager, ai, progress);
          return;
        }

        // Replace viz_4 screenshot with a real chart.
        // ai=3 maps to imageFiles[3] which was "images/viz_4.png".
        if (ai === 3 && window.VizPriceRating && typeof window.VizPriceRating.draw === 'function') {
          window.VizPriceRating.draw(p, manager, ai, progress);
          return;
        }
  
        // override screenshot with real viz for some slots
        if (ai === 2 && window.VizScatter && typeof window.VizScatter.draw === 'function') {
          window.VizScatter.draw(p, manager, ai, progress);
          return;
        }

        // if this slot is the chef recommendations, draw the custom viz
        if (ai === 4 && window.VizChefs && typeof window.VizChefs.draw === 'function') {
          window.VizChefs.draw(p, manager, ai, progress);
          return;
        }

        // Final dessert section: point map from latitude/longitude.
        if (ai === 5 && window.VizMapPoints && typeof window.VizMapPoints.draw === 'function') {
          window.VizMapPoints.draw(p, manager, ai, progress);
          return;
        }

        // load images (only once each)
        for (let i = 0; i < imageFiles.length; i++) {
          if (!imgs[i]) imgs[i] = p.loadImage(imageFiles[i]);
        }
  
        const idx = Math.max(0, Math.min(ai, imageFiles.length - 1));
        const img = imgs[idx];
  
        const cx = (manager.offsetX || 0) + (manager.width || 600) / 2;
        const cy = (manager.offsetY || 0) + (manager.height || 520) / 2;
  
        p.push();
        p.imageMode(p.CENTER);
  
        if (img && img.width > 0) {
          const pad = 24;
          const maxW = (manager.width || 600) - pad * 2;
          const maxH = (manager.height || 520) - pad * 2;
  
          const scale = Math.min(maxW / img.width, maxH / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
  
          p.noStroke();
          p.fill(255, 250, 242);
          p.rect(cx - w/2 - 10, cy - h/2 - 10, w + 20, h + 20, 18);
  
          p.image(img, cx, cy, w, h);
        } else {
          p.noStroke();
          p.fill(0);
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(24);
          p.text("Loading...", cx, cy);
        }
  
        p.pop();
      }
    };
  
    // force all viz types to use the same screenshot renderer
    // window.VizBar = window.VizTitle;
    // window.VizScatter = window.VizTitle;
  
  })();