import { useState, useCallback } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { partyColor } from "../../utils/formatters";

const COUNTIES_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";
const STATES_URL   = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const STATE_DRILL_CONFIG = {
  AL: { center: [-86.8,  32.8], scale: 4000  },
  AK: { center: [-153.0, 64.2], scale: 700   },
  AZ: { center: [-111.7, 34.3], scale: 3500  },
  AR: { center: [-92.4,  34.9], scale: 4200  },
  CA: { center: [-119.5, 37.3], scale: 2500  },
  CO: { center: [-105.5, 39.0], scale: 3800  },
  CT: { center: [-72.7,  41.6], scale: 14000 },
  DE: { center: [-75.5,  39.0], scale: 18000 },
  FL: { center: [-83.0,  28.0], scale: 3200  },
  GA: { center: [-83.4,  32.6], scale: 3500  },
  HI: { center: [-157.8, 20.3], scale: 3500  },
  ID: { center: [-114.5, 44.4], scale: 2800  },
  IL: { center: [-89.2,  40.0], scale: 3500  },
  IN: { center: [-86.1,  40.0], scale: 4500  },
  IA: { center: [-93.5,  42.1], scale: 4000  },
  KS: { center: [-98.4,  38.5], scale: 3800  },
  KY: { center: [-85.3,  37.5], scale: 4500  },
  LA: { center: [-92.0,  30.9], scale: 4200  },
  ME: { center: [-69.4,  45.4], scale: 4000  },
  MD: { center: [-76.8,  38.9], scale: 7000  },
  MA: { center: [-71.5,  42.1], scale: 8000  },
  MI: { center: [-85.6,  44.3], scale: 3000  },
  MN: { center: [-94.0,  46.4], scale: 3200  },
  MS: { center: [-89.7,  32.7], scale: 4200  },
  MO: { center: [-92.5,  38.5], scale: 3700  },
  MT: { center: [-109.6, 47.0], scale: 2500  },
  NE: { center: [-99.9,  41.5], scale: 3800  },
  NV: { center: [-116.4, 38.8], scale: 3000  },
  NH: { center: [-71.6,  43.9], scale: 6500  },
  NJ: { center: [-74.5,  40.1], scale: 8500  },
  NM: { center: [-106.1, 34.4], scale: 3200  },
  NY: { center: [-75.5,  42.9], scale: 3800  },
  NC: { center: [-79.4,  35.5], scale: 4200  },
  ND: { center: [-100.5, 47.5], scale: 4200  },
  OH: { center: [-82.8,  40.3], scale: 4500  },
  OK: { center: [-97.5,  35.5], scale: 4000  },
  OR: { center: [-120.6, 44.0], scale: 3200  },
  PA: { center: [-77.2,  41.0], scale: 4500  },
  RI: { center: [-71.5,  41.6], scale: 20000 },
  SC: { center: [-81.0,  33.8], scale: 5000  },
  SD: { center: [-100.3, 44.5], scale: 3800  },
  TN: { center: [-86.4,  35.8], scale: 4500  },
  TX: { center: [-99.3,  31.5], scale: 1900  },
  UT: { center: [-111.1, 39.3], scale: 3500  },
  VT: { center: [-72.7,  44.1], scale: 7000  },
  VA: { center: [-78.5,  37.5], scale: 4500  },
  WA: { center: [-120.5, 47.4], scale: 3500  },
  WV: { center: [-80.5,  38.6], scale: 5500  },
  WI: { center: [-89.6,  44.5], scale: 4000  },
  WY: { center: [-107.5, 43.0], scale: 3500  },
  DC: { center: [-77.0,  38.9], scale: 50000 },
};

const ABBR_TO_FIPS = {
  AL:"01",AK:"02",AZ:"04",AR:"05",CA:"06",CO:"08",CT:"09",DE:"10",DC:"11",
  FL:"12",GA:"13",HI:"15",ID:"16",IL:"17",IN:"18",IA:"19",KS:"20",KY:"21",
  LA:"22",ME:"23",MD:"24",MA:"25",MI:"26",MN:"27",MS:"28",MO:"29",MT:"30",
  NE:"31",NV:"32",NH:"33",NJ:"34",NM:"35",NY:"36",NC:"37",ND:"38",OH:"39",
  OK:"40",OR:"41",PA:"42",RI:"44",SC:"45",SD:"46",TN:"47",TX:"48",UT:"49",
  VT:"50",VA:"51",WA:"53",WV:"54",WI:"55",WY:"56",
};

