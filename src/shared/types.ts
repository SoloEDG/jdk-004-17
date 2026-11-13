export type Vec = { x: number; y: number };
export type Phase = "ready" | "playing" | "paused" | "upgrade" | "ended";
export type WeaponId = "pulse" | "orbit" | "nova";
export interface Player extends Vec {
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  invincible: number;
}
export interface Enemy extends Vec {
  id: number;
  kind: "chaser" | "shooter" | "elite";
  hp: number;
  maxHp: number;
  radius: number;
  cooldown: number;
}
export interface Bullet extends Vec {
  id: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  owner: "player" | "enemy";
  weapon: WeaponId | "enemy";
  pierce: number;
  hit: number[];
}
export interface Drop extends Vec {
  id: number;
  kind: "xp" | "heal" | "magnet";
  value: number;
  life: number;
}
export interface Weapon {
  id: WeaponId;
  level: number;
  cooldown: number;
}
export interface Upgrade {
  id: string;
  name: string;
  description: string;
  category: string;
  max: number;
}
export interface RunStats {
  kills: number;
  damage: number;
  taken: number;
  collected: number;
  shots: number;
  byWeapon: Record<WeaponId, number>;
}
export interface RunRecord {
  id: string;
  duration: number;
  wave: number;
  level: number;
  kills: number;
  damage: number;
  weapons: string[];
  victory: boolean;
}
export interface GameDoc {
  version: 1;
  seed: number;
  initialSeed: number;
  nextId: number;
  phase: Phase;
  time: number;
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  drops: Drop[];
  weapons: Weapon[];
  upgrades: Record<string, number>;
  choices: string[];
  xp: number;
  level: number;
  pendingLevels: number;
  wave: number;
  waveTime: number;
  spawnBudget: number;
  stats: RunStats;
  records: RunRecord[];
  notice: string;
  victory: boolean;
  training?: TrainingDirectives;
}
export interface Input {
  x: number;
  y: number;
  aim: Vec;
  firing: boolean;
}
export interface TrainingEnemyDirective {
  /** Absolute firing angle (radians) for the enemy's next volley. */
  angle?: number;
  /** Cooldown (seconds) applied after the enemy's next volley. */
  interval?: number;
}
export interface TrainingWeaponDirective {
  /** Bullet speed override (px/s) while training is active. */
  speed?: number;
  /** Base firing interval override (seconds) while training is active. */
  interval?: number;
}
export interface TrainingLedger {
  kills: number;
  damage: number;
  taken: number;
  shots: number;
  collected: number;
  deaths: number;
  steps: number;
}
export interface TrainingDirectives {
  /** One-shot overrides consumed by the real enemy firing rules. */
  enemy: Record<number, TrainingEnemyDirective>;
  /** Temporary overrides applied by the real weapon rules. */
  weapons: Partial<Record<WeaponId, TrainingWeaponDirective>>;
  /** Training-only bookkeeping; never written into the official stats. */
  ledger: TrainingLedger;
}
export interface Trace {
  from: Vec;
  to: Vec;
  kind: "player" | "enemy" | "playerBullet" | "enemyBullet";
}
export interface KillEvent {
  enemy: Enemy;
  weapon: WeaponId;
}
export interface FrameEvents {
  weaponDamage?: Partial<Record<WeaponId, number>>;
  kills: KillEvent[];
  damage: number;
  taken: number;
  shots: number;
  collected: number;
}
export const WIDTH = 1000;
export const HEIGHT = 650;
