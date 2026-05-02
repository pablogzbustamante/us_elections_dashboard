import { useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

const SEGMENT_COLORS = {
  "Low Income":    "#8B5CF6",
  "Middle Income": "#0EA5E9",
  "High Income":   "#10B981",
};

const SEGMENT_MESSAGING = {
  "Low Income":    "Cost of living · Jobs",
  "Middle Income": "Stability · Inflation",
  "High Income":   "Taxes · Investment",
};

function fmtK(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function fmtPop(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
}

function fmtNum(n) { return Number(n).toLocaleString(); }

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const segColor = SEGMENT_COLORS[d.segment] ?? "#9CA3AF";
  const isT = d.winner_name_raw?.toLowerCase().includes("trump");
  const wColor = isT ? "#E5342A" : "#3B82F6";
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 13px", fontSize: 12, lineHeight: 1.7,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>
        {d.county_name}, {d.state_abbr}
      </div>
      <div style={{ color: segColor, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
        {d.segment} - {SEGMENT_MESSAGING[d.segment]}
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
        Income: <strong style={{ color: "var(--text)" }}>{fmtK(d.income)}</strong>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
        Population: <strong style={{ color: "var(--text)" }}>{fmtNum(d.population)}</strong>
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

function makeDot(maxPop, hoveredFips, setHovered) {
  return function CustomDot({ cx, cy, payload }) {
    const color   = SEGMENT_COLORS[payload.segment] ?? "#9CA3AF";
    const hovered = hoveredFips === payload.fips;
    const r = 2.5 + 14 * Math.sqrt(payload.population / maxPop);
    return (
      <circle
        cx={cx} cy={cy} r={hovered ? r + 2 : r}
        fill={color}
        fillOpacity={hovered ? 0.9 : 0.55}
        stroke={hovered ? color : "none"}
        strokeWidth={1.5}
        onMouseEnter={() => setHovered(payload.fips)}
        onMouseLeave={() => setHovered(null)}
        style={{ cursor: "pointer" }}
      />
    );
  };
}

export function IncomePopLegend() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      {Object.entries(SEGMENT_COLORS).map(([seg, color]) => (
        <div key={seg} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width={8} height={8}><circle cx={4} cy={4} r={4} fill={color} /></svg>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{seg}</span>
        </div>
      ))}
    </div>
  );
}

export default function IncomePopulationChart({ data = [] }) {
  const [hoveredFips, setHoveredFips] = useState(null);

  const { groups, incomeMax, popMax, xMax } = useMemo(() => {
    const groups = {
      "Low Income":    data.filter(d => d.segment === "Low Income"),
      "Middle Income": data.filter(d => d.segment === "Middle Income"),
      "High Income":   data.filter(d => d.segment === "High Income"),
    };
    const incomeMax = data.length ? Math.max(...data.map(d => d.income))     : 150_000;
    const popMax    = data.length ? Math.max(...data.map(d => d.population)) : 10_000_000;
    const xMax = Math.ceil(incomeMax * 1.15 / 10_000) * 10_000;
    return { groups, incomeMax, popMax, xMax };
  }, [data]);

  const dotShape = makeDot(popMax, hoveredFips, setHoveredFips);

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
          dataKey="population"
          domain={[0, "auto"]}
          tickFormatter={fmtPop}
          tick={{ fontSize: 10, fill: "var(--text-muted)", dx: -3 }}
          axisLine={false}
          tickLine={false}
          width={32}
          label={{ value: "Population", angle: -90, position: "insideLeft", offset: -38, style: { textAnchor: "middle" }, fontSize: 10, fill: "var(--text-muted)" }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
        {Object.entries(groups).map(([seg, pts]) => (
          <Scatter key={seg} name={seg} data={pts} shape={dotShape} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
