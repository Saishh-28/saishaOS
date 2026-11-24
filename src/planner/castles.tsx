/**
 * Castles on Home: one little castle for each place that used to be
 * crammed into "More" (Calendar, Quests, Rewards, Meals, Care, Lumi,
 * Music Room, Treasury, Evening review). Original CSS shapes only.
 */
import React from "react";
import { Link } from "./router";

export interface Castle {
  to: string;
  name: string;
  what: string;
  roof: string;
  wall: string;
}

export const CASTLES: Castle[] = [
  { to: "/planner/quests", name: "Quest Board", what: "Quests", roof: "#ffd98a", wall: "#b89cff" },
  { to: "/planner/calendar", name: "Star Tower", what: "Calendar", roof: "#8ee6e0", wall: "#7f6bc8" },
  { to: "/planner/rewards", name: "Treasure Vault", what: "Rewards", roof: "#ffd98a", wall: "#c98a5e" },
  { to: "/planner/meals", name: "Hearth Kitchen", what: "Meals", roof: "#f6a8c8", wall: "#9fe3b5" },
  { to: "/planner/care", name: "Moonlit Spa", what: "Care", roof: "#ffc4d8", wall: "#a88bd8" },
  { to: "/planner/lumi", name: "Lumi's Lantern", what: "Talk to Lumi", roof: "#fff1c9", wall: "#8a7fd0" },
  { to: "/planner/music", name: "Music Hall", what: "Songs", roof: "#d8c6ff", wall: "#6fc9d6" },
  { to: "/planner/treasury", name: "Treasury", what: "Money", roof: "#ffe1b8", wall: "#e9a86f" },
  { to: "/planner/review", name: "Night Watch", what: "Evening review", roof: "#b89cff", wall: "#4b3a8f" },
];

function CastleArt({ c }: { c: Castle }) {
  return (
    <span className="castle-art" aria-hidden="true">
      <span className="c-glow" style={{ background: c.roof }} />
      <span className="c-tower left" style={{ background: c.wall }}>
        <span className="c-roof" style={{ borderBottomColor: c.roof }} />
      </span>
      <span className="c-keep" style={{ background: c.wall }}>
        <span className="c-roof big" style={{ borderBottomColor: c.roof }} />
        <span className="c-door" />
      </span>
      <span className="c-tower right" style={{ background: c.wall }}>
        <span className="c-roof" style={{ borderBottomColor: c.roof }} />
      </span>
    </span>
  );
}

/** The castle grid: on Home, and at /planner/more for old links. */
export function Castles({ title = "Castles of the kingdom" }: { title?: string }) {
  return (
    <section className="card castles" aria-label={title}>
      <h2>{title}</h2>
      <ul className="castle-grid">
        {CASTLES.map((c) => (
          <li key={c.to}>
            <Link to={c.to} className="castle" aria-label={`${c.name}: ${c.what}`}>
              <CastleArt c={c} />
              <span className="c-name">{c.name}</span>
              <span className="c-what">{c.what}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
