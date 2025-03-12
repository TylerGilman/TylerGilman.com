// Ultra simple orbs - no escape sequences
var Aquarium = function(canvasId, options) {
  this.options = options || {};
  this.fishCount = this.options.fishCount || 20;
  this.canvas = document.getElementById(canvasId);
  this.orbs = [];
  
  // Start with minimal orbs and lazy load more
  this.initialOrbCount = this.options.initialOrbCount || Math.floor(this.fishCount * 0.3); // 30% to start
  this.maxOrbCount = this.fishCount;
  this.lazyLoadInterval = null;
  
  this.init = function() {
    if (this.canvas == null) return false;
    
    console.log("Initializing aquarium with canvas:", this.canvas);
    
    // Make canvas actual size match its DOM size
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    
    console.log("Canvas size:", this.canvas.width, "x", this.canvas.height);
    
    // Setup 3D scene with transparent background
    this.scene = new THREE.Scene();
    
    // Setup camera to cover the whole canvas (which is now 200vh tall)
    var aspectRatio = this.canvas.width / this.canvas.height;
    this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    
    // Position camera to see the entire canvas height
    this.camera.position.z = 60; // Increased to see more of the canvas
    
    // Setup renderer with alpha enabled for transparency
    this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,  // Enable transparency
        antialias: true
    });
    this.renderer.setSize(this.canvas.width, this.canvas.height, false);
    this.renderer.setClearColor(0x000000, 0);  // Transparent background
    
    // Handle window resize
    var self = this;
    window.addEventListener('resize', function() {
      // Update canvas dimensions
      self.canvas.width = self.canvas.clientWidth;
      self.canvas.height = self.canvas.clientHeight;
      
      // Update camera and renderer
      self.camera.aspect = self.canvas.width / self.canvas.height;
      self.camera.updateProjectionMatrix();
      self.renderer.setSize(self.canvas.width, self.canvas.height, false);
      
      console.log("Canvas resized:", self.canvas.width, "x", self.canvas.height);
    });
    
    // Add lights
    var light = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(light);
    
    var pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(0, 0, 30);
    this.scene.add(pointLight);
    
    var blueLight = new THREE.PointLight(0x0044ff, 1, 50);
    blueLight.position.set(-20, 10, 0);
    this.scene.add(blueLight);
    
    // Create orbs - they stay fixed in the viewport with position:fixed canvas
    this.createOrbs();
    
    console.log("Starting animation loop with " + this.orbs.length + " total orbs");
    
    // Start animation
    var self = this;
    
    // Define animation function
    function animate() {
      requestAnimationFrame(animate);
      
      // Apply any camera adjustments from scroll position
      self.updateCameraForScroll();
      
      // Calculate world bounds 
      var bounds = self.getWorldBounds();
      
      // Current time for animations
      var now = Date.now();
      
      // Move orbs - wrap in try/catch to ensure animation continues even if there's an error
      try {
        for(var i = 0; i < self.orbs.length; i++) {
          var orb = self.orbs[i];
          
          // Skip if orb is invalid
          if (!orb || !orb.position || !orb.velocity) continue;
          
          // Apply velocity normally - no scroll offset to worry about
          orb.position.x += orb.velocity.x;
          orb.position.y += orb.velocity.y;
          orb.position.z += orb.velocity.z;
          
          // X-axis bounce or wraparound
          if (orb.position.x < bounds.worldLeft) {
            // Either bounce
            orb.velocity.x *= -1; 
            orb.position.x = bounds.worldLeft + 1;
          } else if (orb.position.x > bounds.worldRight) {
            // Or bounce
            orb.velocity.x *= -1;
            orb.position.x = bounds.worldRight - 1;
          }
          
          // Y-axis bounce
          if (orb.position.y < bounds.worldTop) {
            orb.velocity.y *= -1;
            orb.position.y = bounds.worldTop + 1;
          } else if (orb.position.y > bounds.worldBottom) {
            orb.velocity.y *= -1;
            orb.position.y = bounds.worldBottom - 1;
          }
          
          // Z-axis bounce
          if (orb.position.z < -bounds.worldDepth/2 || orb.position.z > bounds.worldDepth/2) {
            orb.velocity.z *= -1;
          }
          
          // Special behavior for lazy-loaded orbs
          if (orb.userData && orb.userData.isLazyLoaded) {
            var ageInSeconds = (now - orb.userData.createdAt) / 1000;
            
            // For newly added orbs (first 3 seconds), apply special entrance behavior
            if (ageInSeconds < 3) {
              // Make them pulsate more dramatically and with more brightness
              if (orb.material) {
                orb.material.emissiveIntensity = 0.8 + Math.sin(now * 0.005 + i) * 0.6;
                
                // Slightly adjust color over time for shimmering effect
                var hue = orb.userData.originalHue + Math.sin(now * 0.002) * 0.05;
                orb.material.emissive.setHSL(hue, 0.9, 0.6);
              }
              
              // Maintain directed movement toward center with slight variance
              if (Math.random() < 0.1) {
                // Get distance from center
                var bounds = self.getWorldBounds();
                var centerX = (bounds.worldLeft + bounds.worldRight) / 2;
                var centerY = (bounds.worldTop + bounds.worldBottom) / 2;
                
                // Direction to center
                var dirX = centerX - orb.position.x;
                var dirY = centerY - orb.position.y;
                
                // Normalize
                var length = Math.sqrt(dirX*dirX + dirY*dirY);
                
                // Only adjust if not too close to center
                if (length > 5) {
                  dirX /= length;
                  dirY /= length;
                  
                  // Adjust velocity toward center with small random variance
                  orb.velocity.x = dirX * 0.15 + (Math.random() - 0.5) * 0.05;
                  orb.velocity.y = dirY * 0.15 + (Math.random() - 0.5) * 0.05;
                }
              }
            } else {
              // After 3 seconds, they behave like normal orbs
              orb.userData.isLazyLoaded = false;
            }
          }
          
          // Random direction changes for all orbs
          if (Math.random() < 0.02) {
            // Apply small random direction changes
            orb.velocity.x += (Math.random() - 0.5) * 0.05;
            orb.velocity.y += (Math.random() - 0.5) * 0.05;
            orb.velocity.z += (Math.random() - 0.5) * 0.03;
            
            // Ensure minimum speed
            var speed = Math.sqrt(
              orb.velocity.x * orb.velocity.x + 
              orb.velocity.y * orb.velocity.y + 
              orb.velocity.z * orb.velocity.z
            );
            
            if (speed < 0.05) {
              // Scale up to minimum speed
              var factor = 0.05 / Math.max(speed, 0.001); // Avoid division by zero
              orb.velocity.x *= factor;
              orb.velocity.y *= factor;
              orb.velocity.z *= factor;
            }
          }
          
          // Subtle pulsing effect for visual interest
          if (orb.material) {
            var pulseSpeed = 0.001;
            var intensity = 0.7 + Math.sin(now * pulseSpeed + i) * 0.3;
            orb.material.emissiveIntensity = intensity;
          }
          
          // Occasionally log orb position for debugging
          if (i === 0 && Math.random() < 0.001) {
            console.log("Orb position:", orb.position.x, orb.position.y, orb.position.z);
            console.log("Orb velocity:", orb.velocity.x, orb.velocity.y, orb.velocity.z);
          }
        }
      } catch (e) {
        console.error("Error in orb animation:", e);
      }
      
      // Render
      self.renderer.render(self.scene, self.camera);
    }
    
    // Start the animation loop
    console.log("Calling animate() to start animation loop");
    animate();
    
    return true;
  };
  
  // Get world bounds that match the canvas size (200vh tall)
  this.getWorldBounds = function() {
    // Calculate visible viewport area
    // Handle the case where THREE.MathUtils might not be available
    var vFOV = (THREE.MathUtils ? THREE.MathUtils.degToRad(this.camera.fov) : (this.camera.fov * Math.PI / 180));
    var visibleHeight = 2 * Math.tan(vFOV / 2) * this.camera.position.z;
    var visibleWidth = visibleHeight * this.camera.aspect;
    
    // The world should be the same size as the canvas: viewport width x 2*viewport height
    var worldWidth = visibleWidth; 
    var worldHeight = visibleHeight * 2; // Canvas is 200vh tall (2x viewport height)
    var worldDepth = 60; 
    
    // Calculate the top/bottom of each viewport area
    var firstViewportTop = -worldHeight/2;
    var firstViewportBottom = firstViewportTop + visibleHeight;
    var secondViewportTop = firstViewportBottom;
    var secondViewportBottom = worldHeight/2;
    
    return {
      // Visible viewport area (what's currently visible on screen)
      visibleWidth: visibleWidth,
      visibleHeight: visibleHeight,
      visibleLeft: -visibleWidth/2,
      visibleRight: visibleWidth/2,
      visibleTop: -visibleHeight/2,
      visibleBottom: visibleHeight/2,
      
      // Total world area (matches the 200vh canvas size)
      worldWidth: worldWidth,
      worldHeight: worldHeight,
      worldDepth: worldDepth,
      worldLeft: -worldWidth/2,
      worldRight: worldWidth/2,
      worldTop: -worldHeight/2, // Top of canvas
      worldBottom: worldHeight/2, // Bottom of canvas
      
      // Viewport sections (for spawning)
      firstViewportTop: firstViewportTop,
      firstViewportBottom: firstViewportBottom,
      secondViewportTop: secondViewportTop,
      secondViewportBottom: secondViewportBottom
    };
  };

  this.createOrbs = function() {
    var bounds = this.getWorldBounds();
    var count = this.initialOrbCount; // Start with fewer orbs for faster load
    
    console.log("Initial load with " + count + " orbs - all outside visible area");
    
    // Create initial orbs OUTSIDE the visible viewport
    // They'll move into view gradually
    
    for (var i = 0; i < count; i++) {
      // Create orb with varied sizes
      var size = 1 + Math.random() * 3;
      var geometry = new THREE.SphereGeometry(size, 16, 16);
      
      // Random color with more vibrant options
      var hue = Math.random();
      var saturation = 0.8 + Math.random() * 0.2; // High saturation
      var lightness = 0.5 + Math.random() * 0.3;  // Brighter
      var color = new THREE.Color().setHSL(hue, saturation, lightness);
      
      var material = new THREE.MeshPhongMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.7, // More glow
        shininess: 100,
        transparent: true,
        opacity: 0.9 // Slight transparency
      });
      
      var orb = new THREE.Mesh(geometry, material);
      
      // Position outside the visible area
      // Choose which side to spawn from
      var side = Math.floor(Math.random() * 4); // 0-3 = left, right, top, bottom
      
      switch(side) {
        case 0: // Left side
          orb.position.set(
            bounds.worldLeft - 10 - Math.random() * 30,  // Left of visible area
            bounds.worldTop + Math.random() * bounds.worldHeight, // Any height
            -bounds.worldDepth/2 + Math.random() * bounds.worldDepth // Any depth
          );
          break;
          
        case 1: // Right side
          orb.position.set(
            bounds.worldRight + 10 + Math.random() * 30, // Right of visible area
            bounds.worldTop + Math.random() * bounds.worldHeight, // Any height
            -bounds.worldDepth/2 + Math.random() * bounds.worldDepth // Any depth
          );
          break;
          
        case 2: // Top
          orb.position.set(
            bounds.worldLeft + Math.random() * bounds.worldWidth, // Any width
            bounds.worldTop - 10 - Math.random() * 30, // Above visible area
            -bounds.worldDepth/2 + Math.random() * bounds.worldDepth // Any depth
          );
          break;
          
        case 3: // Bottom
          orb.position.set(
            bounds.worldLeft + Math.random() * bounds.worldWidth, // Any width
            bounds.worldBottom + 10 + Math.random() * 30, // Below visible area
            -bounds.worldDepth/2 + Math.random() * bounds.worldDepth // Any depth
          );
          break;
      }
      
      // Velocity directed toward center of viewport
      var centerX = (bounds.worldLeft + bounds.worldRight) / 2;
      var centerY = (bounds.worldTop + bounds.worldBottom) / 2;
      
      // Direction vector to center
      var dirX = centerX - orb.position.x;
      var dirY = centerY - orb.position.y;
      
      // Normalize direction vector
      var length = Math.sqrt(dirX*dirX + dirY*dirY);
      dirX /= length;
      dirY /= length;
      
      // Apply velocity directed toward center with small random variance
      var speedFactor = 0.1 + Math.random() * 0.1; // Slightly faster to ensure they enter view
      orb.velocity = {
        x: dirX * speedFactor + (Math.random() - 0.5) * 0.05,
        y: dirY * speedFactor + (Math.random() - 0.5) * 0.05,
        z: (Math.random() - 0.5) * 0.05 // Small Z velocity
      };
      
      // Add metadata
      orb.userData = {
        size: size,
        originalHue: hue,
        createdAt: Date.now(),
        isLazyLoaded: true // Mark as lazy loaded for special effects
      };
      
      this.orbs.push(orb);
      this.scene.add(orb);
    }
    
    console.log("Created " + count + " initial orbs distributed across viewport");
    
    // Setup lazy loading of additional orbs
    this.setupLazyLoading();
  };
  
  // No longer needed - lazy loading handles additional orbs
  
  // Lazy loading is used instead of loading all orbs at once
  // Setup scroll tracking to move camera with scroll position
  this.setupScrollTracking = function() {
    // Track scroll position
    this.scrollY = 0;
    var self = this;
    window.addEventListener('scroll', function() {
      self.scrollY = window.scrollY;
    });
    
    // Initialize with current scroll position
    this.scrollY = window.scrollY;
  };
  
  // Setup lazy loading of orbs over time
  this.setupLazyLoading = function() {
    if (this.orbs.length >= this.maxOrbCount) {
      console.log("Already at max orb count, no lazy loading needed");
      return;
    }
    
    var self = this;
    var bounds = this.getWorldBounds();
    
    // Clear any existing interval
    if (this.lazyLoadInterval) {
      clearInterval(this.lazyLoadInterval);
    }
    
    // How many more orbs to add
    var remainingOrbs = this.maxOrbCount - this.orbs.length;
    
    // Time period over which to add orbs (milliseconds)
    var lazyLoadPeriod = 5000; // 5 seconds - spread out loading for better performance
    
    // How many batches to add
    var batchCount = 10; // More smaller batches for smoother appearance
    
    // Calculate orbs per batch
    var orbsPerBatch = Math.ceil(remainingOrbs / batchCount);
    
    // Time between batches
    var batchInterval = lazyLoadPeriod / batchCount;
    
    console.log("Lazy loading " + remainingOrbs + " more orbs in " + batchCount + " batches over " + lazyLoadPeriod/1000 + " seconds");
    
    var batchesAdded = 0;
    
    // Start interval to add orbs over time
    this.lazyLoadInterval = setInterval(function() {
      // Stop if we're at max
      if (self.orbs.length >= self.maxOrbCount) {
        clearInterval(self.lazyLoadInterval);
        console.log("Reached max orb count: " + self.orbs.length);
        return;
      }
      
      // Add a batch of orbs
      var batchSize = Math.min(orbsPerBatch, self.maxOrbCount - self.orbs.length);
      self.addOrbBatch(batchSize);
      
      batchesAdded++;
      
      // Stop after all batches
      if (batchesAdded >= batchCount) {
        clearInterval(self.lazyLoadInterval);
        console.log("Lazy loading complete. Total orbs: " + self.orbs.length);
      }
    }, batchInterval);
  };
  
  // Add a batch of orbs - placed outside initial view for better performance
  this.addOrbBatch = function(count) {
    var bounds = this.getWorldBounds();
    
    for (var i = 0; i < count; i++) {
      // Create orb with varied sizes
      var size = 1 + Math.random() * 3;
      var geometry = new THREE.SphereGeometry(size, 16, 16);
      
      // Random color with more vibrant options
      var hue = Math.random();
      var saturation = 0.8 + Math.random() * 0.2; // High saturation
      var lightness = 0.5 + Math.random() * 0.3;  // Brighter
      var color = new THREE.Color().setHSL(hue, saturation, lightness);
      
      var material = new THREE.MeshPhongMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.7, // More glow
        shininess: 100,
        transparent: true,
        opacity: 0.9 // Slight transparency
      });
      
      var orb = new THREE.Mesh(geometry, material);
      
      // Place orbs well outside the visible area
      // They'll move into view gradually with directed velocity
      var side = Math.floor(Math.random() * 4); // 0, 1, 2, 3 = left, right, top, bottom
      
      switch(side) {
        case 0: // Left side - far outside left edge
          orb.position.set(
            bounds.worldLeft - 20 - Math.random() * 40,  // Further outside left edge
            bounds.worldTop + Math.random() * bounds.worldHeight, // Any height
            -bounds.worldDepth/2 + Math.random() * bounds.worldDepth // Any depth
          );
          break;
        case 1: // Right side - far outside right edge
          orb.position.set(
            bounds.worldRight + 20 + Math.random() * 40, // Further outside right edge
            bounds.worldTop + Math.random() * bounds.worldHeight, // Any height
            -bounds.worldDepth/2 + Math.random() * bounds.worldDepth // Any depth
          );
          break;
        case 2: // Top - far above visible area
          orb.position.set(
            bounds.worldLeft + Math.random() * bounds.worldWidth, // Any width
            bounds.worldTop - 20 - Math.random() * 40, // Far above visible area
            -bounds.worldDepth/2 + Math.random() * bounds.worldDepth // Any depth
          );
          break;
        case 3: // Bottom - far below visible area
          orb.position.set(
            bounds.worldLeft + Math.random() * bounds.worldWidth, // Any width
            bounds.worldBottom + 20 + Math.random() * 40, // Far below visible area
            -bounds.worldDepth/2 + Math.random() * bounds.worldDepth // Any depth
          );
          break;
      }
      
      // Random velocity with moderate speed, directed toward center
      var centerX = (bounds.worldLeft + bounds.worldRight) / 2;
      var centerY = (bounds.worldTop + bounds.worldBottom) / 2;
      
      // Calculate direction toward center
      var dirX = centerX - orb.position.x;
      var dirY = centerY - orb.position.y;
      
      // Normalize direction
      var length = Math.sqrt(dirX*dirX + dirY*dirY);
      dirX /= length;
      dirY /= length;
      
      // Apply velocity toward center with random variance
      var speed = 0.1 + Math.random() * 0.1;
      orb.velocity = {
        x: dirX * speed + (Math.random() - 0.5) * 0.05,
        y: dirY * speed + (Math.random() - 0.5) * 0.05,
        z: (Math.random() - 0.5) * 0.05
      };
      
      // Add metadata
      orb.userData = {
        size: size,
        originalHue: hue,
        createdAt: Date.now(),
        isLazyLoaded: true
      };
      
      this.orbs.push(orb);
      this.scene.add(orb);
    }
    
    console.log("Lazy loaded " + count + " additional orbs, total: " + this.orbs.length);
  };
  
  // This function is intentionally empty - no scroll tracking needed
  // The canvas has position:fixed so it stays in place independent of scroll
  this.updateCameraForScroll = function() {
    // Intentionally empty - orbs are fixed in viewport
  };
};

// Global var for use in HTML
window.Aquarium = Aquarium;
