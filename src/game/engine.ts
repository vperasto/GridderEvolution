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
  rects: {x: number, y: number}[];
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
  type: 'spark' | 'stalker' | 'boss' | 'miniboss' | 'projectile' | 'web';
  bossType?: 'classic' | 'dasher' | 'splitter' | 'turret' | 'teleporter' | 'weaver';
  bossState?: 'moving' | 'charging' | 'dashing' | 'warning' | 'splitting' | 'split' | 'merging';
  dir: Dir;
  vx?: number;
  vy?: number;
  speed: number;
  state: 'moving' | 'frozen' | 'returning';
  freezeTimer: number;
  parent?: Enemy;
  targetX?: number;
  targetY?: number;
  timer?: number;
  life?: number;
  size?: number;
}

export interface Cut {
  x: number;
  y: number;
  timer: number;
}

export class GameEngine {
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;
  
  level = 1;
  score = 0;
  lives = 3;
  paused = false;
  state: 'title' | 'playing' | 'gameover' | 'leveltransition' | 'countdown' = 'title';
  timeLeft = 1000;
  countdown = 0;
  cutCooldown = 0;
  
  nodes: Point[] = [];
  edges: Map<string, Edge> = new Map();
  cells: Cell[] = [];
  cuts: Cut[] = [];
  
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
  onTimeChange?: (time: number) => void;
  onCooldownChange?: (cd: number) => void;
  onCountdownChange?: (cd: number) => void;
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
    
