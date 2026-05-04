import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";

const TRUMP_COLOR  = "#E5342A";
const HARRIS_COLOR = "#3B82F6";

const SEGMENTS = {
  "Low Income":    { messaging: "Cost of living · Jobs · Subsidies",  color: "#8B5CF6" },
  "Middle Income": { messaging: "Stability · Inflation · Housing",    color: "#0EA5E9" },
  "High Income":   { messaging: "Taxes · Economy · Investment",       color: "#10B981" },
};

function fmtK(n) {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
}

function fmtNum(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const seg = SEGMENTS[d?.segment] ?? {};
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 13px", fontSize: 12, lineHeight: 1.7, maxWidth: 240,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.segment}</div>
      <div style={{ fontSize: 10, color: seg.color, fontWeight: 600, marginBottom: 6 }}>
        {seg.messaging}
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
        Income range: <strong style={{ color: "var(--text)" }}>{fmtK(d.income_min)} – {fmtK(d.income_max)}</strong>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
        Total counties: <strong style={{ color: "var(--text)" }}>{(d.trump_counties + d.harris_counties).toLocaleString()}</strong>
      </div>
      <div style={{ color: TRUMP_COLOR, fontSize: 11 }}>
        Trump counties: <strong>{d.trump_counties}</strong>
        {" · "}{fmtNum(d.trump_votes)} votes
      </div>
      <div style={{ color: HARRIS_COLOR, fontSize: 11 }}>
        Harris counties: <strong>{d.harris_counties}</strong>
        {" · "}{fmtNum(d.harris_votes)} votes
      </div>
    </div>
  );
};

function CustomXTick({ x, y, payload }) {
  const seg = SEGMENTS[payload.value] ?? {};
  return (
    <g transform={`translate(${x},${y + 4})`}>
      <text textAnchor="middle" fill="var(--text)" fontSize={12} fontWeight={600}>
        {payload.value}
      </text>
      <text y={15} textAnchor="middle" fill={seg.color ?? "var(--text-muted)"} fontSize={9} fontStyle="italic">
        {seg.messaging}
      </text>
    </g>
  );
}

export default function IncomeSegmentChart({ data = [] }) {
  const chartData = useMemo(() => {
    const map = {};
    for (const row of data) {
      if (!map[row.segment]) {
        map[row.segment] = {
          segment:         row.segment,
          sort_order:      row.sort_order,
          income_min:      row.income_min,
          income_max:      row.income_max,
          trump_counties:  0,
          harris_counties: 0,
          trump_votes:     0,
          harris_votes:    0,
        };
      }
      const e = map[row.segment];
      e.income_min = Math.min(e.income_min, row.income_min);
      e.income_max = Math.max(e.income_max, row.income_max);
      if (row.winner === "Trump")  { e.trump_counties  += row.county_count; e.trump_votes  += row.total_votes; }
      if (row.winner === "Harris") { e.harris_counties += row.county_count; e.harris_votes += row.total_votes; }
    }
    return Object.values(map).sort((a, b) => a.sort_order - b.sort_order);
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 20, right: 16, left: 0, bottom: 8 }} barCategoryGap="28%" barGap={6}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="segment"
          tick={<CustomXTick />}
          axisLine={false}
          tickLine={false}
          interval={0}
          height={60}
        />
        <YAxis
          tickFormatter={(v) => fmtNum(v)}
          tick={{ fontSize: 9, fill: "var(--text-muted)", dx: -3 }}
          axisLine={false}
          tickLine={false}
          width={36}
          label={{ value: "Counties", angle: -90, position: "insideLeft", offset: -24, style: { textAnchor: "middle" }, fontSize: 10, fill: "var(--text-muted)" }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface-2)", opacity: 0.5 }} />
        <Bar dataKey="trump_counties"  name="Trump"  fill={TRUMP_COLOR}  radius={[3, 3, 0, 0]} maxBarSize={52}>
          <LabelList dataKey="trump_counties"  position="top" style={{ fontSize: 9, fill: TRUMP_COLOR,  fontWeight: 700 }} />
        </Bar>
        <Bar dataKey="harris_counties" name="Harris" fill={HARRIS_COLOR} radius={[3, 3, 0, 0]} maxBarSize={52}>
          <LabelList dataKey="harris_counties" position="top" style={{ fontSize: 9, fill: HARRIS_COLOR, fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
