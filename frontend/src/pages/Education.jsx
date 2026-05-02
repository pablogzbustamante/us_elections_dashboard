import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import Layout from "../components/layout/Layout";
import StateMap from "../components/charts/StateMap";
import Spinner from "../components/ui/Spinner";
import { dashboardService } from "../services/dashboardService";
import { analyticsService } from "../services/analyticsService";
import useElectionsStore from "../store/useElectionsStore";

/* ══════════════════════════════════════════════════════════════════════
   Constants
══════════════════════════════════════════════════════════════════════ */
const COUNTIES_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";
const STATES_URL   = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const ABBR_TO_FIPS = {
  AL:"01",AK:"02",AZ:"04",AR:"05",CA:"06",CO:"08",CT:"09",DE:"10",DC:"11",
  FL:"12",GA:"13",HI:"15",ID:"16",IL:"17",IN:"18",IA:"19",KS:"20",KY:"21",
  LA:"22",ME:"23",MD:"24",MA:"25",MI:"26",MN:"27",MS:"28",MO:"29",MT:"30",
  NE:"31",NV:"32",NH:"33",NJ:"34",NM:"35",NY:"36",NC:"37",ND:"38",OH:"39",
  OK:"40",OR:"41",PA:"42",RI:"44",SC:"45",SD:"46",TN:"47",TX:"48",UT:"49",
  VT:"50",VA:"51",WA:"53",WV:"54",WI:"55",WY:"56",
};

const FIPS_TO_ABBR = Object.fromEntries(
  Object.entries(ABBR_TO_FIPS).map(([abbr, fips]) => [fips, abbr])
);

const STATE_DRILL_CONFIG = {
  AL:{center:[-86.8,32.8],scale:4000},AK:{center:[-153.0,64.2],scale:700},
  AZ:{center:[-111.7,34.3],scale:3500},AR:{center:[-92.4,34.9],scale:4200},
  CA:{center:[-119.5,37.3],scale:2500},CO:{center:[-105.5,39.0],scale:3800},
  CT:{center:[-72.7,41.6],scale:14000},DE:{center:[-75.5,39.0],scale:18000},
  FL:{center:[-83.0,28.0],scale:3200},GA:{center:[-83.4,32.6],scale:3500},
  HI:{center:[-157.8,20.3],scale:3500},ID:{center:[-114.5,44.4],scale:2800},
  IL:{center:[-89.2,40.0],scale:3500},IN:{center:[-86.1,40.0],scale:4500},
  IA:{center:[-93.5,42.1],scale:4000},KS:{center:[-98.4,38.5],scale:3800},
  KY:{center:[-85.3,37.5],scale:4500},LA:{center:[-92.0,30.9],scale:4200},
  ME:{center:[-69.4,45.4],scale:4000},MD:{center:[-76.8,38.9],scale:7000},
  MA:{center:[-71.5,42.1],scale:8000},MI:{center:[-85.6,44.3],scale:3000},
  MN:{center:[-94.0,46.4],scale:3200},MS:{center:[-89.7,32.7],scale:4200},
  MO:{center:[-92.5,38.5],scale:3700},MT:{center:[-109.6,47.0],scale:2500},
  NE:{center:[-99.9,41.5],scale:3800},NV:{center:[-116.4,38.8],scale:3000},
  NH:{center:[-71.6,43.9],scale:6500},NJ:{center:[-74.5,40.1],scale:8500},
  NM:{center:[-106.1,34.4],scale:3200},NY:{center:[-75.5,42.9],scale:3800},
  NC:{center:[-79.4,35.5],scale:4200},ND:{center:[-100.5,47.5],scale:4200},
  OH:{center:[-82.8,40.3],scale:4500},OK:{center:[-97.5,35.5],scale:4000},
  OR:{center:[-120.6,44.0],scale:3200},PA:{center:[-77.2,41.0],scale:4500},
  RI:{center:[-71.5,41.6],scale:20000},SC:{center:[-81.0,33.8],scale:5000},
  SD:{center:[-100.3,44.5],scale:3800},TN:{center:[-86.4,35.8],scale:4500},
  TX:{center:[-99.3,31.5],scale:1900},UT:{center:[-111.1,39.3],scale:3500},
  VT:{center:[-72.7,44.1],scale:7000},VA:{center:[-78.5,37.5],scale:4500},
  WA:{center:[-120.5,47.4],scale:3500},WV:{center:[-80.5,38.6],scale:5500},
  WI:{center:[-89.6,44.5],scale:4000},WY:{center:[-107.5,43.0],scale:3500},
  DC:{center:[-77.0,38.9],scale:50000},
};

const STRATEGY_COLORS = {
  "High Priority":        "#EF4444",
  "Persuasion Secondary": "#F59E0B",
  "Low Priority":         "#60A5FA",
  "Ignore":               "#D1D5DB",
};

const QUAD_COLORS = {
  "Mass Persuasion":       "#EF4444",
  "High Complexity Voters":"#6366F1",
  "Low Turnout Risk":      "#F59E0B",
  "Niche Educated":        "#10B981",
};

const QUAD_DESC = {
  "Mass Persuasion":       "Simple, broad messaging",
  "High Complexity Voters":"Policy-driven campaigns",
  "Low Turnout Risk":      "GOTV mobilization focus",
  "Niche Educated":        "Targeted micro-campaigns",
};

const QUAD_MESSAGING = {
  "Mass Persuasion":       "Broad outreach, simple messaging",
  "High Complexity Voters":"Policy-focused, data-driven campaigns",
  "Low Turnout Risk":      "GOTV priority, mobilization focus",
  "Niche Educated":        "Targeted micro-campaigns, detailed policy",
};

const STRATEGY_REC = {
  "Mass Persuasion":       "Mass Messaging",
  "High Complexity Voters":"Policy / Segmented Messaging",
  "Low Turnout Risk":      "Turnout Strategy",
  "Niche Educated":        "Micro-Targeting",
};

/* ══════════════════════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════════════════════ */
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

/* K-means on (xKey, yKey), deterministic farthest-point init, returns segment name per row */
function kMeansSegment(data, xKey, yKey, k = 4, maxIter = 80) {
  const fallback = Object.keys(QUAD_COLORS);
  if (data.length < k) return data.map((_, i) => fallback[i % k]);

  const xs = data.map(d => d[xKey]);
  const ys = data.map(d => d[yKey]);
  const xMin = Math.min(...xs), xRange = (Math.max(...xs) - xMin) || 1;
  const yMin = Math.min(...ys), yRange = (Math.max(...ys) - yMin) || 1;
  const norm = data.map(d => [(d[xKey] - xMin) / xRange, (d[yKey] - yMin) / yRange]);

  const centers = [[...norm[Math.floor(norm.length / 4)]]];
  for (let c = 1; c < k; c++) {
    const dists = norm.map(p =>
      Math.min(...centers.map(ct => { const dx = p[0]-ct[0], dy = p[1]-ct[1]; return dx*dx+dy*dy; }))
    );
    centers.push([...norm[dists.indexOf(Math.max(...dists))]]);
  }

  let labels = new Array(norm.length).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < norm.length; i++) {
      let best = 0, bestD = Infinity;
      for (let j = 0; j < k; j++) {
        const dx = norm[i][0]-centers[j][0], dy = norm[i][1]-centers[j][1];
        const d = dx*dx + dy*dy;
        if (d < bestD) { bestD = d; best = j; }
      }
      if (labels[i] !== best) { changed = true; labels[i] = best; }
    }
    if (!changed) break;
    const sums = Array.from({length: k}, () => [0, 0, 0]);
    labels.forEach((lbl, i) => { sums[lbl][0] += norm[i][0]; sums[lbl][1] += norm[i][1]; sums[lbl][2]++; });
    sums.forEach((s, j) => { if (s[2] > 0) centers[j] = [s[0]/s[2], s[1]/s[2]]; });
  }

  // Bijective assignment: rank top-2 HS centroids (split by BA) and bottom-2 (split by BA).
  // Guarantees all 4 segment names are used regardless of centroid geometry.
  const actual = centers.map((c, i) => ({ hs: c[0]*xRange+xMin, ba: c[1]*yRange+yMin, i }));
  const byHS   = [...actual].sort((a, b) => b.hs - a.hs);
  const top2   = byHS.slice(0, 2).sort((a, b) => a.ba - b.ba); // high HS: low BA first
  const bot2   = byHS.slice(2, 4).sort((a, b) => a.ba - b.ba); // low HS: low BA first

  const nameMap = new Array(k);
  nameMap[top2[0].i] = "Mass Persuasion";        // high HS, low BA
  nameMap[top2[1].i] = "High Complexity Voters";  // high HS, high BA
  nameMap[bot2[0].i] = "Low Turnout Risk";        // low HS, low BA
  nameMap[bot2[1].i] = "Niche Educated";          // low HS, high BA

  return labels.map(l => nameMap[l]);
}

