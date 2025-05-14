// Procedural fish simulation
var Aquarium = function(canvasId, options) {
  this.options = options || {};
  this.fishCount = this.options.fishCount || 20; // Significantly more fish for schooling
  this.canvas = document.getElementById(canvasId);
  this.fish = [];
  this.elapsedTime = 0;
  
  // ConstrainedPoint class for fish segments
  class ConstrainedPoint {
    constructor(x, y, z, constraintRadius, speed, isHead = false, radius = 1.0) {
      this.position = new THREE.Vector3(x, y, z);
      this.constraintRadius = constraintRadius * 0.7; // Tighter constraints for better following
      this.previousPoint = null;
      this.nextPoint = null;
      this.isHead = isHead;
      this.angle = Math.random() * Math.PI * 2;
      this.speed = speed;
      this.elapsedTime = 0; // Track time for waving motion
      this.velocityMultiplier = 1.0;
      this.radius = radius; // Size of this segment
      
      // For determining the shape of the segment
      this.tangent = new THREE.Vector3(1, 0, 0); // Default tangent direction
      this.normal = new THREE.Vector3(0, 1, 0);  // Default normal direction
      this.binormal = new THREE.Vector3(0, 0, 1); // Default binormal direction
      
      // Random vertical movement factor
      this.verticalFactor = Math.random() * 0.8 + 0.7; // Increased for more vertical movement
      
      // Wandering parameters
      this.wanderRadius = 0.5;
      this.wanderDistance = 2.0;
      this.wanderAngle = Math.random() * Math.PI * 2;
      this.wanderChange = 0.1;
      
      // Initialize velocity with slight Y component
      this.velocity = new THREE.Vector3(
        Math.cos(this.angle) * this.speed,
        Math.sin(this.angle) * this.speed * 0.6, // Increased vertical movement
        Math.sin(this.angle) * this.speed
      );
      
      // Time offset for swimming pattern
      this.timeOffset = Math.random() * 1000;
      this.swimCycleSpeed = Math.random() * 0.5 + 0.5; // Different speeds for each fish
    }
    
    updateCoordinateFrame() {
      // Update the tangent based on adjacent points
      if (this.isHead && this.nextPoint) {
        // Head point - use the next point to define the direction
        this.tangent.subVectors(this.nextPoint.position, this.position).normalize();
      } else if (this.previousPoint && this.nextPoint) {
        // Interior point - use previous and next points
        this.tangent.subVectors(this.nextPoint.position, this.previousPoint.position).normalize();
      } else if (this.previousPoint) {
        // Tail point - use the previous point to define the direction
        this.tangent.subVectors(this.position, this.previousPoint.position).normalize();
      }
      
      // Ensure the normal and binormal are perpendicular to the tangent
      // First, try to use the previous normal if available
      if (this.previousPoint) {
        // Get the previous normal and make it perpendicular to current tangent (parallel transport)
        const prevNormal = this.previousPoint.normal;
        
        // Project prevNormal onto the plane perpendicular to tangent
        this.normal.copy(prevNormal).sub(
          this.tangent.clone().multiplyScalar(prevNormal.dot(this.tangent))
        ).normalize();
        
        // If the normal becomes degenerate, choose a new one
        if (this.normal.lengthSq() < 0.1) {
          const upVector = new THREE.Vector3(0, 1, 0);
          this.normal.crossVectors(this.tangent, upVector).normalize();
          if (this.normal.lengthSq() < 0.1) {
            const rightVector = new THREE.Vector3(1, 0, 0);
            this.normal.crossVectors(this.tangent, rightVector).normalize();
          }
        }
      } else {
        // For the first point, choose a normal perpendicular to the tangent
        const upVector = new THREE.Vector3(0, 1, 0);
        this.normal.crossVectors(this.tangent, upVector).normalize();
        if (this.normal.lengthSq() < 0.1) {
          const rightVector = new THREE.Vector3(1, 0, 0);
          this.normal.crossVectors(this.tangent, rightVector).normalize();
        }
      }
      
      // Compute the binormal to complete the orthogonal basis
      this.binormal.crossVectors(this.tangent, this.normal).normalize();
    }

    move(time, swimTime) {
      // Store reference to fish for non-head points
      if (this.fish && !this.fishTimeSet) {
        // Initialize swimTime offset only once
        this.swimTimeOffset = Math.random() * Math.PI * 2;
        this.fishTimeSet = true;
      }
      
      // Create predicted position for later constraint solving
      this.predictedPosition = new THREE.Vector3();
      
      if (this.isHead) {
        // HEAD MOVEMENT: Only the head controls direction
        
        // More natural heading changes with occasional bigger adjustments
        if (Math.random() < 0.01) {
          // Occasional larger direction change (like real fish)
          this.wanderAngle += (Math.random() - 0.5) * 0.3; 
        } else {
          // Normal small adjustments
          this.wanderAngle += (Math.random() - 0.5) * 0.02;
        }
        
        // Vertical depth management
        if (Math.random() < 0.005) {
          // Set a new vertical target height occasionally
          this.verticalTarget = (Math.random() - 0.5) * 15; // Increased vertical range
        }
        
        // Initialize vertical target if needed
        if (this.verticalTarget === undefined) {
          this.verticalTarget = (Math.random() - 0.5) * 15; // Increased vertical range
        }
        
        // Calculate vertical steering to reach the target height
        const verticalDiff = this.verticalTarget - this.position.y;
        const verticalSteering = verticalDiff * 0.02; // Increased vertical responsiveness
        
        // PRIMARY SWIMMING DIRECTION
        const primaryDirection = new THREE.Vector3(
          Math.cos(this.wanderAngle),
          0, // No vertical component in primary direction
          Math.sin(this.wanderAngle)
        ).normalize().multiplyScalar(0.15); // Forward thrust
        
        // Add slight wiggle to head
        const frequency = 0.8; 
        const amplitude = 0.05; // Very minor head wiggle
        
        // Create perpendicular vector for wiggle
        const perpVector = new THREE.Vector3(-Math.sin(this.wanderAngle), 0, Math.cos(this.wanderAngle));
        
        // Apply slight wiggle
        const wiggleAmount = Math.sin(swimTime * frequency + this.timeOffset) * amplitude;
        const wiggleVector = perpVector.clone().multiplyScalar(wiggleAmount);
        
        // Add vertical undulation
        const verticalUndulation = Math.sin(swimTime * 1.0 + this.timeOffset) * 0.04; // More pronounced undulation
        
        // COMBINE ALL MOTION COMPONENTS
        this.velocity.x = primaryDirection.x + wiggleVector.x + (Math.random() - 0.5) * 0.003;
        this.velocity.y = verticalSteering + verticalUndulation + (Math.random() - 0.5) * 0.003;
        this.velocity.z = primaryDirection.z + wiggleVector.z + (Math.random() - 0.5) * 0.003;
        
        // Apply speed multiplier
        this.velocity.multiplyScalar(this.speed * 1.5);
        
        // Apply velocity to position
        this.position.add(this.velocity);
        
        // Store current position as predicted position for constraint solving
        this.predictedPosition.copy(this.position);
      } 
      else {
        // NON-HEAD POINTS: Only follow constraints, don't affect main direction
        
        // Copy current position to predicted position to start
        this.predictedPosition.copy(this.position);
        
        // Get reference to the fish for proper indexing
        const fish = this.fish;
        if (!fish) return;
        
        // Find this point's index
        const segmentIndex = this.index;
        
        // Only apply undulation if we're not in emergency mode
        if (!fish.emergencyMode && segmentIndex > 0) {
          // Calculate normalized position (0 = head, 1 = tail)
          const normalizedIndex = segmentIndex / (fish.pointCount - 1);
          
          // WAVE PROPAGATION PARAMETERS
          // Amplitude increases toward tail
          const maxAmplitude = 0.1; // Reduced maximum amplitude
          const amplitude = maxAmplitude * Math.pow(normalizedIndex, 1.2);
          
          // Wave speed and phase parameters - propagate from head to tail
          const frequency = 3.0; // Speed of undulation 
          const phaseShift = Math.PI * 2.0; // Controls wavelength
          
          // Calculate lateral displacement using sine wave
          const displacement = amplitude * Math.sin(
            frequency * swimTime - phaseShift * normalizedIndex + this.swimTimeOffset
          );
          
          // Get swimming direction from head
          const headPoint = fish.points[0];
          const swimDir = new THREE.Vector3(
            Math.cos(headPoint.wanderAngle),
            0,
            Math.sin(headPoint.wanderAngle)
          ).normalize();
          
          // Get lateral direction (perpendicular to swimming)
          const lateralDir = new THREE.Vector3(
            -swimDir.z,
            0,
            swimDir.x
          ).normalize();
          
          // Apply lateral displacement to current position
          this.predictedPosition.addScaledVector(lateralDir, displacement);
        }
      }
      
      // Improved boundary detection - fish detect and turn before hitting walls
      const aquarium = window.aquariumInstance;
      if (aquarium) {
        const bounds = aquarium.bounds;
        
        // Create detection bounds - further out than correction bounds
        // Fish will detect these boundaries and start turning naturally
        const detectionMargin = 3.0; // Increased detection range
        const correctionMargin = 1.5; // Closer margin for corrections
        
        // Outer detection bounds - fish start to turn when reaching these
        const detectionBounds = {
          minX: bounds.minX + detectionMargin,
          maxX: bounds.maxX - detectionMargin,
          minY: bounds.minY + detectionMargin,
          maxY: bounds.maxY - detectionMargin,
          minZ: bounds.minZ + detectionMargin,
          maxZ: bounds.maxZ - detectionMargin
        };
        
        // Inner correction bounds - stronger corrections applied here
        const correctionBounds = {
          minX: bounds.minX + correctionMargin,
          maxX: bounds.maxX - correctionMargin,
          minY: bounds.minY + correctionMargin,
          maxY: bounds.maxY - correctionMargin,
          minZ: bounds.minZ + correctionMargin,
          maxZ: bounds.maxZ - correctionMargin
        };
        
        // X boundaries - detection and correction
        if (this.position.x < detectionBounds.minX) {
          // Calculate how close to the boundary (0 = at boundary, 1 = at correction zone)
          const proximityFactor = Math.min(1, Math.max(0, 
            (this.position.x - correctionBounds.minX) / (detectionBounds.minX - correctionBounds.minX)
          ));
          
          // Gradually turn away from boundary - more natural
          if (this.isHead) {
            // Smoothly adjust angle based on proximity
            const targetAngle = 0; // Right = away from left boundary
            const currentAngle = this.wanderAngle;
            const angleDiff = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
            this.wanderAngle += angleDiff * (0.2 + (1 - proximityFactor) * 0.3); // Stronger the closer we get
          }
          
          // Apply velocity correction only in correction zone
          if (this.position.x < correctionBounds.minX) {
            // Strong correction proportional to proximity
            this.velocity.x += 0.08 * (correctionBounds.minX - this.position.x);
          }
        } 
        else if (this.position.x > detectionBounds.maxX) {
          // Calculate proximity factor
          const proximityFactor = Math.min(1, Math.max(0, 
            (correctionBounds.maxX - this.position.x) / (correctionBounds.maxX - detectionBounds.maxX)
          ));
          
          // Gradually turn away from boundary
          if (this.isHead) {
            // Smoothly adjust angle based on proximity
            const targetAngle = Math.PI; // Left = away from right boundary
            const currentAngle = this.wanderAngle;
            const angleDiff = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
            this.wanderAngle += angleDiff * (0.2 + (1 - proximityFactor) * 0.3);
          }
          
          // Apply velocity correction in correction zone
          if (this.position.x > correctionBounds.maxX) {
            this.velocity.x += 0.08 * (correctionBounds.maxX - this.position.x);
          }
        }
        
        // Y boundaries - similar pattern but with less aggressive turning
        if (this.position.y < detectionBounds.minY) {
          // More gentle vertical adjustments
          this.velocity.y += 0.04 * (detectionBounds.minY - this.position.y);
          
          // If in correction zone, stronger correction
          if (this.position.y < correctionBounds.minY) {
            this.velocity.y += 0.06 * (correctionBounds.minY - this.position.y);
          }
        } 
        else if (this.position.y > detectionBounds.maxY) {
          this.velocity.y += 0.04 * (detectionBounds.maxY - this.position.y);
          
          // If in correction zone, stronger correction
          if (this.position.y > correctionBounds.maxY) {
            this.velocity.y += 0.06 * (correctionBounds.maxY - this.position.y);
          }
        }
        
        // Z boundaries - similar pattern
        if (this.position.z < detectionBounds.minZ) {
          this.velocity.z += 0.03 * (detectionBounds.minZ - this.position.z);
          
          if (this.position.z < correctionBounds.minZ) {
            this.velocity.z += 0.05 * (correctionBounds.minZ - this.position.z);
          }
        } 
        else if (this.position.z > detectionBounds.maxZ) {
          this.velocity.z += 0.03 * (detectionBounds.maxZ - this.position.z);
          
          if (this.position.z > correctionBounds.maxZ) {
            this.velocity.z += 0.05 * (correctionBounds.maxZ - this.position.z);
          }
        }
        
        // IMPROVED: Hard limit - when fish gets too far out, respawn at opposite edge
        // This ensures fish always enter naturally from an edge rather than teleport to the center
        const outerMargin = -2000; // Much larger margin before respawning
        
        if (this.position.x < bounds.minX + outerMargin) {
          // If too far out on left, spawn at right edge
          this.position.x = bounds.maxX + 15;
          this.position.y = (Math.random() - 0.5) * (bounds.maxY - bounds.minY); 
          this.position.z = (Math.random() - 0.5) * 7;
          this.wanderAngle = Math.PI; // Face left (inward)
        } 
        else if (this.position.x > bounds.maxX - outerMargin) {
          // If too far out on right, spawn at left edge
          this.position.x = bounds.minX - 15;
          this.position.y = (Math.random() - 0.5) * (bounds.maxY - bounds.minY);
          this.position.z = (Math.random() - 0.5) * 7;
          this.wanderAngle = 0; // Face right (inward)
        }
        else if (this.position.y < bounds.minY + outerMargin) {
          // If too far out on bottom, spawn at top edge
          this.position.x = (Math.random() - 0.5) * (bounds.maxX - bounds.minX);
          this.position.y = bounds.maxY + 15;
          this.position.z = (Math.random() - 0.5) * 7;
          this.wanderAngle = Math.PI * 1.5; // Face down (inward)
        }
        else if (this.position.y > bounds.maxY - outerMargin) {
          // If too far out on top, spawn at bottom edge
          this.position.x = (Math.random() - 0.5) * (bounds.maxX - bounds.minX);
          this.position.y = bounds.minY - 15;
          this.position.z = (Math.random() - 0.5) * 7;
          this.wanderAngle = Math.PI * 0.5; // Face up (inward)
        }
      }
    }

    constrain() {
      // Head is the leader - just use its predicted position
      if (!this.previousPoint) {
        if (this.predictedPosition) {
          this.position.copy(this.predictedPosition);
        }
        return;
      }
      
      // For non-head points, enforce constraints
      // This is the key to making the body follow the head properly
      
      // 1. Start with the fixed distance constraint
      // Get direction from previous point to this point
      const direction = new THREE.Vector3().subVectors(
        this.predictedPosition, 
        this.previousPoint.position
      );
      
      // Get current distance
      const currentDistance = direction.length();
      
      // Skip if zero distance (avoid NaN)
      if (currentDistance > 0) {
        // Normalize direction
        direction.normalize();
        
        // Target distance is the constraint radius (fixed distance)
        const targetDistance = this.constraintRadius;
        
        // Create position at exact constraint distance
        this.predictedPosition.copy(this.previousPoint.position)
          .addScaledVector(direction, targetDistance);
      }
      
      // 2. Apply angle constraint to prevent unnatural bending
      if (this.previousPoint.previousPoint) {
        // Get vectors for previous and current segments
        const prevSegment = new THREE.Vector3().subVectors(
          this.previousPoint.position,
          this.previousPoint.previousPoint.position
        ).normalize();
        
        const currSegment = new THREE.Vector3().subVectors(
          this.predictedPosition,
          this.previousPoint.position
        ).normalize();
        
        // Calculate bend angle
        const bendAngle = Math.acos(Math.min(1, Math.max(-1, prevSegment.dot(currSegment))));
        
        // Get max angle based on segment type
        let maxAngle = Math.PI / 4; // Default (45 degrees)
        
        if (this.isHeadSegment) {
          maxAngle = Math.PI / 6; // Head is stiffest (30 degrees)
        } else if (this.isBodySegment) {
          maxAngle = Math.PI / 4.5; // Body is moderately stiff (40 degrees)
        } else if (this.isTailSegment) {
          maxAngle = Math.PI / 3.5; // Tail is more flexible (51 degrees)
        }
        
        // If bend exceeds max angle, limit it
        if (bendAngle > maxAngle) {
          // Get rotation axis (perpendicular to bend plane)
          const rotationAxis = new THREE.Vector3().crossVectors(prevSegment, currSegment).normalize();
          
          // Create rotation to limit angle
          const rotation = new THREE.Quaternion().setFromAxisAngle(rotationAxis, maxAngle);
          
          // Apply rotation to get limited direction
          const limitedDirection = prevSegment.clone().applyQuaternion(rotation);
          
          // Create position at constraint distance in limited direction
          this.predictedPosition.copy(this.previousPoint.position)
            .addScaledVector(limitedDirection, this.constraintRadius);
        }
      }
      
      // Update actual position from constrained prediction
      this.position.copy(this.predictedPosition);
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
      // Flocking behavior parameters
      this.avoidanceRadius = 10; // Greatly increased to force fish apart
      this.seekWeight = 0.02;
      this.maxViewDistance = 7; // Reduced maximum distance from camera to keep fish closer
      
      // Flocking weights - adjust these to change behavior
      this.separationWeight = 0.25;  // Extremely high separation to eliminate clustering
      this.alignmentWeight = 0.02;   // Reduced alignment for less schooling
      this.cohesionWeight = 0.005;   // Minimal cohesion for almost completely independent movement
      this.perceptionRadius = 12;    // Increased perception radius to detect other fish earlier
      
      // CRITICAL FLAG TO ENSURE FISH BODY IS CREATED AND SHOWN
      this.bodyCreated = false;
      
      // Unique behavior for each fish
      this.personalityType = Math.floor(Math.random() * 3); // 0=explorer, 1=social, 2=shy
      this.activityLevel = Math.random() * 0.5 + 0.75; // How active the fish is
      
      // Create tail fin geometry with more realistic shape
      this.tailFinGeometry = new THREE.BufferGeometry();
      const tailVertices = new Float32Array([
        0, 0, 0,         // center
        0, 2.0, -1.5,    // top tip
        0, 0.8, -0.8,    // top middle
        0, -0.8, -0.8,   // bottom middle
        0, -2.0, -1.5    // bottom tip
      ]);
      this.tailFinGeometry.setAttribute('position', new THREE.BufferAttribute(tailVertices, 3));
      this.tailFinGeometry.setIndex([
        0, 1, 2,  // top upper triangle
        0, 2, 3,  // middle triangle
        0, 3, 4   // bottom lower triangle
      ]);
      this.tailFinGeometry.computeVertexNormals();
      
      // Create dorsal fin geometry (on top) with more realistic shape
      this.dorsalFinGeometry = new THREE.BufferGeometry();
      const dorsalVertices = new Float32Array([
        0, 0, 0,         // base front
        -0.5, 0, 0.2,    // base back
        -0.3, 0.6, 0,    // middle point
        -0.7, 1.2, -0.1, // rear point
        0, 1.8, -0.3     // top point
      ]);
      this.dorsalFinGeometry.setAttribute('position', new THREE.BufferAttribute(dorsalVertices, 3));
      this.dorsalFinGeometry.setIndex([
        0, 1, 2,  // lower triangle
        1, 3, 2,  // middle triangle
        2, 3, 4   // upper triangle
      ]);
      this.dorsalFinGeometry.computeVertexNormals();
      
      // Create side fins geometry with more detailed shape
      this.sideFinGeometry = new THREE.BufferGeometry();
      const sideVertices = new Float32Array([
        0, 0, 0,         // center connection
        0.7, 0.1, -0.3,  // front top
        1.2, 0.2, -0.5,  // mid top
        1.6, -0.2, -0.8, // back tip
        1.4, -0.4, -0.6, // mid bottom
        0.8, -0.6, -0.2  // front bottom
      ]);
      this.sideFinGeometry.setAttribute('position', new THREE.BufferAttribute(sideVertices, 3));
      this.sideFinGeometry.setIndex([
        0, 1, 2,  // upper front triangle
        0, 2, 3,  // upper back triangle
        0, 3, 4,  // lower back triangle
        0, 4, 5   // lower front triangle
      ]);
      this.sideFinGeometry.computeVertexNormals();
      
      // Define anatomically correct fish shape
      // This creates a fish with:
      // 1. Elongated head section
      // 2. Thick middle body/torso sections
      // 3. Thinner, more flexible tail sections with longer extension
      
      // Increased number of body segments - more segments for smoother motion and longer tail
      const numSegments = 14; // Increased from 10 to 14 for more detail
      
      // Variable spacing between segments - tighter at the tail for better undulation
      // Extended tail with more segments for better movement
      const segmentSpacings = [
        1.0,  // Head to segment 1
        1.2,  // Segment 1 to 2 (forward body) - longer
        1.2,  // Segment 2 to 3 (forward body) - longer
        1.0,  // Segment 3 to 4 (mid body)
        0.9,  // Segment 4 to 5 (mid body)
        0.8,  // Segment 5 to 6 (rear body)
        0.8,  // Segment 6 to 7 (rear body)
        0.7,  // Segment 7 to 8 (rear body start of tail)
        0.6,  // Segment 8 to 9 (tail start)
        0.6,  // Segment 9 to 10 (tail middle)
        0.5,  // Segment 10 to 11 (tail middle)
        0.4,  // Segment 11 to 12 (tail end)
        0.5,  // Segment 12 to 13 (final tail section)
      ];
      
      // Size coefficients for each segment - creates a more organic fish shape
      // These sizes create the bulge in the middle and taper at both ends
      // Overall more realistic fish with proper tapering and extended tail
      const radii = [
        0.7,   // Head - better proportion to body
        0.85,  // Forward body - gradual increase
        1.0,   // Forward middle - approaching widest point
        1.1,   // Middle body - widest part 
        1.05,  // Mid-body - maintaining width
        1.0,   // Rear middle - starting to taper
        0.9,   // Rear body - gradual tapering
        0.8,   // Rear body - continuing to taper
        0.7,   // Tail base - narrowing
        0.6,   // Tail section - narrower
        0.5,   // Tail section - continuing taper
        0.4,   // Tail section - thin
        0.25,  // Tail connection - very narrow
        0.15   // Tail end - smallest segment
      ];
      
      // Height vs width ratio for each segment - TALL AND NARROW FISH
      // First value is X (width), second is Y (height), third is Z (depth)
      // Fish is taller than it is wide (correct anatomical shape for swimming fish)
      const verticalStretches = [
        [0.6, 1.3, 0.7],  // Head - more beak-like, narrower
        [0.5, 1.6, 0.6],  // Forward body - very tall and narrow
        [0.5, 1.7, 0.5],  // Forward middle - most compressed/tall body
        [0.5, 1.8, 0.5],  // Middle - TALLEST part (elongated oval)
        [0.5, 1.7, 0.5],  // Rear middle - very tall still
        [0.6, 1.6, 0.6],  // Rear body - still tall
        [0.7, 1.5, 0.7],  // Rear body - getting less tall
        [0.8, 1.4, 0.8],  // Tail base - still taller than wide
        [0.9, 1.3, 0.9],  // Extended tail - getting rounder
        [0.9, 1.3, 0.9],  // Extended tail - similar proportions
        [1.0, 1.2, 1.0],  // Extended tail - getting more round
        [1.0, 1.2, 1.0],  // Extended tail - similar shape
        [1.0, 1.1, 1.0],  // Extended tail - almost round
        [1.0, 1.0, 1.0]   // Tail end - completely round
      ];
      
      // Create and position the points
      let currentX = x;
      
      // Store total number of points for reference
      this.pointCount = numSegments;
      
      // Initialize swim time for undulating motion
      this.swimTime = Math.random() * 100;
      
      for (let i = 0; i < numSegments; i++) {
        // Determine segment type for angle constraints
        const isHead = (i === 0);
        const isHeadNeck = (i === 1);
        const isBodySegment = (i >= 2 && i <= 6); 
        const isTailSegment = (i >= 7);
        
        // Create the point with appropriate constraint radius and segment size
        const constraintRadius = i < numSegments - 1 ? segmentSpacings[i] : 0.4;
        const radius = radii[i];
        
        const point = new ConstrainedPoint(
          currentX,
          y,
          z,
          constraintRadius,
          speed * this.activityLevel,
          isHead,
          radius
        );
        
        // Set segment type flags for angle constraints
        point.isHeadSegment = isHead || isHeadNeck; // Head and neck are stiff
        point.isBodySegment = isBodySegment;        // Middle is moderately flexible
        point.isTailSegment = isTailSegment;        // Tail is most flexible
        
        // Store reference to parent fish and segment index
        point.fish = this;
        point.index = i;
        
        // Apply the stretch factors to the point
        point.stretchFactors = verticalStretches[i];
        
        this.points.push(point);
        
        // Move to next point position
        if (i < numSegments - 1) {
          currentX += segmentSpacings[i];
        }
      }
      
      // Connect points
      for (let i = 1; i < this.points.length; i++) {
        this.points[i].previousPoint = this.points[i - 1];
        this.points[i - 1].nextPoint = this.points[i];
      }
      
      // Initialize the coordinate frames for each point
      this.updatePointCoordinateFrames();
      
      // CRITICALLY IMPORTANT: Create a continuous fish body using the tube technique
      // This is what gives the fish its visible "skin"
      this.createFishBody();
      
      // Verify that the body was created successfully
      if (!this.bodyCreated || !this.bodyMesh) {
        console.error("CRITICAL: Failed to create fish body!");
      }
      
      // Double-check the body mesh visibility
      if (this.bodyMesh) {
        this.bodyMesh.visible = true;
      }
      
      // Add eyes to the fish
      this.addEyes();
      
      // Add fins
      this.addFins();
    }
    
    // Updates the coordinate frames for all points
    updatePointCoordinateFrames() {
      for (let i = 0; i < this.points.length; i++) {
        this.points[i].updateCoordinateFrame();
      }
    }
    
    // Create a fish body - with emergency fallback option
    createFishBody() {
      // Check if we should use detailed or simple geometry
      const aquarium = window.aquariumInstance;
      const useSimple = aquarium && aquarium.useSimpleShapes;
      
      // Create fish body - either detailed skin mesh or simple emergency fallback
      let fishBody;
      
      if (!useSimple) {
        // NORMAL MODE: Custom skin mesh for better looking fish
        // Use the new fish skin geometry with 16 segments for smooth appearance
        fishBody = this.createFishSkin(this.points, 16);
      } else {
        // EMERGENCY FALLBACK: Simple merged geometry that's guaranteed to render
        fishBody = this.createSimpleFishBody();
      }
      
      // Create a more natural, less shiny fish material
      const fishMaterial = new THREE.MeshLambertMaterial({
        color: this.color,
        emissive: new THREE.Color(this.color).multiplyScalar(0.05), // Much less emissive
        transparent: false,
        opacity: 1.0,
        wireframe: false,
        flatShading: false, // Smooth shading for natural look
        side: THREE.DoubleSide
      });
      
      // Create the fish mesh with forced visibility settings
      let fishMesh;
      
      // Safety check for morphTargets to prevent "undefined" errors
      if (fishBody.morphTargets) {
        // Ensure morphTargets is an array if it exists
        if (!Array.isArray(fishBody.morphTargets)) {
          fishBody.morphTargets = [];
        }
      }
      
      // Handle if fishBody is a Group (from the simple fish body) or a geometry
      if (fishBody instanceof THREE.Group) {
        // It's already a group of meshes (from createSimpleFishBody)
        fishMesh = fishBody;
        
        // Ensure all child meshes have good materials
        fishMesh.traverse(child => {
          if (child instanceof THREE.Mesh) {
            // Replace all child materials with our main fish material
            child.material = fishMaterial.clone();
          }
        });
      } else {
        // It's a geometry, create a mesh with it
        fishMesh = new THREE.Mesh(fishBody, fishMaterial);
      }
      
      // Ensure visibility and rendering priority
      fishMesh.visible = true;
      fishMesh.renderOrder = 1000; // Force to render on top of everything
      fishMesh.frustumCulled = false; // Never cull this mesh
      
      // Add to group
      this.group.add(fishMesh);
      
      // Store the body mesh for updates
      this.bodyMesh = fishMesh;
      
      // Force proper shadows
      if (fishMesh.geometry) {
        fishMesh.geometry.computeBoundingSphere();
        fishMesh.geometry.computeBoundingBox();
      }
      
      // Mark that body has been created
      this.bodyCreated = true;
      
      // Debug log
      console.log('Fish body created with ' + (useSimple ? 'simple' : 'detailed') + ' geometry');
    }
    
    // EMERGENCY FALLBACK: Create a simple fish body
    createSimpleFishBody() {
      // Use a more visible and robust primitive shape
      // Create a proper fish shape using detailed primitive
      
      // Setup points for fish body
      const firstPoint = this.points[0];
      const lastPoint = this.points[this.points.length - 1];
      
      // Get the overall length of the fish
      const length = new THREE.Vector3().subVectors(
        lastPoint.position, 
        firstPoint.position
      ).length();
      
      // Get the middle position
      const middle = new THREE.Vector3().addVectors(
        firstPoint.position, 
        lastPoint.position
      ).multiplyScalar(0.5);
      
      // Create geometry - use sphere for head, cylinder for body, and cone for tail
      // This guaranteed-visible approach uses multiple solid primitives
      const bodyGeometry = new THREE.Group();
      
      // Create solid head (sphere)
      const headGeometry = new THREE.SphereGeometry(1.0, 16, 16);
      const headMesh = new THREE.Mesh(
        headGeometry,
        new THREE.MeshLambertMaterial({ 
          color: this.color,
          emissive: new THREE.Color(this.color).multiplyScalar(0.3),
          side: THREE.DoubleSide
        })
      );
      headMesh.position.copy(firstPoint.position);
      bodyGeometry.add(headMesh);
      
      // Create solid body (cylinder) - absolutely guaranteed to render
      const bodyShape = new THREE.CylinderGeometry(
        0.9,         // top radius
        0.5,         // bottom radius
        length * 0.8, // height
        16,          // radial segments
        3,           // height segments
        false        // open-ended
      );
      
      // Calculate orientation to match fish direction
      const direction = new THREE.Vector3().subVectors(
        lastPoint.position,
        firstPoint.position
      ).normalize();
      
      // Create body mesh with solid material
      const bodyPrimitiveMesh = new THREE.Mesh(
        bodyShape,
        new THREE.MeshLambertMaterial({ 
          color: this.color,
          emissive: new THREE.Color(this.color).multiplyScalar(0.3),
          side: THREE.DoubleSide
        })
      );
      
      // Position at middle point between head and tail
      const bodyCenter = new THREE.Vector3().addVectors(
        firstPoint.position,
        middle
      ).multiplyScalar(0.5);
      bodyPrimitiveMesh.position.copy(bodyCenter);
      
      // Orient to point along fish direction
      bodyPrimitiveMesh.lookAt(lastPoint.position);
      bodyPrimitiveMesh.rotateX(Math.PI/2); // Adjust for cylinder orientation
      
      // Add to body group
      bodyGeometry.add(bodyPrimitiveMesh);
      
      return bodyGeometry;
    }
    
    /**
     * Creates a fish skin mesh following a set of points with varying width and height
     * 
     * @param {Array} points - Array of constraint points that define the fish spine
     * @param {Number} radialSegments - Number of segments around each cross-section
     * @returns {THREE.BufferGeometry} Geometry for the fish skin
     */
    createFishSkin(points, radialSegments) {
      // Ensure we have enough points to create a valid skin
      if (points.length < 2) {
        console.error('Need at least 2 points to create a fish skin');
        return new THREE.BufferGeometry();
      }
      
      // Count total vertices and indices for the buffer
      const numPoints = points.length;
      const verticesPerRing = radialSegments;
      const totalVertices = numPoints * verticesPerRing;
      const trianglesPerSegment = radialSegments * 2;
      const totalIndices = (numPoints - 1) * trianglesPerSegment * 3;
      
      // Create arrays for vertex data
      const positions = new Float32Array(totalVertices * 3);
      const normals = new Float32Array(totalVertices * 3);
      const uvs = new Float32Array(totalVertices * 2);
      const indices = [];
      
      // Step 1: Compute tangents for each point
      const tangents = new Array(numPoints);
      
      // Start point tangent
      tangents[0] = new THREE.Vector3()
        .subVectors(points[1].position, points[0].position)
        .normalize();
        
      // End point tangent
      tangents[numPoints - 1] = new THREE.Vector3()
        .subVectors(points[numPoints - 1].position, points[numPoints - 2].position)
        .normalize();
      
      // Interior points (average of adjacent segments)
      for (let i = 1; i < numPoints - 1; i++) {
        const v1 = new THREE.Vector3().subVectors(points[i].position, points[i-1].position);
        const v2 = new THREE.Vector3().subVectors(points[i+1].position, points[i].position);
        
        tangents[i] = new THREE.Vector3().addVectors(v1, v2).normalize();
      }
      
      // Step 2: Compute normals and binormals for coordinate frames
      const normals_vec = new Array(numPoints);
      const binormals = new Array(numPoints);
      
      // Initial normal and binormal for first point
      // Choose a vector perpendicular to the tangent
      let initialNormal;
      const up = new THREE.Vector3(0, 1, 0);
      if (Math.abs(tangents[0].dot(up)) > 0.999) {
        // If tangent is parallel to up, use a different vector
        initialNormal = new THREE.Vector3(1, 0, 0);
      } else {
        // Otherwise cross with up vector
        initialNormal = new THREE.Vector3().crossVectors(up, tangents[0]).normalize();
      }
      
      normals_vec[0] = initialNormal;
      binormals[0] = new THREE.Vector3().crossVectors(tangents[0], normals_vec[0]).normalize();
      
      // Propagate normals along the spine using parallel transport
      for (let i = 1; i < numPoints; i++) {
        // Calculate rotation from previous tangent to current tangent
        const prevTangent = tangents[i-1];
        const currTangent = tangents[i];
        
        // Project previous normal onto plane perpendicular to current tangent
        const dot = currTangent.dot(normals_vec[i-1]);
        normals_vec[i] = new THREE.Vector3()
          .copy(normals_vec[i-1])
          .sub(currTangent.clone().multiplyScalar(dot))
          .normalize();
        
        // Calculate binormal from tangent and normal
        binormals[i] = new THREE.Vector3().crossVectors(currTangent, normals_vec[i]).normalize();
      }
      
      // Step 3: Generate vertices for each cross-section
      for (let i = 0; i < numPoints; i++) {
        const point = points[i];
        const ringOffset = i * verticesPerRing;
        
        // Get width and height for this point
        // Convert from radius values to semi-major/minor axes
        // Add safety check for stretchFactors
        let width, height;
        if (point.stretchFactors && Array.isArray(point.stretchFactors)) {
          width = point.radius * point.stretchFactors[0];  // X-axis (width)
          height = point.radius * point.stretchFactors[1]; // Y-axis (height)
        } else {
          // Default values if stretchFactors is missing
          width = point.radius * 0.6;   // Default width factor
          height = point.radius * 1.3;  // Default height factor
        }
        
        // Enhanced fish body shaping with anatomically correct proportions
        // Adjust width based on position along the spine (wider in middle)
        let widthFactor = 1.0;
        let heightFactor = 1.0;
        
        // HEAD SECTION - more tapered and beak-like
        if (i === 0) {
          // Head mesh is now more tapered to a snout/beak shape
          // Smoothly taper based on angle around the circumference
          widthFactor = 0.7;  // Narrower overall
          heightFactor = 1.1; // Slightly taller
          
          // Additional shape modifiers for head - shift vertices toward tip
          // This creates a more elongated, tapered head shape like a real fish snout
          // We'll apply these modifiers in the vertex calculation later
        } 
        // NECK - transition from head to body  
        else if (i === 1) {
          // Neck is the transition between the head and body
          widthFactor = 0.8;   // Still narrow but wider than head
          heightFactor = 1.25; // Taller than head
        }
        // TAIL - tapered for efficient swimming
        else if (i >= numPoints - 2) {
          // Tail tapers vertically for efficient swimming motion
          widthFactor = 0.7;  // Narrow horizontally 
          heightFactor = 0.5; // Significantly flattened vertically
        }
        // MAIN BODY - classic fish shape with wide middle
        else {
          const middleSegment = Math.floor(numPoints / 2);
          const distFromMiddle = Math.abs(i - middleSegment) / middleSegment;
          
          // Fish are wider in the middle, tapering to head and tail
          widthFactor = 1.0 + (1.0 - distFromMiddle) * 0.4; // Up to 40% wider in middle
          // Tall in the middle for classic fish shape
          heightFactor = 1.0 + (1.0 - distFromMiddle) * 0.2; // Up to 20% taller in middle
        }
        
        // Generate vertices around the circumference
        for (let j = 0; j < radialSegments; j++) {
          const theta = (j / radialSegments) * Math.PI * 2;
          
          // Position index in arrays
          const posIndex = (ringOffset + j) * 3;
          const uvIndex = (ringOffset + j) * 2;
          
          // Calculate base position on ellipse
          let x = width * widthFactor * Math.cos(theta);
          let y = height * heightFactor * Math.sin(theta);
          
          // Create the vertex position
          let vertex;
          
          // Special head shapes - customization based on segment
          if (i === 0) {
            // GUARANTEED CLOSED FISH HEAD SOLUTION
            // Collapse ALL vertices in the first ring to a single point
            // This approach guarantees a closed front with no possibility of holes
            
            // Calculate the fixed front beak tip position once
            // This single point will be used for ALL vertices in the first ring
            // Using a much less extreme forward position for a very natural, blunt beak
            const beakTipX = point.position.x - 0.3; // Minimal extension for a rounder, friendlier beak
            const beakTipY = point.position.y;       // Keep Y centered
            const beakTipZ = point.position.z;       // Keep Z centered
            
            // EVERY SINGLE VERTEX in the first ring gets this exact same position
            // This creates a perfect cone/point with absolutely no possibility of holes
            vertex = new THREE.Vector3(beakTipX, beakTipY, beakTipZ);
            
            // Skip all other vertex calculations for this ring
            // Every vertex must be at exactly the same point
            // This is the simplest, most foolproof solution
          } 
          // NECK: Create perfect transition to the single-point beak
          else if (i === 1) {
            // Special transition handling for the neck segment that connects
            // directly to our single-point beak tip
            
            // We need an aggressive funnel shape at the front to meet the beak tip
            
            // Calculate angle around the ring
            const normalizedAngle = theta / (Math.PI * 2); // 0-1 around the ring
            
            // Get position along the front-back axis (0 at front, 1 at back)
            const frontFactor = (-Math.cos(theta) + 1) / 2;
            
            // Calculate position in vertical axis
            const verticalFactor = Math.sin(theta); // -1 to 1 (bottom to top)
            
            // Calculate distance from the middle of the ring
            const middleDistance = Math.abs(verticalFactor); // 0 at middle, 1 at top/bottom
            
            // Create a funnel shape that's narrower toward the front
            // This creates a clean transition to the single-point beak
            
            // Taper width based on position - much more aggressive at front
            // Need to be much narrower at front to match the single-point beak
            const frontTaper = 0.2 + (1 - frontFactor) * 0.8; // 0.2 at front, 1.0 at back
            x *= frontTaper;
            
            // Additional narrowing at front to create smooth funnel
            if (frontFactor < 0.5) {
              // Extra tapering for the front half of the segment
              const frontHalfTaper = 0.4 + (frontFactor / 0.5) * 0.6; // 0.4 at front, 1.0 at middle
              x *= frontHalfTaper;
            }
            
            // Apply different stretching for top/bottom to maintain fish shape
            let heightFactor = 1.0;
            if (verticalFactor > 0) {
              // Top half - slightly taller to maintain fish shape
              heightFactor = 1.05;
            } else {
              // Bottom half - slightly shorter
              heightFactor = 0.95;
            }
            y *= heightFactor;
            
            // Add forward shift to create smooth transition to the beak tip
            const forwardShift = 0.5 * (1 - frontFactor); // More shift at front
            
            // Forward vector to blend with head shape
            const forwardVector = new THREE.Vector3().copy(tangents[i]).multiplyScalar(-forwardShift);
            
            // Create vertex with appropriate shift for smooth transition
            vertex = new THREE.Vector3(
              point.position.x + x * normals_vec[i].x + y * binormals[i].x + forwardVector.x,
              point.position.y + x * normals_vec[i].y + y * binormals[i].y + forwardVector.y,
              point.position.z + x * normals_vec[i].z + y * binormals[i].z + forwardVector.z
            );
          } 
          else {
            // Normal position calculation for body & tail segments
            vertex = new THREE.Vector3(
              point.position.x + x * normals_vec[i].x + y * binormals[i].x,
              point.position.y + x * normals_vec[i].y + y * binormals[i].y,
              point.position.z + x * normals_vec[i].z + y * binormals[i].z
            );
          }
          
          // Store position
          positions[posIndex] = vertex.x;
          positions[posIndex + 1] = vertex.y;
          positions[posIndex + 2] = vertex.z;
          
          // Calculate normal (pointing outward from center)
          const normal = new THREE.Vector3(
            x * normals_vec[i].x + y * binormals[i].x,
            x * normals_vec[i].y + y * binormals[i].y,
            x * normals_vec[i].z + y * binormals[i].z
          ).normalize();
          
          // Store normal
          normals[posIndex] = normal.x;
          normals[posIndex + 1] = normal.y;
          normals[posIndex + 2] = normal.z;
          
          // Store UV coordinates
          uvs[uvIndex] = i / (numPoints - 1);       // U = position along spine
          uvs[uvIndex + 1] = j / radialSegments;    // V = position around circumference
        }
      }
      
      // Step 4: Create triangular faces connecting the rings
      for (let i = 0; i < numPoints - 1; i++) {
        const ringOffset = i * verticesPerRing;
        const nextRingOffset = (i + 1) * verticesPerRing;
        
        for (let j = 0; j < radialSegments; j++) {
          // Vertices of the quad
          const v1 = ringOffset + j;
          const v2 = ringOffset + ((j + 1) % radialSegments);
          const v3 = nextRingOffset + ((j + 1) % radialSegments);
          const v4 = nextRingOffset + j;
          
          // Create two triangles for the quad (counter-clockwise winding)
          indices.push(v1, v2, v4);
          indices.push(v2, v3, v4);
        }
      }
      
      // Step 5: Create the BufferGeometry
      const geometry = new THREE.BufferGeometry();
      
      // Set attributes
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      
      // Compute vertex normals for smooth shading
      geometry.computeVertexNormals();
      
      return geometry;
    }
    
    // Method to update the fish skin when points move (for animation)
    updateFishSkin() {
      if (!this.bodyMesh || !this.bodyMesh.geometry) return;
      
      // Recompute the fish skin geometry with the current points
      const newGeometry = this.createFishSkin(this.points, 16); // 16 radial segments
      
      // Update the mesh's geometry
      this.bodyMesh.geometry.dispose(); // Clean up old geometry
      this.bodyMesh.geometry = newGeometry;
    }
    
    // Create a realistic fish head with proper beak/snout shape
    addEyes() {
      const headPoint = this.points[0];
      const neckPoint = this.points[1];
      
      // Get direction for proper orientation
      const headDirection = new THREE.Vector3()
        .subVectors(neckPoint.position, headPoint.position)
        .normalize();
      
      // Create composite head group
      const headGroup = new THREE.Group();
      
      // We'll only use the mesh from createFishSkin instead of a visible sphere
      // Just add a small invisible placeholder object to help position things
      const invisiblePlaceholder = new THREE.Object3D();
      headGroup.add(invisiblePlaceholder);
      
      // No eyes as requested - creating a cleaner, more streamlined fish appearance
      // The fish will rely purely on its mesh shape without eye details
      
      // Add complete head group to fish
      this.group.add(headGroup);
      this.headFiller = headGroup;
    }
    
    // Add all fins to the fish
    addFins() {
      // Simplified fin material
      const finMaterial = new THREE.MeshBasicMaterial({
        color: this.color,
        wireframe: false,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      });
      
      // Add side fins (pectoral fins)
      this.addPectoralFins(finMaterial);
      
      // Add dorsal fin (top fin)
      this.addDorsalFin(finMaterial);
      
      // Add anal fin (bottom fin)
      this.addAnalFin(finMaterial);
      
      // Add tail fin
      this.addTailFin(finMaterial);
    }
    
    // Add pectoral fins (side fins) - completely redone for anatomical correctness
    addPectoralFins(finMaterial) {
      // Use the 2nd point as an anchor for the pectoral fins - more forward on the body
      const finAnchorPoint = this.points[1]; // Move to point 1 (more forward)
      
      // Create anatomically correct side fin geometry
      const sideFinsVertices = new Float32Array([
        0, 0, 0,           // Base connection point
        0.3, 0.2, 0.7,     // Forward top edge
        0.7, 0.1, 1.1,     // Middle top edge
        1.2, -0.2, 0.9,    // Rear top point
        1.0, -0.5, 0.6,    // Rear bottom point
        0.5, -0.4, 0.4     // Lower forward edge
      ]);
      
      // Create custom geometry for side fins
      const sideFinGeometry = new THREE.BufferGeometry();
      sideFinGeometry.setAttribute('position', new THREE.BufferAttribute(sideFinsVertices, 3));
      sideFinGeometry.setIndex([
        0, 1, 2, // Upper front triangle
        0, 2, 3, // Upper rear triangle
        0, 3, 4, // Lower rear triangle
        0, 4, 5  // Lower front triangle
      ]);
      sideFinGeometry.computeVertexNormals();
      
      // RIGHT PECTORAL FIN - positioned at anatomically correct location
      const rightFin = new THREE.Mesh(sideFinGeometry.clone(), finMaterial);
      
      // Position fin using anchor point's coordinate frame
      // Calculate proper position with enough clearance from body
      const rightOffset = new THREE.Vector3(0, -0.2, 1.0); // More outward from body, slightly lower
      const rightPos = this.transformLocalToWorld(rightOffset, finAnchorPoint);
      rightFin.position.copy(rightPos);
      
      // Orient fin to point outward and slightly backward
      // This creates the correct anatomical position
      rightFin.lookAt(rightFin.position.clone().add(
        new THREE.Vector3(finAnchorPoint.tangent.x, 0, finAnchorPoint.binormal.z)
      ));
      rightFin.rotateY(Math.PI / 3); // Angle fin properly
      
      // Scale for proper proportion
      rightFin.scale.set(0.7, 0.6, 0.7);
      this.group.add(rightFin);
      this.rightFin = rightFin;
      
      // LEFT PECTORAL FIN - mirror of right fin
      const leftFin = new THREE.Mesh(sideFinGeometry.clone(), finMaterial);
      
      // Position mirror of right fin
      const leftOffset = new THREE.Vector3(0, -0.2, -1.0); // Mirror of right fin position
      const leftPos = this.transformLocalToWorld(leftOffset, finAnchorPoint);
      leftFin.position.copy(leftPos);
      
      // Orient fin to point outward and slightly backward on left side
      leftFin.lookAt(leftFin.position.clone().add(
        new THREE.Vector3(finAnchorPoint.tangent.x, 0, -finAnchorPoint.binormal.z)
      ));
      leftFin.rotateY(-Math.PI / 3); // Angle fin properly, mirrored
      
      // Scale for proper proportion
      leftFin.scale.set(0.7, 0.6, 0.7);
      this.group.add(leftFin);
      this.leftFin = leftFin;
    }
    
    // Add dorsal fin (top fin) - correctly angled BACKWARD
    addDorsalFin(finMaterial) {
      // Use the 3rd-4th segment as an anchor for the dorsal fin
      const finAnchorPoint = this.points[3];
      
      // Create a new custom dorsal fin geometry with BACKWARD orientation
      // Note: X-axis in this geometry points forward along fish body
      // Vertices designed to extend BACKWARD (negative X values)
      const dorsalVertices = new Float32Array([
        0, 0, 0,         // base front
        -1.5, 0, 0,      // base back - extend backward along body
        -1.2, 1.3, 0,    // rear point - most backward point
        -0.8, 1.8, 0,    // middle point
        -0.3, 1.3, 0,    // upper middle point
        0, 0.7, 0        // front point - lowest point
      ]);
      
      const dorsalGeometry = new THREE.BufferGeometry();
      dorsalGeometry.setAttribute('position', new THREE.BufferAttribute(dorsalVertices, 3));
      dorsalGeometry.setIndex([
        0, 5, 4,  // front triangle
        0, 4, 3,  // middle triangle
        0, 3, 2,  // high-middle triangle
        0, 2, 1   // rear triangle
      ]);
      dorsalGeometry.computeVertexNormals();
      
      // Create fin with forward-facing geometry
      const dorsalFin = new THREE.Mesh(dorsalGeometry, finMaterial);
      
      // Position the fin directly above the anchor point
      const offset = new THREE.Vector3(0, 0.8, 0);
      const pos = this.transformLocalToWorld(offset, finAnchorPoint);
      dorsalFin.position.copy(pos);
      
      // Anatomically correct orientation along body
      dorsalFin.lookAt(dorsalFin.position.clone().add(finAnchorPoint.tangent));
      
      // Scale for proper proportion
      dorsalFin.scale.set(0.9, 0.9, 0.9);
      
      this.group.add(dorsalFin);
      this.dorsalFin = dorsalFin;
    }
    
    // Add anal fin (bottom fin) - correctly angled BACKWARD like dorsal fin
    addAnalFin(finMaterial) {
      // Use the 5th segment as an anchor for the anal fin
      const finAnchorPoint = this.points[5];
      
      // Create a new custom anal fin geometry with BACKWARD orientation to match dorsal
      // Similar to dorsal fin but pointing downward and slightly smaller
      const analVertices = new Float32Array([
        0, 0, 0,          // base front
        -1.2, 0, 0,       // base back - extend backward along body
        -1.0, -1.0, 0,    // rear point - most backward point
        -0.6, -1.4, 0,    // middle point
        -0.2, -1.0, 0,    // lower middle point
        0, -0.5, 0        // front point - lowest point
      ]);
      
      const analGeometry = new THREE.BufferGeometry();
      analGeometry.setAttribute('position', new THREE.BufferAttribute(analVertices, 3));
      analGeometry.setIndex([
        0, 5, 4,  // front triangle
        0, 4, 3,  // middle triangle 
        0, 3, 2,  // low-middle triangle
        0, 2, 1   // rear triangle
      ]);
      analGeometry.computeVertexNormals();
      
      // Create fin with forward-facing downward geometry
      const analFin = new THREE.Mesh(analGeometry, finMaterial);
      
      // Position the fin directly below the anchor point
      const offset = new THREE.Vector3(0, -0.8, 0);
      const pos = this.transformLocalToWorld(offset, finAnchorPoint);
      analFin.position.copy(pos);
      
      // Anatomically correct orientation along body
      analFin.lookAt(analFin.position.clone().add(finAnchorPoint.tangent));
      
      // Scale for proper proportion
      analFin.scale.set(0.8, 0.7, 0.8);
      
      this.group.add(analFin);
      this.analFin = analFin;
    }
    
    // Add tail fin with simple orientation
    addTailFin(finMaterial) {
      // Use the last point as an anchor for the tail fin
      const tailAnchorPoint = this.points[this.points.length - 1];
      const previousPoint = this.points[this.points.length - 2];
      
      // REALISTIC FISH TAIL APPROACH - create a flattened diamond shape
      // Real fish tails are thin and flattened vertically, NOT rounded like a nipple
      
      // Create a custom flat plate geometry for the tail end
      // Using a flattened, vertically oriented diamond shape
      const tailAspectRatio = 2.0; // Tail is twice as tall as it is wide
      
      // Use a custom flattened box for the main tail shape
      const tailCapGeometry = new THREE.BoxGeometry(
        0.1,                    // Very thin front-to-back
        tailAspectRatio * 1.0,  // Tall vertically to form diamond shape
        0.8                     // Width horizontally
      );
      
      // Create tail material with no emissive component for more natural look
      const tailCapMaterial = new THREE.MeshLambertMaterial({
        color: this.color,
        flatShading: false,
        transparent: false,
        side: THREE.DoubleSide      // Visible from both sides
      });
      
      const tailCap = new THREE.Mesh(tailCapGeometry, tailCapMaterial);
      
      // Position the tail cap at the last segment, but extend it a bit behind 
      // to form a proper tail fin shape
      tailCap.position.copy(tailAnchorPoint.position.clone());
      
      // Get previous point to determine the tail direction
      const tailDirection = new THREE.Vector3().subVectors(
        tailAnchorPoint.position,
        previousPoint.position
      ).normalize();
      
      // Position tail cap at the end of the last segment
      // but oriented flat like a real fish tail fin
      const lastSegmentRadius = tailAnchorPoint.radius;
      
      // Rotate the tail to be perpendicular to the fish body
      // This creates the flat, vertical tail fin shape
      tailCap.lookAt(tailCap.position.clone().add(tailDirection));
      tailCap.rotateX(Math.PI / 2); // Rotate to make vertical
      
      // Scale based on fish size to ensure proportional tail
      // Real fish tails are generally 3-4x larger than the tail end of the body
      const tailEndRadius = tailAnchorPoint.radius;
      
      // Scale the tail to make it appropriately sized relative to the fish
      tailCap.scale.set(
        0.2,                  // Very thin front-to-back
        tailEndRadius * 4.0,  // Tall vertically to form proper tail fin
        tailEndRadius * 3.0   // Wider than the body for proper fin appearance
      );
      this.group.add(tailCap);
      this.tailCap = tailCap;
      
      // Create a simpler tail fin - smaller and more manageable
      const tailVertices = new Float32Array([
        0, 0, 0,         // center
        -1.0, 2.0, 0,    // top back
        -0.5, 1.0, 0,    // top middle
        -0.2, 0.5, 0,    // top base
        -0.2, -0.5, 0,   // bottom base
        -0.5, -1.0, 0,   // bottom middle
        -1.0, -2.0, 0    // bottom back
      ]);
      
      // Create custom geometry for tail
      const tailGeometry = new THREE.BufferGeometry();
      tailGeometry.setAttribute('position', new THREE.BufferAttribute(tailVertices, 3));
      
      // Create triangulated shape
      tailGeometry.setIndex([
        0, 1, 2,  // top upper triangle
        0, 2, 3,  // top base triangle
        0, 3, 4,  // center triangle
        0, 4, 5,  // bottom base triangle
        0, 5, 6   // bottom lower triangle
      ]);
      tailGeometry.computeVertexNormals();
      
      // Create mesh with custom geometry
      const tailFin = new THREE.Mesh(tailGeometry, finMaterial);
      
      // Position at the end of body
      tailFin.position.copy(tailAnchorPoint.position.clone());
      
      // Move slightly into the body to eliminate gaps
      const bodyDirection = new THREE.Vector3().subVectors(
        previousPoint.position, 
        tailAnchorPoint.position
      ).normalize().multiplyScalar(0.2);
      tailFin.position.add(bodyDirection);
      
      // Simple orientation - just make it face backward
      tailFin.lookAt(tailFin.position.clone().add(new THREE.Vector3(-1, 0, 0)));
      
      // Adjust to make it vertical
      tailFin.rotateZ(Math.PI / 2);
      
      // Smaller scale for better proportions
      tailFin.scale.set(1.0, 1.2, 1.0);
      
      this.group.add(tailFin);
      this.tailFin = tailFin;
    }
    
    // Update fish body mesh based on current point positions
    updateFishBodyMesh() {
      // Check if we have a valid body mesh
      if (!this.bodyMesh || !this.bodyMesh.geometry) {
        console.warn("Cannot update fish body mesh - no valid mesh exists");
        this.createFishBody(); // Create new body if missing
        return;
      }
      
      // First ensure the mesh is visible
      this.bodyMesh.visible = true;
      
      // Group mesh (from simple fish body) requires a different update approach
      if (this.bodyMesh instanceof THREE.Group) {
        // For group meshes, just update positions of the child meshes
        this.updateFinAndEyePositions();
        return;
      }
      
      // OPTIMIZATION: For performance reasons, only do full updates every few frames
      // This significantly reduces the computational load
      if (this._updateCounter === undefined) this._updateCounter = 0;
      this._updateCounter = (this._updateCounter + 1) % 2; // Skip every other frame
      
      if (this._updateCounter === 0) {
        // Try using the dedicated update method if it's the right geometry type
        try {
          // Use our optimized fish skin update method
          this.updateFishSkin();
        } catch (e) {
          console.warn("Error updating fish skin, falling back to rebuild", e);
          
          // If update fails, rebuild the geometry entirely (fallback)
          // Recreate the entire mesh with the current point positions
          const newGeometry = this.createFishSkin(this.points, 16);
          
          // Replace the old geometry
          this.bodyMesh.geometry.dispose(); // Clean up old geometry
          this.bodyMesh.geometry = newGeometry;
        }
      }
      
      // Always update coordinate frames for fins and eyes to follow
      this.updatePointCoordinateFrames();
      
      // Ensure normals are updated for proper lighting
      if (this.bodyMesh.geometry) {
        this.bodyMesh.geometry.computeVertexNormals();
      }
    }
    
    // Update fish fins and head to follow the fish body
    updateFinAndEyePositions() {
      // Renamed for backward compatibility, but only updates fins now
      // Update fish head to follow head point with proper orientation
      if (this.headFiller) {
        const headPoint = this.points[0];
        const neckPoint = this.points[1];
        
        // If head is a Group (detailed beak shape)
        if (this.headFiller instanceof THREE.Group) {
          // Get the head direction vector
          const headDirection = new THREE.Vector3()
            .subVectors(neckPoint.position, headPoint.position)
            .normalize();
          
          // Position the entire head group at the head point
          this.headFiller.position.copy(headPoint.position);
          
          // Orient the head group to look in the direction of movement
          this.headFiller.lookAt(
            this.headFiller.position.clone().add(headDirection.clone().multiplyScalar(-10))
          );
          
          // Position the placeholder (only remaining child)
          if (this.headFiller.children.length > 0) {
            const placeholder = this.headFiller.children[0];
            placeholder.position.set(0, 0, 0);
          }
        } else {
          // Simple head just follows the head point
          this.headFiller.position.copy(headPoint.position);
        }
      }
      
      // Update tail cap position
      if (this.tailCap) {
        const tailPoint = this.points[this.points.length - 1];
        this.tailCap.position.copy(tailPoint.position);
      }
      
      // Update fins to follow body points
      // Pectoral fins - positioned directly on the body surface
      if (this.rightFin && this.leftFin) {
        const finAnchorPoint = this.points[2];
        
        // Position fins directly at the body surface to eliminate gaps
        // Get the body radius at this segment, with a fallback if stretchFactors is undefined
        let finRadius;
        if (finAnchorPoint.stretchFactors && Array.isArray(finAnchorPoint.stretchFactors)) {
          // Use proper stretch factor if available
          finRadius = finAnchorPoint.radius * finAnchorPoint.stretchFactors[0];
        } else {
          // Fallback to basic radius if no stretch factors
          finRadius = finAnchorPoint.radius * 0.6; // Default width factor
        }
        
        // Use precise body dimensions for fin placement
        const rightOffset = new THREE.Vector3(0.1, 0.1, finRadius); // Z exactly at body surface
        const leftOffset = new THREE.Vector3(0.1, 0.1, -finRadius); // Z exactly at body surface
        
        // Transform to world coordinates using anchor point's coordinate frame
        const rightPos = this.transformLocalToWorld(rightOffset, finAnchorPoint);
        const leftPos = this.transformLocalToWorld(leftOffset, finAnchorPoint);
        
        this.rightFin.position.copy(rightPos);
        this.leftFin.position.copy(leftPos);
        
        // Orient fins based on point's orientation - improved angle
        this.rightFin.lookAt(this.rightFin.position.clone().add(
          finAnchorPoint.tangent.clone().add(finAnchorPoint.binormal.clone().multiplyScalar(0.2))
        ));
        this.leftFin.lookAt(this.leftFin.position.clone().add(
          finAnchorPoint.tangent.clone().add(finAnchorPoint.binormal.clone().multiplyScalar(-0.2))
        ));
        
        // Additional rotations to get correct fin orientation
        this.rightFin.rotateY(Math.PI / 2);
        this.leftFin.rotateY(-Math.PI / 2);
      }
      
      // Dorsal fin - strictly follows the point it's attached to
      if (this.dorsalFin) {
        const finAnchorPoint = this.points[3];
        
        // Position the fin directly above the anchor point
        const offset = new THREE.Vector3(0, 0.8, 0);
        const pos = this.transformLocalToWorld(offset, finAnchorPoint);
        this.dorsalFin.position.copy(pos);
        
        // Orient fin to strictly follow anchor point's orientation
        const nextPoint = this.points[4];
        const direction = new THREE.Vector3().subVectors(nextPoint.position, finAnchorPoint.position);
        
        // Look in the exact same direction as the body segment
        this.dorsalFin.lookAt(this.dorsalFin.position.clone().add(direction));
      }
      
      // Anal fin - strictly follows the point it's attached to
      if (this.analFin) {
        const finAnchorPoint = this.points[5];
        
        // Position fin below the anchor point
        const offset = new THREE.Vector3(0, -0.8, 0);
        const pos = this.transformLocalToWorld(offset, finAnchorPoint);
        this.analFin.position.copy(pos);
        
        // Orient fin to strictly follow anchor point's orientation
        const nextPoint = this.points[6];
        const direction = new THREE.Vector3().subVectors(nextPoint.position, finAnchorPoint.position);
        
        // Look in the exact same direction as the body segment
        this.analFin.lookAt(this.analFin.position.clone().add(direction));
        
        // Keep it pointing downward
        this.analFin.rotateZ(Math.PI);
      }
      
      // Tail fin
      if (this.tailFin) {
        const tailAnchorPoint = this.points[this.points.length - 1];
        this.tailFin.position.copy(tailAnchorPoint.position);
        this.tailFin.lookAt(
          this.tailFin.position.clone().add(tailAnchorPoint.tangent)
        );
      }
    }
    
    // Helper function to transform a local point to world coordinates using a point's coordinate frame
    transformLocalToWorld(localOffset, point) {
      const worldPos = new THREE.Vector3();
      worldPos.copy(point.position);
      worldPos.add(
        new THREE.Vector3(
          point.tangent.x * localOffset.x + point.normal.x * localOffset.y + point.binormal.x * localOffset.z,
          point.tangent.y * localOffset.x + point.normal.y * localOffset.y + point.binormal.y * localOffset.z,
          point.tangent.z * localOffset.x + point.normal.z * localOffset.y + point.binormal.z * localOffset.z
        )
      );
      return worldPos;
    }

    update(time, allFish, camera) {
      // Update swim time for undulating motion
      this.swimTime += 0.02 * this.activityLevel;
      
      // Check if we need to rebuild any missing parts
      const bodyMissing = !this.bodyCreated || !this.bodyMesh;
      const finsMissing = !this.tailFin || !this.rightFin || !this.leftFin;

      // Rebuild if parts are missing
      if (bodyMissing) {
        console.warn("Fish body missing - rebuilding");
        
        // Remove existing parts to avoid duplicates
        while (this.group.children.length > 0) {
          this.group.remove(this.group.children[0]);
        }
        
        // Rebuild from scratch
        this.createFishBody();
        this.addEyes();
        this.addFins();
        
        // Ensure visibility
        if (this.bodyMesh) {
          this.bodyMesh.visible = true;
          this.bodyMesh.renderOrder = 1000;
          if (this.bodyMesh instanceof THREE.Group) {
            this.bodyMesh.traverse(child => {
              if (child instanceof THREE.Mesh) {
                child.visible = true;
                child.renderOrder = 1000;
              }
            });
          }
        }
        
        // Make fins visible
        if (this.rightFin) this.rightFin.visible = true;
        if (this.leftFin) this.leftFin.visible = true;
        if (this.dorsalFin) this.dorsalFin.visible = true;
        if (this.analFin) this.analFin.visible = true;
        if (this.tailFin) this.tailFin.visible = true;
      }
      else if (finsMissing) {
        this.addFins();
      }
      
      // Calculate where the fish should go
      this.calculateTargetPosition(camera);
      
      // IMPORTANT: The fish navigation is entirely controlled by the head point
      const head = this.points[0];
      
      // Steer toward target based on personality
      const toTarget = new THREE.Vector3().subVectors(this.targetPosition, head.position);
      const distToTarget = toTarget.length();
      if (distToTarget > 2) {
        toTarget.normalize().multiplyScalar(this.seekWeight);
        head.velocity.add(toTarget);
        head.velocity.normalize().multiplyScalar(head.speed * head.velocityMultiplier);
      }
      
      // Avoid other fish
      this.avoidOtherFish(allFish);
      
      // STEP 1: Move just the head point
      head.move(time, this.swimTime);
      
      // STEP 2: Calculate undulating wave position for body points
      for (let i = 1; i < this.points.length; i++) {
        this.points[i].move(time, this.swimTime);
      }
      
      // STEP 3: Apply constraints using more iterations for better stability
      // This is what makes the body follow the head in a natural way
      const constraintIterations = 5; // Increased for better stability
      for (let iter = 0; iter < constraintIterations; iter++) {
        // Always process front-to-back (head to tail)
        for (let i = 0; i < this.points.length; i++) {
          this.points[i].constrain();
        }
      }

      // STEP 4: Update coordinate frames
      this.updatePointCoordinateFrames();

      // STEP 5: Update the mesh
      if (this.bodyMesh) {
        this.bodyMesh.visible = true;
        this.updateFishBodyMesh();
      } else {
        this.bodyCreated = false;
        this.update(time, allFish, camera);
        return;
      }
      
      // Force visibility on all components
      if (this.bodyMesh) this.bodyMesh.visible = true;
      if (this.rightFin) this.rightFin.visible = true;
      if (this.leftFin) this.leftFin.visible = true;
      if (this.dorsalFin) this.dorsalFin.visible = true;
      if (this.analFin) this.analFin.visible = true;
      if (this.tailFin) this.tailFin.visible = true;
      if (this.headFiller) this.headFiller.visible = true;
      
      // Update the positions of fins and eyes
      this.updateFinAndEyePositions();
      
      // Add fin animations 
      // Simplest possible tail fin update - purely following the body
      if (this.tailFin && this.points.length >= 2) {
        const tailPoint = this.points[this.points.length - 1];
        const preTailPoint = this.points[this.points.length - 2];
        
        // Update position
        this.tailFin.position.copy(tailPoint.position);
        
        // Get direction based on actual body segments
        const direction = new THREE.Vector3().subVectors(
          tailPoint.position,
          preTailPoint.position
        ).normalize();
        
        // Orient fin to face backward from fish
        // This means we look at a point that's in the opposite direction of travel
        const lookPoint = this.tailFin.position.clone().add(direction.clone().negate());
        this.tailFin.lookAt(lookPoint);
        
        // Make fin vertical 
        this.tailFin.rotateZ(Math.PI / 2);
      }
      
      // Side fins - simplified, let the body movement drive their motion
      if (this.rightFin && this.leftFin) {
        const head = this.points[0];
        const finAnchorPoint = this.points[2];
        
        // Right fin - static orientation, will appear to move with the fish
        // Base orientation only - pointing outward
        const rightPos = this.transformLocalToWorld(new THREE.Vector3(0.1, 0.2, 0.7), finAnchorPoint);
        this.rightFin.position.copy(rightPos);
        this.rightFin.lookAt(this.rightFin.position.clone().add(new THREE.Vector3(0, 0, 1)));
        this.rightFin.rotateY(Math.PI / 2); // Right fin points right
        
        // Left fin - static orientation, will appear to move with the fish
        const leftPos = this.transformLocalToWorld(new THREE.Vector3(0.1, 0.2, -0.7), finAnchorPoint);
        this.leftFin.position.copy(leftPos);
        this.leftFin.lookAt(this.leftFin.position.clone().add(new THREE.Vector3(0, 0, -1)));
        this.leftFin.rotateY(-Math.PI / 2); // Left fin points left
        
        // Slight response to turning - just enough to show fish steering
        const turningAmount = head.velocity.z * 2;
        if (turningAmount > 0.01) {
          // Turning right - angle fins slightly
          this.rightFin.rotation.x = -turningAmount * 0.2;
          this.leftFin.rotation.x = turningAmount * 0.2;
        } else if (turningAmount < -0.01) {
          // Turning left - angle fins slightly
          this.rightFin.rotation.x = -turningAmount * 0.2;
          this.leftFin.rotation.x = turningAmount * 0.2;
        }
      }
      
      // Dorsal fin - simplified, just align with body
      if (this.dorsalFin) {
        const finAnchorPoint = this.points[3];
        const nextPoint = this.points[4];
        
        // Get body direction to align fin with body
        const bodyDirection = new THREE.Vector3().subVectors(
          nextPoint.position,
          finAnchorPoint.position
        ).normalize();
        
        // Position the fin
        const offset = new THREE.Vector3(0, 0.8, 0);
        const pos = this.transformLocalToWorld(offset, finAnchorPoint);
        this.dorsalFin.position.copy(pos);
        
        // Orient dorsal fin simply in the direction of body movement
        const lookTarget = new THREE.Vector3().copy(finAnchorPoint.position).add(bodyDirection);
        this.dorsalFin.lookAt(lookTarget);
      }
      
      // Anal fin - simplified, just align with body
      if (this.analFin) {
        const finAnchorPoint = this.points[5];
        const nextPoint = this.points[6];
        
        // Get body direction to align fin with body
        const bodyDirection = new THREE.Vector3().subVectors(
          nextPoint.position,
          finAnchorPoint.position
        ).normalize();
        
        // Position the fin
        const offset = new THREE.Vector3(0, -0.8, 0);
        const pos = this.transformLocalToWorld(offset, finAnchorPoint);
        this.analFin.position.copy(pos);
        
        // Orient fin along body direction
        const lookTarget = new THREE.Vector3().copy(finAnchorPoint.position).add(bodyDirection);
        this.analFin.lookAt(lookTarget);
        
        // Maintain downward orientation
        this.analFin.rotateZ(Math.PI);
      }
    }
    
    // Flocking algorithm (based on Boids) - implements the three key behaviors:
    // 1. Separation - avoid crowding
    // 2. Alignment - match direction with neighbors
    // 3. Cohesion - stay with the group
    avoidOtherFish(allFish) {
      const head = this.points[0];
      
      // Initialize force vectors for flocking behaviors
      const separation = new THREE.Vector3();  // Avoid crowding
      const alignment = new THREE.Vector3();   // Match direction
      const cohesion = new THREE.Vector3();    // Move toward center
      let neighbors = 0;
      
      // Enhanced collision detection radius - fish more aware of others
      const detectionRadius = this.perceptionRadius * 1.2;
      
      // Check all other fish for flocking interactions
      for (const otherFish of allFish) {
        if (otherFish === this) continue;
        
        const otherHead = otherFish.points[0];
        const toOther = new THREE.Vector3().subVectors(head.position, otherHead.position);
        const distance = toOther.length();
        
        // Only interact with fish within perception radius
        if (distance < this.perceptionRadius) {
          // SEPARATION - avoid crowding nearby fish (stronger at close range)
          if (distance < this.avoidanceRadius) {
            // Calculate separation force (inversely proportional to distance)
            const avoidStrength = 1 - Math.pow(distance / this.avoidanceRadius, 2);
            const separationForce = toOther.clone().normalize().multiplyScalar(avoidStrength);
            separation.add(separationForce);
          }
          
          // ALIGNMENT - match direction with nearby fish
          alignment.add(otherFish.points[0].velocity);
          
          // COHESION - move toward center of group
          cohesion.add(otherHead.position);
          
          neighbors++;
        }
      }
      
      // Only apply flocking behaviors if there are neighbors
      if (neighbors > 0) {
        // SEPARATION - apply avoidance force
        separation.multiplyScalar(this.separationWeight);
        
        // ALIGNMENT - match average direction of neighbors
        alignment.divideScalar(neighbors).normalize().multiplyScalar(this.alignmentWeight);
        
        // COHESION - move toward center of group
        cohesion.divideScalar(neighbors);  // Get average position
        const cohesionForce = new THREE.Vector3().subVectors(cohesion, head.position)
          .normalize().multiplyScalar(this.cohesionWeight);
        
        // Apply all flocking forces
        head.velocity.add(separation);
        head.velocity.add(alignment);
        head.velocity.add(cohesionForce);
        
        // Add a larger random component for more chaotic movement
        const randomness = new THREE.Vector3(
          (Math.random() - 0.5) * 0.07,
          (Math.random() - 0.5) * 0.07,
          (Math.random() - 0.5) * 0.01
        );
        head.velocity.add(randomness);
      }
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
              (Math.random() - 0.5) * 20,
              (Math.random() - 0.5) * 15,
              (Math.random() - 0.5) * 3
            );
            
            // Increase speed to return to view
            head.velocityMultiplier = 1.5;
          } else {
            // Random wandering, occasionally changing target
            if (Math.random() < 0.01) {
              this.targetPosition.set(
                (Math.random() - 0.5) * 25,
                (Math.random() - 0.5) * 18,
                (Math.random() - 0.5) * 3
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
              (Math.random() - 0.5) * 16,
              (Math.random() - 0.5) * 3
            );
            head.velocityMultiplier = 1.3;
          } else {
            // Occasionally pick new positions near center
            if (Math.random() < 0.02) {
              this.targetPosition.set(
                (Math.random() - 0.5) * 22,
                (Math.random() - 0.5) * 17,
                (Math.random() - 0.5) * 3
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

  // Store screen boundaries for containment
  this.bounds = {
    minX: -25,
    maxX: 25,
    minY: -20,
    maxY: 20,
    minZ: -8,
    maxZ: -2
  };
  
  // CRITICAL: Always use simple shapes to guarantee visibility 
  this.useSimpleShapes = true;
  
  // Lazy loading flags and timing
  this.loaded = false;
  this.fishToCreate = 0;
  this.fishCreationInterval = null;
  this.initialFishDelay = 500; // ms before first fish spawns
  this.fishSpawnDelay = 100; // ms between fish spawning - faster
  
  this.init = function() {
    if (!this.canvas) return false;
    
    // Check if WebGL is available - using a simple test instead of THREE.WEBGL
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        console.error('WebGL is not available');
        return false;
      }
    } catch (e) {
      console.error('WebGL is not available', e);
      return false;
    }
    
    // Try to use detailed fish skin if possible, fallback to simple shapes if needed
    this.useSimpleShapes = false; // Start with detailed meshes
    console.log('Using detailed fish skin mesh for better appearance');

    // Setup scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000816);

    // Setup camera (completely static)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 20);
    
    // Setup renderer with improved settings for visibility
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas, 
      antialias: true,
      alpha: false,
      stencil: false,
      depth: true,
      premultipliedAlpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.sortObjects = false; // Disable sorting for predictable rendering
    
    // Add environment
    this.addEnvironment();
    
    // Add proper lighting for fish visibility
    this.addLighting();

    // Handle resize (only update renderer size)
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(width, height);
      
      // Update bounds based on new viewport size
      this.updateBoundaries();
    });

    // Define harmonious blue/teal fish colors for underwater theme
    this.fishColors = [
      new THREE.Color(0x3A7CA5), // deep blue
      new THREE.Color(0x4A94BF), // medium blue
      new THREE.Color(0x5EAAD7), // light blue
      new THREE.Color(0x2F6D58), // deep teal
      new THREE.Color(0x4A8573), // medium teal
      new THREE.Color(0x64A98E), // light teal
      new THREE.Color(0x6A8D9C), // blue gray
      new THREE.Color(0x829CAB), // pale blue
      new THREE.Color(0x38658B), // navy blue
      new THREE.Color(0x518BA8), // steel blue
      new THREE.Color(0x2E5D69), // dark teal
      new THREE.Color(0x336270), // deep ocean blue
    ];
    
    // Calculate screen boundaries based on camera
    this.updateBoundaries();
    
    // Start simulation with no fish
    this.fishToCreate = this.fishCount;
    this.fish = [];
    
    // Start spawning fish with a delay
    setTimeout(() => {
      this.startCreatingFish();
    }, this.initialFishDelay);
    
    // Start animation loop
    this.animate();
    return true;
  };
  
  // Update screen boundaries based on camera
  this.updateBoundaries = function() {
    // Calculate visible area boundaries
    const vFov = this.camera.fov * Math.PI / 180;
    const height = 2 * Math.tan(vFov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;
    
    // Set boundaries with larger margins to keep fish firmly on screen
    const horizontalMargin = 4; // Larger margins for horizontal movement
    const verticalMargin = 3;   // Smaller margins for vertical movement
    
    this.bounds = {
      minX: -width/2 + horizontalMargin,  // Left 
      maxX: width/2 - horizontalMargin,   // Right
      minY: -height/2 + verticalMargin,   // Bottom
      maxY: height/2 - verticalMargin,    // Top
      minZ: -8,                           // Far from camera - reduced depth
      maxZ: -2                            // Near to camera - prevent crossing camera
    };
  };
  
  // Create a fish at one of the off-screen spawn points
  this.createFish = function() {
    if (this.fishToCreate <= 0) {
      clearInterval(this.fishCreationInterval);
      this.loaded = true;
      return;
    }
    
    // IMPROVED: Spawn positions - guaranteed to be FAR outside screen edges
    // Use a much larger margin to ensure fish are completely off-screen
    const margin = 20; // Large margin to ensure fish are well off-screen
    
    const spawnPositions = [
      // Left side spawns - well off-screen
      { x: this.bounds.minX - margin, y: (Math.random() - 0.5) * (this.bounds.maxY - this.bounds.minY), z: (Math.random() - 0.5) * 7 },
      // Right side spawns - well off-screen
      { x: this.bounds.maxX + margin, y: (Math.random() - 0.5) * (this.bounds.maxY - this.bounds.minY), z: (Math.random() - 0.5) * 7 },
      // Top spawns - well off-screen
      { x: (Math.random() - 0.5) * (this.bounds.maxX - this.bounds.minX), y: this.bounds.maxY + margin, z: (Math.random() - 0.5) * 7 },
      // Bottom spawns - well off-screen
      { x: (Math.random() - 0.5) * (this.bounds.maxX - this.bounds.minX), y: this.bounds.minY - margin, z: (Math.random() - 0.5) * 7 }
    ];
    
    // Pick random spawn position
    const spawn = spawnPositions[Math.floor(Math.random() * spawnPositions.length)];
    
    // Select a color with slight variation
    const baseColor = this.fishColors[this.fish.length % this.fishColors.length];
    const color = baseColor.clone().offsetHSL(
      (Math.random() - 0.5) * 0.05, // slight hue variation
      Math.random() * 0.1,          // slight saturation variation
      (Math.random() - 0.5) * 0.1   // slight lightness variation
    );
    
    // Create smaller fish with good speed for visible movement
    const speed = 0.8 + Math.random() * 0.4; // Extremely fast speeds
    
    // Create smaller fish - reduce overall scale for more natural schooling
    const fishScale = 0.15 + Math.random() * 0.15; // 15-30% of original size - much smaller
    
    // Create fish with the emergency simple body mode if needed
    // After spawning a few fish, switch to simple mode if we had visibility issues
    if (this.fish.length >= 3) {
      // Check if any existing fish have their body visible
      let visibleBodiesCount = 0;
      for (const existingFish of this.fish) {
        if (existingFish.bodyMesh && existingFish.bodyMesh.visible) {
          visibleBodiesCount++;
        }
      }
      
      // If most fish don't have visible bodies, switch to simple mode
      if (visibleBodiesCount < this.fish.length * 0.5) {
        console.warn("Fish visibility issues detected - switching to simple mode");
        this.useSimpleShapes = true;
      }
    }
    
    // Create the fish with current settings
    const fish = new Fish(spawn.x, spawn.y, spawn.z, color, speed);
    
    // Scale fish to make them smaller
    fish.scale = fishScale;
    
    // Always do a complete rebuild to ensure all parts exist
    // Clear any existing parts to avoid duplicates
    while (fish.group.children.length > 0) {
      fish.group.remove(fish.group.children[0]);
    }
    
    // Rebuild all parts from scratch
    fish.createFishBody();
    fish.addEyes();
    fish.addFins();
    
    // Always call compute for proper mesh normals
    if (fish.bodyMesh && fish.bodyMesh.geometry) {
      fish.bodyMesh.geometry.computeVertexNormals();
      fish.bodyMesh.geometry.computeBoundingSphere();
    }
    
    // Ensure all fish components are visible
    if (fish.bodyMesh) fish.bodyMesh.visible = true;
    if (fish.rightFin) fish.rightFin.visible = true;
    if (fish.leftFin) fish.leftFin.visible = true;
    if (fish.dorsalFin) fish.dorsalFin.visible = true;
    if (fish.analFin) fish.analFin.visible = true;
    if (fish.tailFin) fish.tailFin.visible = true;
    if (fish.headFiller) fish.headFiller.visible = true;
    
    // Apply scaling to make fish smaller
    if (fish.scale && fish.scale !== 1.0) {
      fish.group.scale.set(fish.scale, fish.scale, fish.scale);
    }
    
    // Set initial velocity toward center of screen - STRONGER to ensure they come into view
    const centerX = (this.bounds.minX + this.bounds.maxX) / 2;
    const centerY = (this.bounds.minY + this.bounds.maxY) / 2;
    const centerZ = (this.bounds.minZ + this.bounds.maxZ) / 2;
    
    // Calculate direction toward center with more precise targeting
    const dirX = centerX - spawn.x;
    const dirY = centerY - spawn.y;
    const dirZ = centerZ - spawn.z;
    const length = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    
    // Add strong initial velocity toward center to ensure fish enter screen quickly
    const headPoint = fish.points[0];
    headPoint.velocity.x = (dirX / length) * speed * 1.5;
    headPoint.velocity.y = (dirY / length) * speed * 1.5;
    headPoint.velocity.z = (dirZ / length) * speed * 1.5;
    
    // Set the initial wander angle to face inward
    const angle = Math.atan2(dirZ, dirX);
    headPoint.wanderAngle = angle;
    
    // Add to scene
    this.fish.push(fish);
    this.scene.add(fish.group);
    
    this.fishToCreate--;
  };
  
  // Start creating fish at intervals
  this.startCreatingFish = function() {
    this.fishCreationInterval = setInterval(() => {
      this.createFish();
    }, this.fishSpawnDelay);
  };
  
  this.addEnvironment = function() {
    // Add stronger ambient light for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    // Add directional light for main illumination and shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 0, 10); // Light from camera position
    this.scene.add(directionalLight);
    
    // Add another directional light from a different angle
    const secondLight = new THREE.DirectionalLight(0xffffff, 0.5);
    secondLight.position.set(5, 5, 5);
    this.scene.add(secondLight);
    
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

  // Add proper lighting for fish visibility
  this.addLighting = function() {
    // Soft underwater ambient light - bluish tint
    const ambientLight = new THREE.AmbientLight(0x101820, 0.7);
    this.scene.add(ambientLight);
    
    // Main light from above - simulating sun through water
    const topLight = new THREE.DirectionalLight(0x3A7CA5, 0.6);
    topLight.position.set(0, 15, 5);
    this.scene.add(topLight);
    
    // Gentle fill light from front - for visibility
    const frontLight = new THREE.DirectionalLight(0x4A6670, 0.4);
    frontLight.position.set(0, 0, 10);
    this.scene.add(frontLight);
    
    // Subtle side fill from left - for dimension
    const leftLight = new THREE.DirectionalLight(0x2B5F82, 0.2);
    leftLight.position.set(-10, 0, 2);
    this.scene.add(leftLight);
  };
  
  this.animate = function() {
    requestAnimationFrame(this.animate.bind(this));
    this.elapsedTime += 0.01;
    
    // Make instance available to fish for boundary detection
    window.aquariumInstance = this;

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
