import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
} from "recharts";

const TRUMP_COLOR  = "#E5342A";
const HARRIS_COLOR = "#3B82F6";

function fmtK(n) {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
}

function makeXTick(chartData) {
  return function CustomXTick({ x, y, payload }) {
    const d = chartData.find((r) => r.quintile_label === payload.value);
    return (
      <g transform={`translate(${x},${y + 4})`}>
        <text textAnchor="middle" fill="var(--text)" fontSize={12} fontWeight={600}>
          {payload.value}
        </text>
        <text y={15} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>
          {d?.range_label}
        </text>
      </g>
    );
  };
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 14px", fontSize: 12, lineHeight: 1.6,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        Q{d.quintile} - {fmtK(d.income_min)} to {fmtK(d.income_max)}
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 6 }}>
        Avg income: {fmtK(d.income_avg)} · {d.county_count} counties
      </div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.fill }}>
          {p.name}: <strong>{Number(p.value).toFixed(1)}%</strong>
        </div>
      ))}
    </div>
  );
}


export default function IncomeQuintileChart({ data = [] }) {
  const containerRef = useRef(null);
  const [h, setH] = useState(300);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => setH(e[0].contentRect.height));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const chartData = data.map((d) => ({
    ...d,
    quintile_label: `Q${d.quintile}`,
    range_label: `${fmtK(d.income_min)}–${fmtK(d.income_max)}`,
  }));

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={chartData} margin={{ top: 18, right: 0, left: 0, bottom: 0 }} barCategoryGap="30%" barGap={8}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="quintile_label"
          tick={makeXTick(chartData)}
          axisLine={false}
          tickLine={false}
          interval={0}
          height={40}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 9, fill: "var(--text-muted)", dx: -3 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface-2)", opacity: 0.6 }} />
        <Bar dataKey="avg_pct_trump" name="avg_pct_trump" fill={TRUMP_COLOR} radius={[3, 3, 0, 0]} maxBarSize={32}>
          <LabelList
            dataKey="avg_pct_trump"
            position="top"
            formatter={(v) => `${Number(v).toFixed(1)}%`}
            style={{ fontSize: 8.2, fill: TRUMP_COLOR, fontWeight: 700 }}
          />
        </Bar>
        <Bar dataKey="avg_pct_harris" name="avg_pct_harris" fill={HARRIS_COLOR} radius={[3, 3, 0, 0]} maxBarSize={32}>
          <LabelList
            dataKey="avg_pct_harris"
            position="top"
            formatter={(v) => `${Number(v).toFixed(1)}%`}
            style={{ fontSize: 8.2, fill: HARRIS_COLOR, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}
