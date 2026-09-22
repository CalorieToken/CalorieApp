import { ShowcaseActivity } from "@/components/ShowcaseActivity";

export const metadata = { robots: { index: false, follow: false }, title: "CalorieApp activity" };
export default function ActivityPage() { return <main className="p-2"><ShowcaseActivity /></main>; }
