"use client";

import { KeyboardEvent, useMemo, useState } from "react";
import mazeCopyConfig from "@/config/gameverse-maze-copy.json";
import { resolveLocale } from "@/lib/locales";
import {
  gameverseMaze,
  mazeComplete,
  mazeKeyDirection,
  mazeStart,
  moveMaze,
  type MazeDirection,
  type MazePosition,
} from "@/lib/gameverseMaze";

type MazeCopy = (typeof mazeCopyConfig)["en"];

function copyFor(locale: string): MazeCopy {
  const resolved = resolveLocale(locale);
  const source = mazeCopyConfig as unknown as Record<string, MazeCopy>;
  return source[resolved] ?? source.en;
}

export function GameverseMazeRoute({
  locale,
  completed,
  onComplete,
  onContinue,
}: {
  locale: string;
  completed: boolean;
  onComplete(): void;
  onContinue(): void;
}) {
  const copy = copyFor(locale);
  const [position, setPosition] = useState<MazePosition>(
    completed ? {...gameverseMaze.exit} : mazeStart()
  );
  const [steps, setSteps] = useState(0);

  const cells = useMemo(
    () => gameverseMaze.rows.flatMap((row, y) =>
      [...row].map((cell, x) => ({cell, x, y}))
    ),
    []
  );

  function move(direction: MazeDirection) {
    if (mazeComplete(position)) return;
    const next = moveMaze(position, direction);
    if (next.x === position.x && next.y === position.y) return;
    setPosition(next);
    setSteps(value => value + 1);
    if (mazeComplete(next)) onComplete();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const direction = mazeKeyDirection(event.key);
    if (!direction) return;
    event.preventDefault();
    move(direction);
  }

  function reset() {
    setPosition(mazeStart());
    setSteps(0);
  }

  const isDone = completed || mazeComplete(position);

  return (
    <section className="gameverse-maze-card" aria-labelledby="gameverse-maze-title">
      <div className="gameverse-maze-copy">
        <p className="gameverse-kicker">ROUTE · {steps}</p>
        <h3 id="gameverse-maze-title">{copy.title}</h3>
        <p>{copy.intro}</p>
        <small>{copy.controls}</small>
      </div>

      <div
        className="gameverse-maze-grid"
        role="application"
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label={copy.title}
        style={{ gridTemplateColumns: `repeat(${gameverseMaze.width}, 1fr)` }}
      >
        {cells.map(({cell, x, y}) => {
          const player = position.x === x && position.y === y;
          return (
            <span
              key={x + "-" + y}
              className={[
                "gameverse-maze-cell",
                cell === "#" ? "is-wall" : "is-path",
                cell === "S" ? "is-start" : "",
                cell === "E" ? "is-exit" : "",
                player ? "has-player" : "",
              ].filter(Boolean).join(" ")}
              aria-hidden="true"
            >
              {player ? "C" : cell === "S" ? "•" : cell === "E" ? "◇" : ""}
            </span>
          );
        })}
      </div>

      <div className="gameverse-maze-controls" aria-label={copy.controls}>
        <button type="button" onClick={() => move("up")} aria-label="Up">↑</button>
        <div>
          <button type="button" onClick={() => move("left")} aria-label="Left">←</button>
          <button type="button" onClick={() => move("down")} aria-label="Down">↓</button>
          <button type="button" onClick={() => move("right")} aria-label="Right">→</button>
        </div>
        <button type="button" className="secondary" onClick={reset}>{copy.reset}</button>
      </div>

      {isDone ? (
        <div className="gameverse-maze-complete" role="status">
          <strong>{copy.done}</strong>
          <button type="button" onClick={onContinue}>{copy.continue}</button>
        </div>
      ) : null}
    </section>
  );
}
