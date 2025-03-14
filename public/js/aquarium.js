// Procedural fish simulation
var Aquarium = function(canvasId, options) {
  this.options = options || {};
  this.fishCount = this.options.fishCount || 5;
  this.canvas = document.getElementById(canvasId);
  this.fish = [];
  this.elapsedTime = 0;
  
  // ConstrainedPoint class for fish segments
  class ConstrainedPoint {
    constructor(x, y, z, constraintRadius, speed, isHead = false) {
      this.position = new THREE.Vector3(x, y, z);
      this.constraintRadius = constraintRadius;
      this.previousPoint = null;
      this.nextPoint = null;
      this.isHead = isHead;
      this.angle = Math.random() * Math.PI * 2;
      this.speed = speed;
      this.velocityMultiplier = 1.0;
      
      // Random vertical movement factor
      this.verticalFactor = Math.random() * 0.5 + 0.5;
      
      // Wandering parameters
      this.wanderRadius = 0.5;
      this.wanderDistance = 2.0;
      this.wanderAngle = Math.random() * Math.PI * 2;
      this.wanderChange = 0.1;
      
      // Initialize velocity with slight Y component
      this.velocity = new THREE.Vector3(
        Math.cos(this.angle) * this.speed,
        Math.sin(this.angle) * this.speed * 0.3, // Add slight vertical movement
        Math.sin(this.angle) * this.speed
      );
      
      // Time offset for swimming pattern
      this.timeOffset = Math.random() * 1000;
      this.swimCycleSpeed = Math.random() * 0.5 + 0.5; // Different speeds for each fish
    }

    move(time) {
      if (!this.isHead) return;
      
      // Apply wander steering behavior
      this.wanderAngle += (Math.random() - 0.5) * this.wanderChange;
      
      const wanderX = Math.cos(this.wanderAngle) * this.wanderRadius;
      const wanderY = Math.sin(this.wanderAngle) * this.wanderRadius * this.verticalFactor;
      const wanderZ = Math.sin(this.wanderAngle) * this.wanderRadius;
      
      // Apply forces
      this.velocity.x += wanderX * 0.05;
      this.velocity.y += wanderY * 0.03;
      this.velocity.z += wanderZ * 0.05;
      
      // Normalize and scale by speed
      this.velocity.normalize().multiplyScalar(this.speed * this.velocityMultiplier);
      
      // Add a subtle swimming motion (up/down) based on time
      const swimFactor = Math.sin((time + this.timeOffset) * this.swimCycleSpeed) * 0.02;
      this.velocity.y += swimFactor;
      
      // Apply velocity
      this.position.add(this.velocity);
    }

    constrain() {
      if (this.previousPoint) {
        const direction = new THREE.Vector3().subVectors(this.position, this.previousPoint.position);
        const distance = direction.length();
        if (distance > this.constraintRadius) {
          direction.normalize();
          this.position.copy(this.previousPoint.position).add(direction.multiplyScalar(this.constraintRadius));
        }
      }
    }
  }

  // Fish class
  class Fish {
    constructor(x, y, z, color, speed) {
      this.color = color;
      this.speed = speed;
      this.group = new THREE.Group();
      this.points = [];
      this.meshes = [];
      this.targetPosition = new THREE.Vector3();
      this.avoidanceRadius = 10;
      this.seekWeight = 0.02;
      this.maxViewDistance = 15; // Maximum distance from camera where fish will try to stay visible
      
      // Unique behavior for each fish
      this.personalityType = Math.floor(Math.random() * 3); // 0=explorer, 1=social, 2=shy
      this.activityLevel = Math.random() * 0.5 + 0.75; // How active the fish is
      
      // Create tail fin geometry
      this.tailFinGeometry = new THREE.BufferGeometry();
      const tailVertices = new Float32Array([
        0, 0, 0,    // center
        0, 1.5, -1.2,  // top
        0, -1.5, -1.2   // bottom
      ]);
      this.tailFinGeometry.setAttribute('position', new THREE.BufferAttribute(tailVertices, 3));
      this.tailFinGeometry.setIndex([0, 1, 2]);
      this.tailFinGeometry.computeVertexNormals();
      
      // Create side fins geometry
      this.sideFinGeometry = new THREE.BufferGeometry();
      const sideVertices = new Float32Array([
        0, 0, 0,     // center
        1.2, 0, -1,  // right
        -1.2, 0, -1  // left
      ]);
      this.sideFinGeometry.setAttribute('position', new THREE.BufferAttribute(sideVertices, 3));
      this.sideFinGeometry.setIndex([0, 1, 2]);
      this.sideFinGeometry.computeVertexNormals();

      // Create points
      const numSegments = 8;
      const segmentSpacing = 0.8;
      
      for (let i = 0; i < numSegments; i++) {
        const point = new ConstrainedPoint(
          x + (i * segmentSpacing),
          y,
          z,
          segmentSpacing,
          speed * this.activityLevel,
          i === 0
        );
        this.points.push(point);
      }

      // Connect points
      for (let i = 1; i < this.points.length; i++) {
        this.points[i].previousPoint = this.points[i - 1];
        this.points[i - 1].nextPoint = this.points[i];
      }

      // Head has different shape - ellipsoid for better hydrodynamics
      const headGeometry = new THREE.SphereGeometry(1.0, 16, 16);
      headGeometry.scale(1.2, 0.8, 1.0); // Make it slightly flattened and elongated
      
      // Create body segments
      const sizes = [1.0, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4];
      for (let i = 0; i < this.points.length; i++) {
        const geometry = i === 0 ? headGeometry : new THREE.SphereGeometry(sizes[i], 16, 16);
        
        // Different material for head vs body
        const material = new THREE.MeshPhongMaterial({
          color: this.color,
          emissive: this.color,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.92,
          specular: new THREE.Color(0xffffff),
          shininess: i === 0 ? 80 : 30 // Make head more shiny
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(this.points[i].position);
        this.group.add(mesh);
        this.meshes.push(mesh);
        
        // Add fins to the middle of the body
        if (i === 2) {
          const finMaterial = new THREE.MeshPhongMaterial({
            color: this.color,
            emissive: this.color,
            emissiveIntensity: 0.3,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
          });
          
          const rightFin = new THREE.Mesh(this.sideFinGeometry.clone(), finMaterial);
          rightFin.rotation.y = Math.PI / 2;
          rightFin.scale.set(0.5, 0.5, 0.5);
          mesh.add(rightFin);
          
          const leftFin = new THREE.Mesh(this.sideFinGeometry.clone(), finMaterial);
          leftFin.rotation.y = -Math.PI / 2;
          leftFin.scale.set(0.5, 0.5, 0.5);
          mesh.add(leftFin);
        }
      }
      
      // Add tail fin to the last segment
      const tailMaterial = new THREE.MeshPhongMaterial({
        color: this.color,
        emissive: this.color,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      
      const tailFin = new THREE.Mesh(this.tailFinGeometry, tailMaterial);
      tailFin.position.set(0, 0, 0);
      tailFin.scale.set(0.7, 0.7, 0.7);
      this.meshes[this.meshes.length - 1].add(tailFin);
      
      // Add eyes to the head
      const eyeGeometry = new THREE.SphereGeometry(0.15, 8, 8);
      const eyeMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.5
      });
      
      const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      rightEye.position.set(0.5, 0.3, 0.6);
      this.meshes[0].add(rightEye);
      
      const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      leftEye.position.set(-0.5, 0.3, 0.6);
      this.meshes[0].add(leftEye);
      
      // Add pupil to each eye
      const pupilGeometry = new THREE.SphereGeometry(0.05, 8, 8);
      const pupilMaterial = new THREE.MeshPhongMaterial({
        color: 0x000000,
        emissive: 0x000000
      });
      
      const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
      rightPupil.position.set(0, 0, 0.1);
      rightEye.add(rightPupil);
      
      const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
      leftPupil.position.set(0, 0, 0.1);
      leftEye.add(leftPupil);
    }

    update(time, allFish, camera) {
      // Calculate a target position based on personality
      this.calculateTargetPosition(camera);
      
      // Apply seeking behavior to head with personality-based weights
      const head = this.points[0];
      
      // Direction to target
      const toTarget = new THREE.Vector3().subVectors(this.targetPosition, head.position);
      const distToTarget = toTarget.length();
      
      // Only seek if we're far from the target
      if (distToTarget > 2) {
        toTarget.normalize().multiplyScalar(this.seekWeight);
        head.velocity.add(toTarget);
        head.velocity.normalize().multiplyScalar(head.speed * head.velocityMultiplier);
      }
      
      // Avoid other fish
      this.avoidOtherFish(allFish);
      
      // Move fish with updated forces
      head.move(time);
      
      // Update constraints for body segments
      for (const point of this.points) {
        point.constrain();
      }

      // Update the mesh positions and rotations
      for (let i = 0; i < this.points.length; i++) {
        this.meshes[i].position.copy(this.points[i].position);
        
        // Orient the fish in the direction of movement
        if (i < this.points.length - 1) {
          const direction = new THREE.Vector3().subVectors(
            this.points[i].position,
            this.points[i + 1].position
          );
          
          if (direction.length() > 0.001) {
            this.meshes[i].lookAt(this.points[i + 1].position);
            // Rotate to align with movement direction
            this.meshes[i].rotateX(Math.PI / 2);
          }
        } else {
          // For the last segment, use the same orientation as the previous segment
          this.meshes[i].quaternion.copy(this.meshes[i-1].quaternion);
        }
      }
      
      // Add swimming motion to tail and fins
      if (this.meshes.length > 0) {
        const tailSegment = this.meshes[this.meshes.length - 1];
        if (tailSegment.children.length > 0) {
          const tailFin = tailSegment.children[0];
          tailFin.rotation.y = Math.sin(time * 5 * this.activityLevel) * 0.5;
        }
        
        // Add subtle motion to side fins
        if (this.meshes[2] && this.meshes[2].children.length >= 2) {
          const rightFin = this.meshes[2].children[0];
          const leftFin = this.meshes[2].children[1];
          
          rightFin.rotation.z = Math.sin(time * 3 * this.activityLevel) * 0.2;
          leftFin.rotation.z = -Math.sin(time * 3 * this.activityLevel) * 0.2;
        }
      }
    }
    
    avoidOtherFish(allFish) {
      const head = this.points[0];
      const avoidanceForce = new THREE.Vector3();
      
      for (const otherFish of allFish) {
        if (otherFish === this) continue;
        
        const otherHead = otherFish.points[0];
        const toOther = new THREE.Vector3().subVectors(head.position, otherHead.position);
        const distance = toOther.length();
        
        if (distance < this.avoidanceRadius) {
          // Calculate avoidance force (stronger when closer)
          const avoidStrength = 1 - Math.pow(distance / this.avoidanceRadius, 2);
          toOther.normalize().multiplyScalar(avoidStrength * 0.03);
          avoidanceForce.add(toOther);
        }
      }
      
      // Apply avoidance force
      head.velocity.add(avoidanceForce);
    }
    
    calculateTargetPosition(camera) {
      const head = this.points[0];
      const cameraPosition = new THREE.Vector3();
      camera.getWorldPosition(cameraPosition);
      
      // Calculate position relative to camera
      const toCam = new THREE.Vector3().subVectors(head.position, cameraPosition);
      const distanceFromCamera = toCam.length();
      
      // Determine if fish is visible
      const tooFar = distanceFromCamera > this.maxViewDistance;
      
      // Base target on personality type
      switch (this.personalityType) {
        case 0: // Explorer - wanders more widely but stays in view
          if (tooFar) {
            // If too far from camera, set target to a random position in front of camera
            this.targetPosition.set(
              (Math.random() - 0.5) * 30,
              (Math.random() - 0.5) * 20,
              (Math.random() - 0.5) * 15
            );
            
            // Increase speed to return to view
            head.velocityMultiplier = 1.5;
          } else {
            // Random wandering, occasionally changing target
            if (Math.random() < 0.01) {
              this.targetPosition.set(
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
              );
            }
            head.velocityMultiplier = 1.0;
          }
          break;
          
        case 1: // Social - stays in the center but moves around moderately
          if (tooFar) {
            // Return to center, but with some variation
            this.targetPosition.set(
              (Math.random() - 0.5) * 20,
              (Math.random() - 0.5) * 10,
              (Math.random() - 0.5) * 10
            );
            head.velocityMultiplier = 1.3;
          } else {
            // Occasionally pick new positions near center
            if (Math.random() < 0.02) {
              this.targetPosition.set(
                (Math.random() - 0.5) * 30,
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15
              );
            }
            head.velocityMultiplier = 0.9;
          }
          break;
          
        case 2: // Shy - stays closer to center and moves more slowly
          if (tooFar) {
            // Return to center quickly
            this.targetPosition.set(
              (Math.random() - 0.5) * 15,
              (Math.random() - 0.5) * 10,
              (Math.random() - 0.5) * 5
            );
            head.velocityMultiplier = 1.2;
          } else {
            // Small, cautious movements
            if (Math.random() < 0.03) {
              this.targetPosition.set(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
              );
            }
            head.velocityMultiplier = 0.8;
          }
          break;
      }
    }
  }

  this.init = function() {
    if (!this.canvas) return false;

    // Setup scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000816);

    // Setup camera (completely static)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 20);
    
    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Add environment
    this.addEnvironment();

    // Handle resize (only update renderer size)
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(width, height);
    });

    // Create fish with different colors
    const fishColors = [
      new THREE.Color(0x3498db), // blue
      new THREE.Color(0x2ecc71), // green
      new THREE.Color(0x9b59b6), // purple
      new THREE.Color(0xe74c3c), // red
      new THREE.Color(0xf1c40f), // yellow
      new THREE.Color(0x1abc9c), // teal
      new THREE.Color(0xe67e22), // orange
    ];
    
    for (let i = 0; i < this.fishCount; i++) {
      // Start fish in front of the camera but spread out
      const x = (Math.random() - 0.5) * 30;
      const y = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 15;
      
      // Select a color from the palette or slightly vary it
      const baseColor = fishColors[i % fishColors.length];
      const color = baseColor.clone().offsetHSL(
        (Math.random() - 0.5) * 0.05, // slight hue variation
        Math.random() * 0.1,          // slight saturation variation
        (Math.random() - 0.5) * 0.1   // slight lightness variation
      );
      
      const speed = 0.05 + Math.random() * 0.025;
      
      const fish = new Fish(x, y, z, color, speed);
      this.fish.push(fish);
      this.scene.add(fish.group);
    }

    this.animate();
    return true;
  };
  
  this.addEnvironment = function() {
    // Add ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Add directional light for main illumination and shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 2, 1);
    this.scene.add(directionalLight);
    
    // Add subtle point lights for water effect
    const pointLight1 = new THREE.PointLight(0x3498db, 0.4, 20);
    pointLight1.position.set(5, 5, 10);
    this.scene.add(pointLight1);
    
    const pointLight2 = new THREE.PointLight(0x2980b9, 0.4, 20);
    pointLight2.position.set(-5, -5, 10);
    this.scene.add(pointLight2);
    
    // Add subtle particles for water effect
    this.particles = new THREE.Group();
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 200;
    
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Position particles in a large cube
      positions[i3] = (Math.random() - 0.5) * 40;
      positions[i3 + 1] = (Math.random() - 0.5) * 30;
      positions[i3 + 2] = (Math.random() - 0.5) * 20;
      
      // Random sizes
      sizes[i] = Math.random() * 0.5 + 0.1;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Use a soft particle texture
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    
    this.particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.particleSystem);
  };
  
  this.updateParticles = function(time) {
    if (!this.particleSystem) return;
    
    const positions = this.particleSystem.geometry.attributes.position.array;
    
    // Slowly move particles
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += Math.sin(time * 0.01 + i * 0.1) * 0.01;
      positions[i + 1] += Math.cos(time * 0.01 + i * 0.1) * 0.01;
      
      // Reset particles that drift too far
      if (Math.abs(positions[i]) > 20) {
        positions[i] = (Math.random() - 0.5) * 40;
      }
      if (Math.abs(positions[i + 1]) > 20) {
        positions[i + 1] = (Math.random() - 0.5) * 30;
      }
      if (Math.abs(positions[i + 2]) > 10) {
        positions[i + 2] = (Math.random() - 0.5) * 20;
      }
    }
    
    this.particleSystem.geometry.attributes.position.needsUpdate = true;
  };

  this.animate = function() {
    requestAnimationFrame(this.animate.bind(this));
    this.elapsedTime += 0.01;

    // Update fish
    for (const fish of this.fish) {
      fish.update(this.elapsedTime, this.fish, this.camera);
    }
    
    // Update water particles
    this.updateParticles(this.elapsedTime);

    // Keep camera static at its initial position
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  };
};

window.Aquarium = Aquarium;