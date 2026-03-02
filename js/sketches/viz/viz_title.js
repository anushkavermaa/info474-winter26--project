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