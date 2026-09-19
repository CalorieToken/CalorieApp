import pack from "../config/calorieverse-meadow.json";

export const meadow = pack;
export const MEADOW_KEY = "calorie.calorieverse.meadow.v1";
export const LEGACY_PROGRESS_KEY = "calorie.gameverse.progress.v1";
export const STARTER_KEY = "calorie.gameverse.starter-character.v1";
export type Point = { x: number; y: number };
export type GardenStage = "empty" | "planted" | "watered" | "harvested";
export type MeadowState = {
  schema: 1;
  world_id: string;
  region_id: string;
  position: Point;
  collected: string[];
  garden: GardenStage;
  [key: string]: unknown;
};
export type MeadowObject = typeof meadow.objects[number];

const stages: GardenStage[] = ["empty", "planted", "watered", "harvested"];
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
export function position(value: unknown): Point {
  const p = value as Partial<Point> | null;
  return {
    x: clamp(typeof p?.x === "number" && Number.isFinite(p.x) ? p.x : meadow.start.x, meadow.bounds.left, meadow.bounds.right),
    y: clamp(typeof p?.y === "number" && Number.isFinite(p.y) ? p.y : meadow.start.y, meadow.bounds.top, meadow.bounds.bottom),
  };
}
export function initialMeadow(): MeadowState {
  return { schema: 1, world_id: meadow.world_id, region_id: meadow.region_id, position: {...meadow.start}, collected: [], garden: "empty" };
}
export function restoreMeadow(raw: string | null): { state: MeadowState; writable: boolean } {
  if (!raw) return { state: initialMeadow(), writable: true };
  try {
    const parsed = JSON.parse(raw);
    // Do not overwrite an unreadable/future save. The user can still explore.
    if (!parsed || parsed.schema !== 1 || parsed.world_id !== meadow.world_id || !Array.isArray(parsed.collected)) {
      return { state: initialMeadow(), writable: false };
    }
    return { state: {
      ...parsed,
      schema: 1,
      world_id: meadow.world_id,
      region_id: meadow.region_id,
      position: position(parsed.position),
      // Keep namespaced IDs from future packs when they are temporarily absent.
      collected: [...new Set<string>(parsed.collected.filter((id: unknown) => typeof id === "string" && id.length <= 120))],
      garden: stages.includes(parsed.garden) ? parsed.garden : "empty",
    }, writable: true };
  } catch { return { state: initialMeadow(), writable: false }; }
}
export function moveToward(from: Point, target: Point, seconds: number): Point {
  const safe = position(target);
  const dx = safe.x - from.x, dy = safe.y - from.y;
  const distance = Math.hypot(dx, dy);
  const step = Math.min(distance, meadow.speed * clamp(seconds, 0, 0.06));
  return distance < 0.01 ? safe : { x: from.x + dx / distance * step, y: from.y + dy / distance * step };
}
export function nearby(point: Point, object: Point): boolean {
  return Math.hypot(point.x - object.x, point.y - object.y) <= meadow.interaction_radius;
}
export function interact(state: MeadowState, objectId: string): MeadowState {
  const object = meadow.objects.find(item => item.id === objectId);
  if (!object || !nearby(state.position, object)) return state;
  if (object.kind === "apple" && !state.collected.includes(object.id)) {
    return {...state, collected: [...state.collected, object.id]};
  }
  if (object.kind === "garden") {
    const index = stages.indexOf(state.garden);
    if (index < stages.length - 1) return {...state, garden: stages[index + 1]};
  }
  return state;
}
export function appleCount(state: MeadowState): number {
  return meadow.objects.filter(item => item.kind === "apple" && state.collected.includes(item.id)).length;
}
export function meadowComplete(state: MeadowState): boolean {
  return appleCount(state) === meadow.objects.filter(item => item.kind === "apple").length && state.garden === "harvested";
}
