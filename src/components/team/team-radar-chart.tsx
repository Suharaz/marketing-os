import type { RadarDimension, MemberStatus } from '@/lib/queries/team-kpi';

interface TeamRadarChartProps {
  dimensions: RadarDimension[]; // length nên = 5 (pentagon)
  status: MemberStatus;
  size?: number; // px — viewBox vuông; default 140
}

// Palette theo status để filled polygon match badge color của card.
const PALETTE: Record<MemberStatus, { stroke: string; fill: string }> = {
  top: { stroke: '#F59E0B', fill: 'rgba(245, 158, 11, 0.18)' }, // amber
  good: { stroke: '#3B82F6', fill: 'rgba(59, 130, 246, 0.16)' }, // blue
  coach: { stroke: '#F43F5E', fill: 'rgba(244, 63, 94, 0.16)' }, // rose
};

// Chuyển 1 giá trị 0–100 + index trục → toạ độ (x, y) trên SVG.
// angle=0 ở đỉnh (12 giờ), tăng theo chiều kim đồng hồ.
function polar(
  cx: number,
  cy: number,
  radius: number,
  angle: number
): [number, number] {
  return [cx + radius * Math.sin(angle), cy - radius * Math.cos(angle)];
}

export function TeamRadarChart({
  dimensions,
  status,
  size = 140,
}: TeamRadarChartProps) {
  const palette = PALETTE[status];
  const cx = size / 2;
  const cy = size / 2;
  // Pad đủ chỗ cho label ngoài rìa polygon.
  const radius = size / 2 - 18;
  const n = dimensions.length;

  // 3 vòng grid (33%, 66%, 100%) — gợi đường đồng tâm cho mắt dễ đọc.
  const gridLevels = [0.33, 0.66, 1];

  // Polygon outline (max ring) làm border outline rõ ràng.
  const outlinePoints = dimensions
    .map((_, i) => {
      const angle = (i * 2 * Math.PI) / n;
      const [x, y] = polar(cx, cy, radius, angle);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  // Filled polygon = giá trị thật (value/100 × radius).
  const dataPoints = dimensions
    .map((d, i) => {
      const angle = (i * 2 * Math.PI) / n;
      const r = radius * (Math.max(0, Math.min(100, d.value)) / 100);
      const [x, y] = polar(cx, cy, r, angle);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-auto"
      role="img"
      aria-label="Radar 5 chiều"
    >
      {/* Grid rings — concentric pentagons */}
      {gridLevels.map((lvl) => (
        <polygon
          key={lvl}
          points={dimensions
            .map((_, i) => {
              const angle = (i * 2 * Math.PI) / n;
              const [x, y] = polar(cx, cy, radius * lvl, angle);
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(' ')}
          fill="none"
          stroke="#E4E4E7"
          strokeWidth={0.6}
        />
      ))}

      {/* Axis lines — từ tâm ra đỉnh outline */}
      {dimensions.map((_, i) => {
        const angle = (i * 2 * Math.PI) / n;
        const [x, y] = polar(cx, cy, radius, angle);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="#E4E4E7"
            strokeWidth={0.6}
          />
        );
      })}

      {/* Outline pentagon — viền nhẹ ngoài cùng */}
      <polygon
        points={outlinePoints}
        fill="none"
        stroke="#D4D4D8"
        strokeWidth={0.8}
      />

      {/* Filled data polygon */}
      <polygon
        points={dataPoints}
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />

      {/* Axis labels — đặt ngoài rìa, anchor tuỳ vị trí */}
      {dimensions.map((d, i) => {
        const angle = (i * 2 * Math.PI) / n;
        const [lx, ly] = polar(cx, cy, radius + 10, angle);
        // Anchor: đỉnh trên/dưới = middle; trái/phải = end/start
        const sin = Math.sin(angle);
        const anchor =
          Math.abs(sin) < 0.2 ? 'middle' : sin > 0 ? 'start' : 'end';
        return (
          <text
            key={i}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-zinc-400"
            style={{ fontSize: 9 }}
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
