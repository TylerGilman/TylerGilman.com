// fishtank.js

class FishTank {
    constructor(canvasId, options = {}) {
        this.canvasId = canvasId;
        this.canvas = null;
        this.ctx = null;
        this.fishes = [];
        this.isInitialized = false;
        this.animationFrameId = null;
        this.mouseX = null;
        this.mouseY = null;

        // Default options with provided overrides
        this.options = {
            width: options.width || 600,
            height: options.height || 400,
            fishCount: options.fishCount || 10,
            minSpeed: options.minSpeed || 0.5,
            maxSpeed: options.maxSpeed || 2.5
        };

    this.ConstrainedPoint = class {
        constructor(x, y, constraintRadius, speed, isHead = false) {
            this.x = x;
            this.y = y;
            this.constraintRadius = constraintRadius;
            this.previousPoint = null;
            this.nextPoint = null;
            this.isHead = isHead;
            this.angle = Math.random() * Math.PI * 2;
            this.speed = speed;
            this.turnRate = 0.2 + (Math.random() * 0.2); // Random turn rate between 0.2 and 0.4
            this.waveAngle = 0.4;
        }

        move(mouseX, mouseY) {
            if (this.isHead) {
                let targetX, targetY;
                if (mouseX !== null && mouseY !== null) {
                    targetX = mouseX;
                    targetY = mouseY;
                } else {
                    targetX = this.x + Math.cos(this.angle) * this.speed;
                    targetY = this.y + Math.sin(this.angle) * this.speed;
                }

                const dx = targetX - this.x;
                const dy = targetY - this.y;
                const targetAngle = Math.atan2(dy, dx);

                const angleDiff = (targetAngle - this.angle + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
                this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.turnRate);

                this.waveAngle += 0.1;
                const waveOffset = Math.sin(this.waveAngle) * 0.3;
                
                this.x += Math.cos(this.angle + waveOffset) * this.speed;
                this.y += Math.sin(this.angle + waveOffset) * this.speed;

                const margin = 30; // Reduced margin for smaller tank

                if (this.x < margin) this.angle = 0;
                if (this.x > canvas.width - margin) this.angle = Math.PI;
                if (this.y < margin) this.angle = Math.PI / 2;
                if (this.y > canvas.height - margin) this.angle = -Math.PI / 2;

                this.x = Math.max(5, Math.min(canvas.width - 5, this.x));
                this.y = Math.max(5, Math.min(canvas.height - 5, this.y));

                if (mouseX === null && mouseY === null && Math.random() < 0.02) {
                    this.angle += (Math.random() - 0.5) * Math.PI / 4;
                }
            }
        }

        constrain() {
            if (this.previousPoint) {
                const dx = this.x - this.previousPoint.x;
                const dy = this.y - this.previousPoint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > this.constraintRadius) {
                    const angle = Math.atan2(dy, dx);
                    this.x = this.previousPoint.x + Math.cos(angle) * this.constraintRadius;
                    this.y = this.previousPoint.y + Math.sin(angle) * this.constraintRadius;
                }
            }
        }
    }

