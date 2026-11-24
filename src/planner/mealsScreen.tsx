/**
 * Meals tab: today's eggetarian meals by weekday, "ate this" / "ate
 * something else" (+5 XP Glow each), and your meal plan as an editable table.
 */
import React, { useEffect, useState } from "react";
import type { Planner } from "./usePlanner";
import { Link } from "./router";
import { dayOfWeek } from "./logic";
import { MEAL_RULES, MEAL_SLOTS, MEAL_XP, MealAte, MealSlot, mealsFor, nextMeal, SLOT_LABEL, WEEKDAY_NAMES } from "./meals";
import { sfx } from "./sound";

interface Props {
  p: Planner;
  today: string;
  minutes: number;
  toast: (msg: string) => void;
}

function Missing() {
  return (
    <div className="card">
      <div className="muted">Meals appear once the Phase 3b migration has run.</div>
    </div>
  );
}

/** Home: the next meal to log. */
export function NextMealCard({ p, today, minutes }: { p: Planner; today: string; minutes: number }) {
  const snap = p.snap;
  if (!snap?.mealsReady || !snap.mealPlan.length) return null;
  const slot = nextMeal(snap.meals, today, minutes);
  const meals = mealsFor(snap.mealPlan, today);
  const logged = snap.meals.filter((m) => m.date === today).length;
  return (
    <div className="card summary">
      <ul className="links">
        <li>
          <Link to="/planner/meals">
            <b>
              Meals · {logged}/{MEAL_SLOTS.length}
            </b>
            <span className="muted">{slot ? `${SLOT_LABEL[slot]}: ${meals.find((m) => m.slot === slot)?.text || "not planned"}` : "All four logged today ✨"}</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}

function MealCard({ p, today, slot, text, toast }: { p: Planner; today: string; slot: MealSlot; text: string; toast: (m: string) => void }) {
  const log = p.snap!.meals.find((m) => m.date === today && m.slot === slot) ?? null;
  const [note, setNote] = useState(log?.note ?? "");
  useEffect(() => setNote(log?.note ?? ""), [log?.note]);
  const pick = (ate: MealAte) => {
    if (log?.ate === ate) {
      p.setMeal(slot, null);
      toast(`${SLOT_LABEL[slot]} cleared`);
      return;
    }
    p.setMeal(slot, ate, ate === "other" ? note : null);
    if (!log) sfx.tick(3);
    toast(`${SLOT_LABEL[slot]} logged · +${MEAL_XP} XP Glow`);
  };
  return (
    <li className={"meal" + (log ? " done" : "")}>
      <div className="meal-top">
        <span className="eyebrow">{SLOT_LABEL[slot].toUpperCase()}</span>
        {log && <span className="pill">+{MEAL_XP} XP</span>}
      </div>
      <div className="q-text">{text || "Nothing planned. Add it in your meal plan below."}</div>
      <div className="row meal-btns" role="group" aria-label={`${SLOT_LABEL[slot]}: what did you eat?`}>
        <button className={"btn" + (log?.ate === "plan" ? "" : " ghost")} aria-pressed={log?.ate === "plan"} onClick={() => pick("plan")}>
          Ate this
        </button>
        <button className={"btn" + (log?.ate === "other" ? "" : " ghost")} aria-pressed={log?.ate === "other"} onClick={() => pick("other")}>
          Something else
        </button>
      </div>
      {log?.ate === "other" && (
        <input
          type="text"
          aria-label={`What you had for ${SLOT_LABEL[slot].toLowerCase()} (optional)`}
          placeholder="What did you have? (optional)"
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (log.note ?? "") && p.setMeal(slot, "other", note)}
        />
      )}
    </li>
  );
}

function PlanEditor({ p, toast, today }: { p: Planner; toast: (m: string) => void; today: string }) {
  const [wd, setWd] = useState(dayOfWeek(today));
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="card">
      <h2>
        Your meal plan <span className="sub">edit after the doctor's advice</span>
      </h2>
      <div className="wd-tabs" role="tablist" aria-label="Weekday">
        {order.map((d) => (
          <button key={d} role="tab" aria-selected={wd === d} className={"wd-tab" + (wd === d ? " on" : "")} onClick={() => setWd(d)}>
            {WEEKDAY_NAMES[d].slice(0, 3)}
          </button>
        ))}
      </div>
      <table className="meal-table">
        <tbody>
          {MEAL_SLOTS.map((slot) => {
            const text = p.snap!.mealPlan.find((r) => r.weekday === wd && r.slot === slot)?.text ?? "";
            return (
              <tr key={`${wd}-${slot}`}>
                <th scope="row">{SLOT_LABEL[slot]}</th>
                <td>
                  <PlanCell
                    label={`${WEEKDAY_NAMES[wd]} ${SLOT_LABEL[slot].toLowerCase()}`}
                    value={text}
                    onSave={(v) => {
                      p.saveMealPlanRow({ weekday: wd, slot, text: v });
                      toast(`${WEEKDAY_NAMES[wd]} ${SLOT_LABEL[slot].toLowerCase()} saved`);
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlanCell({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <textarea
      aria-label={label}
      rows={2}
      maxLength={300}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (!v.trim()) return setV(value);
        if (v.trim() !== value) onSave(v);
      }}
    />
  );
}

export function MealsScreen({ p, today, toast }: Props) {
  const snap = p.snap!;
  if (!snap.mealsReady) return <Missing />;
  const meals = mealsFor(snap.mealPlan, today);
  const logged = snap.meals.filter((m) => m.date === today).length;
  return (
    <>
      <div className="card meal-rules">
        <div className="eyebrow">EGGETARIAN · {WEEKDAY_NAMES[dayOfWeek(today)].toUpperCase()}</div>
        <ul className="rule-chips">
          {MEAL_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h2>
          Today's meals <span className="sub">{logged} of 4 logged · +{MEAL_XP} XP Glow each</span>
        </h2>
        <ul className="meals">
          {meals.map((m) => (
            <React.Fragment key={m.slot}>
              <MealCard p={p} today={today} slot={m.slot} text={m.text} toast={toast} />
            </React.Fragment>
          ))}
        </ul>
      </div>
      <PlanEditor p={p} toast={toast} today={today} />
    </>
  );
}
