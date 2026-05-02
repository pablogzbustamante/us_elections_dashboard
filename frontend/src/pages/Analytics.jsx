import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell,
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
const ABBR_TO_FIPS = {
  AL:"01",AK:"02",AZ:"04",AR:"05",CA:"06",CO:"08",CT:"09",DE:"10",DC:"11",
  FL:"12",GA:"13",HI:"15",ID:"16",IL:"17",IN:"18",IA:"19",KS:"20",KY:"21",
  LA:"22",ME:"23",MD:"24",MA:"25",MI:"26",MN:"27",MS:"28",MO:"29",MT:"30",
  NE:"31",NV:"32",NH:"33",NJ:"34",NM:"35",NY:"36",NC:"37",ND:"38",OH:"39",
  OK:"40",OR:"41",PA:"42",RI:"44",SC:"45",SD:"46",TN:"47",TX:"48",UT:"49",
  VT:"50",VA:"51",WA:"53",WV:"54",WI:"55",WY:"56",
};

/* ══════════════════════════════════════════════════════════════════════
   Helper functions
══════════════════════════════════════════════════════════════════════ */
const isRep = (party) => String(party ?? "").toUpperCase().startsWith("REP");

const voteShade = (trumpPct) => {
  const isR = trumpPct >= 50;
  const intensity = Math.min(Math.abs(trumpPct - 50) / 50, 1);
  return { fill: isR ? "#E5342A" : "#3B82F6", fillOpacity: 0.15 + intensity * 0.75 };
};

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? null : num / denom;
}


function fmtNum(n) {
  if (n == null || isNaN(n)) return "N/A";
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function computeOpportunityScore(marginPct, totalVotes, allVotes) {
  const maxV = Math.max(...allVotes, 1);
  const invMargin = Math.max(0, 1 - Math.abs(marginPct ?? 50) / 50);
  const voteScore = (totalVotes ?? 0) / maxV;
  return Math.round((0.5 * invMargin + 0.5 * voteScore) * 100);
}

function computeAction(oppScore, marginPct, party) {
  if (oppScore >= 70 && Math.abs(marginPct ?? 50) < 15) return "Invest";
  if (isRep(party) && oppScore >= 55) return "Defend";
  if (oppScore >= 40) return "Monitor";
  return "Low Priority";
}

function corrColor(r) {
  if (r == null) return "#F3F4F6";
  if (r > 0) return `rgba(229,52,42,${0.1 + Math.min(r, 1) * 0.75})`;
  return `rgba(59,130,246,${0.1 + Math.min(Math.abs(r), 1) * 0.75})`;
}

/* ══════════════════════════════════════════════════════════════════════
   UI primitives
══════════════════════════════════════════════════════════════════════ */
function HoverTip({ style: badgeStyle, children, tip }) {
  const [pos, setPos] = useState(null);

  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
    >
      <span style={{ ...badgeStyle, cursor: "help" }}>{children}</span>
      {pos && (
        <div style={{
          position: "fixed",
          left: pos.x + 14,
          top: pos.y - 10,
          zIndex: 2000, pointerEvents: "none",
          background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8,
          padding: "9px 13px", fontSize: 12, boxShadow: "0 6px 20px rgba(0,0,0,.13)",
          lineHeight: 1.55, maxWidth: 230, whiteSpace: "normal",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: badgeStyle?.color }}>{children}</div>
          <div style={{ color: "#374151" }}>{tip}</div>
        </div>
      )}
    </span>
  );
}

function TipBox({ children }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8,
      padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,.08)", lineHeight: 1.6,
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

