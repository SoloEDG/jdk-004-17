import type {
  GameDoc,
  Input,
  Trace,
  TrainingDirectives,
  WeaponId,
} from "../../../shared/types";
import { simulate } from "../../../app/simulate";

export const TRAINING_DT = 1 / 60;

export function createDirectives(): TrainingDirectives {
  return {
    enemy: {},
    weapons: {},
    ledger: {
      kills: 0,
      damage: 0,
      taken: 0,
      shots: 0,
      collected: 0,
      deaths: 0,
      steps: 0,
    },
  };
}

/** Deep-copy the live document so training can be rolled back completely. */
export function snapshotDoc(doc: GameDoc): GameDoc {
  return structuredClone(doc);
}

/**
 * Restore the pre-training snapshot in place. No pause-time compensation is
 * applied: time, bullets, cooldowns and stats return exactly to their values
 * at entry.
 */
export function restoreDoc(doc: GameDoc, snapshot: GameDoc): void {
  delete doc.training;
  Object.assign(doc, snapshot);
}

export function setEnemyDirective(
  doc: GameDoc,
  enemyId: number,
  patch: { angle?: number; frequency?: number },
): string | null {
  const training = doc.training;
  if (!training) return "训练模式未启用";
  const enemy = doc.enemies.find((e) => e.id === enemyId);
  if (!enemy) return "目标敌人已不在战场";
  if (enemy.kind === "chaser") return "追猎者不会射击，无法调整弹道";
  const directive: { angle?: number; interval?: number } = {};
  if (patch.angle !== undefined) {
    if (!Number.isFinite(patch.angle)) return "射击角度必须是有限数值";
    directive.angle = patch.angle;
  }
  if (patch.frequency !== undefined) {
    if (!Number.isFinite(patch.frequency) || patch.frequency <= 0)
      return "射击频率必须是大于 0 的有限数值";
    directive.interval = 1 / patch.frequency;
  }
  Object.assign((training.enemy[enemyId] ??= {}), directive);
  return null;
}

export function setWeaponDirective(
  doc: GameDoc,
  weaponId: WeaponId,
  patch: { speed?: number; interval?: number },
): string | null {
  const training = doc.training;
  if (!training) return "训练模式未启用";
  if (!doc.weapons.some((w) => w.id === weaponId)) return "该武器尚未装配";
  const directive: { speed?: number; interval?: number } = {};
  if (patch.speed !== undefined) {
    if (!Number.isFinite(patch.speed) || patch.speed <= 0)
      return "弹速必须是大于 0 的有限数值";
    directive.speed = patch.speed;
  }
  if (patch.interval !== undefined) {
    if (!Number.isFinite(patch.interval) || patch.interval <= 0)
      return "射击间隔必须是大于 0 的有限数值";
    directive.interval = patch.interval;
  }
  Object.assign((training.weapons[weaponId] ??= {}), directive);
  return null;
}

/**
 * Advance the real simulation by a single frame inside the training world.
 * The step flows through waves, arsenal, collision, drops, upgrades and
 * telemetry exactly as live play does; a level-up stops the stepper until
 * the player picks a choice.
 */
export function stepTraining(
  doc: GameDoc,
  input: Input,
  dt: number = TRAINING_DT,
): void {
  const training = doc.training;
  if (!training) return;
  if (doc.phase !== "paused") return; // "upgrade" waits for a choice
  if (doc.player.hp <= 0 || doc.victory) return;
  doc.phase = "playing";
  simulate(doc, input, dt);
  training.ledger.steps++;
  if (doc.player.hp <= 0) training.ledger.deaths = 1;
  if (doc.phase === "playing") doc.phase = "paused";
}

/** After an upgrade choice made during training, return to the frozen lab. */
export function resumeTraining(doc: GameDoc): void {
  if (doc.training && doc.phase === "playing") doc.phase = "paused";
}

/**
 * Preview the next step's paths by simulating a throwaway clone through the
 * same rules. The live document is never touched.
 */
export function previewStep(
  doc: GameDoc,
  input: Input,
  dt: number = TRAINING_DT,
): Trace[] {
  if (!doc.training || doc.phase !== "paused") return [];
  if (doc.player.hp <= 0 || doc.victory) return [];
  const clone = structuredClone(doc);
  clone.phase = "playing";
  simulate(clone, input, dt);
  const traces: Trace[] = [];
  const bulletsBefore = new Map(doc.bullets.map((b) => [b.id, b] as const));
  for (const b of clone.bullets) {
    const prev = bulletsBefore.get(b.id);
    traces.push({
      from: prev ? { x: prev.x, y: prev.y } : { x: b.x, y: b.y },
      to: { x: b.x, y: b.y },
      kind: b.owner === "enemy" ? "enemyBullet" : "playerBullet",
    });
  }
  const enemiesBefore = new Map(doc.enemies.map((e) => [e.id, e] as const));
  for (const e of clone.enemies) {
    const prev = enemiesBefore.get(e.id);
    traces.push({
      from: prev ? { x: prev.x, y: prev.y } : { x: e.x, y: e.y },
      to: { x: e.x, y: e.y },
      kind: "enemy",
    });
  }
  traces.push({
    from: { x: doc.player.x, y: doc.player.y },
    to: { x: clone.player.x, y: clone.player.y },
    kind: "player",
  });
  return traces;
}
