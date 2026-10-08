import type { IssueType, MachineStatus } from "./enums";

/**
 * Single source of truth mapping domain enums -> presentation metadata.
 * `colorVar` references the CSS custom property (see styles/tokens.css),
 * `icon` is a stable key the web app maps to a lucide-react component,
 * `labelKey` is the i18n key (no hardcoded strings in components).
 */

export interface StatusMeta {
  labelKey: string;
  colorVar: string;
  icon: string;
  /** Whether the status dot should pulse (live states). */
  pulse: boolean;
}

export const MACHINE_STATUS_META: Record<MachineStatus, StatusMeta> = {
  running: { labelKey: "status.running", colorVar: "var(--status-running)", icon: "play", pulse: true },
  idle: { labelKey: "status.idle", colorVar: "var(--status-idle)", icon: "pause", pulse: false },
  breakdown: { labelKey: "status.breakdown", colorVar: "var(--status-breakdown)", icon: "alert-triangle", pulse: true },
  maintenance: { labelKey: "status.maintenance", colorVar: "var(--status-maintenance)", icon: "wrench", pulse: false },
  offline: { labelKey: "status.offline", colorVar: "var(--status-offline)", icon: "wifi-off", pulse: false },
};

export const ISSUE_TYPE_META: Record<IssueType, Omit<StatusMeta, "pulse">> = {
  machine_issue: { labelKey: "issue.machineIssue", colorVar: "var(--status-breakdown)", icon: "alert-triangle" },
  thread_empty: { labelKey: "issue.threadEmpty", colorVar: "var(--accent)", icon: "spool" },
  material_missing: { labelKey: "issue.materialMissing", colorVar: "var(--status-idle)", icon: "package" },
  quality_issue: { labelKey: "issue.qualityIssue", colorVar: "var(--status-maintenance)", icon: "scan-line" },
  break_pause: { labelKey: "issue.breakPause", colorVar: "var(--muted)", icon: "coffee" },
  other: { labelKey: "issue.other", colorVar: "var(--muted)", icon: "more-horizontal" },
};
