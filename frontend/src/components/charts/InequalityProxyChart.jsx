import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";

const TRUMP_COLOR  = "#E5342A";
const HARRIS_COLOR = "#3B82F6";
const Y_AXIS_WIDTH = 140;

function fmtK(n) {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
}

function winnerColor(winner) {
  if (!winner) return "#9CA3AF";
  return winner.toLowerCase().includes("trump") ? TRUMP_COLOR : HARRIS_COLOR;
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const color = winnerColor(d.winner_name_raw);
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 13px", fontSize: 12, lineHeight: 1.7,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 3 }}>
        {d.county_name}, {d.state_abbr}
      </div>
      <div style={{ color, fontWeight: 600, marginBottom: 5, fontSize: 11 }}>
        {d.winner_name_raw} +{Math.abs(d.margin_pct).toFixed(1)}%
        {" · "}Proxy: <strong>{fmtK(d.inequality_proxy)}</strong>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
        Median income: <strong style={{ color: "var(--text)" }}>{fmtK(d.income)}</strong>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
        Per capita: <strong style={{ color: "var(--text)" }}>{fmtK(d.per_capita)}</strong>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
        Difference: <strong style={{ color: "var(--text)" }}>{fmtK(d.inequality_proxy)}</strong>
      </div>
    </div>
  );
};

function CustomYTick({ x, y, payload }) {
  return (
    <text
      x={x - Y_AXIS_WIDTH + 29}
      y={y}
      textAnchor="start"
      dominantBaseline="middle"
      fontSize={10}
      fill="var(--text)"
    >
      {payload.value}
    </text>
  );
}

export default function InequalityProxyChart({ data = [] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: `${d.county_name}, ${d.state_abbr}`,
  }));

  const xMax = chartData.length
    ? Math.ceil(Math.max(...chartData.map(d => d.inequality_proxy)) * 1.05 / 5000) * 5000
    : 100_000;

  const barHeight  = 18;
  const chartHeight = Math.max(chartData.length * (barHeight + 6), 80);

  return (
    <div style={{ width: "100%", height: "100%", overflowY: "auto" }}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 52, left: 0, bottom: 4 }}
          barSize={barHeight}
        >
          <XAxis
            type="number"
            domain={[0, xMax]}
            tickFormatter={fmtK}
            tick={{ fontSize: 9, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={Y_AXIS_WIDTH}
            tick={<CustomYTick />}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="inequality_proxy" radius={[0, 3, 3, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={winnerColor(d.winner_name_raw)} fillOpacity={0.75} />
            ))}
            <LabelList
              dataKey="inequality_proxy"
              position="right"
              formatter={fmtK}
              style={{ fontSize: 9, fill: "var(--text-muted)" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
