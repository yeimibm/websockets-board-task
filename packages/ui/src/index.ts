export const ui = {
  button:
    "inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
  primaryButton: "bg-primary text-white hover:brightness-95",
  secondaryButton: "border border-slate-200 bg-white text-ink hover:bg-slate-50",
  card: "rounded-card border border-slate-200 bg-white shadow-card",
  input:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
  statusDot: "inline-block size-2 rounded-full"
} as const;

export type ConnectionTone = "connected" | "connecting" | "disconnected";

export const connectionToneClass: Record<ConnectionTone, string> = {
  connected: "bg-emerald-500",
  connecting: "bg-amber-400",
  disconnected: "bg-slate-400"
};

