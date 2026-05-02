import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ScatterChart, Scatter,
  PieChart, Pie,
} from "recharts";
import Layout from "../components/layout/Layout";
import StateMap from "../components/charts/StateMap";
import Spinner from "../components/ui/Spinner";
import { dashboardService } from "../services/dashboardService";
import { analyticsService } from "../services/analyticsService";
import useElectionsStore from "../store/useElectionsStore";

/* ══════════════════════════════════════════════════════════════════════
   Constants
══════════════════════════════════════════════════════════════════════ */
const ETH_KEYS = ["white", "hispanic", "black", "asian", "native", "pi", "two_or_more"];

const ETH_COLORS = {
  white:       "#60A5FA",
  hispanic:    "#F97316",
  black:       "#EF4444",
  asian:       "#10B981",
  native:      "#8B5CF6",
  pi:          "#06B6D4",
  two_or_more: "#F59E0B",
};

const ETH_LABELS = {
  white:       "White (non-Hisp)",
  hispanic:    "Hispanic",
  black:       "Black",
  asian:       "Asian",
  native:      "Native Am.",
  pi:          "Pacific Is.",
  two_or_more: "Two or More",
};

const ETH_FULL = {
  white:       "White (non-Hispanic)",
  hispanic:    "Hispanic or Latino",
  black:       "Black or African American",
  asian:       "Asian",
  native:      "American Indian & Alaska Native",
  pi:          "Native Hawaiian & Pacific Islander",
  two_or_more: "Two or More Races",
};

/* ══════════════════════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════════════════════ */

function computeDiversity(d) {
  const vals = ETH_KEYS.map(k => d[`pct_${k}`] || 0);
  const total = vals.reduce((s, v) => s + v, 0);
  if (!total) return 0;
  const sq = vals.reduce((s, v) => s + Math.pow(v / total, 2), 0);
  return 1 - sq;
}

function dominantGroup(d) {
  let best = null, bestPct = -1;
  ETH_KEYS.forEach(k => {
    const v = d[`pct_${k}`] || 0;
    if (v > bestPct) { bestPct = v; best = k; }
  });
  return { key: best, pct: bestPct };
}

function aggregateEthnicity(counties) {
  if (!counties.length) {
    return ETH_KEYS.reduce((o, k) => { o[`pct_${k}`] = 0; return o; }, {});
  }
  const totalW = counties.reduce((s, d) => s + (d.total_votes || 1), 0);
  return ETH_KEYS.reduce((o, k) => {
    o[`pct_${k}`] = counties.reduce((s, d) => s + (d[`pct_${k}`] || 0) * (d.total_votes || 1), 0) / totalW;
    return o;
  }, {});
}

/* ══════════════════════════════════════════════════════════════════════
   UI primitives
══════════════════════════════════════════════════════════════════════ */
function TipBox({ children }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8,
      padding: "8px 12px", fontSize: 11.5, boxShadow: "0 4px 12px rgba(0,0,0,.08)", lineHeight: 1.65,
    }}>
      {children}
    </div>
  );
}

function Panel({ title, subtitle, children, loading, scrollable, headerRight }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      <div className="card-header" style={{ flexShrink: 0 }}>
        <div>
          <span className="card-title">{title}</span>
          {subtitle && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{subtitle}</div>}
        </div>
        {headerRight}
      </div>
      <div style={{
        flex: 1, minHeight: 0, padding: "0 12px 12px",
        display: "flex", flexDirection: "column",
        overflowY: scrollable ? "auto" : "hidden",
      }}>
        {loading
          ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-muted)" }}><Spinner /></div>
          : children}
      </div>
    </div>
  );
}

