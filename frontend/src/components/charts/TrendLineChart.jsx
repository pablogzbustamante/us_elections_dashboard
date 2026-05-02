import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { partyColor } from "../../utils/formatters";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8,
      padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,.08)",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#111827" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.stroke, display: "flex", gap: 10 }}>
          <span style={{ flex: 1 }}>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{Number(p.value).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
};

/**
 * data: [{ year: 2016, REPUBLICAN: 52.3, DEMOCRAT: 44.1 }, ...]
 * parties: ["REPUBLICAN", "DEMOCRAT"]
 */
export default function TrendLineChart({ data = [], parties = ["REPUBLICAN", "DEMOCRAT"] }) {
  const names = { REPUBLICAN: "Republican", DEMOCRAT: "Democrat" };
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11, fill: "#9CA3AF" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "#9CA3AF" }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip content={<CustomTooltip />} />
        {parties.map((p) => (
          <Line
            key={p}
            type="monotone"
            dataKey={p}
            name={names[p] ?? p}
            stroke={partyColor(p)}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
