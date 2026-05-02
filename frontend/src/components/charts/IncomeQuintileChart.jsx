import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LabelList,
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

function legendFormatter(value) {
  return value === "avg_pct_trump" ? "Trump" : "Harris";
}

export default function IncomeQuintileChart({ data = [] }) {
  const chartData = data.map((d) => ({
    ...d,
    quintile_label: `Q${d.quintile}`,
    range_label: `${fmtK(d.income_min)}–${fmtK(d.income_max)}`,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 22, right: -0, left: 0, bottom: 44 }} barCategoryGap="30%" barGap={8}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="quintile_label"
          tick={makeXTick(chartData)}
          axisLine={false}
          tickLine={false}
          interval={0}
          height={52}
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
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
          formatter={legendFormatter}
        />
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
  );
}
