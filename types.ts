export enum ScreenState {
  LOBBY = 'LOBBY',
  GAME = 'GAME',
  GAME_OVER = 'GAME_OVER',
}

export enum ShipType {
  INTERCEPTOR = 'INTERCEPTOR',
  FIGHTER = 'FIGHTER',
  BOMBER = 'BOMBER',
}

export enum GameMode {
  LOCAL_PVP = 'LOCAL_PVP', // Split Keyboard
  ONLINE_HOST = 'ONLINE_HOST', // Host P2P
  ONLINE_CLIENT = 'ONLINE_CLIENT', // Join P2P
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector2;
  vel: Vector2;
  radius: number;
  angle: number; // in radians
  destroyed: boolean;
  type: 'PLAYER' | 'ASTEROID' | 'BULLET' | 'PARTICLE';
}

export interface ShipStats {
  maxSpeed: number;
  acceleration: number;
  turnSpeed: number;
  fireRate: number; // ms between shots
  damage: number;
  maxHp: number;
  color: string;
  name: string;
}

export interface ControlState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
  boost: boolean;
}

export interface Player extends Entity {
  type: 'PLAYER';
  shipType: ShipType;
  stats: ShipStats;
  hp: number;
  boostEnergy: number;
  lastFired: number;
  score: number;
  controls: ControlState;
}

export interface Bullet extends Entity {
  type: 'BULLET';
  ownerId: string;
  timeLeft: number;
  damage: number;
}

export interface Asteroid extends Entity {
  type: 'ASTEROID';
  rotSpeed: number;
}

export interface Particle extends Entity {
  type: 'PARTICLE';
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameState {
  players: Player[];
  asteroids: Asteroid[];
  bullets: Bullet[];
  particles: Particle[];
  winnerId: string | null;
  bounds: { width: number; height: number };
}

// Network Message Types
export type NetworkMessage = 
  | { type: 'INPUT'; controls: ControlState }
  | { type: 'STATE'; state: GameState }
  | { type: 'HANDSHAKE'; shipType: ShipType }
  | { type: 'GAME_OVER'; winnerId: string };