  this.Fish = class {
      constructor(x, y, color, speed) {
          this.color = color;
          this.speed = speed;
          this.constraintRadius = 4;
          this.numSegments = 6;
          this.bodySizes = Array.from({ length: this.numSegments }, (_, i) => {
              if (i === 0) return 6;
              const t = i / (this.numSegments - 1);
              return 6 * (1 - Math.pow(t, 1.1));
          });
          this.maxBendAngle = Math.PI / 4;

          this.points = Array.from({ length: this.numSegments }, (_, i) =>
              new ConstrainedPoint(x + i * this.constraintRadius, y, this.constraintRadius, this.speed, i === 0)
          );

          // Connect points
          for (let i = 1; i < this.points.length; i++) {
              this.points[i].previousPoint = this.points[i - 1];
              this.points[i - 1].nextPoint = this.points[i];
          }
      }

      update(mouseX, mouseY) {
          // Update head position first
          this.points[0].move(mouseX, mouseY);
          
          // Update all points' positions
          for (const point of this.points) {
              point.constrain();
          }

          // Limit joint angles
          for (let i = 0; i < this.points.length - 2; i++) {
              this.limitJointAngle(this.points[i], this.points[i + 1], this.points[i + 2]);
          }
      }

      limitJointAngle(p1, p2, p3) {
          const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
          let angleDiff = (angle2 - angle1 + 3 * Math.PI) % (2 * Math.PI) - Math.PI;

          if (Math.abs(angleDiff) > this.maxBendAngle) {
              const newAngle = angle1 + this.maxBendAngle * Math.sign(angleDiff);
              p3.x = p2.x + Math.cos(newAngle) * this.constraintRadius;
              p3.y = p2.y + Math.sin(newAngle) * this.constraintRadius;
          }
      }

      draw(ctx) {
          // Draw body
          const bodyPath = this.getBodyPath();
          ctx.fillStyle = this.color;
          ctx.fill(bodyPath);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.lineWidth = 0.5;
          ctx.stroke(bodyPath);

          // Draw fins
          const finPath = this.getFinPath(1);
          ctx.fillStyle = this.color;
          ctx.fill(finPath);
          ctx.stroke(finPath);
      }

      getBodyPath() {
          const path = new Path2D();
          
          // Helper function for body contour points
          const getContourPoint = (t, side) => {
              const index = Math.min(Math.floor(t * (this.points.length - 1)), this.points.length - 2);
              const localT = (t * (this.points.length - 1)) % 1;
              const p1 = this.points[index];
              const p2 = this.points[index + 1];
              const size1 = this.bodySizes[index];
              const size2 = this.bodySizes[index + 1];

              const x = (1 - localT) * p1.x + localT * p2.x;
              const y = (1 - localT) * p1.y + localT * p2.y;
              const r = (1 - localT) * size1 + localT * size2;
              const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) + (side * Math.PI / 2);

              return {
                  x: x + r * Math.cos(angle),
                  y: y + r * Math.sin(angle)
              };
          };

          // Draw head
          const head = this.points[0];
          const headRadius = this.bodySizes[0];
          const headAngle = Math.atan2(this.points[1].y - head.y, this.points[1].x - head.x);
          
          path.moveTo(
              head.x + headRadius * Math.cos(headAngle + Math.PI/2),
              head.y + headRadius * Math.sin(headAngle + Math.PI/2)
          );
          
          path.arc(head.x, head.y, headRadius, headAngle + Math.PI/2, headAngle - Math.PI/2, false);

          // Draw body
          for (let t = 0; t <= 1; t += 0.1) {
              const point = getContourPoint(t, -1);
              path.lineTo(point.x, point.y);
          }

          for (let t = 1; t >= 0; t -= 0.1) {
              const point = getContourPoint(t, 1);
              path.lineTo(point.x, point.y);
          }

          path.closePath();
          return path;
      }

