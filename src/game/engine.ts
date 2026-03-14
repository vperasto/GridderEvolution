import { audio } from './audio';

export type Dir = 'up' | 'down' | 'left' | 'right' | 'idle';

export interface Point {
  x: number;
  y: number;
}

export interface Edge {
  id: string;
  n1: Point;
  n2: Point;
  traversed: boolean;
}

export interface Cell {
  id: string;
  edges: Edge[];
  captured: boolean;
  color: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface Perk {
  x: number;
  y: number;
  type: 'speed' | 'freeze' | 'shield' | 'double';
  active: boolean;
  timer: number;
}

export interface Enemy {
  x: number;
  y: number;
  startX: number;
  startY: number;
  type: 'spark' | 'stalker' | 'boss';
  dir: Dir;
  speed: number;
  state: 'moving' | 'frozen';
  freezeTimer: number;
}

export class GameEngine {
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;
  
  level = 1;
  score = 0;
  lives = 3;
  state: 'title' | 'playing' | 'gameover' | 'leveltransition' = 'title';
  
  nodes: Point[] = [];
  edges: Map<string, Edge> = new Map();
  cells: Cell[] = [];
  
  player = { x: 0, y: 0, dir: 'idle' as Dir, nextDir: 'idle' as Dir, speed: 1.4, shield: false, double: 0, speedTimer: 0, invincible: 0, lastNode: { x: 0, y: 0 } };
  enemies: Enemy[] = [];
  particles: Particle[] = [];
  perks: Perk[] = [];
  
  gridSize = 40;
  offsetX = 0;
  offsetY = 0;
  
  lastTime = 0;
  comboTimer = 0;
  comboCount = 0;
  mutationTimer = 0;
  mutationMessage = 'MUTATION!';
  levelType: 'normal' | 'pre-mutated' | 'boss' = 'normal';
  perkNames: Record<string, string> = { speed: 'SPEED', freeze: 'FREEZE', shield: 'SHIELD', double: 'DOUBLE' };
  
  onStateChange?: (state: string) => void;
  onScoreChange?: (score: number) => void;
  onLevelChange?: (level: number) => void;
  onLivesChange?: (lives: number) => void;
  onMessage?: (msg: string) => void;

  // Strict C64 Palette
  colors = {
    bg: '#000000', // Black
    grid: '#0088FF', // Light Blue
    player: '#EEEE77', // Yellow
    enemySpark: '#FF7777', // Light Red
    enemyStalker: '#AAFFEE', // Cyan
    boss: '#CC44CC', // Purple
    captured: '#0000AA', // Blue
    text: '#FFFFFF', // White
    perkSpeed: '#FF7777', // Red (Light Red)
    perkFreeze: '#0088FF', // Blue (Light Blue)
    perkShield: '#CC44CC', // Purple
    perkDouble: '#00CC55' // Green
  };

  private _colorblind = false;
  set colorblind(val: boolean) {
    this._colorblind = val;
    if (val) {
      // Colorblind friendly palette (high contrast, distinct hues)
      this.colors = {
        bg: '#000000',
        grid: '#555555', // Grey grid
        player: '#FFFFFF', // White player
        enemySpark: '#E69F00', // Orange
        enemyStalker: '#56B4E9', // Sky Blue
        boss: '#CC79A7', // Reddish Purple
        captured: '#0072B2', // Dark Blue
        text: '#FFFFFF',
        perkSpeed: '#D55E00', // Vermillion
        perkFreeze: '#56B4E9', // Sky Blue
        perkShield: '#F0E442', // Yellow
        perkDouble: '#009E73' // Bluish Green
      };
    } else {
      // Original C64 Palette
      this.colors = {
        bg: '#000000',
        grid: '#0088FF',
        player: '#EEEE77',
        enemySpark: '#FF7777',
        enemyStalker: '#AAFFEE',
        boss: '#CC44CC',
        captured: '#0000AA',
        text: '#FFFFFF',
        perkSpeed: '#FF7777',
        perkFreeze: '#0088FF',
        perkShield: '#CC44CC',
        perkDouble: '#00CC55'
      };
    }
  }
  get colorblind() { return this._colorblind; }

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  init() {
    this.state = 'title';
    if (this.onStateChange) this.onStateChange(this.state);
  }

