import { 
  GameState, Player, Bullet, Asteroid, Particle, 
  Vector2, ShipType, GameMode, ControlState 
} from '../types';
import { GAME_CONSTANTS, SHIP_STATS } from '../constants';

// Helper for random range
const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export class GameEngine {
  state: GameState;
  onGameOver: (winnerId: string) => void;

  constructor(width: number, height: number, mode: GameMode, p1Ship: ShipType, p2Ship: ShipType, onGameOver: (winner: string) => void) {
    this.onGameOver = onGameOver;
    this.state = {
      players: [],
      asteroids: [],
      bullets: [],
      particles: [],
      winnerId: null,
      bounds: { width, height },
    };

    this.initGame(mode, p1Ship, p2Ship);
  }

  initGame(mode: GameMode, p1Ship: ShipType, p2Ship: ShipType) {
    // Player 1 (Blue) - Host or Local
    this.addPlayer('p1', p1Ship, { x: this.state.bounds.width * 0.2, y: this.state.bounds.height / 2 }, false);

    // Player 2 (Red) - Local or Remote
    // Always add P2 for PvP modes
    this.addPlayer('p2', p2Ship, { x: this.state.bounds.width * 0.8, y: this.state.bounds.height / 2 }, true);

    // Spawn Initial Asteroids
    for (let i = 0; i < GAME_CONSTANTS.ASTEROID_COUNT; i++) {
      this.spawnAsteroid();
    }
  }

  addPlayer(id: string, type: ShipType, pos: Vector2, isEnemyColor: boolean) {
    const stats = SHIP_STATS[type];
    const player: Player = {
      id,
      type: 'PLAYER',
      shipType: type,
      stats: { ...stats, color: isEnemyColor ? '#f43f5e' : stats.color }, // Red for enemy, Blue/Green/Red standard for self
      pos,
      vel: { x: 0, y: 0 },
      radius: 18,
      angle: isEnemyColor ? Math.PI : 0, 
      destroyed: false,
      hp: stats.maxHp,
      boostEnergy: 100,
      lastFired: 0,
      score: 0,
      controls: { up: false, down: false, left: false, right: false, shoot: false, boost: false }
    };
    this.state.players.push(player);
  }

  spawnAsteroid() {
    const { width, height } = this.state.bounds;
    const isHorizontal = Math.random() > 0.5;
    const x = isHorizontal ? rand(0, width) : (Math.random() > 0.5 ? 0 : width);
    const y = isHorizontal ? (Math.random() > 0.5 ? 0 : height) : rand(0, height);
    
    if (Math.abs(x - width/2) < 200 && Math.abs(y - height/2) < 200) return;

    this.state.asteroids.push({
      id: `ast_${Date.now()}_${Math.random()}`,
      type: 'ASTEROID',
      pos: { x, y },
      vel: { x: rand(-2, 2), y: rand(-2, 2) },
      radius: rand(15, 40),
      angle: rand(0, Math.PI * 2),
      rotSpeed: rand(-0.05, 0.05),
      destroyed: false,
    });
  }

  // Force override state (for Client mode)
  setState(newState: GameState) {
    this.state = newState;
  }

  // Set controls for a specific player directly (used for remote inputs)
  setPlayerControls(playerId: string, controls: ControlState) {
    const p = this.state.players.find(player => player.id === playerId);
    if (p) {
      p.controls = controls;
    }
  }

  // Handle local keyboard inputs -> Map to Player Controls
  handleInput(keys: Set<string>, mode: GameMode) {
    if (mode === GameMode.ONLINE_CLIENT) return; // Client doesn't control game logic state directly

    const p1 = this.state.players.find(p => p.id === 'p1');
    if (p1 && !p1.destroyed) {
      p1.controls.up = keys.has('w');
      p1.controls.left = keys.has('a');
      p1.controls.down = keys.has('s');
      p1.controls.right = keys.has('d');
      p1.controls.boost = keys.has('shift');
      p1.controls.shoot = keys.has(' ');
    }

    if (mode === GameMode.LOCAL_PVP) {
      const p2 = this.state.players.find(p => p.id === 'p2');
      if (p2 && !p2.destroyed) {
        p2.controls.up = keys.has('arrowup');
        p2.controls.left = keys.has('arrowleft');
        p2.controls.down = keys.has('arrowdown');
        p2.controls.right = keys.has('arrowright');
        p2.controls.boost = keys.has(',') || keys.has('/');
        p2.controls.shoot = keys.has('m') || keys.has('.');
      }
    }
    // ONLINE_HOST: P2 controls are set via setPlayerControls from network messages
  }

  update() {
    if (this.state.winnerId) return;

    // Check Win Condition
    const alivePlayers = this.state.players.filter(p => !p.destroyed);
    if (alivePlayers.length === 1 && this.state.players.length > 1) {
      this.state.winnerId = alivePlayers[0].id;
      this.onGameOver(alivePlayers[0].id);
    } else if (alivePlayers.length === 0 && this.state.players.length > 0) {
      this.state.winnerId = 'DRAW';
      this.onGameOver('DRAW');
    }

    // Update Players
    this.state.players.forEach(p => {
      if (p.destroyed) return;

      if (p.controls.left) p.angle -= p.stats.turnSpeed;
      if (p.controls.right) p.angle += p.stats.turnSpeed;

      const isBoosting = p.controls.boost && p.boostEnergy > 0;
      if (isBoosting) p.boostEnergy -= GAME_CONSTANTS.BOOST_CONSUMPTION;
      else if (p.boostEnergy < 100) p.boostEnergy += GAME_CONSTANTS.BOOST_REGEN;

      if (p.controls.up) {
        const speed = isBoosting ? p.stats.acceleration * GAME_CONSTANTS.BOOST_MULTIPLIER : p.stats.acceleration;
        p.vel.x += Math.cos(p.angle) * speed;
        p.vel.y += Math.sin(p.angle) * speed;
        
        if (Math.random() > 0.5) {
          const offset = isBoosting ? 25 : 15;
          this.spawnParticle(
            p.pos.x - Math.cos(p.angle) * offset,
            p.pos.y - Math.sin(p.angle) * offset,
            isBoosting ? '#38bdf8' : '#fb923c',
            isBoosting ? 1.5 : 0.8
          );
        }
      }

      p.vel.x *= GAME_CONSTANTS.FRICTION;
      p.vel.y *= GAME_CONSTANTS.FRICTION;

      const currentSpeed = Math.sqrt(p.vel.x ** 2 + p.vel.y ** 2);
      const maxS = isBoosting ? p.stats.maxSpeed * 1.5 : p.stats.maxSpeed;
      if (currentSpeed > maxS) {
        const ratio = maxS / currentSpeed;
        p.vel.x *= ratio;
        p.vel.y *= ratio;
      }

      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;

      if (p.pos.x < 0 || p.pos.x > this.state.bounds.width) {
        p.vel.x *= -1;
        p.pos.x = Math.max(0, Math.min(p.pos.x, this.state.bounds.width));
      }
      if (p.pos.y < 0 || p.pos.y > this.state.bounds.height) {
        p.vel.y *= -1;
        p.pos.y = Math.max(0, Math.min(p.pos.y, this.state.bounds.height));
      }

      const now = Date.now();
      if (p.controls.shoot && now - p.lastFired > p.stats.fireRate) {
        p.lastFired = now;
        this.spawnBullet(p);
      }
    });

    // Update Bullets
    this.state.bullets.forEach(b => {
      b.pos.x += b.vel.x;
      b.pos.y += b.vel.y;
      b.timeLeft--;
    });
    this.state.bullets = this.state.bullets.filter(b => b.timeLeft > 0);

    // Update Asteroids
    this.state.asteroids.forEach(a => {
      a.pos.x += a.vel.x;
      a.pos.y += a.vel.y;
      a.angle += a.rotSpeed;

      if (a.pos.x < -50) a.pos.x = this.state.bounds.width + 50;
      if (a.pos.x > this.state.bounds.width + 50) a.pos.x = -50;
      if (a.pos.y < -50) a.pos.y = this.state.bounds.height + 50;
      if (a.pos.y > this.state.bounds.height + 50) a.pos.y = -50;
    });

    // Update Particles
    this.state.particles.forEach(p => {
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      p.life--;
    });
    this.state.particles = this.state.particles.filter(p => p.life > 0);

    this.checkCollisions();
  }

  spawnBullet(owner: Player) {
    const velX = Math.cos(owner.angle) * GAME_CONSTANTS.BULLET_SPEED;
    const velY = Math.sin(owner.angle) * GAME_CONSTANTS.BULLET_SPEED;
    const combinedVelX = velX + owner.vel.x * 0.2;
    const combinedVelY = velY + owner.vel.y * 0.2;

    this.state.bullets.push({
      id: `b_${Date.now()}_${Math.random()}`,
      type: 'BULLET',
      ownerId: owner.id,
      pos: { x: owner.pos.x + Math.cos(owner.angle) * 20, y: owner.pos.y + Math.sin(owner.angle) * 20 },
      vel: { x: combinedVelX, y: combinedVelY },
      radius: 3,
      angle: owner.angle,
      destroyed: false,
      timeLeft: GAME_CONSTANTS.BULLET_LIFETIME,
      damage: owner.stats.damage
    });
  }

  spawnParticle(x: number, y: number, color: string, speedMod: number = 1) {
    if (this.state.particles.length > GAME_CONSTANTS.MAX_PARTICLES) return;
    this.state.particles.push({
      id: `p_${Math.random()}`,
      type: 'PARTICLE',
      pos: { x, y },
      vel: { x: (Math.random() - 0.5) * 3 * speedMod, y: (Math.random() - 0.5) * 3 * speedMod },
      radius: Math.random() * 2 + 1,
      angle: 0,
      destroyed: false,
      life: rand(20, 40),
      maxLife: 40,
      color,
      size: rand(1, 3)
    });
  }

  explode(pos: Vector2, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      this.spawnParticle(pos.x, pos.y, color, 3);
    }
  }

  checkCollisions() {
    this.state.bullets.forEach(b => {
      this.state.asteroids.forEach(a => {
        if (a.destroyed || b.destroyed) return;
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        if (Math.sqrt(dx*dx + dy*dy) < a.radius + b.radius) {
          b.destroyed = true;
          this.explode(b.pos, '#94a3b8', 3);
          a.vel.x += b.vel.x * 0.05;
          a.vel.y += b.vel.y * 0.05;
        }
      });

      this.state.players.forEach(p => {
        if (p.destroyed || b.destroyed || b.ownerId === p.id) return;
        const dx = b.pos.x - p.pos.x;
        const dy = b.pos.y - p.pos.y;
        if (Math.sqrt(dx*dx + dy*dy) < p.radius + b.radius) {
          b.destroyed = true;
          p.hp -= b.damage;
          this.explode(b.pos, p.stats.color, 5);
          if (p.hp <= 0) {
            p.destroyed = true;
            this.explode(p.pos, p.stats.color, 30);
          }
        }
      });
    });

    this.state.players.forEach(p => {
      if (p.destroyed) return;
      this.state.asteroids.forEach(a => {
        const dx = p.pos.x - a.pos.x;
        const dy = p.pos.y - a.pos.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const minDist = p.radius + a.radius;
        
        if (dist < minDist) {
          const angle = Math.atan2(dy, dx);
          const force = 4;
          p.vel.x += Math.cos(angle) * force;
          p.vel.y += Math.sin(angle) * force;
          a.vel.x -= Math.cos(angle) * force;
          a.vel.y -= Math.sin(angle) * force;
          
          p.hp -= 15;
          this.explode(p.pos, '#fbbf24', 5);
          
          if (p.hp <= 0) {
            p.destroyed = true;
            this.explode(p.pos, p.stats.color, 30);
          }
        }
      });
    });
    
    this.state.bullets = this.state.bullets.filter(b => !b.destroyed);
  }
}
