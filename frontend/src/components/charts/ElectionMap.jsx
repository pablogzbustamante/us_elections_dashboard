import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { partyColor } from "../../utils/formatters";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";

function marginToOpacity(margin) {
  if (margin == null) return 0.6;
  const abs = Math.min(Math.abs(Number(margin)), 40);
  return 0.3 + (abs / 40) * 0.7;
}

/**
 * results: Map<fips, { winner_party, margin_pct }>
 * onSelect: (fips) => void
 * selectedFips: string | null
 */
export default function ElectionMap({ results = new Map(), onSelect, selectedFips }) {
  return (
    <div style={{ background: "#FAFAFA" }}>
      <ComposableMap
        projection="geoAlbersUsa"
        style={{ width: "100%", height: "auto" }}
        projectionConfig={{ scale: 900 }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const fips = String(geo.id).padStart(5, "0");
              const result = results.get(fips);
              const fill = result
                ? partyColor(result.winner_party)
                : "#E5E7EB";
              const opacity = result ? marginToOpacity(result.margin_pct) : 1;
              const isSelected = fips === selectedFips;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  fillOpacity={opacity}
                  stroke={isSelected ? "#111827" : "#fff"}
                  strokeWidth={isSelected ? 1.5 : 0.3}
                  onClick={() => onSelect?.(fips)}
                  style={{
                    hover: { strokeWidth: 0.8, stroke: "#374151", cursor: "pointer", fillOpacity: 1 },
                    pressed: { fillOpacity: 0.85 },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

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
          <span style={{ width: 12, height: 12, borderRadius: 2, background: "#E5E7EB", display: "inline-block" }} />
          No data
        </span>
        <span style={{ marginLeft: "auto", color: "var(--text-xmuted)" }}>Shade = margin strength</span>
      </div>
    </div>
  );
}