  start() {
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.player.shield = false;
    if (this.onScoreChange) this.onScoreChange(this.score);
    if (this.onLivesChange) this.onLivesChange(this.lives);
    this.loadLevel();
    this.state = 'playing';
    if (this.onStateChange) this.onStateChange(this.state);
    audio.playStart();
  }

  loadLevel() {
    this.nodes = [];
    this.edges.clear();
    this.cells = [];
    this.enemies = [];
    this.particles = [];
    this.perks = [];
    
    this.player.dir = 'idle';
    this.player.nextDir = 'idle';
    this.player.invincible = 0;
    this.player.lastNode = { x: 0, y: 0 };
    
    const isBoss = this.level % 5 === 0;
    if (isBoss) {
      this.levelType = 'boss';
      this.mutationTimer = Infinity;
    } else if (this.level >= 3 && Math.random() < 0.4) {
      this.levelType = 'pre-mutated';
      this.mutationTimer = Infinity;
    } else {
      this.levelType = 'normal';
      this.mutationTimer = 15;
    }
    
    // Generate grid based on level
    let cols = 5 + Math.floor(this.level / 2);
    let rows = 4 + Math.floor(this.level / 3);
    
    if (cols > 12) cols = 12;
    if (rows > 10) rows = 10;
    
    this.gridSize = Math.min((this.width - 40) / cols, (this.height - 80) / rows);
    this.offsetX = (this.width - cols * this.gridSize) / 2;
    this.offsetY = (this.height - rows * this.gridSize) / 2 + 20;

    // Create nodes
    for (let y = 0; y <= rows; y++) {
      for (let x = 0; x <= cols; x++) {
        this.nodes.push({ x, y });
      }
    }

    const getEdgeId = (p1: Point, p2: Point) => {
      const x1 = Math.min(p1.x, p2.x);
      const y1 = Math.min(p1.y, p2.y);
      const x2 = Math.max(p1.x, p2.x);
      const y2 = Math.max(p1.y, p2.y);
      return `${x1},${y1}-${x2},${y2}`;
    };

    const addEdge = (p1: Point, p2: Point) => {
      const id = getEdgeId(p1, p2);
      if (!this.edges.has(id)) {
        this.edges.set(id, { id, n1: p1, n2: p2, traversed: false });
      }
      return this.edges.get(id)!;
    };

    // Create cells and edges
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Boss level: skip middle cells to make a big arena
        if (isBoss && x > 0 && x < cols - 1 && y > 0 && y < rows - 1) {
          continue;
        }
        
        // Randomly skip some cells to make irregular shapes (from level 3)
        if (!isBoss && this.level >= 3 && Math.random() < 0.1 && (x > 0 && x < cols-1 && y > 0 && y < rows-1)) {
           continue;
        }

        const pTL = { x, y };
        const pTR = { x: x + 1, y };
        const pBL = { x, y: y + 1 };
        const pBR = { x: x + 1, y: y + 1 };

        const eTop = addEdge(pTL, pTR);
        const eBottom = addEdge(pBL, pBR);
        const eLeft = addEdge(pTL, pBL);
        const eRight = addEdge(pTR, pBR);

        this.cells.push({
          id: `${x},${y}`,
          edges: [eTop, eBottom, eLeft, eRight],
          captured: false,
          color: this.colors.captured,
          cx: x, cy: y, w: 1, h: 1
        });
      }
    }

