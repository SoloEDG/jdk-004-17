import { useState } from "react";
import { FlaskConical, StepForward, Undo2 } from "lucide-react";
import type { GameDoc, WeaponId } from "../../../shared/types";
import { distance } from "../../../shared/math";
import { WEAPON_CATALOG } from "../../arsenal";
import { ENEMY_CATALOG } from "../../waves";
import { setEnemyDirective, setWeaponDirective } from "../model/training";

const weaponNames: Record<WeaponId, string> = {
  pulse: "脉冲射线",
  orbit: "轨道刃",
  nova: "新星爆发",
};

function EnemyLab({
  doc,
  say,
}: {
  doc: GameDoc;
  say: (kind: "error" | "ok", text: string) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [angleText, setAngleText] = useState("");
  const [freqText, setFreqText] = useState("");
  const shooters = doc.enemies
    .filter((e) => e.kind !== "chaser")
    .sort((a, b) => distance(a, doc.player) - distance(b, doc.player))
    .slice(0, 6);
  const apply = () => {
    if (selected == null) {
      say("error", "请先选中一名会射击的敌人");
      return;
    }
    const patch: { angle?: number; frequency?: number } = {};
    if (angleText.trim() !== "") patch.angle = (Number(angleText) * Math.PI) / 180;
    if (freqText.trim() !== "") patch.frequency = Number(freqText);
    if (!Object.keys(patch).length) {
      say("error", "请输入要修改的角度或频率");
      return;
    }
    const error = setEnemyDirective(doc, selected, patch);
    if (error) say("error", error);
    else say("ok", "已写入该敌人的下一轮射击规则");
  };
  return (
    <div className="training-section">
      <h3>敌人弹道 · 下一轮射击</h3>
      {!shooters.length ? (
        <p className="training-empty">战场上暂时没有会射击的敌人。</p>
      ) : (
        <div className="training-enemies">
          {shooters.map((e) => {
            const pending = doc.training?.enemy[e.id];
            return (
              <button
                key={e.id}
                className={`enemy-option ${selected === e.id ? "selected" : ""}`}
                onClick={() => setSelected(e.id)}
              >
                <strong>
                  #{e.id} {ENEMY_CATALOG[e.kind].label}
                </strong>
                <small>
                  HP {Math.ceil(e.hp)} · 冷却 {e.cooldown.toFixed(2)}s
                  {pending &&
                    ` · 待生效${pending.angle !== undefined ? ` 角度${Math.round((pending.angle * 180) / Math.PI)}°` : ""}${pending.interval !== undefined ? ` 频率${(1 / pending.interval).toFixed(2)}/s` : ""}`}
                </small>
              </button>
            );
          })}
        </div>
      )}
      <div className="training-form">
        <label>
          角度°
          <input
            value={angleText}
            onChange={(e) => setAngleText(e.target.value)}
            placeholder="0=右 90=下"
            inputMode="decimal"
          />
        </label>
        <label>
          频率/秒
          <input
            value={freqText}
            onChange={(e) => setFreqText(e.target.value)}
            placeholder="如 0.5"
            inputMode="decimal"
          />
        </label>
        <button className="training-apply" onClick={apply}>
          应用
        </button>
      </div>
    </div>
  );
}

function WeaponRow({
  doc,
  id,
  say,
}: {
  doc: GameDoc;
  id: WeaponId;
  say: (kind: "error" | "ok", text: string) => void;
}) {
  const [speedText, setSpeedText] = useState("");
  const [intervalText, setIntervalText] = useState("");
  const active = doc.training?.weapons[id];
  const apply = () => {
    const patch: { speed?: number; interval?: number } = {};
    if (speedText.trim() !== "") patch.speed = Number(speedText);
    if (intervalText.trim() !== "") patch.interval = Number(intervalText);
    if (!Object.keys(patch).length) {
      say("error", "请输入要修改的弹速或间隔");
      return;
    }
    const error = setWeaponDirective(doc, id, patch);
    if (error) say("error", error);
    else say("ok", `${weaponNames[id]}的临时参数已生效`);
  };
  return (
    <div className="training-weapon">
      <div className="training-weapon-head">
        <strong>{weaponNames[id]}</strong>
        <small>
          标准间隔 {WEAPON_CATALOG[id].interval}s
          {active &&
            ` · 临时${active.speed !== undefined ? ` 弹速${active.speed}` : ""}${active.interval !== undefined ? ` 间隔${active.interval}s` : ""}`}
        </small>
      </div>
      <div className="training-form">
        <label>
          弹速
          <input
            value={speedText}
            onChange={(e) => setSpeedText(e.target.value)}
            placeholder="px/s"
            inputMode="decimal"
          />
        </label>
        <label>
          间隔s
          <input
            value={intervalText}
            onChange={(e) => setIntervalText(e.target.value)}
            placeholder="如 0.3"
            inputMode="decimal"
          />
        </label>
        <button className="training-apply" onClick={apply}>
          应用
        </button>
      </div>
    </div>
  );
}

export function TrainingPanel({
  doc,
  step,
  exit,
}: {
  doc: GameDoc;
  step: (frames: number) => void;
  exit: () => void;
}) {
  const [message, setMessage] = useState<{
    kind: "error" | "ok";
    text: string;
  } | null>(null);
  const say = (kind: "error" | "ok", text: string) =>
    setMessage({ kind, text });
  const ledger = doc.training?.ledger;
  const halted = doc.player.hp <= 0 || doc.victory;
  return (
    <div className="overlay">
      <div className="history-dialog training-dialog">
        <button className="close" onClick={exit}>
          退出 ✕
        </button>
        <div className="eyebrow">TRAINING LAB</div>
        <h2>
          <FlaskConical size={20} /> 弹幕训练模式
        </h2>
        <p>
          参数直接作用于真实敌人与武器规则，单步会经过碰撞、掉落、升级与遥测；虚线为下一步路径预览。退出后战场完整恢复到进入前。
        </p>
        {ledger && (
          <div className="training-ledger">
            <span>
              步数 <b>{ledger.steps}</b>
            </span>
            <span>
              击杀 <b>{ledger.kills}</b>
            </span>
            <span>
              死亡 <b>{ledger.deaths}</b>
            </span>
            <span>
              伤害 <b>{Math.round(ledger.damage)}</b>
            </span>
            <span>
              承伤 <b>{Math.round(ledger.taken)}</b>
            </span>
            <span>
              射弹 <b>{ledger.shots}</b>
            </span>
            <small>仅训练记账 · 不写入正式战绩</small>
          </div>
        )}
        {halted && (
          <p className="training-error">
            {doc.victory ? "波次已全部清除，训练结束。" : "机体已阵亡，步进停止。"}
            退出后将恢复进入前的战场。
          </p>
        )}
        <div className="training-grid">
          <EnemyLab doc={doc} say={say} />
          <div className="training-section">
            <h3>武器参数 · 临时调节</h3>
            {doc.weapons.map((w) => (
              <WeaponRow key={w.id} doc={doc} id={w.id} say={say} />
            ))}
          </div>
        </div>
        {message && (
          <p
            className={
              message.kind === "error" ? "training-error" : "training-ok"
            }
          >
            {message.text}
          </p>
        )}
        <div className="training-actions">
          <button
            className="primary"
            disabled={halted}
            onClick={() => step(1)}
          >
            <StepForward size={15} /> 单步 ( . )
          </button>
          <button className="training-apply" disabled={halted} onClick={() => step(10)}>
            步进 ×10
          </button>
          <button className="training-exit" onClick={exit}>
            <Undo2 size={14} /> 退出并恢复战场
          </button>
        </div>
      </div>
    </div>
  );
}