      getFinPath(finPointIndex) {
          const path = new Path2D();
          const finLength = 6;
          const finWidth = 1.5;
          const finAngle = Math.PI / 6;

          const finShape = (t, foldFactor) => {
              const x = t * finLength;
              const y = finWidth * Math.sin(t * Math.PI) * foldFactor + x * Math.tan(finAngle);
              return { x, y };
          };

          // Calculate fin positions and angles
          const p1 = this.points[finPointIndex];
          const p2 = this.points[finPointIndex + 1];
          const p0 = this.points[Math.max(0, finPointIndex - 1)];
          const bodyAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const prevBodyAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          const turnAngle = (bodyAngle - prevBodyAngle + 3 * Math.PI) % (2 * Math.PI) - Math.PI;

          // Calculate fin base points
          const size = this.bodySizes[finPointIndex];
          const rightFinBase = {
              x: p1.x + size * Math.cos(bodyAngle + Math.PI / 2),
              y: p1.y + size * Math.sin(bodyAngle + Math.PI / 2)
          };
          const leftFinBase = {
              x: p1.x + size * Math.cos(bodyAngle - Math.PI / 2),
              y: p1.y + size * Math.sin(bodyAngle - Math.PI / 2)
          };

          // Calculate fin folding based on turn angle
          const rightFoldFactor = 1 - Math.max(0, Math.min(1, turnAngle / (Math.PI / 4)));
          const leftFoldFactor = 1 + Math.max(0, Math.min(1, turnAngle / (Math.PI / 4)));

          // Draw right fin
          path.moveTo(rightFinBase.x, rightFinBase.y);
          for (let t = 0; t <= 1; t += 0.1) {
              const point = finShape(t, rightFoldFactor);
              const rotatedX = point.x * Math.cos(bodyAngle + finAngle) - point.y * Math.sin(bodyAngle + finAngle);
              const rotatedY = point.x * Math.sin(bodyAngle + finAngle) + point.y * Math.cos(bodyAngle + finAngle);
              path.lineTo(rightFinBase.x + rotatedX, rightFinBase.y + rotatedY);
          }
          path.lineTo(rightFinBase.x, rightFinBase.y);

          // Draw left fin
          path.moveTo(leftFinBase.x, leftFinBase.y);
          for (let t = 0; t <= 1; t += 0.1) {
              const point = finShape(t, leftFoldFactor);
              const rotatedX = point.x * Math.cos(bodyAngle - finAngle) - (-point.y) * Math.sin(bodyAngle - finAngle);
              const rotatedY = point.x * Math.sin(bodyAngle - finAngle) + (-point.y) * Math.cos(bodyAngle - finAngle);
              path.lineTo(leftFinBase.x + rotatedX, leftFinBase.y + rotatedY);
          }
          path.lineTo(leftFinBase.x, leftFinBase.y);

          return path;
      }
  }
}

    setCanvasSize() {
        if (this.canvas) {
            this.canvas.width = this.options.width;
            this.canvas.height = this.options.height;
            this.canvas.style.width = this.options.width + 'px';
            this.canvas.style.height = this.options.height + 'px';
        }
    }

    getRandomColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 80%, 50%)`;
    }

    getRandomSpeed(min, max) {
        return Math.random() * (max - min) + min;
    }

    initializeFishes() {
        this.fishes = [];
        for (let i = 0; i < this.options.fishCount; i++) {
            const x = Math.random() * this.options.width;
            const y = Math.random() * this.options.height;
            const color = this.getRandomColor();
            const speed = this.getRandomSpeed(this.options.minSpeed, this.options.maxSpeed);
            this.fishes.push(new this.Fish(x, y, color, speed));
        }
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });

        this.canvas.addEventListener('mouseout', () => {
            this.mouseX = null;
            this.mouseY = null;
        });

        window.addEventListener('resize', () => {
            if (this.canvas.id === 'nav-fishtank') {
                this.options.width = window.innerWidth;
                this.setCanvasSize();
            }
        });
    }

    draw = () => {
        if (!document.body.contains(this.canvas)) {
            this.cleanup();
            return;
        }

        this.ctx.clearRect(0, 0, this.options.width, this.options.height);

        for (const fish of this.fishes) {
            fish.update(this.mouseX, this.mouseY);
            fish.draw(this.ctx);
        }

        this.animationFrameId = requestAnimationFrame(this.draw);
    }

    initialize() {
        if (this.isInitialized) return;

        this.canvas = document.getElementById(this.canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) return;

        this.setCanvasSize();
        this.initializeFishes();
        this.setupEventListeners();
        this.draw();

        this.isInitialized = true;
    }

    cleanup() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.isInitialized = false;
        this.fishes = [];
    }
}

// Global event handlers for HTMX integration
Document.addEventListener('htmx:afterSettle', function(event) {
    const tanks = event.detail.target.getElementsByTagName('canvas');
    if (!tanks.length) {
        console.warn('No canvas elements found in updated content');
        return;
    }

    Array.from(tanks).forEach(tank => {
        if (tank.id && tank.id.includes('fishtank')) {
            console.log(`Initializing tank with id: ${tank.id}`);
            const isNav = tank.id === 'nav-fishtank';
            const options = isNav ? {
                height: 64,
                width: window.innerWidth,
                fishCount: 5,
                minSpeed: 0.3,
                maxSpeed: 1.5
            } : {};
            
            const fishTank = new FishTank(tank.id, options);
            fishTank.initialize();
            tank.fishTank = fishTank;
        }
    });
});

document.addEventListener('htmx:beforeCleanupElement', function(event) {
    const tanks = event.target.getElementsByTagName('canvas');
    Array.from(tanks).forEach(tank => {
        if (tank.fishTank) {
            tank.fishTank.cleanup();
        }
    });
});

// Export for global use
window.FishTank = FishTank;