    // Add Boss cell if boss level
    if (isBoss) {
      const pTL = { x: 1, y: 1 };
      const pTR = { x: cols - 1, y: 1 };
      const pBL = { x: 1, y: rows - 1 };
      const pBR = { x: cols - 1, y: rows - 1 };
      
      const eTop = addEdge(pTL, pTR);
      const eBottom = addEdge(pBL, pBR);
      const eLeft = addEdge(pTL, pBL);
      const eRight = addEdge(pTR, pBR);
      
      this.cells.push({
        id: `boss`,
        edges: [eTop, eBottom, eLeft, eRight],
        captured: false,
        color: '#880000',
        cx: 1, cy: 1, w: cols - 2, h: rows - 2
      });
      
      this.enemies.push({
        x: cols / 2, y: rows / 2, startX: cols / 2, startY: rows / 2, type: 'boss', dir: 'idle', speed: 1, state: 'moving', freezeTimer: 0
      });
    }

    // Player start
    this.player.x = 0;
    this.player.y = 0;

    // Add enemies
    const numEnemies = Math.min(1 + Math.floor(this.level / 2), 8);
    for (let i = 0; i < numEnemies; i++) {
      let ex = cols;
      let ey = rows;
      if (i % 2 === 1) { ex = 0; ey = rows; }
      if (i % 3 === 2) { ex = cols; ey = 0; }
      
      this.enemies.push({
        x: ex, y: ey, 
        startX: ex, startY: ey,
        type: (this.level > 2 && Math.random() > 0.7) ? 'stalker' : 'spark',
        dir: 'up',
        speed: 0.7 + (this.level * 0.05), // Slower scaling
        state: 'moving',
        freezeTimer: 0
      });
    }
    
    if (this.levelType === 'pre-mutated') {
      const mutations = Math.min(10, 2 + Math.floor(this.level / 2));
      for (let i = 0; i < mutations; i++) {
        this.mutateGrid(true); // silent mutation
      }
    }
    
