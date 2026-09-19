export type WorldPosition = { x: number; y: number };
export type WorldDirection = "up" | "down" | "left" | "right";

export type WorldRegionPoint = {
  id: string;
  x: number;
  y: number;
};

export const WORLD_MOVEMENT = Object.freeze({
  minX: 4,
  maxXBeforeRidge: 90,
  maxXAfterRidge: 96,
  minY: 22,
  maxY: 88,
  step: 2.4,
  discoveryRadius: 5.8,
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function safeWorldPosition(
  value: unknown,
  fallback: WorldPosition
): WorldPosition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {...fallback};
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.x !== "number" ||
    !Number.isFinite(candidate.x) ||
    typeof candidate.y !== "number" ||
    !Number.isFinite(candidate.y)
  ) return {...fallback};
  return {
    x: clamp(candidate.x, WORLD_MOVEMENT.minX, WORLD_MOVEMENT.maxXAfterRidge),
    y: clamp(candidate.y, WORLD_MOVEMENT.minY, WORLD_MOVEMENT.maxY),
  };
}

export function moveWorld(
  position: WorldPosition,
  direction: WorldDirection,
  ridgeUnlocked: boolean
): WorldPosition {
  const delta = direction === "up" ? {x: 0, y: -WORLD_MOVEMENT.step}
    : direction === "down" ? {x: 0, y: WORLD_MOVEMENT.step}
    : direction === "left" ? {x: -WORLD_MOVEMENT.step, y: 0}
    : {x: WORLD_MOVEMENT.step, y: 0};

  const maxX = ridgeUnlocked
    ? WORLD_MOVEMENT.maxXAfterRidge
    : WORLD_MOVEMENT.maxXBeforeRidge;

  return {
    x: clamp(position.x + delta.x, WORLD_MOVEMENT.minX, maxX),
    y: clamp(position.y + delta.y, WORLD_MOVEMENT.minY, WORLD_MOVEMENT.maxY),
  };
}

export function worldKeyDirection(key: string): WorldDirection | null {
  const normalized = key.toLowerCase();
  if (key === "ArrowUp" || normalized === "w") return "up";
  if (key === "ArrowDown" || normalized === "s") return "down";
  if (key === "ArrowLeft" || normalized === "a") return "left";
  if (key === "ArrowRight" || normalized === "d") return "right";
  return null;
}

export function nearestWorldRegion<T extends WorldRegionPoint>(
  position: WorldPosition,
  regions: readonly T[],
  radius = WORLD_MOVEMENT.discoveryRadius
): T | null {
  let nearest: T | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const region of regions) {
    const dx = region.x - position.x;
    const dy = (region.y - position.y) * 0.82;
    const distance = Math.hypot(dx, dy);
    if (distance <= radius && distance < nearestDistance) {
      nearest = region;
      nearestDistance = distance;
    }
  }
  return nearest;
}
