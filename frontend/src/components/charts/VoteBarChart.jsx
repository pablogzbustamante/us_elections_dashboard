import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { partyColor } from "../../utils/formatters";

export default function VoteBarChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 52, 120)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "#9CA3AF" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="candidate_name"
          width={110}
          tick={{ fontSize: 12, fill: "#374151" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => [`${Number(v).toFixed(1)}%`, "Vote share"]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
        />
        <Bar dataKey="vote_pct" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 12, formatter: (v) => `${Number(v).toFixed(1)}%` }}>
          {data.map((entry, i) => (
            <Cell key={i} fill={partyColor(entry.party_code)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
