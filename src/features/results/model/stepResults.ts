import type { GameDoc, FrameEvents } from "../../../shared/types";
import { applyEvents, makeRecord } from "./ledger";
import { saveRecords } from "../lib/storage";
export function stepResults(doc: GameDoc, events: FrameEvents): void {
  if (doc.phase === "ended") return;
  if (doc.training) {
    // Training telemetry is booked only in the training panel: official
    // stats, run records and persistence stay untouched.
    const ledger = doc.training.ledger;
    ledger.kills += events.kills.length;
    ledger.damage += events.damage;
    ledger.taken += events.taken;
    ledger.shots += events.shots;
    ledger.collected += events.collected;
    return;
  }
  applyEvents(doc, events);
  if (doc.player.hp > 0 && !doc.victory) return;
  // End the run before persistence, making repeated animation frames idempotent.
  doc.phase = "ended";
  doc.choices = [];
  doc.notice = doc.victory ? "撤离成功 · 信号保全" : "信号中断 · 再次连接";
  doc.records = [makeRecord(doc), ...doc.records].slice(0, 20);
  saveRecords(doc.records);
}
