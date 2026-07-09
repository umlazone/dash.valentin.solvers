"use client";

/** Tiny SVG sparkline */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  stroke = "#fff",
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const last = data[data.length - 1];
  const first = data[0];
  const up = last >= first;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
        opacity={0.9}
      />
      <circle
        cx={width}
        cy={
          height - ((last - min) / range) * (height - 4) - 2
        }
        r="2.5"
        fill={up ? "#3dd68c" : "#f2555a"}
      />
    </svg>
  );
}

/** Horizontal bar for goals / funnel */
export function Bar({
  value,
  max = 100,
  tone = "white",
}: {
  value: number;
  max?: number;
  tone?: "white" | "good" | "warn" | "bad";
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const colors = {
    white: "bg-white",
    good: "bg-emerald-400",
    warn: "bg-amber-400",
    bad: "bg-rose-400",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full ${colors[tone]} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Circular progress */
export function Ring({
  value,
  max,
  size = 72,
  label,
}: {
  value: number;
  max: number;
  size?: number;
  label?: string;
}) {
  const pct = max === 0 ? 0 : Math.min(1, value / max);
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth="6"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="-mt-[52px] mb-6 text-center">
        <div className="text-sm font-semibold tabular-nums">
          {value}/{max}
        </div>
      </div>
      {label ? (
        <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          {label}
        </div>
      ) : null}
    </div>
  );
}

/** Heat intensity for calendar cells */
export function heatClass(posts: number, replies: number) {
  const score = posts * 3 + replies;
  if (score === 0) return "bg-white/[0.03]";
  if (score <= 2) return "bg-white/10";
  if (score <= 4) return "bg-white/20";
  return "bg-white/35";
}
