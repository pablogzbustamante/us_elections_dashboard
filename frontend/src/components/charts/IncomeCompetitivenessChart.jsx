import { useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

const TRUMP_COLOR  = "#E5342A";
const HARRIS_COLOR = "#3B82F6";
const TRUMP_FADE   = "rgba(229,52,42,0.55)";
const HARRIS_FADE  = "rgba(59,130,246,0.55)";

function fmtK(n) {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
}

function fmtNum(n) {
  return Number(n).toLocaleString();
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const isT = d.winner_name_raw?.toLowerCase().includes("trump");
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 13px", fontSize: 12, lineHeight: 1.65,
      maxWidth: 210,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 3 }}>
        {d.county_name}, {d.state_abbr}
      </div>
      <div style={{ color: isT ? TRUMP_COLOR : HARRIS_COLOR, fontWeight: 600, marginBottom: 5 }}>
        {d.winner_name_raw} {d.margin_pct != null ? `+${Math.abs(d.margin_pct).toFixed(1)}%` : ""}
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
        Income: <strong style={{ color: "var(--text)" }}>{fmtK(d.income)}</strong>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
        Competitiveness: <strong style={{ color: "var(--text)" }}>{Number(d.competitiveness_score).toFixed(1)}</strong>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
        Votes: <strong style={{ color: "var(--text)" }}>{fmtNum(d.total_votes)}</strong>
      </div>
    </div>
  );
};

function CustomDot(props) {
  const { cx, cy, payload, hoveredFips } = props;
  const isT     = payload.winner_name_raw?.toLowerCase().includes("trump");
  const hovered = hoveredFips === payload.fips;
  const r       = hovered ? 5 : 3;
  return (
    <circle
      cx={cx} cy={cy} r={r}
      fill={isT ? TRUMP_FADE : HARRIS_FADE}
      stroke={hovered ? (isT ? TRUMP_COLOR : HARRIS_COLOR) : "none"}
      strokeWidth={1.5}
      style={{ transition: "r 0.1s" }}
    />
  );
}

export default function IncomeCompetitivenessChart({ data = [] }) {
  const [hoveredFips, setHoveredFips] = useState(null);

  const { trumpData, harrisData, incomeMax } = useMemo(() => {
    const trumpData  = data.filter(d => d.winner_name_raw?.toLowerCase().includes("trump"));
    const harrisData = data.filter(d => d.winner_name_raw?.toLowerCase().includes("harris"));
    const incomeMax  = data.length ? Math.max(...data.map(d => d.income)) : 150000;
    return { trumpData, harrisData, incomeMax };
  }, [data]);

  const xMax = Math.ceil(incomeMax * 1.2 / 10000) * 10000;

  const dotRenderer = (props) => <CustomDot {...props} hoveredFips={hoveredFips} />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 30, right: 16, left: 50, bottom: 32 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="income"
          domain={[20000, xMax]}
          tickFormatter={fmtK}
          tick={{ fontSize: 10, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
          label={{ value: "Median Household Income", position: "insideBottom", offset: -18, fontSize: 10, fill: "var(--text-muted)" }}
        />
        <YAxis
          type="number"
          dataKey="competitiveness_score"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}`}
          tick={{ fontSize: 10, fill: "var(--text-muted)", dx: -3 }}
          axisLine={false}
          tickLine={false}
          width={32}
          label={{ value: "Competitiveness", angle: -90, position: "insideLeft", offset: -38, style: { textAnchor: "middle" }, fontSize: 10, fill: "var(--text-muted)" }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
        {/* toss-up threshold line */}
        <ReferenceLine y={85} stroke="var(--border)" strokeDasharray="4 3" label={{ value: "Toss-up", position: "insideTopRight", fontSize: 9, fill: "var(--text-muted)" }} />
        <Scatter
          name="Trump"
          data={trumpData}
          shape={dotRenderer}
          onMouseEnter={(d) => setHoveredFips(d.fips)}
          onMouseLeave={() => setHoveredFips(null)}
        />
        <Scatter
          name="Harris"
          data={harrisData}
          shape={dotRenderer}
          onMouseEnter={(d) => setHoveredFips(d.fips)}
          onMouseLeave={() => setHoveredFips(null)}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