    if (this.onLevelChange) this.onLevelChange(this.level);
  }

  setDir(dir: Dir) {
    if (this.state !== 'playing') return;
    
    // Immediate 180-degree turn
    const isOpposite = 
      (this.player.dir === 'up' && dir === 'down') ||
      (this.player.dir === 'down' && dir === 'up') ||
      (this.player.dir === 'left' && dir === 'right') ||
      (this.player.dir === 'right' && dir === 'left');
      
    if (isOpposite) {
      this.player.dir = dir;
      this.player.nextDir = 'idle';
      return;
    }

    this.player.nextDir = dir;
    if (this.player.dir === 'idle') {
      if (this.canMove(this.player.x, this.player.y, dir)) {
        this.player.dir = dir;
        this.player.nextDir = 'idle';
      }
    }
  }

  update(dt: number) {
    if (this.state !== 'playing') return;

    // Timers
    if (this.player.speedTimer > 0) this.player.speedTimer -= dt;
    if (this.player.double > 0) this.player.double -= dt;
    if (this.player.invincible > 0) this.player.invincible -= dt;
    if (this.comboTimer > 0) this.comboTimer -= dt;
    else this.comboCount = 0;

    if (this.level >= 3 && this.level % 5 !== 0) {
      this.mutationTimer -= dt;
      if (this.mutationTimer <= 0) {
        this.mutationTimer = 10 + Math.random() * 10;
        this.mutateGrid();
      }
    }

    // Spawn Perks
    if (Math.random() < 0.002) {
      const types: ('speed' | 'freeze' | 'shield' | 'double')[] = ['speed', 'freeze', 'shield', 'double'];
      const node = this.nodes[Math.floor(Math.random() * this.nodes.length)];
      this.perks.push({
        x: node.x, y: node.y,
        type: types[Math.floor(Math.random() * types.length)],
        active: true,
        timer: 10
      });
    }

    // Update Perks
    for (let i = this.perks.length - 1; i >= 0; i--) {
      const p = this.perks[i];
      p.timer -= dt;
      
      const playerRadius = 8;
      const perkRadius = 6;
      const hitDistPixels = playerRadius + perkRadius - 2;
      
      const dxPixels = Math.abs(this.player.x - p.x) * this.gridSize;
      const dyPixels = Math.abs(this.player.y - p.y) * this.gridSize;
      
      if (p.timer <= 0) {
        this.perks.splice(i, 1);
      } else if (dxPixels < hitDistPixels && dyPixels < hitDistPixels) {
        this.applyPerk(p.type);
        this.perks.splice(i, 1);
      }
    }

    // Move Player
    let speed = this.player.speedTimer > 0 ? 4 : 2; // Reduced base speed
    this.moveEntity(this.player, speed * dt, true);

    // Move Enemies
    for (const enemy of this.enemies) {
      if (enemy.state === 'frozen') {
        enemy.freezeTimer -= dt;
        if (enemy.freezeTimer <= 0) enemy.state = 'moving';
        continue;
      }
      
      if (enemy.type === 'boss') {
        // Boss logic: slowly move towards player
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0) {
           enemy.x += (dx / dist) * enemy.speed * 0.5 * dt;
           enemy.y += (dy / dist) * enemy.speed * 0.5 * dt;
        }
      } else {
        this.moveEntity(enemy, enemy.speed * dt, false);
      }

      // Collision (pixel-based for fairer hitboxes)
      const playerRadius = 8;
      const enemyRadius = enemy.type === 'boss' ? 15 : 8;
      const hitDistPixels = playerRadius + enemyRadius - 2; // -2 for a tiny bit of leniency
      
      const dxPixels = Math.abs(this.player.x - enemy.x) * this.gridSize;
      const dyPixels = Math.abs(this.player.y - enemy.y) * this.gridSize;
      
      if (dxPixels < hitDistPixels && dyPixels < hitDistPixels) {
        if (this.player.invincible <= 0) {
          if (this.player.shield) {
            this.player.shield = false;
            this.player.invincible = 2;
            enemy.x = enemy.startX; // reset enemy
            enemy.y = enemy.startY;
            audio.playExplosion();
            this.spawnParticles(this.player.x, this.player.y, this.colors.perkShield);
          } else {
            this.playerDeath();
          }
        }
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  playerDeath() {
    audio.playExplosion();
    this.spawnParticles(this.player.x, this.player.y, this.colors.player);
    this.lives--;
    if (this.onLivesChange) this.onLivesChange(this.lives);
    
    if (this.lives <= 0) {
      this.gameOver();
    } else {
      // Reset player position and give invincibility
      this.player.x = 0;
      this.player.y = 0;
      this.player.dir = 'idle';
      this.player.nextDir = 'idle';
      this.player.invincible = 3;
    }
  }

  applyPerk(type: string) {
    audio.playPowerup();
    if (this.onMessage) this.onMessage(`PERK: ${type.toUpperCase()}!`);
    if (type === 'speed') this.player.speedTimer = 5;
    if (type === 'freeze') this.enemies.forEach(e => { e.state = 'frozen'; e.freezeTimer = 3; });
    if (type === 'shield') this.player.shield = true;
    if (type === 'double') this.player.double = 10;
  }

  moveEntity(ent: any, dist: number, isPlayer: boolean) {
    if (ent.dir === 'idle') {
      if (isPlayer && ent.nextDir !== 'idle') {
        if (this.canMove(ent.x, ent.y, ent.nextDir)) {
          ent.dir = ent.nextDir;
          ent.nextDir = 'idle';
        }
      }
      return;
    }

    let moved = 0;
    let loopGuard = 0; // Prevent infinite loops
    while (moved < dist && loopGuard++ < 100) {
      if (ent.dir === 'idle') break;

      let targetX = ent.x;
      let targetY = ent.y;
      
      if (ent.dir === 'up') {
        targetY = Math.floor(ent.y);
        if (targetY === ent.y) targetY -= 1;
      } else if (ent.dir === 'down') {
        targetY = Math.ceil(ent.y);
        if (targetY === ent.y) targetY += 1;
      } else if (ent.dir === 'left') {
        targetX = Math.floor(ent.x);
        if (targetX === ent.x) targetX -= 1;
      } else if (ent.dir === 'right') {
        targetX = Math.ceil(ent.x);
        if (targetX === ent.x) targetX += 1;
      }

      let distToNext = Math.abs(targetX - ent.x) + Math.abs(targetY - ent.y);
      let step = Math.min(dist - moved, distToNext);
      
      if (step <= 0) {
        break; // Failsafe: if we aren't moving, break out of the loop
      }

      if (ent.dir === 'up') ent.y -= step;
      if (ent.dir === 'down') ent.y += step;
      if (ent.dir === 'left') ent.x -= step;
      if (ent.dir === 'right') ent.x += step;
      
      moved += step;

      // Reached intersection?
      if (Math.abs(ent.x - targetX) < 0.001 && Math.abs(ent.y - targetY) < 0.001) {
        ent.x = targetX;
        ent.y = targetY;
        
        if (isPlayer) {
          if (this.player.lastNode) {
            const dist = Math.abs(this.player.lastNode.x - ent.x) + Math.abs(this.player.lastNode.y - ent.y);
            if (dist === 1) {
              this.markEdge(this.player.lastNode.x, this.player.lastNode.y, ent.x, ent.y);
            }
          }
          this.player.lastNode = { x: ent.x, y: ent.y };
          audio.playMove();

          if (ent.nextDir !== 'idle' && this.canMove(ent.x, ent.y, ent.nextDir)) {
            ent.dir = ent.nextDir;
            ent.nextDir = 'idle';
          } else if (!this.canMove(ent.x, ent.y, ent.dir)) {
            ent.dir = 'idle';
            break; // Stop moving if we hit a wall
          }
        } else {
          this.decideEnemyDir(ent);
          if (ent.dir === 'idle') break;
        }
        
        if (moved >= dist) break;
      }
    }
  }

  mutateGrid() {
    const candidateEdges = Array.from(this.edges.values()).filter(e => !e.traversed);
    if (candidateEdges.length === 0) return;

    // Shuffle candidates
    candidateEdges.sort(() => Math.random() - 0.5);

    for (const edge of candidateEdges) {
      // Check if occupied
      let occupied = false;
      const ents = [this.player, ...this.enemies];
      for (const ent of ents) {
        const minX = Math.min(edge.n1.x, edge.n2.x);
        const maxX = Math.max(edge.n1.x, edge.n2.x);
        const minY = Math.min(edge.n1.y, edge.n2.y);
        const maxY = Math.max(edge.n1.y, edge.n2.y);
        if (ent.x >= minX && ent.x <= maxX && ent.y >= minY && ent.y <= maxY) {
          occupied = true;
          break;
        }
      }
      if (occupied) continue;

      const sharedCells = this.cells.filter(c => !c.captured && c.edges.some(ce => ce.id === edge.id));
      if (sharedCells.length === 2) {
        const [c1, c2] = sharedCells;
        
        this.edges.delete(edge.id);
        this.cells = this.cells.filter(c => c.id !== c1.id && c.id !== c2.id);
        
        const newEdges = [...c1.edges, ...c2.edges].filter(e => e.id !== edge.id);
        const uniqueEdges = Array.from(new Set(newEdges));
        
        const minX = Math.min(c1.cx, c2.cx);
        const minY = Math.min(c1.cy, c2.cy);
        const maxX = Math.max(c1.cx + c1.w, c2.cx + c2.w);
        const maxY = Math.max(c1.cy + c1.h, c2.cy + c2.h);
        
        this.cells.push({
          id: `merged_${c1.id}_${c2.id}`,
          edges: uniqueEdges,
          captured: false,
          color: this.colors.captured,
          cx: minX,
          cy: minY,
          w: maxX - minX,
          h: maxY - minY
        });
        
        const ex = (edge.n1.x + edge.n2.x) / 2;
        const ey = (edge.n1.y + edge.n2.y) / 2;
        this.spawnParticles(ex, ey, '#FFFFFF');
        audio.playExplosion();
        if (this.onMessage) this.onMessage(this.mutationMessage);
        
        this.checkCells();
        break;
      }
    }
  }

  canMove(x: number, y: number, dir: Dir) {
    let nx = Math.round(x);
    let ny = Math.round(y);
    if (dir === 'up') ny -= 1;
    if (dir === 'down') ny += 1;
    if (dir === 'left') nx -= 1;
    if (dir === 'right') nx += 1;
    
    const id = this.getEdgeId({x: Math.round(x), y: Math.round(y)}, {x: nx, y: ny});
    return this.edges.has(id);
  }

  getEdgeId(p1: Point, p2: Point) {
    const x1 = Math.min(p1.x, p2.x);
    const y1 = Math.min(p1.y, p2.y);
    const x2 = Math.max(p1.x, p2.x);
    const y2 = Math.max(p1.y, p2.y);
    return `${x1},${y1}-${x2},${y2}`;
  }

  decideEnemyDir(enemy: Enemy) {
    const ix = Math.round(enemy.x);
    const iy = Math.round(enemy.y);
    const possible: Dir[] = [];
    
    if (this.canMove(ix, iy, 'up') && enemy.dir !== 'down') possible.push('up');
    if (this.canMove(ix, iy, 'down') && enemy.dir !== 'up') possible.push('down');
    if (this.canMove(ix, iy, 'left') && enemy.dir !== 'right') possible.push('left');
    if (this.canMove(ix, iy, 'right') && enemy.dir !== 'left') possible.push('right');
    
    if (possible.length === 0) {
      // Dead end, turn around
      if (enemy.dir === 'up') enemy.dir = 'down';
      else if (enemy.dir === 'down') enemy.dir = 'up';
      else if (enemy.dir === 'left') enemy.dir = 'right';
      else if (enemy.dir === 'right') enemy.dir = 'left';
      return;
    }

    if (enemy.type === 'stalker') {
      // Try to move towards player
      let bestDir = possible[0];
      let minDist = Infinity;
      for (const d of possible) {
        let nx = ix, ny = iy;
        if (d === 'up') ny -= 1;
        if (d === 'down') ny += 1;
        if (d === 'left') nx -= 1;
        if (d === 'right') nx += 1;
        const dist = Math.abs(nx - this.player.x) + Math.abs(ny - this.player.y);
        if (dist < minDist) {
          minDist = dist;
          bestDir = d;
        }
      }
      // 80% chance to follow best path, 20% random
      if (Math.random() < 0.8) {
        enemy.dir = bestDir;
        return;
      }
    }

    // Spark or random fallback
    enemy.dir = possible[Math.floor(Math.random() * possible.length)];
  }

  markEdge(x1: number, y1: number, x2: number, y2: number) {
    const id = this.getEdgeId({x: x1, y: y1}, {x: x2, y: y2});
    const edge = this.edges.get(id);
    if (edge && !edge.traversed) {
      edge.traversed = true;
      this.checkCells();
    }
  }

  checkCells() {
    let capturedThisFrame = 0;
    let allCaptured = true;

    for (const cell of this.cells) {
      if (!cell.captured) {
        const allEdgesTraversed = cell.edges.every(e => e.traversed);
        if (allEdgesTraversed) {
          cell.captured = true;
          capturedThisFrame++;
          this.spawnParticles(cell.cx + cell.w/2, cell.cy + cell.h/2, cell.color);
          
          let pts = 100;
          if (this.player.double > 0) pts *= 2;
          this.score += pts;
        } else {
          allCaptured = false;
        }
      }
    }

    if (capturedThisFrame > 0) {
      audio.playCapture();
      if (this.onScoreChange) this.onScoreChange(this.score);
      
      this.comboCount += capturedThisFrame;
      this.comboTimer = 0.5;
      
      if (this.comboCount > 1 && this.onMessage) {
        this.onMessage(`COMBO x${this.comboCount}!`);
        this.score += 50 * this.comboCount;
        if (this.onScoreChange) this.onScoreChange(this.score);
      }
    }

    if (allCaptured) {
      this.levelComplete();
    }
  }

  spawnParticles(x: number, y: number, color: string) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        color
      });
    }
  }

  levelComplete() {
    this.state = 'leveltransition';
    if (this.onStateChange) this.onStateChange(this.state);
    audio.playStart();
    setTimeout(() => {
      this.level++;
      this.loadLevel();
      this.state = 'playing';
      if (this.onStateChange) this.onStateChange(this.state);
    }, 2000);
  }

  gameOver() {
    this.state = 'gameover';
    audio.playExplosion();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  render() {
    const { ctx, width, height, gridSize, offsetX, offsetY } = this;
    
    // Clear
    ctx.clearRect(0, 0, width, height);

    if (this.state === 'title') return;

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Draw Cells
    for (const cell of this.cells) {
      if (cell.captured) {
        ctx.fillStyle = cell.color;
        ctx.fillRect(cell.cx * gridSize, cell.cy * gridSize, cell.w * gridSize, cell.h * gridSize);
      }
    }

    // Draw Edges
    ctx.lineWidth = 4;
    ctx.lineCap = 'square'; // C64 blocky style
    for (const edge of this.edges.values()) {
      ctx.strokeStyle = edge.traversed ? this.colors.player : this.colors.grid;
      ctx.beginPath();
      ctx.moveTo(edge.n1.x * gridSize, edge.n1.y * gridSize);
      ctx.lineTo(edge.n2.x * gridSize, edge.n2.y * gridSize);
      ctx.stroke();
    }

    // Draw Perks
    for (const perk of this.perks) {
      const color = this.colors[`perk${perk.type.charAt(0).toUpperCase() + perk.type.slice(1)}` as keyof typeof this.colors] || '#fff';
      ctx.fillStyle = color;
      
      // Stationary blocky perk
      ctx.fillRect(perk.x * gridSize - 6, perk.y * gridSize - 6, 12, 12); 
      
      // Hover animation for text only, smaller amplitude
      const floatY = Math.sin(Date.now() / 200 + perk.x * 10) * 2;
      
      // Floating text with outline for readability
      const text = this.perkNames[perk.type] || perk.type.toUpperCase();
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      
      // Outline
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(text, perk.x * gridSize, perk.y * gridSize - 12 + floatY);
      
      // Fill
      ctx.fillStyle = color;
      ctx.fillText(text, perk.x * gridSize, perk.y * gridSize - 12 + floatY);
    }

    // Draw Particles
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillRect(p.x * gridSize - 2, p.y * gridSize - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // Draw Enemies
    for (const enemy of this.enemies) {
      if (enemy.type === 'boss') {
        ctx.fillStyle = this.colors.boss;
        ctx.fillRect(enemy.x * gridSize - 15, enemy.y * gridSize - 15, 30, 30);
        // Boss eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(enemy.x * gridSize - 8, enemy.y * gridSize - 8, 4, 4);
        ctx.fillRect(enemy.x * gridSize + 4, enemy.y * gridSize - 8, 4, 4);
      } else {
        ctx.fillStyle = enemy.type === 'stalker' ? this.colors.enemyStalker : this.colors.enemySpark;
        if (enemy.state === 'frozen') ctx.fillStyle = '#aaa';
        
        // Blocky enemies
        ctx.fillRect(enemy.x * gridSize - 8, enemy.y * gridSize - 8, 16, 16);
      }
    }

    // Draw Player
    if (this.player.invincible <= 0 || Math.floor(Date.now() / 100) % 2 === 0) {
      ctx.fillStyle = this.colors.player;
      ctx.fillRect(this.player.x * gridSize - 8, this.player.y * gridSize - 8, 16, 16); // Blocky player
      
      if (this.player.shield) {
        ctx.strokeStyle = this.colors.perkShield;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.player.x * gridSize - 12, this.player.y * gridSize - 12, 24, 24);
      }
    }

    ctx.restore();
  }
}
