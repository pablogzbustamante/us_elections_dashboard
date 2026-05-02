import { useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// Affordability tiers: housing_value / income
const TIERS = [
  { max: 3,        color: "#22C55E", label: "< 3×  Affordable"       },
  { max: 5,        color: "#F59E0B", label: "3–5×  Moderate"         },
  { max: 7,        color: "#F97316", label: "5–7×  Unaffordable"     },
  { max: Infinity, color: "#EF4444", label: "> 7×  Severely stressed" },
];

function tierColor(ratio) {
  for (const t of TIERS) if (ratio < t.max) return t.color;
  return TIERS[TIERS.length - 1].color;
}

function fmtK(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function fmtNum(n) { return Number(n).toLocaleString(); }

export function AffordabilityLegend() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {TIERS.map(t => (
        <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width={8} height={8}><circle cx={4} cy={4} r={4} fill={t.color} /></svg>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const color = tierColor(d.affordability_ratio);
  const isT = d.winner_name_raw?.toLowerCase().includes("trump");
  const wColor = isT ? "#E5342A" : "#3B82F6";
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 13px", fontSize: 12, lineHeight: 1.7,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 3 }}>
        {d.county_name}, {d.state_abbr}
      </div>
      <div style={{ color, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
        {d.affordability_ratio.toFixed(1)}× ratio
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
        Income: <strong style={{ color: "var(--text)" }}>{fmtK(d.income)}</strong>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
        Housing: <strong style={{ color: "var(--text)" }}>{fmtK(d.housing_value)}</strong>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
        Persons/hh: <strong style={{ color: "var(--text)" }}>{d.persons_per_hh}</strong>
      </div>
      {d.winner_name_raw && (
        <div style={{ color: wColor, fontSize: 11, marginTop: 3 }}>
          {d.winner_name_raw} +{Math.abs(d.margin_pct).toFixed(1)}%
          {" · "}{fmtNum(d.total_votes)} votes
        </div>
      )}
    </div>
  );
};

function CustomDot({ cx, cy, payload, hoveredFips, onEnter, onLeave }) {
  const color   = tierColor(payload.affordability_ratio);
  const hovered = hoveredFips === payload.fips;
  return (
    <circle
      cx={cx} cy={cy}
      r={hovered ? 5.5 : 3.5}
      fill={color}
      fillOpacity={hovered ? 0.95 : 0.6}
      stroke={hovered ? color : "none"}
      strokeWidth={1.5}
      onMouseEnter={() => onEnter(payload.fips)}
      onMouseLeave={onLeave}
      style={{ cursor: "pointer" }}
    />
  );
}

export default function HousingAffordabilityChart({ data = [] }) {
  const [hoveredFips, setHoveredFips] = useState(null);

  const { incomeMax, housingMax } = useMemo(() => ({
    incomeMax:  data.length ? Math.max(...data.map(d => d.income))        : 150_000,
    housingMax: data.length ? Math.max(...data.map(d => d.housing_value)) : 1_000_000,
  }), [data]);

  const xMax = Math.ceil(incomeMax  * 1.15 / 10_000)  * 10_000;
  const yMax = Math.ceil(housingMax * 1.15 / 50_000)  * 50_000;

  const dotShape = (props) => (
    <CustomDot
      {...props}
      hoveredFips={hoveredFips}
      onEnter={setHoveredFips}
      onLeave={() => setHoveredFips(null)}
    />
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 10, right: 16, left: 50, bottom: 32 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="income"
          domain={[20_000, xMax]}
          tickFormatter={fmtK}
          tick={{ fontSize: 10, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
          label={{ value: "Median Household Income", position: "insideBottom", offset: -18, fontSize: 10, fill: "var(--text-muted)" }}
        />
        <YAxis
          type="number"
          dataKey="housing_value"
          domain={[0, yMax]}
          tickFormatter={fmtK}
          tick={{ fontSize: 10, fill: "var(--text-muted)", dx: -3 }}
          axisLine={false}
          tickLine={false}
          width={32}
          label={{ value: "Median Housing Value", angle: -90, position: "insideLeft", offset: -38, style: { textAnchor: "middle" }, fontSize: 10, fill: "var(--text-muted)" }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
        {/* ratio = 5 reference line: income × 5 is rough unaffordability threshold */}
        <ReferenceLine
          segment={[{ x: 20_000, y: 100_000 }, { x: xMax, y: xMax * 5 > yMax ? yMax : xMax * 5 }]}
          stroke="var(--text-muted)"
          strokeDasharray="4 3"
          strokeOpacity={0.4}
          label={{ value: "5× ratio", position: "insideTopLeft", fontSize: 9, fill: "var(--text-muted)" }}
        />
        <Scatter data={data} shape={dotShape} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
