import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun } from "../src/shared/createRun";
import { simulate } from "../src/app/simulate";
import { chooseUpgrade } from "../src/features/progression";
import {
  TRAINING_DT,
  createDirectives,
  snapshotDoc,
  restoreDoc,
  setEnemyDirective,
  setWeaponDirective,
  stepTraining,
  resumeTraining,
  previewStep,
} from "../src/features/training";
import type { GameDoc } from "../src/shared/types";

const input = { x: 0, y: 0, aim: { x: 700, y: 325 }, firing: false };

function trainingDoc(): { doc: GameDoc; snapshot: GameDoc } {
  const doc = createRun();
  doc.phase = "playing";
  simulate(doc, input, TRAINING_DT); // connect wave 1
  doc.phase = "paused";
  const snapshot = snapshotDoc(doc);
  doc.training = createDirectives();
  return { doc, snapshot };
}

const shooter = (id = 42) => ({
  id,
  kind: "shooter" as const,
  x: 650,
  y: 325,
  hp: 30,
  maxHp: 30,
  radius: 14,
  cooldown: 0,
});

test("exit restores bullets, cooldowns, stats and clock without pause compensation", () => {
  const { doc, snapshot } = trainingDoc();
  doc.enemies = [shooter()];
  for (let i = 0; i < 30; i++) stepTraining(doc, input, TRAINING_DT);
  assert.ok(doc.training!.ledger.steps > 0);
  assert.notEqual(JSON.stringify(doc.bullets), JSON.stringify(snapshot.bullets));
  restoreDoc(doc, snapshot);
  assert.equal(doc.training, undefined);
  assert.equal(JSON.stringify(doc), JSON.stringify(snapshot));
  assert.equal(doc.time, snapshot.time);
  assert.deepEqual(doc.weapons, snapshot.weapons);
  assert.deepEqual(doc.stats, snapshot.stats);
});

test("enemy directive drives the real firing rules for one volley only", () => {
  const { doc } = trainingDoc();
  doc.enemies = [shooter()];
  assert.equal(
    setEnemyDirective(doc, 42, { angle: 0, frequency: 2 }),
    null,
  );
  stepTraining(doc, input, TRAINING_DT);
  const shot = doc.bullets.find((b) => b.owner === "enemy");
  assert.ok(shot, "the real wave rules fired the overridden volley");
  assert.ok(shot!.vx > 0 && Math.abs(shot!.vy) < 1e-9, "angle override applied");
  assert.ok(
    Math.abs(doc.enemies[0].cooldown - 0.5) < 1e-9,
    "frequency 2/s becomes a 0.5s cooldown",
  );
  assert.deepEqual(doc.training!.enemy, {}, "directive consumed after one volley");
});

test("zero or non-finite frequency and infinite speed are rejected", () => {
  const { doc } = trainingDoc();
  doc.enemies = [shooter()];
  assert.match(setEnemyDirective(doc, 42, { frequency: 0 })!, /频率/);
  assert.match(setEnemyDirective(doc, 42, { frequency: Infinity })!, /频率/);
  assert.match(setEnemyDirective(doc, 42, { angle: NaN })!, /角度/);
  assert.deepEqual(doc.training!.enemy, {}, "rejected edits leave no directive");
  assert.match(setWeaponDirective(doc, "pulse", { speed: Infinity })!, /弹速/);
  assert.match(setWeaponDirective(doc, "pulse", { speed: 0 })!, /弹速/);
  assert.match(setWeaponDirective(doc, "pulse", { interval: 0 })!, /间隔/);
  assert.match(setWeaponDirective(doc, "orbit", { speed: 300 })!, /装配/);
  assert.deepEqual(doc.training!.weapons, {});
  assert.equal(setWeaponDirective(doc, "pulse", { speed: 900, interval: 0.2 }), null);
});

test("weapon overrides flow through the real arsenal rules", () => {
  const { doc } = trainingDoc();
  doc.bullets = []; // clear the volley fired while connecting wave 1
  doc.weapons[0].cooldown = 0;
  setWeaponDirective(doc, "pulse", { speed: 900, interval: 0.2 });
  const officialShots = doc.stats.shots;
  stepTraining(doc, input, TRAINING_DT);
  const shot = doc.bullets.find((b) => b.owner === "player");
  assert.ok(shot, "real arsenal fired with the override");
  assert.ok(Math.abs(Math.hypot(shot!.vx, shot!.vy) - 900) < 1e-6);
  assert.ok(Math.abs(doc.weapons[0].cooldown - 0.2) < 1e-9);
  assert.ok(doc.training!.ledger.shots > 0, "shots booked in training ledger");
  assert.equal(doc.stats.shots, officialShots, "official shot counter untouched");
});

test("training kills and damage never touch official stats or records", () => {
  const { doc } = trainingDoc();
  doc.enemies = [{ ...shooter(), hp: 10, maxHp: 10 }];
  doc.bullets = [
    {
      id: 900,
      x: 650,
      y: 325,
      vx: 0,
      vy: 0,
      radius: 5,
      damage: 20,
      life: 1,
      owner: "player",
      weapon: "pulse",
      pierce: 0,
      hit: [],
    },
  ];
  stepTraining(doc, input, TRAINING_DT);
  assert.equal(doc.training!.ledger.kills, 1);
  assert.ok(doc.training!.ledger.damage >= 10);
  assert.equal(doc.stats.kills, 0);
  assert.equal(doc.stats.damage, 0);
  assert.equal(doc.records.length, 0);
});

test("death in training is booked only in the ledger and halts stepping", () => {
  const { doc } = trainingDoc();
  doc.player.hp = 5;
  doc.player.invincible = 0;
  doc.enemies = [{ ...shooter(), kind: "chaser", x: 500, y: 325 }];
  stepTraining(doc, input, TRAINING_DT);
  assert.equal(doc.player.hp, 0);
  assert.equal(doc.training!.ledger.deaths, 1);
  assert.equal(doc.phase, "paused", "run does not end inside training");
  assert.equal(doc.records.length, 0);
  const before = JSON.stringify(doc);
  stepTraining(doc, input, TRAINING_DT);
  assert.equal(JSON.stringify(doc), before, "further steps are refused");
});

test("a level-up stops the stepper and waits for a choice", () => {
  const { doc } = trainingDoc();
  doc.pendingLevels = 1;
  stepTraining(doc, input, TRAINING_DT);
  assert.equal(doc.phase, "upgrade");
  const before = JSON.stringify(doc);
  stepTraining(doc, input, TRAINING_DT);
  assert.equal(JSON.stringify(doc), before, "stepping waits while choosing");
  chooseUpgrade(doc, doc.choices[0]);
  resumeTraining(doc);
  assert.equal(doc.phase, "paused");
  assert.ok(doc.training, "still inside the training world");
});

test("preview shows next-step paths without mutating the world", () => {
  const { doc } = trainingDoc();
  doc.enemies = [shooter()];
  doc.weapons[0].cooldown = 0;
  const before = JSON.stringify(doc);
  const traces = previewStep(doc, input, TRAINING_DT);
  assert.equal(JSON.stringify(doc), before, "preview is side-effect free");
  assert.ok(traces.some((t) => t.kind === "player"));
  assert.ok(traces.some((t) => t.kind === "enemy"));
  assert.ok(
    traces.some(
      (t) =>
        t.kind === "playerBullet" &&
        (t.from.x !== t.to.x || t.from.y !== t.to.y),
    ),
    "weapon fire appears in the preview",
  );
});
