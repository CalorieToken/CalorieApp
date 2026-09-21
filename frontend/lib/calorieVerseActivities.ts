import pack from "../config/calorieverse-food-activity.json";
import { nearby, type MeadowState } from "./calorieVerseMeadow";

// Add content modules alongside the original garden, never replace world/save IDs.
// This is a local activity reducer, not a participation or reward adapter.
export const foodActivity = pack;
export type ActivityStatus = "new" | "complete" | "unsupported";
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function foodActivityStatus(state: MeadowState): ActivityStatus {
  if (state.modules === undefined) return "new";
  if (!record(state.modules)) return "unsupported";
  const saved = state.modules[pack.module_id];
  if (saved === undefined) return "new";
  if (!record(saved) || saved.schema !== 1 || !Array.isArray(saved.completed)) return "unsupported";
  return saved.completed.includes(pack.sample.id) ? "complete" : "new";
}

export function reviewFoodSample(state: MeadowState, answerId: string): MeadowState {
  if (state.world_id !== pack.world_id || state.region_id !== pack.region_id ||
      !nearby(state.position, pack.object) || answerId !== pack.sample.answer_id ||
      foodActivityStatus(state) !== "new") return state;
  const modules = record(state.modules) ? state.modules : {};
  const saved = modules[pack.module_id];
  const previous = record(saved) ? saved : {};
  const completed = Array.isArray(previous.completed) ? previous.completed : [];
  return {
    ...state,
    modules: {
      ...modules,
      [pack.module_id]: {...previous, schema: 1, completed: [...completed, pack.sample.id]},
    },
  };
}