function scoreFill(score, maxScore) {
  const t = Math.min(Math.max(score / (maxScore || 1), 0), 1);
  return `rgb(${Math.round(245 - t*154)},${Math.round(243 - t*210)},${Math.round(255 - t*73)})`;
}

/* ══════════════════════════════════════════════════════════════════════
   UI primitives
══════════════════════════════════════════════════════════════════════ */
function TipBox({ children }) {
  return (
    <div style={{
      background:"#fff",border:"1px solid #E5E7EB",borderRadius:8,
      padding:"10px 14px",fontSize:12,boxShadow:"0 4px 12px rgba(0,0,0,.08)",lineHeight:1.6,
    }}>
      {children}
    </div>
  );
}

function Panel({ title, subtitle, children, loading, scrollable, headerRight }) {
  return (
    <div className="card" style={{ display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden" }}>
      <div className="card-header" style={{ flexShrink:0 }}>
        <div>
          <span className="card-title">{title}</span>
          {subtitle && <div style={{ fontSize:11,color:"var(--text-muted)",marginTop:1 }}>{subtitle}</div>}
        </div>
        {headerRight}
      </div>
      <div style={{
        flex:1,minHeight:0,padding:"0 12px 12px",
        display:"flex",flexDirection:"column",
        overflowY:scrollable?"auto":"hidden",
      }}>
        {loading
          ? <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:10,color:"var(--text-muted)" }}><Spinner /></div>
          : children}
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-muted)",fontSize:12 }}>
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
    <div ref={ref} style={{ position:"relative" }}>
      <div style={{
        display:"flex",alignItems:"center",
        background:"var(--surface-2)",border:"1px solid var(--border)",
        borderRadius:6,overflow:"hidden",
      }}>
        <span style={{ padding:"0 0 0 9px",color:"var(--text-muted)",display:"flex" }}><IconSearch /></span>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={mode === "state" ? "Search states…" : "Search counties…"}
          style={{ border:"none",outline:"none",background:"transparent",padding:"5px 7px",fontSize:12,width:130,color:"var(--text)" }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }}
            style={{ border:"none",background:"transparent",cursor:"pointer",padding:"0 7px",color:"var(--text-muted)",fontSize:16,lineHeight:1 }}>×</button>
        )}
      </div>
      {open && query && results.length > 0 && (
        <div style={{
          position:"absolute",top:"calc(100% + 6px)",right:0,minWidth:200,
          background:"var(--surface)",border:"1px solid var(--border)",
          borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.13)",zIndex:1000,overflow:"hidden",
        }}>
          {results.map(item => (
            <div
              key={mode === "state" ? item.state_abbr : item.fips}
              onClick={() => handleSelect(item)}
              style={{ padding:"8px 13px",cursor:"pointer",fontSize:12.5,display:"flex",justifyContent:"space-between",alignItems:"center" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontWeight:500 }}>{mode === "state" ? item.state_name : item.county_name}</span>
              <span style={{ fontSize:11,color:"var(--text-muted)" }}>{item.state_abbr}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TargetingMap
══════════════════════════════════════════════════════════════════════ */
const GEO_STYLE    = { default:{ outline:"none" },hover:{ outline:"none",cursor:"pointer" },pressed:{ outline:"none" } };
const BORDER_STYLE = { default:{ outline:"none" },hover:{ outline:"none" },pressed:{ outline:"none" } };

function TargetingMap({
  countyEduMap, stateEduMap,
  viewMode, selectedStateAbbr, selectedCountyFips,
  onStateSelect, onCountySelect,
  viewType, maxScore,
}) {
  const [tooltip, setTooltip] = useState(null);

  const isDrilledIn = viewMode === "drilldown" && !!selectedStateAbbr;
  const drillFips   = isDrilledIn ? (ABBR_TO_FIPS[selectedStateAbbr] ?? null) : null;

  const mapProps = isDrilledIn
    ? { projection:"geoMercator",  projectionConfig: STATE_DRILL_CONFIG[selectedStateAbbr] ?? { center:[-96,38],scale:900 } }
    : { projection:"geoAlbersUsa", projectionConfig:{ scale:860 } };

  const countyColor = useCallback((fips) => {
    const d = countyEduMap.get(fips);
    if (!d) return { fill:"#E5E7EB",fillOpacity:1 };
    if (viewType === "strategy") return { fill: STRATEGY_COLORS[d.strategy] || "#E5E7EB", fillOpacity:0.85 };
    return { fill: scoreFill(d.targeting_score, maxScore), fillOpacity:1 };
  }, [countyEduMap, viewType, maxScore]);

  const stateColor = useCallback((abbr) => {
    const d = stateEduMap.get(abbr);
    if (!d) return { fill:"#E5E7EB",fillOpacity:1 };
    if (viewType === "strategy") return { fill: STRATEGY_COLORS[d.strategy] || "#E5E7EB", fillOpacity:0.85 };
    return { fill: scoreFill(d.targeting_score, maxScore), fillOpacity:1 };
  }, [stateEduMap, viewType, maxScore]);

  const showTip = useCallback((e, d) => setTooltip({ x:e.clientX,y:e.clientY,d }), []);
  const moveTip = useCallback((e) => setTooltip(t => t ? { ...t,x:e.clientX,y:e.clientY } : null), []);
  const hideTip = useCallback(() => setTooltip(null), []);

  const renderStates = useCallback(({ geographies }) =>
    geographies.map(geo => {
      const sf   = String(geo.id).padStart(2,"0");
      const abbr = FIPS_TO_ABBR[sf];
      const d    = abbr ? stateEduMap.get(abbr) : null;
      const { fill, fillOpacity } = abbr ? stateColor(abbr) : { fill:"#E5E7EB",fillOpacity:1 };
      const isSelected = abbr === selectedStateAbbr;
      return (
        <Geography key={geo.rsmKey} geography={geo}
          fill={fill} fillOpacity={fillOpacity}
          stroke={isSelected ? "#111827" : "#fff"} strokeWidth={isSelected ? 2.2 : 0.8}
          style={GEO_STYLE}
          onMouseEnter={e => d && showTip(e,{ ...d,_isState:true })}
          onMouseLeave={hideTip}
          onClick={() => abbr && onStateSelect?.(abbr)}
        />
      );
    }), [stateEduMap, stateColor, selectedStateAbbr, showTip, hideTip, onStateSelect]);

  const renderCountyFills = useCallback(({ geographies }) => {
    const geos = isDrilledIn
      ? geographies.filter(g => String(g.id).padStart(5,"0").startsWith(drillFips))
      : geographies;
    const clickCounty = viewMode === "counties" || isDrilledIn;
    return geos.map(geo => {
      const fips = String(geo.id).padStart(5,"0");
      const sf   = fips.slice(0,2);
      const abbr = FIPS_TO_ABBR[sf];
      const d    = countyEduMap.get(fips);
      const { fill, fillOpacity } = countyColor(fips);
      const isSelected = fips === selectedCountyFips;
      return (
        <Geography key={geo.rsmKey} geography={geo}
          fill={fill} fillOpacity={fillOpacity}
          stroke={isSelected ? "#111827" : "rgba(255,255,255,0.25)"}
          strokeWidth={isSelected ? 1.5 : isDrilledIn ? 0.5 : 0.2}
          style={GEO_STYLE}
          onMouseEnter={e => d && showTip(e,d)}
          onMouseLeave={hideTip}
          onClick={() => {
            if (clickCounty) onCountySelect?.(fips);
            else if (abbr) onStateSelect?.(abbr);
          }}
        />
      );
    });
  }, [countyEduMap, countyColor, isDrilledIn, drillFips, viewMode, selectedCountyFips, showTip, hideTip, onStateSelect, onCountySelect]);

  const renderStateBorders = useCallback(({ geographies }) =>
    geographies.map(geo => {
      const abbr = FIPS_TO_ABBR[String(geo.id).padStart(2,"0")];
      const isSel = abbr === selectedStateAbbr;
      return (
        <Geography key={`sb-${geo.rsmKey}`} geography={geo}
          fill="none"
          stroke={isSel ? "#111827" : "rgba(255,255,255,0.75)"}
          strokeWidth={isSel ? 2 : 0.9}
          style={BORDER_STYLE}
          onClick={() => abbr && onStateSelect?.(abbr)}
        />
      );
    }), [selectedStateAbbr, onStateSelect]);

  const tip = tooltip?.d;

  return (
    <div style={{ position:"relative",background:"#F8FAFC",height:"100%" }} onMouseMove={moveTip}>
      <ComposableMap {...mapProps} style={{ width:"100%",height:"100%" }}>
        {viewMode === "states" && <Geographies geography={STATES_URL}>{renderStates}</Geographies>}
        {viewMode !== "states" && <Geographies geography={COUNTIES_URL}>{renderCountyFills}</Geographies>}
        {viewMode === "counties" && <Geographies geography={STATES_URL}>{renderStateBorders}</Geographies>}
        {viewMode === "drilldown" && !isDrilledIn && <Geographies geography={STATES_URL}>{renderStateBorders}</Geographies>}
      </ComposableMap>

      {tip && (
        <div style={{
          position:"fixed",left:tooltip.x+14,top:tooltip.y-80,
          background:"#111827",color:"#fff",
          padding:"8px 12px",borderRadius:7,fontSize:11,
          pointerEvents:"none",zIndex:9999,
          whiteSpace:"nowrap",boxShadow:"0 4px 12px rgba(0,0,0,.25)",lineHeight:1.75,
        }}>
          {tip._isState ? (
            <>
              <div style={{ fontWeight:700 }}>{tip.state_abbr} (state avg)</div>
              <div>Avg % Bachelors: <span style={{ color:"#93C5FD" }}>{Number(tip.pct_bachelors).toFixed(1)}%</span></div>
              <div>Avg Competitiveness: <span style={{ color:"#6EE7B7" }}>{Number(tip.competitiveness_score).toFixed(1)}</span></div>
              <div>Score: <span style={{ color:"#C4B5FD" }}>{Number(tip.targeting_score).toFixed(3)}</span></div>
              {tip.strategy && <div>Strategy: <span style={{ color: STRATEGY_COLORS[tip.strategy]||"#fff" }}>{tip.strategy}</span></div>}
            </>
          ) : (
            <>
              <div style={{ fontWeight:700 }}>{tip.county_name}, {tip.state_abbr}</div>
              <div>Margin: <span style={{ color:"#FCA5A5" }}>{Number(tip.margin_pct).toFixed(1)}%</span></div>
              <div>% Bachelors: <span style={{ color:"#93C5FD" }}>{Number(tip.pct_bachelors).toFixed(1)}%</span></div>
              <div>Score: <span style={{ color:"#C4B5FD" }}>{Number(tip.targeting_score).toFixed(3)}</span></div>
              {tip.strategy && <div>Strategy: <span style={{ color: STRATEGY_COLORS[tip.strategy]||"#fff" }}>{tip.strategy}</span></div>}
            </>
          )}
        </div>
      )}

      {viewType === "strategy" ? (
        <div className="map-legend">
          {Object.entries(STRATEGY_COLORS).map(([label, color]) => (
            <span key={label} style={{ display:"flex",alignItems:"center",gap:5 }}>
              <span style={{ width:10,height:10,borderRadius:2,background:color,display:"inline-block" }} />
              <span style={{ fontSize:10 }}>{label}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="map-legend">
          <span style={{ fontSize:10,color:"var(--text-muted)" }}>Low</span>
          <div style={{ width:72,height:9,borderRadius:4,background:"linear-gradient(to right, #f5f3ff, #5b21b6)" }} />
          <span style={{ fontSize:10,color:"var(--text-muted)" }}>High</span>
          <span style={{ marginLeft:"auto",fontSize:10,color:"var(--text-muted)" }}>Targeting Score</span>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Visual 3 - Education Structure Scatter (K-Means segments)
   X: pct_hs_only  Y: pct_bachelors  - orthogonal axes, no collinearity
══════════════════════════════════════════════════════════════════════ */
function QuadrantScatter({ data, selectedSegment, onSegmentClick, selectedStateAbbr, selectedCountyFips }) {
  const filtered = useMemo(() => {
    if (selectedCountyFips) return data.filter(d => d.fips === selectedCountyFips);
    if (selectedStateAbbr)  return data.filter(d => d.state_abbr === selectedStateAbbr);
    return data;
  }, [data, selectedStateAbbr, selectedCountyFips]);

  const hsMedian = useMemo(() => median(filtered.map(d => d.pct_hs_only)),    [filtered]);
  const baMedian = useMemo(() => median(filtered.map(d => d.pct_bachelors)),   [filtered]);

  const QTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <TipBox>
        <div style={{ fontWeight:600 }}>{d.county_name}, {d.state_abbr}</div>
        <div>% HS Only: <b>{Number(d.pct_hs_only).toFixed(1)}%</b></div>
        <div>% Bachelors: <b>{Number(d.pct_bachelors).toFixed(1)}%</b></div>
        <div>Segment: <b style={{ color: QUAD_COLORS[d.segment] }}>{d.segment}</b></div>
        <div style={{ fontSize:11,color:"var(--text-muted)" }}>{QUAD_DESC[d.segment]}</div>
      </TipBox>
    );
  };

  return (
    <div style={{ flex:1,minHeight:0,display:"flex",flexDirection:"column" }}>
      <div style={{ display:"flex",flexWrap:"wrap",gap:"3px 8px",padding:"0 0 6px",flexShrink:0 }}>
        {Object.entries(QUAD_COLORS).map(([label, color]) => (
          <button
            key={label}
            onClick={() => onSegmentClick(selectedSegment === label ? null : label)}
            style={{
              display:"flex",alignItems:"center",gap:4,fontSize:10.5,
              background:"none",border:"none",cursor:"pointer",padding:"1px 4px",borderRadius:4,
              opacity: selectedSegment && selectedSegment !== label ? 0.35 : 1,
              color: selectedSegment === label ? color : "var(--text-muted)",
              fontWeight: selectedSegment === label ? 700 : 400,
            }}
          >
            <span style={{ width:8,height:8,borderRadius:"50%",background:color,display:"inline-block",flexShrink:0 }} />
            {label}
          </button>
        ))}
        {selectedSegment && (
          <button onClick={() => onSegmentClick(null)}
            style={{ fontSize:10,color:"var(--text-muted)",background:"none",border:"none",cursor:"pointer",padding:"1px 4px" }}>
            ✕ clear
          </button>
        )}
      </div>

      <div style={{ flex:1,minHeight:0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top:4,right:16,left:0,bottom:24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="pct_hs_only" type="number" domain={["auto","auto"]}
              tick={{ fontSize:10,fill:"#9CA3AF" }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`}
              label={{ value:"% HS Diploma Only",position:"insideBottom",offset:-14,fontSize:11,fill:"#9CA3AF" }}
            />
            <YAxis
              dataKey="pct_bachelors" type="number" domain={["auto","auto"]}
              tick={{ fontSize:10,fill:"#9CA3AF" }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`}
              label={{ value:"% Bachelors or Higher",angle:-90,position:"insideLeft",offset:12,fontSize:11,fill:"#9CA3AF" }}
            />
            <Tooltip content={<QTip />} cursor={false} />
            <ReferenceLine x={hsMedian} stroke="#D1D5DB" strokeDasharray="4 4"
              label={{ value:"Med HS",position:"insideTopRight",fontSize:9,fill:"#9CA3AF" }} />
            <ReferenceLine y={baMedian} stroke="#D1D5DB" strokeDasharray="4 4"
              label={{ value:"Med BA",position:"insideTopRight",fontSize:9,fill:"#9CA3AF" }} />
            <Scatter
              data={filtered}
              shape={props => {
                const isFiltered = selectedSegment && props.payload.segment !== selectedSegment;
                return (
                  <circle
                    cx={props.cx} cy={props.cy} r={2.5}
                    fill={QUAD_COLORS[props.payload.segment]}
                    fillOpacity={isFiltered ? 0.12 : 0.72}
                    stroke="none"
                    style={{ cursor:"pointer" }}
                    onClick={() => onSegmentClick(
                      selectedSegment === props.payload.segment ? null : props.payload.segment
                    )}
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
   Visual 4 - Education Gap Ranking
   Gap = pct_hs_only − pct_bachelors
   Filters: selectedStateAbbr + selectedSegment (cross-filter)
══════════════════════════════════════════════════════════════════════ */
function GapRanking({ data, selectedStateAbbr, selectedSegment }) {
  const [showTop, setShowTop] = useState(true);

  const filtered = useMemo(() => {
    let r = selectedStateAbbr ? data.filter(d => d.state_abbr === selectedStateAbbr) : data;
    if (selectedSegment) r = r.filter(d => d.segment === selectedSegment);
    return r;
  }, [data, selectedStateAbbr, selectedSegment]);

  const ranked = useMemo(() => {
    const withGap = filtered
      .filter(d => d.pct_hs_only != null && d.pct_bachelors != null)
      .map(d => ({ ...d, label:`${d.county_name}, ${d.state_abbr}` }))
      .sort((a, b) => b.gap - a.gap);
    return showTop ? withGap.slice(0, 15) : [...withGap].reverse().slice(0, 15);
  }, [filtered, showTop]);

  const GapTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <TipBox>
        <div style={{ fontWeight:600 }}>{d.county_name}, {d.state_abbr}</div>
        <div>% HS Only: <b>{Number(d.pct_hs_only).toFixed(1)}%</b></div>
        <div>% Bachelors: <b>{Number(d.pct_bachelors).toFixed(1)}%</b></div>
        <div>Gap: <b>{Number(d.gap).toFixed(1)}%</b></div>
        {d.segment && <div>Segment: <b style={{ color: QUAD_COLORS[d.segment] }}>{d.segment}</b></div>}
      </TipBox>
    );
  };

  if (!ranked.length) return <EmptyState message={
    selectedStateAbbr || selectedSegment
      ? `No data for ${[selectedStateAbbr, selectedSegment].filter(Boolean).join(" / ")}`
      : "No education data available"
  } />;

  return (
    <>
      <div style={{ display:"flex",justifyContent:"flex-end",marginBottom:6,flexShrink:0 }}>
        {["Top 15","Bottom 15"].map((label, i) => (
          <button key={label} onClick={() => setShowTop(i === 0)}
            style={{
              fontSize:10,padding:"3px 8px",borderRadius:5,
              border:"1px solid var(--border)",marginLeft:4,
              background: showTop === (i===0) ? "var(--surface-2)" : "transparent",
              fontWeight: showTop === (i===0) ? 600 : 400,
              cursor:"pointer",color:"var(--text)",
            }}>{label}</button>
        ))}
      </div>
      <div style={{ flex:1,minHeight:0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ranked} layout="vertical" margin={{ top:4,right:40,left:4,bottom:4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
            <XAxis
              type="number" domain={["auto","auto"]}
              tick={{ fontSize:9,fill:"#9CA3AF" }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v>0?"+":""}${v.toFixed(0)}%`}
            />
            <YAxis
              type="category" dataKey="label" width={130}
              tick={{ fontSize:9,fill:"#374151" }} axisLine={false} tickLine={false}
            />
            <ReferenceLine x={0} stroke="#D1D5DB" strokeDasharray="3 3" />
            <Tooltip content={<GapTip />} cursor={{ fill:"rgba(0,0,0,0.03)" }} />
            <Bar dataKey="gap" radius={[0,3,3,0]} maxBarSize={14}>
              {ranked.map((entry, i) => (
                <Cell
                  key={i}
                  fill={QUAD_COLORS[entry.segment] || (entry.gap >= 0 ? "#7C3AED" : "#60A5FA")}
                  fillOpacity={0.4 + (ranked.length - i) / ranked.length * 0.55}
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
   Visual 5 - Education Ratio Distribution
   ratio = pct_bachelors / pct_hs_only  (independent measures)
══════════════════════════════════════════════════════════════════════ */
function RatioDistribution({ data, selectedStateAbbr, selectedCountyFips }) {
  const filtered = useMemo(() => {
    if (selectedCountyFips) return data.filter(d => d.fips === selectedCountyFips);
    if (selectedStateAbbr)  return data.filter(d => d.state_abbr === selectedStateAbbr);
    return data;
  }, [data, selectedStateAbbr, selectedCountyFips]);

  const chartData = useMemo(() => {
    const ratios = filtered
      .filter(d => d.pct_hs_only > 0)
      .map(d => Number(d.pct_bachelors) / Number(d.pct_hs_only));

    if (!ratios.length) return { bins:[], mean_val:0, median_val:0, meanBinLabel:"" };

    const N   = 22;
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);
    const bw  = Math.max((max - min) / N, 0.001);

    const bins = Array.from({ length:N }, (_, i) => ({ name:(min + i*bw).toFixed(2), count:0 }));
    ratios.forEach(v => { bins[Math.min(Math.floor((v - min) / bw), N-1)].count++; });

    const mean_val   = ratios.reduce((s, v) => s+v, 0) / ratios.length;
    const sorted     = [...ratios].sort((a,b) => a-b);
    const mid        = Math.floor(sorted.length / 2);
    const median_val = sorted.length % 2 === 0 ? (sorted[mid-1]+sorted[mid])/2 : sorted[mid];
    const meanBinLabel = bins[Math.min(Math.floor((mean_val - min) / bw), N-1)]?.name ?? "";

    return { bins, mean_val, median_val, meanBinLabel };
  }, [filtered]);

  const RatioTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return <TipBox><div style={{ fontWeight:600 }}>Ratio: {d.name}</div><div>Counties: <b>{d.count}</b></div></TipBox>;
  };

  if (!chartData.bins.length) return <EmptyState message="No education data available" />;

  return (
    <div style={{ flex:1,minHeight:0,display:"flex",flexDirection:"column",gap:4 }}>
      <div style={{ display:"flex",gap:16,flexShrink:0,fontSize:11,color:"var(--text-muted)" }}>
        <span>Mean: <b style={{ color:"var(--text)" }}>{chartData.mean_val.toFixed(2)}</b></span>
        <span>Median: <b style={{ color:"var(--text)" }}>{chartData.median_val.toFixed(2)}</b></span>
        <span style={{ marginLeft:"auto" }}>Bachelors ÷ HS-Only</span>
      </div>
      <div style={{ flex:1,minHeight:0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData.bins} margin={{ top:22,right:16,left:0,bottom:28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="name" tick={{ fontSize:9,fill:"#9CA3AF" }} axisLine={false} tickLine={false} interval={4}
              label={{ value:"Bachelors / HS-Only Ratio",position:"insideBottom",offset:-16,fontSize:11,fill:"#9CA3AF" }} />
            <YAxis tick={{ fontSize:10,fill:"#9CA3AF" }} axisLine={false} tickLine={false}
              label={{ value:"Counties",angle:-90,position:"insideLeft",offset:12,fontSize:11,fill:"#9CA3AF" }} />
            <Tooltip content={<RatioTip />} cursor={{ fill:"rgba(0,0,0,0.03)" }} />
            <ReferenceLine x={chartData.meanBinLabel} stroke="#7C3AED" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value:`Mean ${chartData.mean_val.toFixed(2)}`,position:"top",fontSize:9,fill:"#7C3AED",offset:6 }} />
            <Bar dataKey="count" fill="#7C3AED" fillOpacity={0.65} radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Visual 6a - Segment Composition (Donut + strategy annotation)
══════════════════════════════════════════════════════════════════════ */
function SegmentComposition({ data, selectedSegment, onSegmentClick, selectedStateAbbr, selectedCountyFips }) {
  const filtered = useMemo(() => {
    if (selectedCountyFips) return data.filter(d => d.fips === selectedCountyFips);
    if (selectedStateAbbr)  return data.filter(d => d.state_abbr === selectedStateAbbr);
    return data;
  }, [data, selectedStateAbbr, selectedCountyFips]);

  const compositionData = useMemo(() => {
    const totals = {};
    Object.keys(QUAD_COLORS).forEach(k => { totals[k] = 0; });
    let grand = 0;
    const useVotes = filtered.some(d => d.total_votes > 0);
    filtered.forEach(d => {
      if (!d.segment || !(d.segment in totals)) return;
      const w = useVotes ? (d.total_votes || 1) : 1;
      totals[d.segment] += w; grand += w;
    });
    return Object.entries(totals).map(([name, value]) => ({
      name, value, fill: QUAD_COLORS[name],
      pct: grand > 0 ? (value / grand * 100).toFixed(1) : "0",
    }));
  }, [filtered]);

  const dominant = useMemo(() =>
    compositionData.reduce((a, b) => +a.pct > +b.pct ? a : b, compositionData[0]),
    [compositionData]
  );

  const CompTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <TipBox>
        <div style={{ fontWeight:600,color:d.fill }}>{d.name}</div>
        <div>Share: <b>{d.pct}%</b></div>
        <div style={{ fontSize:11,color:"var(--text-muted)" }}>{QUAD_DESC[d.name]}</div>
      </TipBox>
    );
  };

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }) => {
    if (Number(pct) < 6) return null;
    const R = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    return (
      <text x={cx + r*Math.cos(-midAngle*R)} y={cy + r*Math.sin(-midAngle*R)}
        fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
        {pct}%
      </text>
    );
  };

  return (
    <div style={{ flex:1,minHeight:0,display:"flex",flexDirection:"column",gap:6 }}>
      {dominant && (
        <div style={{
          background: (QUAD_COLORS[dominant.name]||"#888")+"18",
          border:`1px solid ${(QUAD_COLORS[dominant.name]||"#888")}35`,
          borderRadius:7,padding:"6px 10px",flexShrink:0,
          display:"flex",justifyContent:"space-between",alignItems:"center",
        }}>
          <div>
            <div style={{ fontSize:9,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.05em" }}>Recommended Strategy</div>
            <div style={{ fontSize:13,fontWeight:700,color:QUAD_COLORS[dominant.name] }}>
              {STRATEGY_REC[dominant.name] || "Mixed Strategy"}
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:9,color:"var(--text-muted)" }}>Dominant Segment</div>
            <div style={{ fontSize:11,fontWeight:600 }}>{dominant.name} ({dominant.pct}%)</div>
          </div>
        </div>
      )}
      <div style={{ flex:1,minHeight:0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={compositionData} dataKey="value" nameKey="name"
              cx="50%" cy="48%" innerRadius="35%" outerRadius="62%"
              paddingAngle={2} labelLine={false} label={renderLabel}>
              {compositionData.map((e, i) => (
                <Cell key={i} fill={e.fill}
                  fillOpacity={selectedSegment && selectedSegment !== e.name ? 0.2 : 0.85}
                  style={{ cursor:"pointer" }}
                  onClick={() => onSegmentClick(selectedSegment === e.name ? null : e.name)}
                />
              ))}
            </Pie>
            <Tooltip content={<CompTip />} />
            <Legend
              formatter={v => (
                <span style={{ fontSize:10.5,color: selectedSegment && selectedSegment !== v ? "var(--text-muted)" : "var(--text)" }}>{v}</span>
              )}
              iconType="circle" iconSize={8}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Visual 6b - Action Panel (top counties + primary strategy)
══════════════════════════════════════════════════════════════════════ */
function ActionPanel({ data, selectedStateAbbr }) {
  const [sortBy, setSortBy] = useState("targeting_score");

  const filtered = useMemo(
    () => selectedStateAbbr ? data.filter(d => d.state_abbr === selectedStateAbbr) : data,
    [data, selectedStateAbbr],
  );

  const topCounties = useMemo(() =>
    [...filtered]
      .filter(d => d[sortBy] != null)
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, 10),
    [filtered, sortBy]
  );

  const dominant = useMemo(() => {
    const counts = {};
    filtered.forEach(d => { if (d.segment) counts[d.segment] = (counts[d.segment]||0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] ?? "";
  }, [filtered]);

  return (
    <div style={{ flex:1,minHeight:0,display:"flex",flexDirection:"column",gap:8 }}>
      {dominant && (
        <div style={{
          background:(QUAD_COLORS[dominant]||"#888")+"18",
          border:`1px solid ${(QUAD_COLORS[dominant]||"#888")}35`,
          borderRadius:8,padding:"8px 12px",flexShrink:0,
        }}>
          <div style={{ fontSize:9,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.05em" }}>Primary Strategy Recommendation</div>
          <div style={{ fontSize:14,fontWeight:700,color:QUAD_COLORS[dominant],marginTop:2 }}>
            {STRATEGY_REC[dominant] || "Mixed Strategy"}
          </div>
          <div style={{ fontSize:11,color:"var(--text-muted)",marginTop:1 }}>
            {QUAD_MESSAGING[dominant]}
          </div>
        </div>
      )}

      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
        <span style={{ fontSize:11,fontWeight:600 }}>Top 10 Priority Counties</span>
        <div style={{ display:"flex",gap:3 }}>
          {[{key:"targeting_score",label:"Score"},{key:"gap",label:"Gap"}].map(({key,label}) => (
            <button key={key} onClick={() => setSortBy(key)} style={{
              fontSize:10,padding:"2px 7px",borderRadius:4,
              border:"1px solid var(--border)",
              background: sortBy===key ? "var(--surface-2)" : "transparent",
              fontWeight: sortBy===key ? 600 : 400,
              cursor:"pointer",color:"var(--text)",
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1,minHeight:0,overflowY:"auto" }}>
        <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
          <thead>
            <tr>
              {["County", sortBy==="targeting_score"?"Score":"Gap %", "Segment", "Messaging"].map(h => (
                <th key={h} style={{
                  textAlign: h==="Score"||h==="Gap %"?"right":"left",
                  padding:"3px 5px",color:"var(--text-muted)",fontWeight:600,fontSize:10,
                  borderBottom:"1px solid var(--border)",
                  position:"sticky",top:0,background:"var(--surface)",whiteSpace:"nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topCounties.map((d, i) => (
              <tr key={d.fips} style={{ borderBottom:"1px solid var(--border)" }}>
                <td style={{ padding:"4px 5px",fontWeight:i<3?600:400,whiteSpace:"nowrap" }}>
                  {i<3 && <span style={{ color:"#F59E0B",marginRight:4 }}>★</span>}
                  {d.county_name}, {d.state_abbr}
                </td>
                <td style={{ padding:"4px 5px",textAlign:"right",fontFamily:"monospace",fontSize:10.5 }}>
                  {sortBy==="targeting_score"
                    ? d.targeting_score.toFixed(3)
                    : `${d.gap>=0?"+":""}${d.gap.toFixed(1)}%`}
                </td>
                <td style={{ padding:"4px 5px" }}>
                  <span style={{
                    display:"inline-block",padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:600,
                    background:(QUAD_COLORS[d.segment]||"#888")+"20",
                    color:QUAD_COLORS[d.segment]||"#888",
                    whiteSpace:"nowrap",
                  }}>{d.segment||"-"}</span>
                </td>
                <td style={{ padding:"4px 5px",color:"var(--text-muted)",fontSize:9.5,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                  {QUAD_MESSAGING[d.segment]||"-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Visual 6c - Age Distribution (Donut)
══════════════════════════════════════════════════════════════════════ */
const AGE_GROUPS = [
  { key: "pct_under_18", label: "Under 18",  color: "#60A5FA" },
  { key: "pct_18_64",    label: "18 – 64",   color: "#10B981" },
  { key: "pct_65_older", label: "65 +",      color: "#F97316" },
];

function AgeDistribution({ ageData, selectedStateAbbr, selectedCountyFips }) {
  const filtered = useMemo(() => {
    if (selectedCountyFips) return ageData.filter(d => d.fips === selectedCountyFips);
    if (selectedStateAbbr)  return ageData.filter(d => d.state_abbr === selectedStateAbbr);
    return ageData;
  }, [ageData, selectedStateAbbr, selectedCountyFips]);

  const pieData = useMemo(() => {
    if (!filtered.length) return [];
    const totalW = filtered.reduce((s, d) => s + (d.total_votes || 1), 0);
    return AGE_GROUPS.map(({ key, label, color }) => ({
      key, label, color,
      value: filtered.reduce((s, d) => s + (d[key] || 0) * (d.total_votes || 1), 0) / totalW,
    }));
  }, [filtered]);

  const dominant = useMemo(() => pieData.reduce((a, b) => a.value > b.value ? a : b, pieData[0]), [pieData]);

  const AgeTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <TipBox>
        <div style={{ fontWeight:600, color:d.color }}>{d.label}</div>
        <div>Share: <b>{d.value.toFixed(1)}%</b></div>
      </TipBox>
    );
  };

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
    if (value < 5) return null;
    const R = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    return (
      <text
        x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
        fill="white" textAnchor="middle" dominantBaseline="central"
        fontSize={10} fontWeight={700}
      >
        {value.toFixed(1)}%
      </text>
    );
  };

  if (!pieData.length) return <EmptyState message="No age data available" />;

  return (
    <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"column", gap:6 }}>
      {dominant && (
        <div style={{
          background: dominant.color + "18",
          border: `1px solid ${dominant.color}35`,
          borderRadius:7, padding:"6px 10px", flexShrink:0,
          display:"flex", justifyContent:"space-between", alignItems:"center",
        }}>
          <div>
            <div style={{ fontSize:9, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Largest Age Group</div>
            <div style={{ fontSize:13, fontWeight:700, color:dominant.color }}>{dominant.label}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:9, color:"var(--text-muted)" }}>Share</div>
            <div style={{ fontSize:11, fontWeight:600 }}>{dominant.value.toFixed(1)}%</div>
          </div>
        </div>
      )}
      <div style={{ flex:1, minHeight:0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData} dataKey="value" nameKey="label"
              cx="50%" cy="48%" innerRadius="35%" outerRadius="62%"
              paddingAngle={2} labelLine={false} label={renderLabel}
            >
              {pieData.map((d, i) => (
                <Cell key={i} fill={d.color} fillOpacity={0.85} />
              ))}
            </Pie>
            <Tooltip content={<AgeTip />} />
            <Legend
              formatter={v => <span style={{ fontSize:10.5, color:"var(--text)" }}>{v}</span>}
              iconType="circle" iconSize={8}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Main Education page
══════════════════════════════════════════════════════════════════════ */
export default function Education() {
  const { selectedElectionId, loadElections } = useElectionsStore();

  const [stateMapData,    setStateMapData]    = useState(new Map());
  const [countyMapData,   setCountyMapData]   = useState(new Map());
  const [stateMapLoading, setStateMapLoading] = useState(false);
  const [eduData,         setEduData]         = useState([]);
  const [eduLoading,      setEduLoading]      = useState(false);
  const [ageData,         setAgeData]         = useState([]);
  const [ageLoading,      setAgeLoading]      = useState(false);

  const [selectedStateAbbr,  setSelectedStateAbbr]  = useState(null);
  const [selectedCountyFips, setSelectedCountyFips] = useState(null);
  const [selectedSegment,    setSelectedSegment]    = useState(null);

  const [electoralViewMode, setElectoralViewMode] = useState("states");
  const [targetingViewMode, setTargetingViewMode] = useState("states");
  const [targetingView,     setTargetingView]     = useState("score");
  const [compTab,           setCompTab]           = useState("segments");

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
    setSelectedSegment(null);
  }, [selectedElectionId]);

  useEffect(() => {
    if (!selectedElectionId) return;
    setEduLoading(true);
    analyticsService.getEducationCountySummary(selectedElectionId)
      .then(setEduData)
      .catch(console.error)
      .finally(() => setEduLoading(false));
    setAgeLoading(true);
    analyticsService.getAgeCountySummary(selectedElectionId)
      .then(rows => setAgeData(rows.map(d => ({ ...d, fips: String(d.fips).padStart(5, "0") }))))
      .catch(console.error)
      .finally(() => setAgeLoading(false));
  }, [selectedElectionId]);

  /* Processed county data: basic fields + K-means segment */
  const processedEduData = useMemo(() => {
    if (!eduData.length) return [];

    const compMed = median(eduData.map(d => Number(d.competitiveness_score || 0)));
    const baMed   = median(eduData.map(d => Number(d.pct_bachelors || 0)));

    const firstPass = eduData.map(d => {
      const comp = Number(d.competitiveness_score || 0) / 100;
      const ba   = Number(d.pct_bachelors || 0) / 100;
      const targeting_score = comp * Math.pow(1 - ba, 2);
      const gap = Number(d.pct_hs_only || 0) - Number(d.pct_bachelors || 0);

      const isComp  = Number(d.competitiveness_score || 0) >= compMed;
      const isLowBa = Number(d.pct_bachelors || 0) < baMed;
      let strategy;
      if (isComp && isLowBa) strategy = "High Priority";
      else if (isComp)        strategy = "Persuasion Secondary";
      else if (isLowBa)       strategy = "Low Priority";
      else                    strategy = "Ignore";

      return {
        ...d,
        fips:                  String(d.fips).padStart(5, "0"),
        pct_bachelors:         Number(d.pct_bachelors || 0),
        pct_hs_only:           Number(d.pct_hs_only || 0),
        pct_some_college:      Number(d.pct_some_college || 0),
        pct_hs_or_higher:      Number(d.pct_hs_or_higher || 0),
        margin_pct:            Number(d.margin_pct || 0),
        competitiveness_score: Number(d.competitiveness_score || 0),
        total_votes:           Number(d.total_votes || 0),
        targeting_score,
        gap,
        strategy,
      };
    });

    const segments = kMeansSegment(firstPass, "pct_hs_only", "pct_bachelors");
    return firstPass.map((d, i) => ({ ...d, segment: segments[i] }));
  }, [eduData]);

  const countyEduMap = useMemo(
    () => new Map(processedEduData.map(d => [d.fips, d])),
    [processedEduData],
  );

  const stateEduMap = useMemo(() => {
    if (!processedEduData.length) return new Map();
    const byState = {};
    processedEduData.forEach(d => {
      if (!byState[d.state_abbr]) byState[d.state_abbr] = [];
      byState[d.state_abbr].push(d);
    });
    const compMed = median(processedEduData.map(d => d.competitiveness_score));
    const baMed   = median(processedEduData.map(d => d.pct_bachelors));

    const result = new Map();
    Object.entries(byState).forEach(([abbr, counties]) => {
      const avgBa   = counties.reduce((s, c) => s + c.pct_bachelors, 0) / counties.length;
      const avgComp = counties.reduce((s, c) => s + c.competitiveness_score, 0) / counties.length;
      const targeting_score = (avgComp / 100) * Math.pow(1 - avgBa / 100, 2);
      const isComp  = avgComp >= compMed;
      const isLowBa = avgBa < baMed;
      let strategy;
      if (isComp && isLowBa) strategy = "High Priority";
      else if (isComp)        strategy = "Persuasion Secondary";
      else if (isLowBa)       strategy = "Low Priority";
      else                    strategy = "Ignore";
      result.set(abbr, { state_abbr:abbr, pct_bachelors:avgBa, competitiveness_score:avgComp, targeting_score, strategy });
    });
    return result;
  }, [processedEduData]);

  const maxScore = useMemo(() => {
    let max = 0;
    countyEduMap.forEach(d => { if (d.targeting_score > max) max = d.targeting_score; });
    stateEduMap.forEach(d => { if (d.targeting_score > max) max = d.targeting_score; });
    return max || 1;
  }, [countyEduMap, stateEduMap]);

  /* ── Electoral map handlers ── */
  const handleElectoralStateSelect = useCallback((abbr) => {
    setSelectedCountyFips(null);
    if (electoralViewMode === "drilldown") setSelectedStateAbbr(abbr);
    else setSelectedStateAbbr(p => p === abbr ? null : abbr);
  }, [electoralViewMode]);

  const handleElectoralCountySelect = useCallback((fips) => {
    setSelectedCountyFips(p => p === fips ? null : fips);
  }, []);

  const handleElectoralViewMode = useCallback((mode) => {
    setElectoralViewMode(mode);
    setSelectedCountyFips(null);
    if (mode === "states") setSelectedStateAbbr(null);
  }, []);

  const handleElectoralSearchCounty = useCallback((fips) => {
    setElectoralViewMode("counties");
    setSelectedCountyFips(fips);
    setSelectedStateAbbr(null);
  }, []);

  /* ── Targeting map handlers ── */
  const handleTargetingStateSelect = useCallback((abbr) => {
    setSelectedCountyFips(null);
    if (targetingViewMode === "drilldown") setSelectedStateAbbr(abbr);
    else setSelectedStateAbbr(p => p === abbr ? null : abbr);
  }, [targetingViewMode]);

  const handleTargetingCountySelect = useCallback((fips) => {
    setSelectedCountyFips(p => p === fips ? null : fips);
  }, []);

  const handleTargetingViewMode = useCallback((mode) => {
    setTargetingViewMode(mode);
    setSelectedCountyFips(null);
    if (mode === "states") setSelectedStateAbbr(null);
  }, []);

  const handleTargetingSearchCounty = useCallback((fips) => {
    setTargetingViewMode("counties");
    setSelectedCountyFips(fips);
    setSelectedStateAbbr(null);
  }, []);

  /* Derived labels */
  const selectedState  = selectedStateAbbr ? [...stateMapData.values()].find(r => r.state_abbr === selectedStateAbbr) : null;
  const selectedCounty = selectedCountyFips ? countyMapData.get(selectedCountyFips) : null;
  const selectionLabel = selectedCounty
    ? `${selectedCounty.county_name}, ${selectedCounty.state_abbr}`
    : selectedState?.state_name ?? null;

  const ViewModeBtn = ({ mode, current, onClick }) => (
    <button onClick={() => onClick(mode)} style={{
      fontSize:10,padding:"3px 7px",borderRadius:5,
      border:"1px solid var(--border)",
      background: current===mode ? "var(--surface-2)" : "transparent",
      fontWeight: current===mode ? 600 : 400,
      cursor:"pointer",color:"var(--text)",
    }}>
      {mode.charAt(0).toUpperCase() + mode.slice(1)}
    </button>
  );

  return (
    <Layout>
      <div style={{
        height:57,flexShrink:0,padding:"0 24px",
        borderBottom:"1px solid var(--border)",
        display:"flex",alignItems:"center",gap:16,
      }}>
        <div>
          <div style={{ fontSize:11,color:"var(--text-muted)",fontWeight:500 }}>ANALYTICS</div>
          <div style={{ fontSize:17,fontWeight:700 }}>Education Analysis</div>
        </div>
        {selectionLabel && (
          <div style={{ fontSize:12,color:"var(--text-muted)" }}>
            Filtered: <strong style={{ color:"var(--text)" }}>{selectionLabel}</strong>
            <button onClick={() => { setSelectedStateAbbr(null); setSelectedCountyFips(null); }}
              style={{ marginLeft:8,fontSize:11,color:"var(--text-muted)",background:"none",border:"none",cursor:"pointer" }}>✕</button>
          </div>
        )}
        {selectedSegment && (
          <div style={{ fontSize:12,color:"var(--text-muted)" }}>
            Segment: <strong style={{ color: QUAD_COLORS[selectedSegment] }}>{selectedSegment}</strong>
            <button onClick={() => setSelectedSegment(null)}
              style={{ marginLeft:8,fontSize:11,color:"var(--text-muted)",background:"none",border:"none",cursor:"pointer" }}>✕</button>
          </div>
        )}
      </div>

      <div style={{
        height:"calc(100vh - 57px)",
        display:"grid",
        gridTemplateColumns:"1.1fr 1fr 1fr",
        gridTemplateRows:"1fr 1fr",
        gap:10,padding:10,
        boxSizing:"border-box",
        overflow:"hidden",
      }}>

        {/* ── Visual 1: Electoral Map ── */}
        <div className="card" style={{ display:"flex",flexDirection:"column",minHeight:0 }}>
          <div className="card-header" style={{ flexShrink:0 }}>
            <span className="card-title">Electoral Map</span>
            <div style={{ display:"flex",gap:5,alignItems:"center" }}>
              <MapSearch
                viewMode={electoralViewMode}
                stateMapData={stateMapData}
                countyMapData={countyMapData}
                onStateSelect={handleElectoralStateSelect}
                onCountySelect={handleElectoralSearchCounty}
              />
              {["states","counties","drilldown"].map(m => (
                <ViewModeBtn key={m} mode={m} current={electoralViewMode} onClick={handleElectoralViewMode} />
              ))}
            </div>
          </div>
          <div style={{ flex:1,position:"relative",minHeight:0 }}>
            {stateMapLoading
              ? <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100%",gap:10,color:"var(--text-muted)" }}><Spinner /> Loading map…</div>
              : (
                <StateMap
                  viewMode={electoralViewMode}
                  stateResults={stateMapData}
                  countyResults={countyMapData}
                  onStateSelect={handleElectoralStateSelect}
                  onCountySelect={handleElectoralCountySelect}
                  selectedStateAbbr={selectedStateAbbr}
                  selectedCountyFips={selectedCountyFips}
                />
              )}
          </div>
        </div>

        {/* ── Visual 2: Targeting Choropleth Map ── */}
        <div className="card" style={{ display:"flex",flexDirection:"column",minHeight:0 }}>
          <div className="card-header" style={{ flexShrink:0 }}>
            <div>
              <span className="card-title">Targeting Map</span>
              <div style={{ fontSize:11,color:"var(--text-muted)",marginTop:1 }}>Education × Margin</div>
            </div>
            <div style={{ display:"flex",gap:4,alignItems:"center",flexWrap:"wrap" }}>
              <MapSearch
                viewMode={targetingViewMode}
                stateMapData={stateMapData}
                countyMapData={countyMapData}
                onStateSelect={handleTargetingStateSelect}
                onCountySelect={handleTargetingSearchCounty}
              />
              {["states","counties","drilldown"].map(m => (
                <ViewModeBtn key={m} mode={m} current={targetingViewMode} onClick={handleTargetingViewMode} />
              ))}
              <div style={{ width:1,height:16,background:"var(--border)",margin:"0 2px" }} />
              {[{key:"score",label:"Score"},{key:"strategy",label:"Strategy"}].map(({key,label}) => (
                <button key={key} onClick={() => setTargetingView(key)} style={{
                  fontSize:10,padding:"3px 7px",borderRadius:5,
                  border:"1px solid var(--border)",
                  background: targetingView===key ? "var(--surface-2)" : "transparent",
                  fontWeight: targetingView===key ? 600 : 400,
                  cursor:"pointer",color:"var(--text)",
                }}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{ flex:1,position:"relative",minHeight:0 }}>
            {eduLoading
              ? <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100%",gap:10,color:"var(--text-muted)" }}><Spinner /> Loading…</div>
              : (
                <TargetingMap
                  countyEduMap={countyEduMap}
                  stateEduMap={stateEduMap}
                  viewMode={targetingViewMode}
                  selectedStateAbbr={selectedStateAbbr}
                  selectedCountyFips={selectedCountyFips}
                  onStateSelect={handleTargetingStateSelect}
                  onCountySelect={handleTargetingCountySelect}
                  viewType={targetingView}
                  maxScore={maxScore}
                />
              )}
          </div>
        </div>

        {/* ── Visual 3: Education Structure Scatter ── */}
        <Panel
          title="Education Structure Scatter"
          subtitle="K-Means segments - HS Only vs Bachelors%"
          loading={eduLoading}
        >
          {processedEduData.length > 0
            ? <QuadrantScatter data={processedEduData} selectedSegment={selectedSegment} onSegmentClick={setSelectedSegment} selectedStateAbbr={selectedStateAbbr} selectedCountyFips={selectedCountyFips} />
            : <EmptyState message="Load election data to display" />}
        </Panel>

        {/* ── Visual 4: Education Gap Ranking ── */}
        <Panel
          title="Education Gap Ranking"
          subtitle={[selectedStateAbbr, selectedSegment].filter(Boolean).join(" · ") || "All counties - HS Only vs Bachelors"}
          loading={eduLoading}
        >
          {processedEduData.length > 0
            ? <GapRanking data={processedEduData} selectedStateAbbr={selectedStateAbbr} selectedSegment={selectedSegment} />
            : <EmptyState message="Load election data to display" />}
        </Panel>

        {/* ── Visual 5: Education Ratio Distribution ── */}
        <Panel
          title="Education Ratio Distribution"
          subtitle="Bachelors ÷ HS-Only per county"
          loading={eduLoading}
        >
          {processedEduData.length > 0
            ? <RatioDistribution data={processedEduData} selectedStateAbbr={selectedStateAbbr} selectedCountyFips={selectedCountyFips} />
            : <EmptyState message="Load election data to display" />}
        </Panel>

        {/* ── Visual 6: Segment Composition / Action Panel / Age (tabbed) ── */}
        <Panel
          title={compTab === "segments" ? "Segment Composition" : compTab === "action" ? "Action Panel" : "Age Distribution"}
          subtitle={compTab === "segments" ? "Electorate distribution by education cluster" : compTab === "action" ? "Top priority counties + strategy" : "Population age breakdown"}
          loading={compTab === "age" ? ageLoading : eduLoading}
          headerRight={
            <div style={{ display:"flex",gap:3 }}>
              {[{key:"segments",label:"Segments"},{key:"action",label:"Action"},{key:"age",label:"Age"}].map(({key,label}) => (
                <button key={key} onClick={() => setCompTab(key)} style={{
                  fontSize:10,padding:"3px 8px",borderRadius:5,
                  border:"1px solid var(--border)",
                  background: compTab===key ? "var(--surface-2)" : "transparent",
                  fontWeight: compTab===key ? 600 : 400,
                  cursor:"pointer",color:"var(--text)",
                }}>{label}</button>
              ))}
            </div>
          }
        >
          {compTab === "age"
            ? (ageData.length > 0
                ? <AgeDistribution ageData={ageData} selectedStateAbbr={selectedStateAbbr} selectedCountyFips={selectedCountyFips} />
                : <EmptyState message="Load election data to display" />)
            : (processedEduData.length > 0
                ? compTab === "segments"
                  ? <SegmentComposition data={processedEduData} selectedSegment={selectedSegment} onSegmentClick={setSelectedSegment} selectedStateAbbr={selectedStateAbbr} selectedCountyFips={selectedCountyFips} />
                  : <ActionPanel data={processedEduData} selectedStateAbbr={selectedStateAbbr} />
                : <EmptyState message="Load election data to display" />)}
        </Panel>

      </div>
    </Layout>
  );
}