    // Spawn title bosses
    this.enemies = [];
    const types = ['classic', 'dasher', 'splitter', 'turret', 'teleporter', 'weaver'];
    for (let i = 0; i < 3; i++) {
      this.enemies.push({
        x: Math.random() * (this.width / this.gridSize),
        y: Math.random() * (this.height / this.gridSize),
        startX: 0, startY: 0,
        type: 'boss',
        bossType: types[Math.floor(Math.random() * types.length)] as any,
        bossState: 'moving',
        dir: 'idle',
        speed: 2 + Math.random() * 2,
        state: 'moving',
        freezeTimer: 0,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        size: 15 + Math.random() * 10
      });
    }
  }

  togglePause() {
    if (this.state !== 'playing') return;
    this.paused = !this.paused;
    if (this.paused) {
      audio.stopMusic();
    } else {
      audio.startMusic(this.levelType === 'boss');
    }
  }

  start(startLevel: number = 1) {
    this.state = 'playing';
    this.level = startLevel;
    this.score = 0;
    this.lives = 3;
    this.timeLeft = 1000;
    this.cutCooldown = 0;
    this.player.shield = false;
    if (this.onScoreChange) this.onScoreChange(this.score);
    if (this.onLivesChange) this.onLivesChange(this.lives);
    if (this.onTimeChange) this.onTimeChange(Math.ceil(this.timeLeft));
    if (this.onCooldownChange) this.onCooldownChange(Math.ceil(this.cutCooldown));
    this.loadLevel();
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
    this.cuts = [];
    this.timeLeft = 1000;
    this.cutCooldown = 0;
    if (this.onTimeChange) this.onTimeChange(Math.ceil(this.timeLeft));
    if (this.onCooldownChange) this.onCooldownChange(Math.ceil(this.cutCooldown));
    
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
    
    this.gridSize = Math.min((this.width - 40) / cols, (this.height - 120) / rows);
    this.offsetX = (this.width - cols * this.gridSize) / 2;
    this.offsetY = (this.height - rows * this.gridSize) / 2 + 40;

    // We will populate this.nodes later based on valid edges
    this.nodes = [];

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

    let bossShape = 'O';
    if (isBoss) {
      const shapes = ['O', 'S', 'E', 'U', 'H', 'C'];
      bossShape = shapes[Math.floor(Math.random() * shapes.length)];
    }

    // Create cells and edges
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Boss level: skip cells based on random shape
        if (isBoss) {
          let skip = false;
          if (bossShape === 'O') {
            skip = (x > 0 && x < cols - 1 && y > 0 && y < rows - 1);
          } else if (bossShape === 'S') {
            if (y > 0 && y < Math.floor(rows/2) && x > 0) skip = true;
            if (y > Math.floor(rows/2) && y < rows - 1 && x < cols - 1) skip = true;
          } else if (bossShape === 'E') {
            if (x > 0 && y > 0 && y < Math.floor(rows/2)) skip = true;
            if (x > 0 && y > Math.floor(rows/2) && y < rows - 1) skip = true;
          } else if (bossShape === 'U') {
            if (x > 0 && x < cols - 1 && y < rows - 1) skip = true;
          } else if (bossShape === 'H') {
            if (x > 0 && x < cols - 1 && y < Math.floor(rows/2)) skip = true;
            if (x > 0 && x < cols - 1 && y > Math.floor(rows/2)) skip = true;
          } else if (bossShape === 'C') {
            if (x > 0 && y > 0 && y < rows - 1) skip = true;
          }
          if (skip) continue;
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
          rects: [{x, y}]
        });
      }
    }

    // Populate nodes from valid edges so perks only spawn on reachable grid points
    const nodeSet = new Set<string>();
    for (const edge of this.edges.values()) {
      const id1 = `${edge.n1.x},${edge.n1.y}`;
      if (!nodeSet.has(id1)) {
        nodeSet.add(id1);
        this.nodes.push(edge.n1);
      }
      const id2 = `${edge.n2.x},${edge.n2.y}`;
      if (!nodeSet.has(id2)) {
        nodeSet.add(id2);
        this.nodes.push(edge.n2);
      }
    }

    // Add Boss cell if boss level
    if (isBoss) {
      let bossType = 'classic';
      if (this.level === 10) bossType = 'dasher';
      else if (this.level === 15) bossType = 'splitter';
      else if (this.level === 20) bossType = 'turret';
      else if (this.level === 25) bossType = 'teleporter';
      else if (this.level >= 30) {
        const types = ['weaver', 'dasher', 'splitter', 'turret', 'teleporter'];
        bossType = types[Math.floor(this.level / 5) % types.length];
      }

      let bossSize = 15;
      if (bossType === 'weaver') bossSize = 18;
      else if (bossType === 'dasher') bossSize = 12;
      else if (bossType === 'splitter') bossSize = 20;
      else if (bossType === 'turret') bossSize = 16;
      else if (bossType === 'teleporter') bossSize = 14;

      this.enemies.push({
        x: cols / 2, y: rows / 2, startX: cols / 2, startY: rows / 2, 
        type: 'boss', bossType: bossType as any, bossState: 'moving',
        dir: 'idle', speed: bossType === 'dasher' ? 1.5 : 1, state: 'moving', 
        freezeTimer: 0, timer: 0, size: bossSize
      });
    }

    // Player start
    this.player.x = 0;
    this.player.y = 0;

    // Add enemies
    const numEnemies = Math.min(1 + Math.floor(this.level / 2), 6); // Capped at 6
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
        speed: Math.min(1.2, 0.7 + (this.level * 0.03)), // Capped below player speed (1.4)
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
    
    if (this.state !== 'title') {
      audio.startMusic(this.levelType === 'boss');
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

  cutLine() {
    if (this.state !== 'playing' || this.paused) return;
    if (this.cutCooldown > 0) return;
    
    this.cuts.push({
      x: this.player.x,
      y: this.player.y,
      timer: 3
    });
    this.cutCooldown = 5;
    if (this.onCooldownChange) this.onCooldownChange(Math.ceil(this.cutCooldown));
    audio.playExplosion();
  }

  update(dt: number) {
    if (this.paused) return;
    if (this.state === 'title') {
      for (const enemy of this.enemies) {
        enemy.x += (enemy.vx || 0) * dt;
        enemy.y += (enemy.vy || 0) * dt;
        if (enemy.x < 0) { enemy.x = 0; enemy.vx = Math.abs(enemy.vx!); }
        if (enemy.x > this.width / this.gridSize) { enemy.x = this.width / this.gridSize; enemy.vx = -Math.abs(enemy.vx!); }
        if (enemy.y < 0) { enemy.y = 0; enemy.vy = Math.abs(enemy.vy!); }
        if (enemy.y > this.height / this.gridSize) { enemy.y = this.height / this.gridSize; enemy.vy = -Math.abs(enemy.vy!); }
      }
      return;
    }
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.onCountdownChange) this.onCountdownChange(Math.ceil(this.countdown));
      if (this.countdown <= 0) {
        this.state = 'playing';
        if (this.onStateChange) this.onStateChange(this.state);
      }
      return;
    }
    if (this.state !== 'playing') return;

    // Time limit
    // IMPORTANT: 100 units = 10 seconds (10 units per second).
    // Do not change this calculation! (100 = 10 sek)
    this.timeLeft -= dt * 10;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.playerDeath(true);
    }
    if (this.onTimeChange) this.onTimeChange(Math.ceil(this.timeLeft));

    // Cut Cooldown
    if (this.cutCooldown > 0) {
      this.cutCooldown -= dt;
      if (this.onCooldownChange) this.onCooldownChange(Math.ceil(this.cutCooldown));
    }

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

    // Update Cuts
    for (let i = this.cuts.length - 1; i >= 0; i--) {
      const cut = this.cuts[i];
      cut.timer -= dt;
      
      // Spawn electric sparks
      if (Math.random() < 0.4) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1.5 + 0.5;
        this.particles.push({
          x: cut.x,
          y: cut.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.1 + Math.random() * 0.2,
          maxLife: 0.3,
          color: Math.random() > 0.5 ? '#00FFFF' : '#FFFFFF'
        });
      }

      if (cut.timer <= 0) this.cuts.splice(i, 1);
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
        if (!enemy.timer) enemy.timer = 0;
        enemy.timer += dt;

        if (enemy.bossType === 'classic') {
          const dx = this.player.x - enemy.x;
          const dy = this.player.y - enemy.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 0) {
             enemy.x += (dx / dist) * enemy.speed * 0.5 * dt;
             enemy.y += (dy / dist) * enemy.speed * 0.5 * dt;
          }
          
          // Miniboss spawning logic (only on harder levels, e.g., level >= 10)
          if (this.level >= 10 && Math.random() < 0.01) {
            // Spawn miniboss rarely for classic boss on high levels
            const angle = Math.random() * Math.PI * 2;
            const spawnDist = 3 + Math.random() * 3;
            this.enemies.push({
              x: enemy.x, y: enemy.y, startX: enemy.x, startY: enemy.y,
              type: 'miniboss', dir: 'idle', speed: Math.min(1.2, enemy.speed * 1.5), state: 'moving',
              freezeTimer: 0, parent: enemy,
              targetX: enemy.x + Math.cos(angle) * spawnDist,
              targetY: enemy.y + Math.sin(angle) * spawnDist,
              timer: 2
            });
          }
        } 
        else if (enemy.bossType === 'dasher') {
          if (enemy.bossState === 'moving') {
            const dx = this.player.x - enemy.x;
            const dy = this.player.y - enemy.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0) {
               enemy.x += (dx / dist) * enemy.speed * 0.4 * dt;
               enemy.y += (dy / dist) * enemy.speed * 0.4 * dt;
            }
            if (enemy.timer > 3) {
              enemy.bossState = 'charging';
              enemy.timer = 0;
              enemy.targetX = this.player.x;
              enemy.targetY = this.player.y;
              audio.playBossWarning();
            }
          } else if (enemy.bossState === 'charging') {
            if (enemy.timer > 1) {
              enemy.bossState = 'dashing';
              enemy.timer = 0;
              audio.playBossAbility();
            }
          } else if (enemy.bossState === 'dashing') {
            const dx = enemy.targetX! - enemy.x;
            const dy = enemy.targetY! - enemy.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0.5) {
               enemy.x += (dx / dist) * enemy.speed * 5 * dt;
               enemy.y += (dy / dist) * enemy.speed * 5 * dt;
            } else {
              enemy.bossState = 'moving';
              enemy.timer = 0;
            }
          }
        }
        else if (enemy.bossType === 'splitter') {
          if (enemy.bossState === 'moving') {
            const dx = this.player.x - enemy.x;
            const dy = this.player.y - enemy.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0) {
               enemy.x += (dx / dist) * enemy.speed * 0.6 * dt;
               enemy.y += (dy / dist) * enemy.speed * 0.6 * dt;
            }
            if (enemy.timer > 6 && !enemy.parent) {
              enemy.bossState = 'splitting';
              enemy.timer = 0;
              audio.playBossWarning();
            }
          } else if (enemy.bossState === 'splitting') {
            // Shake effect in draw
            if (enemy.timer > 2) {
              enemy.bossState = 'split';
              enemy.timer = 0;
              enemy.size = 8; // shrink main body
              audio.playBossAbility();
              // Spawn 3 clones
              for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2;
                this.enemies.push({
                  ...enemy,
                  x: enemy.x + Math.cos(angle) * 2,
                  y: enemy.y + Math.sin(angle) * 2,
                  speed: enemy.speed * 1.1,
                  timer: 0,
                  bossState: 'split',
                  parent: enemy
                });
              }
            }
          } else if (enemy.bossState === 'split') {
            const dx = this.player.x - enemy.x;
            const dy = this.player.y - enemy.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0) {
               enemy.x += (dx / dist) * enemy.speed * 1.1 * dt; // Faster when split
               enemy.y += (dy / dist) * enemy.speed * 1.1 * dt;
            }
            if (enemy.timer > 8) {
              enemy.bossState = 'merging';
              enemy.timer = 0;
            }
          } else if (enemy.bossState === 'merging') {
            const target = enemy.parent;
            if (target && target.freezeTimer !== -1) {
              const dx = target.x - enemy.x;
              const dy = target.y - enemy.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              if (dist > 0.5) {
                 enemy.x += (dx / dist) * enemy.speed * 3 * dt; // Fast merge
                 enemy.y += (dy / dist) * enemy.speed * 3 * dt;
              } else {
                enemy.freezeTimer = -1; // remove clone
                target.size = Math.min(20, target.size! + 4); // grow parent back
              }
            } else {
              // I am the parent, wait for clones to merge
              if (enemy.timer > 3) {
                enemy.bossState = 'moving';
                enemy.timer = 0;
                enemy.size = 20; // restore full size
              }
            }
          }
        }
        else if (enemy.bossType === 'turret') {
          const centerX = this.width / this.gridSize / 2;
          const centerY = this.height / this.gridSize / 2;
          const dx = centerX - enemy.x;
          const dy = centerY - enemy.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 1) {
             enemy.x += (dx / dist) * enemy.speed * 0.2 * dt;
             enemy.y += (dy / dist) * enemy.speed * 0.2 * dt;
          }
          if (enemy.timer > 2.5) {
            enemy.timer = 0;
            audio.playBossAbility();
            for (let i = 0; i < 8; i++) {
              const angle = (i / 8) * Math.PI * 2;
              this.enemies.push({
                x: enemy.x, y: enemy.y, startX: enemy.x, startY: enemy.y,
                type: 'projectile', dir: 'idle', speed: 4, state: 'moving', freezeTimer: 0,
                vx: Math.cos(angle), vy: Math.sin(angle), size: 4
              });
            }
          }
        }
        else if (enemy.bossType === 'teleporter') {
          if (enemy.bossState === 'moving') {
            const dx = this.player.x - enemy.x;
            const dy = this.player.y - enemy.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0) {
               enemy.x += (dx / dist) * enemy.speed * 0.3 * dt;
               enemy.y += (dy / dist) * enemy.speed * 0.3 * dt;
            }
            if (enemy.timer > 5) {
              enemy.bossState = 'warning';
              enemy.timer = 0;
              enemy.targetX = this.player.x;
              enemy.targetY = this.player.y;
              audio.playBossWarning();
            }
          } else if (enemy.bossState === 'warning') {
            if (enemy.timer > 1.5) {
              enemy.x = enemy.targetX!;
              enemy.y = enemy.targetY!;
              enemy.bossState = 'moving';
              enemy.timer = 0;
              audio.playBossAbility();
            }
          }
        }
        else if (enemy.bossType === 'weaver') {
          const dx = this.player.x - enemy.x;
          const dy = this.player.y - enemy.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 0) {
             enemy.x += (dx / dist) * enemy.speed * 0.7 * dt;
             enemy.y += (dy / dist) * enemy.speed * 0.7 * dt;
          }
          if (enemy.timer > 0.8) {
            enemy.timer = 0;
            audio.playBossAbility();
            this.enemies.push({
              x: enemy.x, y: enemy.y, startX: enemy.x, startY: enemy.y,
              type: 'web', dir: 'idle', speed: 0, state: 'moving', freezeTimer: 0,
              life: 6, size: 8
            });
          }
        }
      } else if (enemy.type === 'projectile') {
        enemy.x += enemy.vx! * enemy.speed * dt;
        enemy.y += enemy.vy! * enemy.speed * dt;
        if (enemy.x < 0 || enemy.x > this.width/this.gridSize || enemy.y < 0 || enemy.y > this.height/this.gridSize) {
          enemy.freezeTimer = -1; // mark for removal
        }
      } else if (enemy.type === 'web') {
        enemy.life! -= dt;
        if (enemy.life! <= 0) enemy.freezeTimer = -1;
      } else if (enemy.type === 'miniboss') {
        if (enemy.state === 'moving') {
          // Move towards target
          const dx = enemy.targetX! - enemy.x;
          const dy = enemy.targetY! - enemy.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 0.1) {
            enemy.x += (dx / dist) * enemy.speed * dt;
            enemy.y += (dy / dist) * enemy.speed * dt;
          } else {
            enemy.timer! -= dt;
            if (enemy.timer! <= 0) {
              enemy.state = 'returning';
            }
          }
        } else if (enemy.state === 'returning') {
          // Move towards parent
          if (enemy.parent) {
            const dx = enemy.parent.x - enemy.x;
            const dy = enemy.parent.y - enemy.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0.5) {
              enemy.x += (dx / dist) * enemy.speed * dt;
              enemy.y += (dy / dist) * enemy.speed * dt;
            } else {
              // Merge back (remove from array)
              enemy.freezeTimer = -1; // mark for removal
            }
          } else {
            enemy.freezeTimer = -1;
          }
        }
      } else {
        this.moveEntity(enemy, enemy.speed * dt, false);
      }

      // Collision (pixel-based for fairer hitboxes)
      const playerRadius = 8;
      let enemyRadius = 8;
      if (enemy.type === 'boss') enemyRadius = enemy.size || 15;
      else if (enemy.type === 'miniboss') enemyRadius = 6;
      else if (enemy.type === 'projectile') enemyRadius = 4;
      else if (enemy.type === 'web') enemyRadius = 8;
      
      const hitDistPixels = playerRadius + enemyRadius - 2; // -2 for a tiny bit of leniency
      
      // Don't collide with teleporter while it's warning
      if (enemy.type === 'boss' && enemy.bossState === 'warning') continue;
      
      const dxPixels = Math.abs(this.player.x - enemy.x) * this.gridSize;
      const dyPixels = Math.abs(this.player.y - enemy.y) * this.gridSize;
      
      if (dxPixels < hitDistPixels && dyPixels < hitDistPixels) {
        if (this.player.invincible <= 0) {
          if (this.player.shield) {
            this.player.shield = false;
            this.player.invincible = 2;
            enemy.x = enemy.startX; // reset enemy
            enemy.y = enemy.startY;
            if (enemy.type === 'boss') {
              audio.playBossHit();
            } else {
              audio.playHit();
            }
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
    
    // Remove merged minibosses
    this.enemies = this.enemies.filter(e => e.freezeTimer !== -1);
  }

  playerDeath(isTimeOut: boolean = false) {
    this.spawnParticles(this.player.x, this.player.y, this.colors.player);
    this.lives--;
    if (this.onLivesChange) this.onLivesChange(this.lives);
    
    if (this.lives <= 0) {
      audio.playDeath();
      this.gameOver();
    } else {
      audio.playHit();
      if (isTimeOut) {
        this.loadLevel(); // Reset level
        this.state = 'countdown';
        this.countdown = 3;
        if (this.onStateChange) this.onStateChange(this.state);
        if (this.onCountdownChange) this.onCountdownChange(Math.ceil(this.countdown));
      } else {
        // Reset player position and give invincibility
        this.player.x = 0;
        this.player.y = 0;
        this.player.dir = 'idle';
        this.player.nextDir = 'idle';
        this.player.invincible = 3;
        this.timeLeft = 1000;
        if (this.onTimeChange) this.onTimeChange(Math.ceil(this.timeLeft));
      }
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

      let startX = ent.x;
      let startY = ent.y;
      
      if (ent.dir === 'up') ent.y -= step;
      if (ent.dir === 'down') ent.y += step;
      if (ent.dir === 'left') ent.x -= step;
      if (ent.dir === 'right') ent.x += step;
      
      moved += step;

      // Check cuts for all entities
      if (ent.type !== 'projectile' && ent.type !== 'web') {
        for (const cut of this.cuts) {
          let hit = false;
          const eps = 0.001;
          if (ent.dir === 'right' && startX <= cut.x + eps && ent.x >= cut.x - eps && Math.abs(ent.y - cut.y) < eps) hit = true;
          if (ent.dir === 'left' && startX >= cut.x - eps && ent.x <= cut.x + eps && Math.abs(ent.y - cut.y) < eps) hit = true;
          if (ent.dir === 'down' && startY <= cut.y + eps && ent.y >= cut.y - eps && Math.abs(ent.x - cut.x) < eps) hit = true;
          if (ent.dir === 'up' && startY >= cut.y - eps && ent.y <= cut.y + eps && Math.abs(ent.x - cut.x) < eps) hit = true;

          if (Math.abs(startX - cut.x) < eps && Math.abs(startY - cut.y) < eps) {
            hit = false; // Started exactly on it, allow moving away
          }

          if (hit) {
            if (isPlayer) {
              ent.x = cut.x;
              ent.y = cut.y;
              ent.dir = 'idle';
              ent.nextDir = 'idle';
            } else {
              if (ent.type === 'boss') {
                audio.playBossHit();
              }
              if (ent.dir === 'up') { ent.y = cut.y + 0.01; ent.dir = 'down'; }
              else if (ent.dir === 'down') { ent.y = cut.y - 0.01; ent.dir = 'up'; }
              else if (ent.dir === 'left') { ent.x = cut.x + 0.01; ent.dir = 'right'; }
              else if (ent.dir === 'right') { ent.x = cut.x - 0.01; ent.dir = 'left'; }
            }
            break;
          }
        }
      }

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

  mutateGrid(silent: boolean = false) {
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
        
        const sharedEdges = c1.edges.filter(e1 => c2.edges.some(e2 => e1.id === e2.id));
        for (const se of sharedEdges) {
          this.edges.delete(se.id);
        }
        
        this.cells = this.cells.filter(c => c.id !== c1.id && c.id !== c2.id);
        
        const newEdges = [...c1.edges, ...c2.edges].filter(e => !sharedEdges.some(se => se.id === e.id));
        const uniqueEdges = Array.from(new Set(newEdges));
        
        this.cells.push({
          id: `merged_${c1.id}_${c2.id}`,
          edges: uniqueEdges,
          captured: false,
          color: this.colors.captured,
          rects: [...c1.rects, ...c2.rects]
        });
        
        if (!silent) {
          const ex = (edge.n1.x + edge.n2.x) / 2;
          const ey = (edge.n1.y + edge.n2.y) / 2;
          this.spawnParticles(ex, ey, '#FFFFFF');
          audio.playExplosion();
          if (this.onMessage) this.onMessage(this.mutationMessage);
        }
        
        this.checkCells();
        break;
      }
    }
  }

  canMove(x: number, y: number, dir: Dir) {
    const isAtIntersectionX = Math.abs(x - Math.round(x)) < 0.001;
    const isAtIntersectionY = Math.abs(y - Math.round(y)) < 0.001;
    
    if (!isAtIntersectionX && (dir === 'up' || dir === 'down')) return false;
    if (!isAtIntersectionY && (dir === 'left' || dir === 'right')) return false;

    let nx = Math.round(x);
    let ny = Math.round(y);
    if (dir === 'up') ny -= 1;
    if (dir === 'down') ny += 1;
    if (dir === 'left') nx -= 1;
    if (dir === 'right') nx += 1;
    
    // Check if the target node has a cut
    for (const cut of this.cuts) {
      if (Math.abs(cut.x - nx) < 0.001 && Math.abs(cut.y - ny) < 0.001) {
        return false;
      }
    }

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

    const distToPlayer = Math.abs(ix - this.player.x) + Math.abs(iy - this.player.y);
    const chaseRadius = enemy.type === 'stalker' ? 12 : 7; // Stalkers see further

    if (distToPlayer < chaseRadius) {
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
      // 85% chance to follow best path, 15% random
      if (Math.random() < 0.85) {
        enemy.dir = bestDir;
        return;
      }
    }

    // Random fallback when far away or randomly ignoring
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
          
          // Spawn particles in the center of the first rect
          const centerRect = cell.rects[Math.floor(cell.rects.length / 2)];
          this.spawnParticles(centerRect.x + 0.5, centerRect.y + 0.5, cell.color);
          
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
    audio.playLevelComplete();
    setTimeout(() => {
      this.level++;
      this.loadLevel();
      this.state = 'playing';
      if (this.onStateChange) this.onStateChange(this.state);
    }, 2000);
  }

  gameOver() {
    this.state = 'gameover';
    if (this.onStateChange) this.onStateChange(this.state);
  }

  render() {
    const { ctx, width, height, gridSize, offsetX, offsetY } = this;
    
    // Clear
    ctx.clearRect(0, 0, width, height);

    if (this.state === 'title') {
      ctx.save();
      this.drawEnemies(ctx, gridSize);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Draw Cells
    for (const cell of this.cells) {
      if (cell.captured) {
        ctx.fillStyle = cell.color;
        for (const rect of cell.rects) {
          ctx.fillRect(rect.x * gridSize, rect.y * gridSize, gridSize, gridSize);
        }
      }
    }

    // Draw Edges
    ctx.lineWidth = 4;
    ctx.lineCap = 'square'; // C64 blocky style
    
    // Draw untraversed edges
    ctx.beginPath();
    for (const edge of this.edges.values()) {
      if (!edge.traversed) {
        ctx.moveTo(edge.n1.x * gridSize, edge.n1.y * gridSize);
        ctx.lineTo(edge.n2.x * gridSize, edge.n2.y * gridSize);
      }
    }
    ctx.strokeStyle = this.colors.grid;
    ctx.stroke();

    // Draw traversed edges
    ctx.beginPath();
    for (const edge of this.edges.values()) {
      if (edge.traversed) {
        ctx.moveTo(edge.n1.x * gridSize, edge.n1.y * gridSize);
        ctx.lineTo(edge.n2.x * gridSize, edge.n2.y * gridSize);
      }
    }
    ctx.strokeStyle = this.colors.player;
    ctx.stroke();

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

    // Draw Cuts
    for (const cut of this.cuts) {
      const cx = cut.x * gridSize;
      const cy = cut.y * gridSize;

      // Black background to hide the grid line
      ctx.fillStyle = '#000000';
      ctx.fillRect(cx - 8, cy - 8, 16, 16);
      
      // Electric crackle effect
      ctx.globalAlpha = Math.min(1, cut.timer);
      
      // Draw jagged lightning lines
      ctx.strokeStyle = Math.random() > 0.5 ? '#00FFFF' : '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + (Math.random() - 0.5) * 12, cy + (Math.random() - 0.5) * 12);
      for(let j = 0; j < 3; j++) {
         ctx.lineTo(cx + (Math.random() - 0.5) * 14, cy + (Math.random() - 0.5) * 14);
      }
      ctx.stroke();

      // Draw random glitch pixels
      ctx.fillStyle = '#00FFFF';
      for(let j = 0; j < 3; j++) {
         ctx.fillRect(cx + (Math.random() - 0.5) * 14, cy + (Math.random() - 0.5) * 14, 2, 2);
      }

      ctx.globalAlpha = 1;
    }

    this.drawEnemies(ctx, gridSize);

    // Draw Player
    if (this.player.invincible <= 0 || Math.floor(Date.now() / 100) % 2 === 0) {
      const px = this.player.x * gridSize;
      const py = this.player.y * gridSize;

      ctx.save();
      ctx.translate(px, py);

      // Draw Octagon base (Drone body)
      ctx.beginPath();
      const octSize = 8;
      const corner = octSize * 0.4;
      ctx.moveTo(-octSize, -corner);
      ctx.lineTo(-corner, -octSize);
      ctx.lineTo(corner, -octSize);
      ctx.lineTo(octSize, -corner);
      ctx.lineTo(octSize, corner);
      ctx.lineTo(corner, octSize);
      ctx.lineTo(-corner, octSize);
      ctx.lineTo(-octSize, corner);
      ctx.closePath();
      
      // Drone body styling (Dark with neon border)
      ctx.fillStyle = '#111111';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.colors.player;
      ctx.shadowColor = this.colors.player;
      ctx.shadowBlur = 5;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset shadow

      // Determine eye offset based on direction
      let eyeOffsetX = 0;
      let eyeOffsetY = 0;
      const offsetAmount = 3;
      if (this.player.dir === 'up') eyeOffsetY = -offsetAmount;
      else if (this.player.dir === 'down') eyeOffsetY = offsetAmount;
      else if (this.player.dir === 'left') eyeOffsetX = -offsetAmount;
      else if (this.player.dir === 'right') eyeOffsetX = offsetAmount;

      // Draw glowing eye (HAL 9000 / Portal core style)
      ctx.beginPath();
      ctx.arc(eyeOffsetX, eyeOffsetY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FF2244'; // Neon red/pink eye
      ctx.shadowColor = '#FF0022';
      ctx.shadowBlur = 8;
      ctx.fill();
      
      // Inner bright core
      ctx.beginPath();
      ctx.arc(eyeOffsetX, eyeOffsetY, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowBlur = 0;
      ctx.fill();

      ctx.restore();
      
      // Shield
      if (this.player.shield) {
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.strokeStyle = this.colors.perkShield;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = this.colors.perkShield + '33'; // 20% opacity fill
        ctx.fill();
      }
    }

    ctx.restore();
  }

  drawEnemies(ctx: CanvasRenderingContext2D, gridSize: number) {
    for (const enemy of this.enemies) {
      if (enemy.type === 'boss') {
        const size = enemy.size || 15;
        let drawX = enemy.x * gridSize;
        let drawY = enemy.y * gridSize;
        
        if (enemy.bossState === 'splitting') {
          drawX += (Math.random() - 0.5) * 6;
          drawY += (Math.random() - 0.5) * 6;
        }
        
        let bossColor = this.colors.boss;
        if (enemy.bossType === 'weaver') bossColor = '#8A2BE2'; // Purple
        else if (enemy.bossType === 'dasher') bossColor = '#FF4500'; // OrangeRed
        else if (enemy.bossType === 'splitter') bossColor = '#32CD32'; // LimeGreen
        else if (enemy.bossType === 'turret') bossColor = '#808080'; // Gray
        else if (enemy.bossType === 'teleporter') bossColor = '#00FFFF'; // Cyan

        if (enemy.bossState === 'warning') {
          // Draw warning reticle
          ctx.strokeStyle = '#FF0000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(enemy.targetX! * gridSize, enemy.targetY! * gridSize, size + Math.sin(Date.now()/50)*5, 0, Math.PI*2);
          ctx.stroke();
          ctx.globalAlpha = 0.3;
        } else if (enemy.bossState === 'charging') {
          ctx.fillStyle = Math.floor(Date.now() / 100) % 2 === 0 ? '#FFFFFF' : bossColor;
        } else {
          ctx.fillStyle = bossColor;
        }
        
        if (enemy.bossType === 'weaver') {
          // Spider-like (6 legs)
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 3;
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + Math.sin(Date.now() / 200 + i) * 0.5;
            ctx.beginPath();
            ctx.moveTo(drawX, drawY);
            ctx.lineTo(drawX + Math.cos(angle) * size * 1.5, drawY + Math.sin(angle) * size * 1.5);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(drawX, drawY, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillRect(drawX - size*0.4, drawY - size*0.4, size*0.2, size*0.2);
          ctx.fillRect(drawX + size*0.2, drawY - size*0.4, size*0.2, size*0.2);
        } else if (enemy.bossType === 'classic') {
          // Skull-like
          ctx.fillRect(drawX - size, drawY - size, size*2, size*1.5);
          ctx.fillRect(drawX - size*0.6, drawY + size*0.5, size*1.2, size*0.5); // Jaw
          ctx.fillStyle = '#000'; // Dark eyes for skull
          ctx.fillRect(drawX - size*0.5, drawY - size*0.2, size*0.4, size*0.4);
          ctx.fillRect(drawX + size*0.1, drawY - size*0.2, size*0.4, size*0.4);
          ctx.fillStyle = '#000'; // Teeth
          ctx.fillRect(drawX - size*0.4, drawY + size*0.5, size*0.1, size*0.5);
          ctx.fillRect(drawX, drawY + size*0.5, size*0.1, size*0.5);
          ctx.fillRect(drawX + size*0.3, drawY + size*0.5, size*0.1, size*0.5);
        } else if (enemy.bossType === 'dasher') {
          // Spiky
          ctx.beginPath();
          ctx.moveTo(drawX, drawY - size * 1.5);
          ctx.lineTo(drawX + size * 1.5, drawY);
          ctx.lineTo(drawX, drawY + size * 1.5);
          ctx.lineTo(drawX - size * 1.5, drawY);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillRect(drawX - size*0.2, drawY - size*0.2, size*0.4, size*0.4);
        } else if (enemy.bossType === 'splitter') {
          // Slime, wobbly
          const wobble = Math.sin(Date.now() / 150) * size * 0.2;
          ctx.beginPath();
          ctx.ellipse(drawX, drawY, size + wobble, size - wobble, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(drawX - size*0.3, drawY - size*0.2, size*0.2, 0, Math.PI*2);
          ctx.arc(drawX + size*0.3, drawY - size*0.2, size*0.2, 0, Math.PI*2);
          ctx.fill();
        } else if (enemy.bossType === 'turret') {
          // Mechanical
          ctx.fillRect(drawX - size, drawY - size, size*2, size*2);
          ctx.fillStyle = '#333';
          ctx.fillRect(drawX - size*0.8, drawY - size*0.8, size*1.6, size*1.6);
          ctx.fillStyle = '#f00'; // Center eye
          ctx.beginPath();
          ctx.arc(drawX, drawY, size*0.4, 0, Math.PI*2);
          ctx.fill();
        } else if (enemy.bossType === 'teleporter') {
          // Ethereal / Tentacles
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(drawX, drawY, size * 0.8, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 4;
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + Math.sin(Date.now() / 300 + i) * 0.3;
            ctx.beginPath();
            ctx.moveTo(drawX + Math.cos(angle) * size * 0.5, drawY + Math.sin(angle) * size * 0.5);
            // Draw wavy tentacle
            ctx.quadraticCurveTo(
              drawX + Math.cos(angle + 0.5) * size * 1.5, 
              drawY + Math.sin(angle + 0.5) * size * 1.5,
              drawX + Math.cos(angle) * size * 2, 
              drawY + Math.sin(angle) * size * 2
            );
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(drawX, drawY, size * 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Default
          ctx.fillRect(drawX - size, drawY - size, size*2, size*2);
          ctx.fillStyle = '#fff';
          const eyeOffset = size * 0.5;
          const eyeSize = Math.max(2, size * 0.25);
          ctx.fillRect(drawX - eyeOffset, drawY - eyeOffset, eyeSize, eyeSize);
          ctx.fillRect(drawX + eyeOffset - eyeSize, drawY - eyeOffset, eyeSize, eyeSize);
        }
        
        ctx.globalAlpha = 1;
      } else if (enemy.type === 'projectile') {
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.arc(enemy.x * gridSize, enemy.y * gridSize, enemy.size || 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemy.type === 'web') {
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, enemy.life! / 2)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(enemy.x * gridSize - 8, enemy.y * gridSize - 8);
        ctx.lineTo(enemy.x * gridSize + 8, enemy.y * gridSize + 8);
        ctx.moveTo(enemy.x * gridSize + 8, enemy.y * gridSize - 8);
        ctx.lineTo(enemy.x * gridSize - 8, enemy.y * gridSize + 8);
        ctx.stroke();
      } else if (enemy.type === 'miniboss') {
        ctx.fillStyle = '#FF5555'; // Reddish
        ctx.beginPath();
        ctx.arc(enemy.x * gridSize, enemy.y * gridSize, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = enemy.type === 'stalker' ? this.colors.enemyStalker : this.colors.enemySpark;
        if (enemy.state === 'frozen') ctx.fillStyle = '#aaa';
        
        // Blocky enemies
        ctx.fillRect(enemy.x * gridSize - 8, enemy.y * gridSize - 8, 16, 16);
      }
    }
  }
}