function EmptyState({ message }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
      {message}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Map search bar
══════════════════════════════════════════════════════════════════════ */
const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

function MapSearch({ viewMode, stateMapData, countyMapData, onStateSelect, onCountySelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const mode = viewMode === "states" ? "state" : "county";

  useEffect(() => { setQuery(""); setOpen(false); }, [viewMode]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    if (mode === "state") {
      return [...stateMapData.values()]
        .filter((r) => r.state_name?.toLowerCase().includes(q) || r.state_abbr?.toLowerCase().includes(q))
        .slice(0, 8);
    }
    return [...countyMapData.values()]
      .filter((r) => r.county_name?.toLowerCase().includes(q) || r.state_abbr?.toLowerCase().includes(q))
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
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={mode === "state" ? "Search states…" : "Search counties…"}
          style={{ border: "none", outline: "none", background: "transparent", padding: "5px 7px", fontSize: 12, width: 140, color: "var(--text)" }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }}
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: "0 7px", color: "var(--text-muted)", fontSize: 16, lineHeight: 1 }}>×</button>
        )}
      </div>
      {open && query && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 210,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.13)", zIndex: 1000, overflow: "hidden",
        }}>
          {results.map((item) => (
            <div
              key={mode === "state" ? item.state_abbr : item.fips}
              onClick={() => handleSelect(item)}
              style={{ padding: "8px 13px", cursor: "pointer", fontSize: 12.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
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
   Column 1 Row 2 - Dynamic Variable Scatterplot (CorrelationChart)
══════════════════════════════════════════════════════════════════════ */
function CorrelationChart({ selectedElectionId, stateFips, countyMapData, stateMapData }) {
  const [indicators, setIndicators] = useState([]);
  const [selIndicator, setSelIndicator] = useState("");
  const [corrData, setCorrData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/analytics/indicators")
      .then((r) => r.json())
      .then((data) => { setIndicators(data); if (data.length) setSelIndicator(data[0].indicator_code); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selIndicator || !selectedElectionId) return;
    setLoading(true);
    analyticsService.getCorrelation(selIndicator, selectedElectionId)
      .then(setCorrData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selIndicator, selectedElectionId]);

  const scatterData = useMemo(() => {
    const allRows = corrData?.data ?? [];
    if (stateFips) {
      return allRows
        .filter((d) => String(d.fips).padStart(5, "0").startsWith(stateFips))
        .map((d) => {
          const fips5 = String(d.fips).padStart(5, "0");
          const county = countyMapData.get(fips5);
          const rep = isRep(county?.winner_party);
          return {
            metric_value: Number(d.metric_value),
            marginNumber: (rep ? 1 : -1) * Math.abs(Number(d.margin_pct)) / 100,
            label: county ? `${county.county_name}, ${county.state_abbr}` : fips5,
            fips: fips5,
          };
        });
    }
    const byState = {};
    allRows.forEach((d) => {
      const sf = String(d.fips).padStart(5, "0").slice(0, 2);
      if (!byState[sf]) byState[sf] = [];
      byState[sf].push(Number(d.metric_value));
    });
    return Object.entries(byState).map(([sf, vals]) => {
      const sr = stateMapData.get(sf);
      if (!sr) return null;
      const avgMetric = vals.reduce((s, v) => s + v, 0) / vals.length;
      const rep = isRep(sr.winner_party);
      return {
        metric_value: avgMetric,
        marginNumber: (rep ? 1 : -1) * Math.abs(Number(sr.margin_pct)) / 100,
        label: sr.state_name,
        fips: sf,
      };
    }).filter(Boolean);
  }, [corrData, stateFips, countyMapData, stateMapData]);

  const corrVal = corrData?.correlation;
  const indicatorName = indicators.find((i) => i.indicator_code === selIndicator)?.indicator_name ?? selIndicator;

  const CorrTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const isR = d.marginNumber >= 0;
    return (
      <TipBox>
        <div style={{ fontWeight: 600 }}>{d.label}</div>
        <div>Indicator: <b>{Number(d.metric_value).toFixed(2)}</b></div>
        <div>Margin: <b style={{ color: isR ? "#E5342A" : "#3B82F6" }}>{isR ? "R" : "D"} {Math.abs(d.marginNumber).toFixed(3)}</b></div>
      </TipBox>
    );
  };

  const Dot = ({ cx, cy, payload }) => {
    const { fill, fillOpacity } = voteShade(
      payload.marginNumber >= 0
        ? 50 + Math.abs(payload.marginNumber) * 50
        : 50 - Math.abs(payload.marginNumber) * 50
    );
    return <circle cx={cx} cy={cy} r={3} fill={fill} fillOpacity={fillOpacity} stroke="none" />;
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, marginBottom: 6 }}>
        <select
          className="election-select"
          style={{ flex: 1, fontSize: 11 }}
          value={selIndicator}
          onChange={(e) => setSelIndicator(e.target.value)}
        >
          {indicators.map((ind) => (
            <option key={ind.indicator_code} value={ind.indicator_code}>
              [{ind.category}] {ind.indicator_name}
            </option>
          ))}
        </select>
        {corrVal != null && (
          <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", color: "var(--text-muted)" }}>
            r = {corrVal.toFixed(3)}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {loading
          ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--text-muted)" }}><Spinner /></div>
          : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="metric_value" name="Indicator" type="number" domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => Number(v) < 2 ? `${(Number(v) * 100).toFixed(0)}%` : `${Number(v).toFixed(1)}%`}
                  label={{ value: indicatorName || "Indicator", position: "insideBottom", offset: -14, fontSize: 11, fill: "#9CA3AF" }}
                />
                <YAxis
                  dataKey="marginNumber" name="Margin Number" type="number" domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v.toFixed(2)}
                  label={{ value: "Margin (R+/D−)", angle: -90, position: "insideLeft", offset: 12, fontSize: 11, fill: "#9CA3AF" }}
                />
                <Tooltip content={<CorrTip />} cursor={false} />
                <ReferenceLine y={0} stroke="#D1D5DB" strokeDasharray="4 4" />
                <Scatter data={scatterData} shape={<Dot />} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Column 2 Row 1 - Margin vs Turnout Scatter
══════════════════════════════════════════════════════════════════════ */
function MarginTurnoutScatter({ countyMapData, stateMapData, stateFips, selectionFips }) {
  const rows = useMemo(() => {
    if (stateFips) {
      return [...countyMapData.values()]
        .filter((c) => c.fips?.startsWith(stateFips))
        .filter((c) => c.total_votes > 0 && c.margin_pct != null);
    }
    return [...stateMapData.values()]
      .filter((s) => s.total_votes > 0 && s.margin_pct != null);
  }, [countyMapData, stateMapData, stateFips]);

  const data = useMemo(() => {
    const allVotes = rows.map((r) => r.total_votes ?? 0);
    const maxV = Math.max(...allVotes, 1);
    return rows.map((r) => {
      const rep = isRep(r.winner_party);
      const signedMargin = (rep ? 1 : -1) * Math.abs(Number(r.margin_pct));
      const radius = 3 + ((r.total_votes ?? 0) / maxV) * 9;
      return {
        x: signedMargin,
        y: r.total_votes ?? 0,
        name: r.county_name ?? r.state_name ?? "",
        state: r.state_abbr ?? "",
        party: r.winner_party,
        margin_pct: r.margin_pct,
        winner_2020: r.winner_2020,
        comp: r.competitiveness_score,
        r: Math.max(2, Math.round(radius)),
        fips: r.fips ?? r.state_fips,
        highlighted: selectionFips ? (r.fips ?? r.state_fips) === selectionFips : false,
      };
    });
  }, [rows, selectionFips]);

  if (!data.length) return <EmptyState message="No data available" />;

  const MTTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const rep = isRep(d.party);
    return (
      <TipBox>
        <div style={{ fontWeight: 600 }}>{d.name}{d.state ? `, ${d.state}` : ""}</div>
        <div>Winner: <b style={{ color: rep ? "#E5342A" : "#3B82F6" }}>{rep ? "Republican" : "Democrat"}</b></div>
        <div>Margin: <b>{Math.abs(Number(d.margin_pct)).toFixed(1)}%</b></div>
        <div>Total Votes: <b>{fmtNum(d.y)}</b></div>
        {d.winner_2020 && <div>2020 Winner: <b>{d.winner_2020}</b></div>}
        {d.comp != null && <div>Competitiveness: <b>{Number(d.comp).toFixed(2)}</b></div>}
      </TipBox>
    );
  };

  const MTDot = ({ cx, cy, payload }) => {
    const rep = isRep(payload.party);
    const fill = rep ? "#E5342A" : "#3B82F6";
    const opacity = payload.highlighted ? 1 : 0.55;
    const stroke = payload.highlighted ? (rep ? "#7f1d1d" : "#1e3a8a") : "none";
    return <circle cx={cx} cy={cy} r={payload.r} fill={fill} fillOpacity={opacity} stroke={stroke} strokeWidth={1.5} />;
  };

  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis
            dataKey="x" name="Margin" type="number" domain={["auto", "auto"]}
            tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `${v > 0 ? "R+" : "D+"}${Math.abs(v).toFixed(0)}%`}
            label={{ value: "Electoral Margin (R+ / D−)", position: "insideBottom", offset: -14, fontSize: 11, fill: "#9CA3AF" }}
          />
          <YAxis
            dataKey="y" name="Total Votes" type="number" domain={["auto", "auto"]}
            tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
            tickFormatter={fmtNum}
            label={{ value: "Total Votes", angle: -90, position: "insideLeft", offset: 12, fontSize: 11, fill: "#9CA3AF" }}
          />
          <Tooltip content={<MTTip />} cursor={false} />
          <ReferenceLine x={0} stroke="#D1D5DB" strokeDasharray="4 4" />
          <Scatter data={data} shape={<MTDot />} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Column 3 Row 1 - Strategic Priority Ranking
══════════════════════════════════════════════════════════════════════ */
const ACTION_STYLE = {
  "Invest":       { background: "#DCFCE7", color: "#166534" },
  "Defend":       { background: "#FEF9C3", color: "#854D0E" },
  "Monitor":      { background: "#DBEAFE", color: "#1E40AF" },
  "Low Priority": { background: "#F3F4F6", color: "#6B7280" },
};

const ACTION_DESC = {
  "Invest":       "High opportunity - close race with significant turnout. Allocating resources here can flip the outcome.",
  "Defend":       "Current party leads but the area carries meaningful electoral weight. Resources needed to hold the margin.",
  "Monitor":      "Moderate opportunity. Worth tracking for shifts in competitiveness before committing resources.",
  "Low Priority": "Low electoral impact - uncompetitive margin, low turnout, or both. Not a priority for resource allocation.",
};

function StrategicRanking({ countyMapData, stateMapData, stateFips, topDriver, onSelect, selectionFips }) {
  const [sortKey, setSortKey] = useState("opp");
  const [sortDir, setSortDir] = useState(-1);

  const rows = useMemo(() => {
    const source = stateFips
      ? [...countyMapData.values()].filter((c) => c.fips?.startsWith(stateFips))
      : [...stateMapData.values()];

    const allVotes = source.map((r) => r.total_votes ?? 0);

    return source
      .filter((r) => r.total_votes > 0 && r.margin_pct != null)
      .map((r) => {
        const opp = computeOpportunityScore(r.margin_pct, r.total_votes, allVotes);
        const action = computeAction(opp, r.margin_pct, r.winner_party);
        const name = r.county_name ?? r.state_name ?? "";
        const state = r.state_abbr ?? "";
        return {
          name, state, party: r.winner_party,
          margin: Number(r.margin_pct),
          votes: r.total_votes ?? 0,
          opp,
          action,
          driver: topDriver ?? "Mixed factors",
          winner_2020: r.winner_2020 ?? null,
          fips: r.fips ?? r.state_fips,
        };
      });
  }, [countyMapData, stateMapData, stateFips, topDriver]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => sortDir * (a[sortKey] > b[sortKey] ? 1 : -1));
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (key === sortKey) setSortDir((d) => -d);
    else { setSortKey(key); setSortDir(-1); }
  };

  const Th = ({ k, children }) => (
    <th
      onClick={() => toggleSort(k)}
      style={{
        padding: "5px 8px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)",
        textAlign: "left", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
        borderBottom: "1px solid var(--border)", position: "sticky", top: 0,
        background: "var(--surface)",
      }}
    >
      {children} {sortKey === k ? (sortDir > 0 ? "↑" : "↓") : ""}
    </th>
  );

  if (!sorted.length) return <EmptyState message="No data available" />;

  return (
    <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            <Th k="opp">#</Th>
            <Th k="name">Location</Th>
            <Th k="margin">Margin</Th>
            <Th k="votes">Votes</Th>
            <Th k="action">Action</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 80).map((row, i) => {
            const rep = isRep(row.party);
            const isTop5 = i < 5;
            const isSelected = row.fips === selectionFips;
            return (
              <tr
                key={row.fips ?? i}
                onClick={() => onSelect?.(row)}
                style={{
                  background: isSelected ? "var(--surface-2)" : "transparent",
                  borderLeft: isTop5 ? "2px solid var(--primary, #6366F1)" : "2px solid transparent",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? "var(--surface-2)" : "transparent"; }}
              >
                <td style={{ padding: "5px 8px", color: "var(--text-muted)", fontWeight: isTop5 ? 700 : 400 }}>{i + 1}</td>
                <td style={{ padding: "5px 8px", fontWeight: 500, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.name}{row.state && !stateFips ? `, ${row.state}` : ""}
                </td>
                <td style={{ padding: "5px 8px", color: rep ? "#E5342A" : "#3B82F6", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {rep ? "R" : "D"}+{row.margin.toFixed(1)}%
                </td>
                <td style={{ padding: "5px 8px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtNum(row.votes)}</td>
                <td style={{ padding: "5px 8px" }}>
                  <HoverTip
                    style={{ ...ACTION_STYLE[row.action], borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}
                    tip={ACTION_DESC[row.action]}
                  >{row.action}</HoverTip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Column 2 Row 2 - Demographic Heatmap
══════════════════════════════════════════════════════════════════════ */
const HEATMAP_COLS = [
  { label: "Margin",     key: "r_margin" },
  { label: "Competit.",  key: "r_comp"   },
  { label: "Votes",      key: "r_votes"  },
];

function DemographicHeatmap({ allCorrelations, countyMapData, stateFips, loading }) {
  const [sortKey, setSortKey] = useState(null);   // null = grouped by category
  const [sortDir, setSortDir] = useState(-1);      // -1 = desc, 1 = asc

  const matrix = useMemo(() => {
    if (!allCorrelations.length) return [];
    return allCorrelations.map((ind) => {
      const rows = stateFips
        ? ind.data.filter((d) => String(d.fips).padStart(5, "0").startsWith(stateFips))
        : ind.data;
      if (!rows.length) return null;

      const mv     = rows.map((d) => Number(d.metric_value));
      const margin = rows.map((d) => Number(d.margin_pct));
      const comp   = rows.map((d) => Number(d.competitiveness_score ?? 0));

      const votePairs = rows
        .map((d) => {
          const c = countyMapData.get(String(d.fips).padStart(5, "0"));
          return c ? [Number(d.metric_value), Number(c.total_votes)] : null;
        })
        .filter(Boolean);

      return {
        name:     ind.indicator_name,
        category: ind.category,
        r_margin: pearson(mv, margin),
        r_comp:   pearson(mv, comp),
        r_votes:  votePairs.length > 3 ? pearson(votePairs.map((p) => p[0]), votePairs.map((p) => p[1])) : null,
      };
    }).filter(Boolean);
  }, [allCorrelations, countyMapData, stateFips]);

  /* Deduplicate by name - keep the entry with the highest |r_margin| */
  const deduped = useMemo(() => {
    const seen = new Map();
    matrix.forEach((row) => {
      const existing = seen.get(row.name);
      if (!existing || Math.abs(row.r_margin ?? 0) > Math.abs(existing.r_margin ?? 0)) {
        seen.set(row.name, row);
      }
    });
    return [...seen.values()];
  }, [matrix]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => -d);
    } else {
      setSortKey(key);
      setSortDir(-1);
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return null;
    return [...deduped].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return sortDir * (bv - av);
    });
  }, [deduped, sortKey, sortDir]);

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-muted)" }}><Spinner /></div>;
  if (!deduped.length) return <EmptyState message="Load election data to display heatmap" />;

  const ColHeader = ({ col }) => {
    const active = sortKey === col.key;
    return (
      <div
        onClick={() => toggleSort(col.key)}
        style={{
          fontSize: 9, textAlign: "center", lineHeight: 1.2, fontWeight: 600,
          cursor: "pointer", userSelect: "none",
          color: active ? "var(--text)" : "var(--text-muted)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
        }}
      >
        {col.label}
        <span style={{ fontSize: 8, opacity: active ? 1 : 0.4 }}>
          {active ? (sortDir < 0 ? "↓" : "↑") : "↕"}
        </span>
      </div>
    );
  };

  const renderRow = (row) => (
    <div
      key={row.name}
      style={{ display: "grid", gridTemplateColumns: "1fr 48px 48px 48px", gap: 3, marginBottom: 2, alignItems: "center" }}
    >
      <div style={{ fontSize: 10, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: 2 }} title={row.name}>
        {row.name.length > 24 ? row.name.slice(0, 24) + "…" : row.name}
      </div>
      {HEATMAP_COLS.map(({ key }) => {
        const r = row[key];
        return (
          <div
            key={key}
            title={r != null ? `r = ${r.toFixed(3)}` : "Insufficient data"}
            style={{
              height: 18, borderRadius: 3,
              background: corrColor(r),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 8, color: "rgba(0,0,0,0.55)", fontWeight: 600,
            }}
          >
            {r != null ? r.toFixed(2) : "–"}
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 48px 48px 48px", gap: 3, marginBottom: 6, paddingRight: 4 }}>
        <div
          style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, cursor: sortKey ? "pointer" : "default" }}
          onClick={() => { if (sortKey) setSortKey(null); }}
          title={sortKey ? "Click to reset grouping" : ""}
        >
          Indicator {sortKey ? <span style={{ fontSize: 8, opacity: 0.5 }}>↺</span> : ""}
        </div>
        {HEATMAP_COLS.map((col) => <ColHeader key={col.key} col={col} />)}
      </div>

      {/* Rows: sorted flat or grouped by category */}
      {sorted
        ? sorted.map(renderRow)
        : (() => {
            const groups = {};
            deduped.forEach((row) => {
              const cat = row.category ?? "Other";
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push(row);
            });
            return Object.entries(groups).map(([cat, rows]) => (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3, paddingLeft: 2 }}>
                  {cat}
                </div>
                {rows.map(renderRow)}
              </div>
            ));
          })()
      }

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, paddingLeft: 2 }}>
        <div style={{ fontSize: 9, color: "var(--text-muted)" }}>−1</div>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: "linear-gradient(to right, rgba(59,130,246,0.85), #f9fafb, rgba(229,52,42,0.85))" }} />
        <div style={{ fontSize: 9, color: "var(--text-muted)" }}>+1</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Column 3 Row 2 - Driver Importance Bar Chart
══════════════════════════════════════════════════════════════════════ */
function DriverImportanceChart({ allCorrelations, stateFips, countyMapData, loading }) {
  const chartData = useMemo(() => {
    return allCorrelations
      .map((ind) => {
        let r = ind.r;
        if (stateFips) {
          const filtered = ind.data.filter((d) => String(d.fips).padStart(5, "0").startsWith(stateFips));
          if (filtered.length > 3) {
            r = pearson(
              filtered.map((d) => Number(d.metric_value)),
              filtered.map((d) => Number(d.margin_pct))
            );
          } else {
            r = null;
          }
        }
        if (r == null) return null;
        const shortName = ind.indicator_name.length > 28 ? ind.indicator_name.slice(0, 28) + "…" : ind.indicator_name;
        return { name: shortName, fullName: ind.indicator_name, r, absR: Math.abs(r) };
      })
      .filter(Boolean)
      .sort((a, b) => b.absR - a.absR)
      .slice(0, 10);
  }, [allCorrelations, stateFips, countyMapData]);

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-muted)" }}><Spinner /></div>;
  if (!chartData.length) return <EmptyState message="Load election data to display drivers" />;

  const DriverTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const dir = d.r > 0 ? "positive" : "negative";
    const strength = d.absR >= 0.6 ? "strong" : d.absR >= 0.3 ? "moderate" : "weak";
    return (
      <TipBox>
        <div style={{ fontWeight: 600 }}>{d.fullName}</div>
        <div>|r| = <b>{d.absR.toFixed(3)}</b></div>
        <div>Direction: <b>{dir}</b></div>
        <div style={{ color: "var(--text-muted)" }}>{strength} relationship with margin</div>
      </TipBox>
    );
  };

  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 48, left: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
          <XAxis
            type="number" domain={[0, 1]}
            tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
            tickFormatter={(v) => v.toFixed(1)}
            label={{ value: "Importance (|r|)", position: "insideBottom", offset: -2, fontSize: 10, fill: "#9CA3AF" }}
          />
          <YAxis
            type="category" dataKey="name" width={130}
            tick={{ fontSize: 9, fill: "#374151" }} axisLine={false} tickLine={false}
          />
          <Tooltip content={<DriverTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
          <Bar dataKey="absR" radius={[0, 3, 3, 0]} maxBarSize={14}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.r > 0 ? "#E5342A" : "#3B82F6"} fillOpacity={0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Main Analytics page
══════════════════════════════════════════════════════════════════════ */
export default function Analytics() {
  const { selectedElectionId, loadElections } = useElectionsStore();

  const [stateMapData,    setStateMapData]    = useState(new Map());
  const [countyMapData,   setCountyMapData]   = useState(new Map());
  const [stateMapLoading, setStateMapLoading] = useState(false);
  const [allCorrelations, setAllCorrelations] = useState([]);
  const [corrLoading,     setCorrLoading]     = useState(false);

  const [viewMode,           setViewMode]           = useState("states");
  const [selectedStateAbbr,  setSelectedStateAbbr]  = useState(null);
  const [selectedCountyFips, setSelectedCountyFips] = useState(null);

  useEffect(() => { loadElections(); }, [loadElections]);

  /* Load map data on election change */
  useEffect(() => {
    if (!selectedElectionId) return;
    setStateMapLoading(true);
    dashboardService.getStateMapData(selectedElectionId)
      .then((rows) => setStateMapData(new Map(rows.map((r) => [r.state_fips, r]))))
      .catch(console.error)
      .finally(() => setStateMapLoading(false));
    dashboardService.getMapData(selectedElectionId)
      .then((rows) => setCountyMapData(new Map(rows.map((r) => [r.fips, r]))))
      .catch(console.error);
    setSelectedStateAbbr(null);
    setSelectedCountyFips(null);
  }, [selectedElectionId]);

  /* Load all indicator correlations for heatmap + driver chart */
  useEffect(() => {
    if (!selectedElectionId) return;
    setCorrLoading(true);
    fetch("/api/analytics/indicators")
      .then((r) => r.json())
      .then((indicators) =>
        Promise.all(
          indicators.map((ind) =>
            analyticsService.getCorrelation(ind.indicator_code, selectedElectionId)
              .then((res) => ({ ...ind, r: res.correlation, data: res.data }))
              .catch(() => ({ ...ind, r: null, data: [] }))
          )
        )
      )
      .then((results) => setAllCorrelations(results.filter((r) => r.r != null)))
      .catch(console.error)
      .finally(() => setCorrLoading(false));
  }, [selectedElectionId]);

  const handleStateSelect = useCallback((abbr) => {
    setSelectedCountyFips(null);
    if (viewMode === "drilldown") {
      setSelectedStateAbbr(abbr);
    } else {
      setSelectedStateAbbr((prev) => (prev === abbr ? null : abbr));
    }
  }, [viewMode]);

  const handleCountySelect = useCallback((fips) => {
    setSelectedCountyFips((prev) => (prev === fips ? null : fips));
  }, []);

  const handleViewMode = useCallback((mode) => {
    setViewMode(mode);
    setSelectedCountyFips(null);
    if (mode === "states") setSelectedStateAbbr(null);
  }, []);

  const handleSearchCountySelect = useCallback((fips) => {
    setViewMode("counties");
    setSelectedCountyFips(fips);
    setSelectedStateAbbr(null);
  }, []);

  /* Derived */
  const stateFips = selectedStateAbbr ? ABBR_TO_FIPS[selectedStateAbbr] : null;
  const selectedState = selectedStateAbbr
    ? [...stateMapData.values()].find((r) => r.state_abbr === selectedStateAbbr)
    : null;
  const selectedCounty = selectedCountyFips ? countyMapData.get(selectedCountyFips) : null;
  const selectionLabel = selectedCounty
    ? `${selectedCounty.county_name}, ${selectedCounty.state_abbr}`
    : selectedState?.state_name ?? null;

  const selectionFips = selectedCountyFips ?? (selectedStateAbbr ? stateFips : null);

  /* Top driver = indicator with highest |r| */
  const topDriver = useMemo(() => {
    if (!allCorrelations.length) return null;
    const top = allCorrelations.reduce((a, b) => (Math.abs(a.r) > Math.abs(b.r) ? a : b));
    return top?.indicator_name ?? null;
  }, [allCorrelations]);

  const handleRankingSelect = useCallback((row) => {
    if (stateFips) {
      setSelectedCountyFips((prev) => (prev === row.fips ? null : row.fips));
    } else {
      handleStateSelect(row.state);
    }
  }, [stateFips, handleStateSelect]);

  return (
    <Layout>
      {/* Page header */}
      <div style={{
        height: 57, flexShrink: 0,
        padding: "0 24px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>ANALYTICS</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>General Analytics</div>
        </div>
      </div>

      {/* 3×2 grid */}
      <div style={{
        height: "calc(100vh - 57px)",
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 10,
        padding: 10,
        boxSizing: "border-box",
        overflow: "hidden",
      }}>

        {/* ── Col 1 Row 1: Electoral Map ── */}
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <span className="card-title">Electoral Map</span>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <MapSearch
                viewMode={viewMode}
                stateMapData={stateMapData}
                countyMapData={countyMapData}
                onStateSelect={handleStateSelect}
                onCountySelect={handleSearchCountySelect}
              />
              {["states", "counties", "drilldown"].map((m) => (
                <button
                  key={m}
                  onClick={() => handleViewMode(m)}
                  style={{
                    fontSize: 10, padding: "3px 7px", borderRadius: 5,
                    border: "1px solid var(--border)",
                    background: viewMode === m ? "var(--surface-2)" : "transparent",
                    fontWeight: viewMode === m ? 600 : 400,
                    cursor: "pointer", color: "var(--text)",
                  }}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
            {stateMapLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--text-muted)" }}>
                <Spinner /> Loading map…
              </div>
            ) : (
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

          {selectionLabel && (
            <div style={{ padding: "6px 12px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
              Selected: <strong style={{ color: "var(--text)" }}>{selectionLabel}</strong>
              <button
                onClick={() => { setSelectedStateAbbr(null); setSelectedCountyFips(null); }}
                style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
              >
                ✕ clear
              </button>
            </div>
          )}
        </div>

        {/* ── Col 2 Row 1: Margin vs Turnout ── */}
        <Panel title="Margin vs Turnout" subtitle={selectionLabel ?? (stateFips ? "Counties" : "By state")}>
          <MarginTurnoutScatter
            countyMapData={countyMapData}
            stateMapData={stateMapData}
            stateFips={stateFips}
            selectionFips={selectionFips}
          />
        </Panel>

        {/* ── Col 3 Row 1: Strategic Priority Ranking ── */}
        <Panel
          title="Strategic Priority Ranking"
          subtitle={topDriver ? `Top driver: ${topDriver}` : (selectionLabel ?? (stateFips ? "Counties" : "By state"))}
          scrollable
        >
          <StrategicRanking
            countyMapData={countyMapData}
            stateMapData={stateMapData}
            stateFips={stateFips}
            topDriver={topDriver}
            onSelect={handleRankingSelect}
            selectionFips={selectionFips}
          />
        </Panel>

        {/* ── Col 1 Row 2: Variable Relationship Analysis ── */}
        <Panel title="Variable Relationship Analysis" subtitle={selectionLabel ?? (stateFips ? "Counties" : "By state")}>
          <CorrelationChart
            selectedElectionId={selectedElectionId}
            stateFips={stateFips}
            countyMapData={countyMapData}
            stateMapData={stateMapData}
          />
        </Panel>

        {/* ── Col 2 Row 2: Demographic Heatmap ── */}
        <Panel title="Demographic Correlation Heatmap" subtitle={selectionLabel ?? (stateFips ? "Counties" : "National")} scrollable>
          <DemographicHeatmap
            allCorrelations={allCorrelations}
            countyMapData={countyMapData}
            stateFips={stateFips}
            loading={corrLoading}
          />
        </Panel>

        {/* ── Col 3 Row 2: Driver Importance ── */}
        <Panel title="Driver Importance" subtitle="Absolute correlation with electoral margin">
          <DriverImportanceChart
            allCorrelations={allCorrelations}
            stateFips={stateFips}
            countyMapData={countyMapData}
            loading={corrLoading}
          />
        </Panel>

      </div>
    </Layout>
  );
}
