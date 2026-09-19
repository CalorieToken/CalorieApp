import config from "@/config/calorieverse-fnb-chain.json";
import copyConfig from "@/config/calorieverse-fnb-copy.json";
import type { AgeBand } from "@/lib/ageExperience";
import { resolveLocale } from "@/lib/locales";

export const CALORIEVERSE_FNB_KEY = "calorie.calorieverse.fnb.v1";

export type FnbBranchId =
  | "fruit-vegetables"
  | "grain-bakery"
  | "dairy"
  | "drinks"
  | "hospitality"
  | "retail-delivery";

export type FnbRoleId =
  | "primary-producer"
  | "processor-manufacturer"
  | "baker-kitchen-craft"
  | "wholesaler-distributor"
  | "warehouse-cold-chain"
  | "transport-logistics"
  | "grocery-retail"
  | "restaurant"
  | "cafe"
  | "takeaway"
  | "delivery"
  | "consumer"
  | "food-data-reviewer";

export type FnbRole = {
  id: FnbRoleId;
  stage: string;
  aliases: string[];
  upstream: FnbRoleId[];
  downstream: FnbRoleId[];
  consequence_ids: string[];
};

export type FnbCopy = {
  title: string;
  intro: string;
  branch: string;
  role: string;
  start: string;
  active: string;
  upstream: string;
  downstream: string;
  consequence: string;
  optional: string;
  detailFallback: string;
  branchNames: Record<FnbBranchId, string>;
  roleNames: Record<FnbRoleId, string>;
  roleDescriptions: Partial<Record<FnbRoleId, string>>;
};

export type FnbLocalProgress = {
  version: 1;
  branch_id: FnbBranchId;
  role_id: FnbRoleId | null;
  visited_role_ids: FnbRoleId[];
};

const branches = config.branches as Array<{id:FnbBranchId;ages:AgeBand[]}>;
const roles = config.roles as FnbRole[];
const roleIds = new Set(roles.map(role => role.id));
const branchIds = new Set(branches.map(branch => branch.id));

export function fnbCopy(locale?: string | null): {
  locale: string;
  copy: FnbCopy;
} {
  const resolved = resolveLocale(locale);
  const source = copyConfig as unknown as Record<string,FnbCopy>;
  return {
    locale: source[resolved] ? resolved : "en",
    copy: source[resolved] ?? source.en,
  };
}

export function fnbRoleCopy(locale: string, roleId: FnbRoleId): {
  name: string;
  description: string;
  descriptionFallback: boolean;
} {
  const {copy} = fnbCopy(locale);
  const english = copyConfig.en as unknown as FnbCopy;
  const description = copy.roleDescriptions[roleId];
  return {
    name: copy.roleNames[roleId] ?? english.roleNames[roleId] ?? roleId,
    description: description ?? english.roleDescriptions[roleId] ?? "",
    descriptionFallback: !description && Boolean(english.roleDescriptions[roleId]),
  };
}

export function branchesForAge(ageBand: AgeBand) {
  return branches.filter(branch => branch.ages.includes(ageBand));
}

export function allFnbRoles(): FnbRole[] {
  return roles;
}

export function fnbRole(roleId: FnbRoleId): FnbRole | null {
  return roles.find(role => role.id === roleId) ?? null;
}

export function parseFnbProgress(value: string | null): FnbLocalProgress {
  const fallback: FnbLocalProgress = {
    version:1,
    branch_id:"fruit-vegetables",
    role_id:null,
    visited_role_ids:[],
  };
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as Partial<FnbLocalProgress>;
    const branch = typeof parsed.branch_id === "string" && branchIds.has(parsed.branch_id as FnbBranchId)
      ? parsed.branch_id as FnbBranchId
      : fallback.branch_id;
    const role = typeof parsed.role_id === "string" && roleIds.has(parsed.role_id as FnbRoleId)
      ? parsed.role_id as FnbRoleId
      : null;
    const visited = Array.isArray(parsed.visited_role_ids)
      ? [...new Set(parsed.visited_role_ids.filter(id =>
          typeof id === "string" && roleIds.has(id as FnbRoleId)
        ) as FnbRoleId[])]
      : [];
    return {
      version:1,
      branch_id:branch,
      role_id:role,
      visited_role_ids:visited,
    };
  } catch {
    return fallback;
  }
}

export function chooseFnbRole(
  progress: FnbLocalProgress,
  roleId: FnbRoleId
): FnbLocalProgress {
  if (!roleIds.has(roleId)) return progress;
  return {
    ...progress,
    role_id:roleId,
    visited_role_ids:[...new Set([...progress.visited_role_ids,roleId])],
  };
}

export function chooseFnbBranch(
  progress: FnbLocalProgress,
  branchId: FnbBranchId
): FnbLocalProgress {
  if (!branchIds.has(branchId)) return progress;
  return {...progress,branch_id:branchId};
}

export const calorieVerseFnbConfig = config;
