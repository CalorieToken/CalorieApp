import mazeConfig from "@/config/gameverse-maze.json";

export type MazePosition = { x: number; y: number };
export type MazeDirection = "up" | "down" | "left" | "right";

export const gameverseMaze = mazeConfig;

export function mazeCell(position: MazePosition): string {
  const row = mazeConfig.rows[position.y];
  if (!row || position.x < 0 || position.x >= row.length) return "#";
  return row[position.x] ?? "#";
}

export function mazeCanEnter(position: MazePosition): boolean {
  return mazeCell(position) !== "#";
}

export function moveMaze(
  position: MazePosition,
  direction: MazeDirection
): MazePosition {
  const delta = direction === "up" ? {x:0,y:-1}
    : direction === "down" ? {x:0,y:1}
    : direction === "left" ? {x:-1,y:0}
    : {x:1,y:0};
  const next = {x:position.x + delta.x, y:position.y + delta.y};
  return mazeCanEnter(next) ? next : position;
}

export function mazeComplete(position: MazePosition): boolean {
  return position.x === mazeConfig.exit.x && position.y === mazeConfig.exit.y;
}

export function mazeStart(): MazePosition {
  return {...mazeConfig.start};
}

export function mazeKeyDirection(key: string): MazeDirection | null {
  if (key === "ArrowUp" || key.toLowerCase() === "w") return "up";
  if (key === "ArrowDown" || key.toLowerCase() === "s") return "down";
  if (key === "ArrowLeft" || key.toLowerCase() === "a") return "left";
  if (key === "ArrowRight" || key.toLowerCase() === "d") return "right";
  return null;
}
