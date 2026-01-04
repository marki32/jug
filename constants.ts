import { ShipType, ShipStats } from './types';

export const GAME_CONSTANTS = {
  FPS: 60,
  FRICTION: 0.98,
  ASTEROID_COUNT: 8,
  ASTEROID_SPAWN_RATE: 2000,
  MAX_PARTICLES: 100,
  BOOST_CONSUMPTION: 1,
  BOOST_REGEN: 0.2,
  BOOST_MULTIPLIER: 1.8,
  BULLET_SPEED: 12,
  BULLET_LIFETIME: 60, // frames
  SCREEN_PADDING: 50,
};

export const SHIP_STATS: Record<ShipType, ShipStats> = {
  [ShipType.INTERCEPTOR]: {
    name: "Interceptor",
    maxSpeed: 7,
    acceleration: 0.25,
    turnSpeed: 0.12,
    fireRate: 150,
    damage: 10,
    maxHp: 60,
    color: '#3b82f6', // blue-500
  },
  [ShipType.FIGHTER]: {
    name: "Fighter",
    maxSpeed: 5,
    acceleration: 0.18,
    turnSpeed: 0.09,
    fireRate: 250,
    damage: 20,
    maxHp: 100,
    color: '#22c55e', // green-500
  },
  [ShipType.BOMBER]: {
    name: "Bomber",
    maxSpeed: 3.5,
    acceleration: 0.12,
    turnSpeed: 0.06,
    fireRate: 450,
    damage: 45,
    maxHp: 160,
    color: '#ef4444', // red-500
  },
};
