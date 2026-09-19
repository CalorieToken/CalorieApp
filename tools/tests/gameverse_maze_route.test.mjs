import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mazeUrl = new URL("../../frontend/config/gameverse-maze.json", import.meta.url);
const copyUrl = new URL("../../frontend/config/gameverse-maze-copy.json", import.meta.url);
const worldUrl = new URL("../../frontend/config/gameverse-world.json", import.meta.url);
const componentUrl = new URL("../../frontend/components/GameverseMazeRoute.tsx", import.meta.url);
const gameverseUrl = new URL("../../frontend/components/GameverseWorld.tsx", import.meta.url);

async function json(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

test("maze is a real connected route with a reachable exit", async () => {
  const maze = await json(mazeUrl);
  const rows = maze.rows;
  const start = maze.start;
  const exit = maze.exit;
  const queue = [start];
  const seen = new Set([`${start.x},${start.y}`]);

  while (queue.length) {
    const current = queue.shift();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next = {x: current.x + dx, y: current.y + dy};
      const key = `${next.x},${next.y}`;
      const cell = rows[next.y]?.[next.x] ?? "#";
      if (cell === "#" || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }

  assert.equal(seen.has(`${exit.x},${exit.y}`), true);
  assert.equal(rows[start.y][start.x], "S");
  assert.equal(rows[exit.y][exit.x], "E");
});

test("maze completion approaches mountains without revealing brand colours", async () => {
  const [maze, world] = await Promise.all([json(mazeUrl), json(worldUrl)]);
  assert.equal(maze.completion.reveals_brand_mountains, false);
  assert.equal(maze.completion.preserves_hidden_mountain_colors, true);
  assert.equal(world.progression.mountain_reveal_after_maze, false);
  const ridge = world.regions.find(region => region.id === "misty-ridge");
  assert.ok(ridge);
  assert.equal(ridge.hidden_until, "maze-complete");
});

test("maze has complete shell copy in all eleven display languages", async () => {
  const copy = await json(copyUrl);
  const locales = ["en","zh-Hans","hi","es","ar","fr","bn","pt","id","ur","nl"];
  assert.deepEqual(Object.keys(copy).sort(), [...locales].sort());
  for (const locale of locales) {
    for (const key of ["title","intro","controls","reset","done","continue"]) {
      assert.equal(typeof copy[locale][key], "string", `${locale} missing ${key}`);
      assert.ok(copy[locale][key].trim().length > 0);
    }
  }
});

test("maze UI supports both keyboard and touch controls", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /onKeyDown=\{onKeyDown\}/);
  assert.match(source, /mazeKeyDirection/);
  assert.match(source, /move\("up"\)/);
  assert.match(source, /move\("left"\)/);
  assert.match(source, /move\("down"\)/);
  assert.match(source, /move\("right"\)/);
});

test("Gameverse persists maze completion and reveals only the misty ridge", async () => {
  const source = await readFile(gameverseUrl, "utf8");
  assert.match(source, /maze_complete\?: boolean/);
  assert.match(source, /setMazeCompleteState\(stored\.maze_complete === true\)/);
  assert.match(source, /region\.id !== "misty-ridge" \|\| mazeCompleteState/);
  assert.match(source, /GameverseMazeRoute/);
  assert.match(source, /setCurrentRegionId\(ridge\.id\)/);
});