function heatColor(party, marginPct) {
  if (!party) return { fill: "#D1D5DB", fillOpacity: 1 };
  const abs         = Math.min(Math.abs(Number(marginPct) || 0), 40);
  const fillOpacity = 0.22 + (abs / 40) * 0.78;
  return { fill: partyColor(party), fillOpacity };
}

const GEO_STYLE = {
  default: { outline: "none" },
  hover:   { outline: "none", cursor: "pointer" },
  pressed: { outline: "none" },
};

const BORDER_STYLE = {
  default: { outline: "none" },
  hover:   { outline: "none" },
  pressed: { outline: "none" },
};

/**
 * viewMode:           "states" | "counties" | "drilldown"
 * stateResults:       Map<state_fips_2digit, {state_abbr, state_name, winner_party, margin_pct, ...}>
 * countyResults:      Map<county_fips_5digit, {county_name, state_abbr, winner_party, margin_pct, ...}>
 * onStateSelect:      (state_abbr) => void
 * onCountySelect:     (county_fips) => void  - fired in counties / drilled-in drilldown modes
 * selectedStateAbbr:  string | null
 * selectedCountyFips: string | null
 */
export default function StateMap({
  viewMode          = "states",
  stateResults      = new Map(),
  countyResults     = new Map(),
  onStateSelect,
  onCountySelect,
  selectedStateAbbr,
  selectedCountyFips,
}) {
  const [tooltip, setTooltip] = useState(null);

  const isDrilledIn = viewMode === "drilldown" && !!selectedStateAbbr;
  const drillFips   = isDrilledIn ? (ABBR_TO_FIPS[selectedStateAbbr] ?? null) : null;

  const mapProps = isDrilledIn
    ? { projection: "geoMercator",  projectionConfig: STATE_DRILL_CONFIG[selectedStateAbbr] ?? { center: [-96, 38], scale: 900 } }
    : { projection: "geoAlbersUsa", projectionConfig: { scale: 860 } };

  const showTip  = useCallback((e, data) => setTooltip({ x: e.clientX, y: e.clientY, data }), []);
  const moveTip  = useCallback((e) => setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null), []);
  const hideTip  = useCallback(() => setTooltip(null), []);

  /* ── STATES mode: render one geography per state ── */
  const renderStates = useCallback(({ geographies }) =>
    geographies.map((geo) => {
      const stateFips  = String(geo.id).padStart(2, "0");
      const result     = stateResults.get(stateFips);
      const { fill, fillOpacity } = heatColor(result?.winner_party, result?.margin_pct);
      const isSelected = result?.state_abbr === selectedStateAbbr;

      return (
        <Geography
          key={geo.rsmKey}
          geography={geo}
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={isSelected ? "#111827" : "#fff"}
          strokeWidth={isSelected ? 2.2 : 0.8}
          style={GEO_STYLE}
          onMouseEnter={(e) => result && showTip(e, { label: result.state_name, party: result.winner_party, margin: result.margin_pct })}
          onMouseLeave={hideTip}
          onClick={() => result && onStateSelect?.(result.state_abbr)}
        />
      );
    }),
  [stateResults, selectedStateAbbr, showTip, hideTip, onStateSelect]);

  /* ── COUNTY fill layer (counties & drilldown modes) ── */
  const renderCountyFills = useCallback(({ geographies }) => {
    const geos = isDrilledIn
      ? geographies.filter((g) => String(g.id).padStart(5, "0").startsWith(drillFips))
      : geographies;

    // Counties mode and drilldown-zoomed → clicks select county
    // Drilldown not-yet-zoomed → clicks zoom into state
    const clickSelectsCounty = viewMode === "counties" || isDrilledIn;

    return geos.map((geo) => {
      const countyFips  = String(geo.id).padStart(5, "0");
      const stateFips   = countyFips.slice(0, 2);
      const cr          = countyResults.get(countyFips);
      const sr          = stateResults.get(stateFips);
      const { fill, fillOpacity } = heatColor(cr?.winner_party, cr?.margin_pct);

      const isSelected  = countyFips === selectedCountyFips;

      const tipData = cr
        ? { label: `${cr.county_name}, ${cr.state_abbr}`, party: cr.winner_party, margin: cr.margin_pct }
        : sr
          ? { label: sr.state_name, party: sr.winner_party, margin: sr.margin_pct }
          : null;

      const handleClick = () => {
        if (clickSelectsCounty) {
          onCountySelect?.(countyFips);
        } else {
          sr && onStateSelect?.(sr.state_abbr);
        }
      };

      return (
        <Geography
          key={geo.rsmKey}
          geography={geo}
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={isSelected ? "#111827" : "rgba(255,255,255,0.35)"}
          strokeWidth={isSelected ? 1.5 : isDrilledIn ? 0.5 : 0.2}
          style={GEO_STYLE}
          onMouseEnter={(e) => tipData && showTip(e, tipData)}
          onMouseLeave={hideTip}
          onClick={handleClick}
        />
      );
    });
  }, [countyResults, stateResults, isDrilledIn, drillFips, viewMode,
      selectedCountyFips, showTip, hideTip, onStateSelect, onCountySelect]);

  /* ── State border overlay (counties mode only, not when drilled in) ── */
  const renderStateBorders = useCallback(({ geographies }) =>
    geographies.map((geo) => {
      const stateFips  = String(geo.id).padStart(2, "0");
      const isSelected = stateResults.get(stateFips)?.state_abbr === selectedStateAbbr;
      return (
        <Geography
          key={`sb-${geo.rsmKey}`}
          geography={geo}
          fill="none"
          stroke={isSelected ? "#111827" : "rgba(255,255,255,0.85)"}
          strokeWidth={isSelected ? 2 : 1}
          style={BORDER_STYLE}
          onClick={() => {
            const r = stateResults.get(stateFips);
            if (r) onStateSelect?.(r.state_abbr);
          }}
        />
      );
    }),
  [stateResults, selectedStateAbbr, onStateSelect]);

  return (
    <div style={{ position: "relative", background: "#F8FAFC", height: "100%" }} onMouseMove={moveTip}>
      <ComposableMap {...mapProps} style={{ width: "100%", height: "100%" }}>

        {/* States mode: one clean shape per state, no county lines */}
        {viewMode === "states" && (
          <Geographies geography={STATES_URL}>
            {renderStates}
          </Geographies>
        )}

        {/* Counties / Drill-down modes: county-level fills */}
        {viewMode !== "states" && (
          <Geographies geography={COUNTIES_URL}>
            {renderCountyFills}
          </Geographies>
        )}

        {/* State border overlay - counties mode (full US, not drilled) */}
        {viewMode === "counties" && (
          <Geographies geography={STATES_URL}>
            {renderStateBorders}
          </Geographies>
        )}

        {/* State border overlay - drilldown mode but not yet zoomed in */}
        {viewMode === "drilldown" && !isDrilledIn && (
          <Geographies geography={STATES_URL}>
            {renderStateBorders}
          </Geographies>
        )}
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x + 14, top: tooltip.y - 40,
          background: "#111827", color: "#fff",
          padding: "6px 11px", borderRadius: 7,
          fontSize: 12, fontWeight: 500,
          pointerEvents: "none", zIndex: 9999,
          whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,.25)",
        }}>
          <span style={{ fontWeight: 700 }}>{tooltip.data.label}</span>
          {tooltip.data.party && (() => {
            const c = String(tooltip.data.party).toUpperCase();
            const isRep = c.startsWith("REP") || c === "R";
            return (
              <span style={{ marginLeft: 8, color: isRep ? "#FCA5A5" : "#93C5FD" }}>
                {isRep ? "R" : "D"} +{Number(tooltip.data.margin).toFixed(1)}%
              </span>
            );
          })()}
        </div>
      )}

      {/* Legend */}
      <div className="map-legend">
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: "#E5342A", display: "inline-block" }} />
          Republican
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: "#3B82F6", display: "inline-block" }} />
          Democrat
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: "#D1D5DB", display: "inline-block" }} />
          No data
        </span>
        <span style={{ marginLeft: "auto", color: "var(--text-xmuted)", fontSize: 11 }}>
          Shade = margin strength
        </span>
      </div>
    </div>
  );
}