function EmptyState({ message = "No data available" }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
      {message}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MapSearch
══════════════════════════════════════════════════════════════════════ */
const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

function MapSearch({ viewMode, stateMapData, countyMapData, onStateSelect, onCountySelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const ref  = useRef(null);
  const mode = viewMode === "states" ? "state" : "county";

  useEffect(() => { setQuery(""); setOpen(false); }, [viewMode]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    if (mode === "state")
      return [...stateMapData.values()]
        .filter(r => r.state_name?.toLowerCase().includes(q) || r.state_abbr?.toLowerCase().includes(q))
        .slice(0, 8);
    return [...countyMapData.values()]
      .filter(r => r.county_name?.toLowerCase().includes(q) || r.state_abbr?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, mode, stateMapData, countyMapData]);

  const handleSelect = (item) => {
    if (mode === "state") onStateSelect(item.state_abbr);
    else onCountySelect(item.fips);
    setQuery(""); setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{
        display: "flex", alignItems: "center",
        background: "var(--surface-2)", border: "1px solid var(--border)",
        borderRadius: 6, overflow: "hidden",
      }}>
        <span style={{ padding: "0 0 0 9px", color: "var(--text-muted)", display: "flex" }}><IconSearch /></span>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={mode === "state" ? "Search states…" : "Search counties…"}
          style={{ border: "none", outline: "none", background: "transparent", padding: "5px 7px", fontSize: 12, width: 130, color: "var(--text)" }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }}
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: "0 7px", color: "var(--text-muted)", fontSize: 16, lineHeight: 1 }}>×</button>
        )}
      </div>
      {open && query && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 200,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.13)", zIndex: 1000, overflow: "hidden",
        }}>
          {results.map(item => (
            <div
              key={mode === "state" ? item.state_abbr : item.fips}
              onClick={() => handleSelect(item)}
              style={{ padding: "8px 13px", cursor: "pointer", fontSize: 12.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontWeight: 500 }}>{mode === "state" ? item.state_name : item.county_name}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.state_abbr}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Visual 2 - Pie Chart (Electorate Composition Overview)
══════════════════════════════════════════════════════════════════════ */
function CircularBarplot({ aggData, label }) {
  const [hovered, setHovered] = useState(null);

  const sorted = useMemo(() => {
    return [...ETH_KEYS]
      .map(k => ({ key: k, pct: aggData[`pct_${k}`] || 0 }))
      .sort((a, b) => b.pct - a.pct);
  }, [aggData]);

  const hasData = sorted.some(d => d.pct > 0);

  const PieTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <TipBox>
        <div style={{ fontWeight: 600, color: ETH_COLORS[d.key] }}>{ETH_FULL[d.key]}</div>
        <div>Share: <b>{d.pct.toFixed(1)}%</b></div>
      </TipBox>
    );
  };

  if (!hasData) return <EmptyState message="No ethnicity data" />;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 8, overflow: "hidden" }}>
      {/* Pie chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={sorted}
              dataKey="pct"
              nameKey="key"
              cx="50%" cy="50%"
              innerRadius="38%" outerRadius="70%"
              paddingAngle={2}
              onMouseEnter={(_, i) => setHovered(sorted[i]?.key ?? null)}
              onMouseLeave={() => setHovered(null)}
            >
              {sorted.map((d, i) => (
                <Cell
                  key={d.key}
                  fill={ETH_COLORS[d.key]}
                  fillOpacity={hovered && hovered !== d.key ? 0.2 : 0.85}
                  stroke="#fff"
                  strokeWidth={1}
                  style={{ cursor: "pointer", transition: "fill-opacity 0.15s" }}
                />
              ))}
            </Pie>
            <Tooltip content={<PieTip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div style={{ width: 132, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 5, paddingRight: 4 }}>
        {sorted.map(({ key, pct }, i) => (
          <div key={key}
            style={{
              display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
              opacity: hovered && hovered !== key ? 0.3 : 1,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
          >
            <span style={{ width: 9, height: 9, borderRadius: 2, background: ETH_COLORS[key], flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9.5, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {i + 1}. {ETH_LABELS[key]}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: ETH_COLORS[key] }}>{pct.toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Visual 3 - Dominance Segmentation (Targeting Segments)
══════════════════════════════════════════════════════════════════════ */
function DominanceSegmentation({ data, selectedCountyFips }) {
  const [metric, setMetric] = useState("counties");

  /* When a single county is selected, show its full ethnic breakdown instead */
  const countyBreakdown = useMemo(() => {
    if (!selectedCountyFips || !data.length) return null;
    const county = data.find(d => d.fips === selectedCountyFips);
    if (!county) return null;
    return ETH_KEYS
      .map(k => ({ key: k, label: ETH_LABELS[k], value: county[`pct_${k}`] || 0 }))
      .sort((a, b) => b.value - a.value);
  }, [data, selectedCountyFips]);

  const chartData = useMemo(() => {
    if (countyBreakdown) return null;
    const counts = {}, votes = {};
    ETH_KEYS.forEach(k => { counts[k] = 0; votes[k] = 0; });
    let diverseN = 0, diverseV = 0;
    data.forEach(d => {
      const dom = dominantGroup(d);
      if (!dom.key) return;
      if (dom.pct < 50) { diverseN++; diverseV += d.total_votes || 0; return; }
      counts[dom.key]++;
      votes[dom.key] += d.total_votes || 0;
    });
    const rows = ETH_KEYS
      .map(k => ({ key: k, label: ETH_LABELS[k], value: metric === "counties" ? counts[k] : votes[k] }))
      .filter(d => d.value > 0);
    if (diverseN > 0) rows.push({ key: "diverse", label: "Diverse / Mixed", value: metric === "counties" ? diverseN : diverseV });
    return rows.sort((a, b) => b.value - a.value);
  }, [data, metric, countyBreakdown]);

  const DomTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const color = d.key !== "diverse" ? ETH_COLORS[d.key] : "#9CA3AF";
    return (
      <TipBox>
        <div style={{ fontWeight: 600, color }}>{ETH_FULL[d.key] || "Diverse / Mixed"}</div>
        <div>{countyBreakdown ? "Share" : (metric === "counties" ? "Counties" : "Total Votes")}: <b>
          {countyBreakdown ? `${d.value.toFixed(1)}%` : d.value.toLocaleString()}
        </b></div>
        {!countyBreakdown && d.key !== "diverse" && (
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
            {d.key === "white" ? "Broad messaging" :
             d.key === "hispanic" ? "Bilingual / cultural messaging" :
             d.key === "black" ? "Turnout + community engagement" :
             "Targeted outreach"}
          </div>
        )}
      </TipBox>
    );
  };

  const displayData = countyBreakdown || chartData || [];
  if (!displayData.length) return <EmptyState />;

  return (
    <>
      {!countyBreakdown && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4, flexShrink: 0 }}>
          {[{ key: "counties", label: "Counties" }, { key: "population", label: "Votes" }].map(({ key, label }) => (
            <button key={key} onClick={() => setMetric(key)} style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 4, marginLeft: 3,
              border: "1px solid var(--border)",
              background: metric === key ? "var(--surface-2)" : "transparent",
              fontWeight: metric === key ? 600 : 400,
              cursor: "pointer", color: "var(--text)",
            }}>{label}</button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData} layout="vertical" margin={{ top: 4, right: 50, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
            <XAxis type="number"
              tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
              tickFormatter={v => countyBreakdown ? `${v.toFixed(0)}%` : (v > 999 ? `${(v/1000).toFixed(0)}k` : v)}
            />
            <YAxis type="category" dataKey="label" width={110}
              tick={{ fontSize: 9, fill: "#374151" }} axisLine={false} tickLine={false} />
            <Tooltip content={<DomTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={20}>
              {displayData.map((d, i) => (
                <Cell key={i}
                  fill={d.key !== "diverse" ? ETH_COLORS[d.key] : "#9CA3AF"}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Visual 4 - Ethnic Diversity Index Ranking (Prioritization)
══════════════════════════════════════════════════════════════════════ */
function DiversityRanking({ data, selectedCountyFips }) {
  const [showTop, setShowTop] = useState(true);

  const ranked = useMemo(() => {
    const withLabel = data
      .filter(d => d.diversity_index != null)
      .map(d => ({ ...d, label: `${d.county_name}, ${d.state_abbr}` }))
      .sort((a, b) => b.diversity_index - a.diversity_index);
    const top = showTop ? withLabel.slice(0, 15) : [...withLabel].reverse().slice(0, 15);
    return top;
  }, [data, showTop]);

  const highlightFips = selectedCountyFips;

  const DivTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const dom = dominantGroup(d);
    return (
      <TipBox>
        <div style={{ fontWeight: 600 }}>{d.county_name}, {d.state_abbr}</div>
        <div>Diversity Index: <b>{d.diversity_index.toFixed(3)}</b></div>
        {dom.key && <div>Dominant: <b style={{ color: ETH_COLORS[dom.key] }}>{ETH_LABELS[dom.key]}</b> ({dom.pct.toFixed(1)}%)</div>}
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
          {d.diversity_index > 0.7 ? "Coalition messaging required" : d.diversity_index > 0.5 ? "Mixed targeting" : "Focused messaging possible"}
        </div>
      </TipBox>
    );
  };

  if (!ranked.length) return <EmptyState />;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4, flexShrink: 0 }}>
        {["Top 15", "Bottom 15"].map((label, i) => (
          <button key={label} onClick={() => setShowTop(i === 0)} style={{
            fontSize: 10, padding: "2px 7px", borderRadius: 4, marginLeft: 3,
            border: "1px solid var(--border)",
            background: showTop === (i === 0) ? "var(--surface-2)" : "transparent",
            fontWeight: showTop === (i === 0) ? 600 : 400,
            cursor: "pointer", color: "var(--text)",
          }}>{label}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ranked} layout="vertical" margin={{ top: 4, right: 52, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
            <XAxis type="number" domain={[0, 1]}
              tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
              tickFormatter={v => v.toFixed(1)} />
            <YAxis type="category" dataKey="label" width={130}
              tick={{ fontSize: 9, fill: "#374151" }} axisLine={false} tickLine={false} />
            <Tooltip content={<DivTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="diversity_index" radius={[0, 3, 3, 0]} maxBarSize={14}>
              {ranked.map((d, i) => {
                const dom = dominantGroup(d);
                const isHighlighted = d.fips === highlightFips;
                return (
                  <Cell key={i}
                    fill={ETH_COLORS[dom.key] || "#6B7280"}
                    fillOpacity={isHighlighted ? 1 : 0.45 + (ranked.length - i) / ranked.length * 0.5}
                    stroke={isHighlighted ? "#111827" : "none"}
                    strokeWidth={isHighlighted ? 1.5 : 0}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Visual 5 - Ethnicity Concentration Scatter (Messaging Strategy)
══════════════════════════════════════════════════════════════════════ */
function ConcentrationScatter({ data, selectedCountyFips }) {
  const [yGroup, setYGroup] = useState("hispanic");

  const altGroups = ETH_KEYS.filter(k => k !== "white");

  const ScatTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <TipBox>
        <div style={{ fontWeight: 600 }}>{d.county_name}, {d.state_abbr}</div>
        <div>White (non-Hisp): <b>{(d.pct_white || 0).toFixed(1)}%</b></div>
        <div style={{ color: ETH_COLORS[yGroup] }}>{ETH_FULL[yGroup]}: <b>{(d[`pct_${yGroup}`] || 0).toFixed(1)}%</b></div>
        <div>Diversity Index: <b>{d.diversity_index.toFixed(3)}</b></div>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
          {d.pct_white > 70 ? "Homogeneous - simple messaging" :
           d.pct_white < 30 && (d[`pct_${yGroup}`] || 0) > 30 ? "Minority-driven electorate" :
           "Mixed - competitive narrative space"}
        </div>
      </TipBox>
    );
  };

  if (!data.length) return <EmptyState />;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", gap: 3, flexShrink: 0, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9.5, color: "var(--text-muted)", alignSelf: "center", marginRight: 2 }}>Y-axis:</span>
        {altGroups.map(k => (
          <button key={k} onClick={() => setYGroup(k)} style={{
            fontSize: 9, padding: "2px 6px", borderRadius: 4,
            border: `1px solid ${ETH_COLORS[k]}`,
            background: yGroup === k ? ETH_COLORS[k] : "transparent",
            color: yGroup === k ? "#fff" : ETH_COLORS[k],
            fontWeight: yGroup === k ? 600 : 400,
            cursor: "pointer",
          }}>{ETH_LABELS[k]}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 16, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="pct_white" type="number" domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`}
              label={{ value: "% White (non-Hisp)", position: "insideBottom", offset: -14, fontSize: 11, fill: "#9CA3AF" }}
            />
            <YAxis dataKey={`pct_${yGroup}`} type="number" domain={[0, "auto"]}
              tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`}
              label={{ value: `% ${ETH_LABELS[yGroup]}`, angle: -90, position: "insideLeft", offset: 12, fontSize: 11, fill: "#9CA3AF" }}
            />
            <Tooltip content={<ScatTip />} cursor={false} />
            <Scatter data={data}
              shape={props => {
                const d = props.payload;
                const isHighlighted = d.fips === selectedCountyFips;
                return (
                  <circle
                    cx={props.cx} cy={props.cy}
                    r={isHighlighted ? 5 : 2.5}
                    fill={ETH_COLORS[yGroup]}
                    fillOpacity={isHighlighted ? 1 : 0.4 + d.diversity_index * 0.5}
                    stroke={isHighlighted ? "#111827" : "none"}
                    strokeWidth={isHighlighted ? 1.5 : 0}
                  />
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Visual 6 - Ethnicity Targeting Opportunity Ranking
══════════════════════════════════════════════════════════════════════ */
function TargetingRanking({ data, selectedCountyFips }) {
  const [targetGroup, setTargetGroup] = useState("hispanic");

  /* If a county is selected, show that county's target scores across all groups */
  const countyScores = useMemo(() => {
    if (!selectedCountyFips) return null;
    const county = data.find(d => d.fips === selectedCountyFips);
    if (!county) return null;
    const dom = dominantGroup(county);
    return ETH_KEYS.map(k => {
      const pct = county[`pct_${k}`] || 0;
      const score = (pct / 100) * (1 - (dom.pct || 0) / 100);
      return { key: k, label: ETH_LABELS[k], target_score: score, pct };
    }).sort((a, b) => b.target_score - a.target_score);
  }, [data, selectedCountyFips]);

  const ranked = useMemo(() => {
    if (countyScores) return null;
    return [...data]
      .map(d => {
        const dom = dominantGroup(d);
        const pct = d[`pct_${targetGroup}`] || 0;
        return { ...d, target_score: (pct / 100) * (1 - (dom.pct || 0) / 100), label: `${d.county_name}, ${d.state_abbr}` };
      })
      .sort((a, b) => b.target_score - a.target_score)
      .slice(0, 15);
  }, [data, targetGroup, countyScores]);

  const TgtTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (countyScores) {
      return (
        <TipBox>
          <div style={{ fontWeight: 600, color: ETH_COLORS[d.key] }}>{ETH_FULL[d.key]}</div>
          <div>Group Share: <b>{d.pct.toFixed(1)}%</b></div>
          <div>Targeting Score: <b>{d.target_score.toFixed(3)}</b></div>
        </TipBox>
      );
    }
    const dom = dominantGroup(d);
    return (
      <TipBox>
        <div style={{ fontWeight: 600 }}>{d.county_name}, {d.state_abbr}</div>
        <div style={{ color: ETH_COLORS[targetGroup] }}>{ETH_FULL[targetGroup]}: <b>{(d[`pct_${targetGroup}`] || 0).toFixed(1)}%</b></div>
        {dom.key && <div>Dominant: <b>{ETH_LABELS[dom.key]}</b> ({dom.pct.toFixed(1)}%)</div>}
        <div>Target Score: <b>{d.target_score.toFixed(3)}</b></div>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>High presence, still competitive → outreach leverage</div>
      </TipBox>
    );
  };

  const displayData = countyScores || ranked || [];
  if (!displayData.length) return <EmptyState />;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 5 }}>
      {!countyScores && (
        <div style={{ display: "flex", gap: 3, flexShrink: 0, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9.5, color: "var(--text-muted)", alignSelf: "center", marginRight: 2 }}>Target:</span>
          {ETH_KEYS.map(k => (
            <button key={k} onClick={() => setTargetGroup(k)} style={{
              fontSize: 9, padding: "2px 6px", borderRadius: 4,
              border: `1px solid ${ETH_COLORS[k]}`,
              background: targetGroup === k ? ETH_COLORS[k] : "transparent",
              color: targetGroup === k ? "#fff" : ETH_COLORS[k],
              fontWeight: targetGroup === k ? 600 : 400,
              cursor: "pointer",
            }}>{ETH_LABELS[k]}</button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData} layout="vertical" margin={{ top: 4, right: 52, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
            <XAxis type="number" domain={[0, dataMax => dataMax * 1.18]}
              tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
              tickFormatter={v => v.toFixed(2)} />
            <YAxis type="category" dataKey="label" width={130}
              tick={{ fontSize: 9, fill: "#374151" }} axisLine={false} tickLine={false} />
            <Tooltip content={<TgtTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="target_score" radius={[0, 3, 3, 0]} maxBarSize={14}>
              {displayData.map((d, i) => (
                <Cell key={i}
                  fill={countyScores ? ETH_COLORS[d.key] : ETH_COLORS[targetGroup]}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Main Ethnic page
══════════════════════════════════════════════════════════════════════ */
export default function Ethnic() {
  const { selectedElectionId, loadElections } = useElectionsStore();

  const [stateMapData,    setStateMapData]    = useState(new Map());
  const [countyMapData,   setCountyMapData]   = useState(new Map());
  const [stateMapLoading, setStateMapLoading] = useState(false);
  const [ethData,         setEthData]         = useState([]);
  const [ethLoading,      setEthLoading]      = useState(false);

  const [selectedStateAbbr,  setSelectedStateAbbr]  = useState(null);
  const [selectedCountyFips, setSelectedCountyFips] = useState(null);
  const [viewMode,           setViewMode]           = useState("states");

  useEffect(() => { loadElections(); }, [loadElections]);

  useEffect(() => {
    if (!selectedElectionId) return;
    setStateMapLoading(true);
    dashboardService.getStateMapData(selectedElectionId)
      .then(rows => setStateMapData(new Map(rows.map(r => [r.state_fips, r]))))
      .catch(console.error)
      .finally(() => setStateMapLoading(false));
    dashboardService.getMapData(selectedElectionId)
      .then(rows => setCountyMapData(new Map(rows.map(r => [r.fips, r]))))
      .catch(console.error);
    setSelectedStateAbbr(null);
    setSelectedCountyFips(null);
  }, [selectedElectionId]);

  useEffect(() => {
    if (!selectedElectionId) return;
    setEthLoading(true);
    analyticsService.getEthnicityCountySummary(selectedElectionId)
      .then(setEthData)
      .catch(console.error)
      .finally(() => setEthLoading(false));
  }, [selectedElectionId]);

  /* Processed data: pad fips + add diversity_index */
  const processedData = useMemo(() => {
    return ethData.map(d => {
      const base = {
        ...d,
        fips: String(d.fips).padStart(5, "0"),
        total_votes: Number(d.total_votes || 0),
        margin_pct:  Number(d.margin_pct || 0),
        competitiveness_score: Number(d.competitiveness_score || 0),
      };
      ETH_KEYS.forEach(k => { base[`pct_${k}`] = Number(d[`pct_${k}`] || 0); });
      base.diversity_index = computeDiversity(base);
      return base;
    });
  }, [ethData]);

  /* Filtered data respects state + county selection */
  const filteredData = useMemo(() => {
    if (selectedCountyFips) return processedData.filter(d => d.fips === selectedCountyFips);
    if (selectedStateAbbr)  return processedData.filter(d => d.state_abbr === selectedStateAbbr);
    return processedData;
  }, [processedData, selectedStateAbbr, selectedCountyFips]);

  /* For diversity + targeting panels: use state scope when county selected for better context */
  const stateOrAllData = useMemo(() => {
    if (selectedStateAbbr) return processedData.filter(d => d.state_abbr === selectedStateAbbr);
    return processedData;
  }, [processedData, selectedStateAbbr]);

  /* Aggregate for circular barplot */
  const aggData = useMemo(() => aggregateEthnicity(filteredData), [filteredData]);

  /* Map handlers */
  const handleStateSelect = useCallback((abbr) => {
    setSelectedCountyFips(null);
    if (viewMode === "drilldown") setSelectedStateAbbr(abbr);
    else setSelectedStateAbbr(p => p === abbr ? null : abbr);
  }, [viewMode]);

  const handleCountySelect = useCallback((fips) => {
    setSelectedCountyFips(p => p === fips ? null : fips);
  }, []);

  const handleViewMode = useCallback((mode) => {
    setViewMode(mode);
    setSelectedCountyFips(null);
    if (mode === "states") setSelectedStateAbbr(null);
  }, []);

  const handleSearchCounty = useCallback((fips) => {
    setViewMode("counties");
    setSelectedCountyFips(fips);
    setSelectedStateAbbr(null);
  }, []);

  /* Derived labels */
  const selectedState  = selectedStateAbbr ? [...stateMapData.values()].find(r => r.state_abbr === selectedStateAbbr) : null;
  const selectedCounty = selectedCountyFips ? countyMapData.get(selectedCountyFips) : null;
  const selectionLabel = selectedCounty
    ? `${selectedCounty.county_name}, ${selectedCounty.state_abbr}`
    : selectedState?.state_name ?? null;

  const circularLabel = selectedCounty
    ? `${selectedCounty.county_name}`
    : selectedState?.state_name ?? "National";

  const ViewModeBtn = ({ mode }) => (
    <button onClick={() => handleViewMode(mode)} style={{
      fontSize: 10, padding: "3px 7px", borderRadius: 5,
      border: "1px solid var(--border)",
      background: viewMode === mode ? "var(--surface-2)" : "transparent",
      fontWeight: viewMode === mode ? 600 : 400,
      cursor: "pointer", color: "var(--text)",
    }}>
      {mode.charAt(0).toUpperCase() + mode.slice(1)}
    </button>
  );

  const hasData = processedData.length > 0;

  return (
    <Layout>
      {/* ── Header ── */}
      <div style={{
        height: 57, flexShrink: 0, padding: "0 24px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>ANALYTICS</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Ethnic Analysis</div>
        </div>
        {selectionLabel && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Filtered: <strong style={{ color: "var(--text)" }}>{selectionLabel}</strong>
            <button
              onClick={() => { setSelectedStateAbbr(null); setSelectedCountyFips(null); }}
              style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
            >✕</button>
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      <div style={{
        height: "calc(100vh - 57px)",
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 10, padding: 10,
        boxSizing: "border-box",
        overflow: "hidden",
      }}>

        {/* ── 1: Electoral Map ── */}
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <span className="card-title">Electoral Map</span>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <MapSearch
                viewMode={viewMode}
                stateMapData={stateMapData}
                countyMapData={countyMapData}
                onStateSelect={handleStateSelect}
                onCountySelect={handleSearchCounty}
              />
              {["states", "counties", "drilldown"].map(m => <ViewModeBtn key={m} mode={m} />)}
            </div>
          </div>
          <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
            {stateMapLoading
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--text-muted)" }}><Spinner /> Loading map…</div>
              : (
                <StateMap
                  viewMode={viewMode}
                  stateResults={stateMapData}
                  countyResults={countyMapData}
                  onStateSelect={handleStateSelect}
                  onCountySelect={handleCountySelect}
                  selectedStateAbbr={selectedStateAbbr}
                  selectedCountyFips={selectedCountyFips}
                />
              )}
          </div>
        </div>

        {/* ── 2: Circular Barplot ── */}
        <Panel
          title="Ethnic Composition"
          subtitle={`Electorate distribution · ${circularLabel}`}
          loading={ethLoading}
        >
          {hasData
            ? <CircularBarplot aggData={aggData} label={circularLabel} />
            : <EmptyState message="Load election data to display" />}
        </Panel>

        {/* ── 3: Dominance Segmentation ── */}
        <Panel
          title="Dominance Segmentation"
          subtitle={selectedCountyFips ? "County ethnic breakdown" : "Counties by dominant ethnicity"}
          loading={ethLoading}
        >
          {hasData
            ? <DominanceSegmentation data={filteredData} selectedCountyFips={selectedCountyFips} />
            : <EmptyState message="Load election data to display" />}
        </Panel>

        {/* ── 4: Diversity Index Ranking ── */}
        <Panel
          title="Diversity Index Ranking"
          subtitle={selectedStateAbbr ? `${selectedState?.state_name ?? selectedStateAbbr} counties` : "All counties - Herfindahl diversity"}
          loading={ethLoading}
        >
          {hasData
            ? <DiversityRanking data={stateOrAllData} selectedCountyFips={selectedCountyFips} />
            : <EmptyState message="Load election data to display" />}
        </Panel>

        {/* ── 5: Concentration Scatter ── */}
        <Panel
          title="Concentration Scatter"
          subtitle="% White vs minority group share"
          loading={ethLoading}
        >
          {hasData
            ? <ConcentrationScatter data={filteredData.length > 1 ? filteredData : processedData} selectedCountyFips={selectedCountyFips} />
            : <EmptyState message="Load election data to display" />}
        </Panel>

        {/* ── 6: Targeting Opportunity Ranking ── */}
        <Panel
          title="Targeting Opportunity"
          subtitle={selectedCountyFips ? "All groups - target score for this county" : "Top counties for ethnic outreach"}
          loading={ethLoading}
        >
          {hasData
            ? <TargetingRanking data={stateOrAllData} selectedCountyFips={selectedCountyFips} />
            : <EmptyState message="Load election data to display" />}
        </Panel>

      </div>
    </Layout>
  );
}
