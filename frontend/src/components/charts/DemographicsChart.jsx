import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from "recharts";

export default function DemographicsChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
        <PolarGrid stroke="#E5E7EB" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "#6B7280" }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
          formatter={(v) => [Number(v).toFixed(1), "Value"]}
        />
        <Radar
          dataKey="value"
          stroke="#E5342A"
          fill="#E5342A"
          fillOpacity={0.15}
          strokeWidth={2}
          dot={{ r: 3, fill: "#E5342A" }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
