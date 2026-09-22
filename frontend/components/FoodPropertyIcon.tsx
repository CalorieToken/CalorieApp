type Property = "calories" | "protein" | "fat" | "carbohydrates" | "plant" | "score" | "recipe" | "label";

/** Decorative icons always accompany a translated text label. */
export function FoodPropertyIcon({ kind }: { kind: Property }) {
  const paths: Record<Property, string> = {
    recipe: "M4 3h7a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H4Z M14 6a3 3 0 0 1 3-3h3v16h-2a4 4 0 0 0-4 2 M7 7h4 M7 11h4",
    label: "M12 3l3 2 4 1 1 4-1 4-3 2-4 1-4-1-3-2-1-4 1-4 4-1Z M8 10l3 3 5-6 M8 16l-1 6 5-3 5 3-1-6",
    calories: "M13 3c1 5-4 5-3 9 2-1 3-3 3-5 4 3 6 6 5 9a6 6 0 0 1-12 0c-1-4 3-7 7-13Z M12 14c-2 2-3 4-1 5 2 1 4-1 1-5Z",
    protein: "M8 4c4-2 10 0 11 4 1 4-3 4-4 7-1 4-6 6-9 3-4-4-2-11 2-14Z M8 8c-2 2-2 5 0 7 M11 7l1 1 M13 10l1 1",
    fat: "M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12Z M8 15a4 4 0 0 0 3 4",
    carbohydrates: "M12 21V8 M12 12C7 12 6 8 6 6c4 0 6 2 6 6Z M12 17c-5 0-6-4-6-6 4 0 6 2 6 6Z M12 12c5 0 6-4 6-6-4 0-6 2-6 6Z M12 17c5 0 6-4 6-6-4 0-6 2-6 6Z M12 8c-3-2-3-4 0-6 3 2 3 4 0 6Z",
    plant: "M4 20c0-5 3-8 8-11 M5 15C1 6 10 3 20 4c0 10-5 17-13 12 M10 12l4 1",
    score: "M4 20V12h4v8 M10 20V8h4v12 M16 20V4h4v16 M3 20h18",
  };
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20"
    className="inline-block h-5 w-5 shrink-0 align-middle" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[kind]} />
  </svg>;
}
