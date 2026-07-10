"use client";

function points(data: number[], width: number, height: number, pad = 6) {
  if (!data.length) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return data
    .map((value, index) => {
      const x = pad + (index / Math.max(data.length - 1, 1)) * (width - pad * 2);
      const y = height - pad - ((value - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function HorizonChart({
  data,
  label = "Audience trajectory",
}: {
  data: number[];
  label?: string;
}) {
  const width = 720;
  const height = 188;
  const polyline = points(data, width, height, 10);
  const last = data[data.length - 1] ?? 0;
  const first = data[0] ?? 0;
  const delta = last - first;
  const lastPoint = polyline.split(" ").at(-1)?.split(",") ?? ["0", "0"];

  return (
    <figure className="horizon-chart" aria-label={label}>
      <div className="horizon-chart__meta">
        <span>{label}</span>
        <span className="horizon-chart__delta">
          {delta >= 0 ? "+" : ""}
          {delta} period
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label}: ${first} to ${last}`}
        preserveAspectRatio="none"
      >
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1="0"
            x2={width}
            y1={height * fraction}
            y2={height * fraction}
            className="horizon-chart__grid"
          />
        ))}
        <polyline points={polyline} className="horizon-chart__line-shadow" />
        <polyline points={polyline} className="horizon-chart__line" />
        <circle
          cx={lastPoint[0]}
          cy={lastPoint[1]}
          r="4"
          className="horizon-chart__point"
        />
      </svg>
    </figure>
  );
}

export function ArcGauge({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  const radius = 54;
  const circumference = Math.PI * radius;
  const dash = (safe / 100) * circumference;

  return (
    <div className="arc-gauge" aria-label={`${safe}% de ejecución semanal`}>
      <svg viewBox="0 0 128 72" aria-hidden="true">
        <path
          d="M10 64 A54 54 0 0 1 118 64"
          pathLength={circumference}
          className="arc-gauge__track"
        />
        <path
          d="M10 64 A54 54 0 0 1 118 64"
          pathLength={circumference}
          strokeDasharray={`${dash} ${circumference}`}
          className="arc-gauge__value"
        />
      </svg>
      <div className="arc-gauge__number">{safe}%</div>
    </div>
  );
}

export function MicroLine({
  data,
  inverse = false,
}: {
  data: number[];
  inverse?: boolean;
}) {
  const width = 112;
  const height = 32;
  return (
    <svg
      className="micro-line"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points(data, width, height, 2)}
        className={inverse ? "micro-line__path inverse" : "micro-line__path"}
      />
    </svg>
  );
}
