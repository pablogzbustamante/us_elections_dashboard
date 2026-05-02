import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import Layout from "../components/layout/Layout";
import { standardQueryService } from "../services/standardQueryService";

/* ─────────────────────────────────────────────────────────────
   ERD layout constants
───────────────────────────────────────────────────────────── */
const TW   = 220;  // table width
const RH   = 22;   // column row height
const HH   = 34;   // table header height
const HGAP = 70;   // horizontal gap between columns
const VGAP = 36;   // vertical gap between tables

const tblH = (t) => HH + t.columns.length * RH;

const HIDDEN_TABLES = new Set([
  "county_alias",
  "stg_demographics_raw",
  "stg_education_raw",
  "stg_elections_raw",
  "stg_population_density_raw",
  "stg_religion_raw",
]);

function computeLayout(tables, relationships = []) {
  if (!tables.length) return {};

  const dims   = tables.filter((t) => t.name.startsWith("dim_"));
  const facts  = tables.filter((t) => t.name.startsWith("fact_"));
  const others = tables.filter((t) => !t.name.startsWith("dim_") && !t.name.startsWith("fact_"));

  // Build bidirectional adjacency from FK relationships
  const adj = {};
  for (const rel of relationships) {
    (adj[rel.source_table] ??= new Set()).add(rel.target_table);
    (adj[rel.target_table] ??= new Set()).add(rel.source_table);
  }

  // Barycenter sort: order `group` so that each table's vertical position
  // aligns with the centroid of its neighbours in `reference`.
  // This is the classic Sugiyama step-2 crossing-minimisation heuristic.
  const barycenterSort = (group, reference) => {
    const rank = Object.fromEntries(reference.map((t, i) => [t.name, i]));
    return [...group].sort((a, b) => {
      const bc = (t) => {
        const nbrs = [...(adj[t.name] ?? [])].filter((n) => n in rank);
        return nbrs.length ? nbrs.reduce((s, n) => s + rank[n], 0) / nbrs.length : 1e9;
      };
      return bc(a) - bc(b);
    });
  };

  // Seed with alphabetical, then alternate optimisation passes
  let dimOrder  = [...dims].sort((a, b) => a.name.localeCompare(b.name));
  let factOrder = [...facts].sort((a, b) => a.name.localeCompare(b.name));

  for (let pass = 0; pass < 4; pass++) {
    factOrder = barycenterSort(factOrder, dimOrder);
    dimOrder  = barycenterSort(dimOrder,  factOrder);
  }

  const positions = {};

  // Assign first half to col-0, second half to col-1 so that after
  // barycenter sorting the "interface" column is the one closest to the
  // opposing group — reducing long diagonal crossings.
  const layoutGroup = (group, startX, numCols) => {
    if (!group.length) return startX;
    const perCol = Math.ceil(group.length / numCols);
    const cols   = Array.from({ length: numCols }, () => []);
    group.forEach((t, i) => cols[Math.min(Math.floor(i / perCol), numCols - 1)].push(t));
    for (let ci = 0; ci < numCols; ci++) {
      let y = 60;
      for (const t of cols[ci]) {
        positions[t.name] = { x: startX + ci * (TW + HGAP), y };
        y += tblH(t) + VGAP;
      }
    }
    return startX + Math.min(numCols, group.length) * (TW + HGAP) + HGAP;
  };

  let x = 40;
  x = layoutGroup(dimOrder,  x, dimOrder.length  <= 3 ? 1 : 2);
  x = layoutGroup(factOrder, x, factOrder.length <= 3 ? 1 : 2);
  if (others.length) layoutGroup(others, x, 2);

  return positions;
}

/* ─────────────────────────────────────────────────────────────
   Type abbreviations for ERD display
───────────────────────────────────────────────────────────── */
const abbrev = (t) =>
  t.replace("character varying", "varchar")
   .replace("double precision", "float8")
   .replace("timestamp without time zone", "timestamp")
   .replace("timestamp with time zone", "timestamptz")
   .replace("integer", "int4")
   .replace("smallint", "int2")
   .replace("bigint", "int8")
   .replace("boolean", "bool");

/* ─────────────────────────────────────────────────────────────
   TableNode
───────────────────────────────────────────────────────────── */
function TableNode({ table, pos, isDim }) {
  const accent = isDim ? "var(--blue)" : "var(--accent)";
  const headerBg = isDim ? "rgba(59,130,246,0.08)" : "rgba(229,52,42,0.07)";

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: TW,
        background: "var(--surface)",
        border: `1.5px solid ${accent}`,
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
        fontSize: 10.5,
      }}
    >
      {/* header */}
      <div
        style={{
          background: headerBg,
          height: HH,
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "0 8px",
          borderBottom: "1px solid var(--border)",
          fontWeight: 700,
          fontSize: 11,
          color: accent,
          overflow: "hidden",
        }}
      >
        <span style={{ fontSize: 9, flexShrink: 0 }}>{isDim ? "◇" : "■"}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {table.name}
        </span>
      </div>

      {/* columns */}
      {table.columns.map((col) => (
        <div
          key={col.name}
          style={{
            height: RH,
            padding: "0 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 4,
            borderBottom: "1px solid var(--border-light)",
            background: col.is_primary_key ? "rgba(245,158,11,0.06)" : undefined,
          }}
        >
          <span
            style={{
              color: col.is_primary_key ? "var(--amber)" : "var(--text)",
              fontWeight: col.is_primary_key ? 600 : 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 135,
            }}
          >
            {col.is_primary_key && (
              <span style={{ marginRight: 3, fontSize: 9 }}>⬦</span>
            )}
            {col.name}
          </span>
          <span style={{ color: "var(--text-xmuted)", fontSize: 9.5, flexShrink: 0 }}>
            {abbrev(col.type)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SchemaDiagram
───────────────────────────────────────────────────────────── */
function SchemaDiagram({ schema }) {
  const [pan,      setPan]      = useState({ x: 30, y: 20 });
  const [zoom,     setZoom]     = useState(0.78);
  const [dragging, setDragging] = useState(false);
  const lastPt = useRef(null);

  const positions = useMemo(() => {
    if (!schema) return {};
    const tables = schema.tables.filter((t) => !HIDDEN_TABLES.has(t.name));
    const rels   = schema.relationships.filter(
      (r) => !HIDDEN_TABLES.has(r.source_table) && !HIDDEN_TABLES.has(r.target_table)
    );
    return computeLayout(tables, rels);
  }, [schema]);

  const canvasW = useMemo(() => {
    if (!schema) return 600;
    const vals = Object.values(positions);
    return vals.length ? Math.max(...vals.map((p) => p.x + TW + 40)) : 600;
  }, [positions, schema]);

  const canvasH = useMemo(() => {
    if (!schema) return 400;
    return schema.tables.reduce((acc, t) => {
      const p = positions[t.name];
      return p ? Math.max(acc, p.y + tblH(t) + 40) : acc;
    }, 400);
  }, [positions, schema]);

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    setDragging(true);
    lastPt.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseMove = useCallback(
    (e) => {
      if (!dragging) return;
      setPan((p) => ({
        x: p.x + e.clientX - lastPt.current.x,
        y: p.y + e.clientY - lastPt.current.y,
      }));
      lastPt.current = { x: e.clientX, y: e.clientY };
    },
    [dragging]
  );
  const onMouseUp   = useCallback(() => setDragging(false), []);
  const onWheel = useCallback((e) => {
    e.preventDefault();
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      // Trackpad two-finger horizontal scroll
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    } else if (e.shiftKey) {
      // Shift + scroll → pan horizontally
      setPan((p) => ({ x: p.x - e.deltaY, y: p.y }));
    } else {
      // Plain scroll → pan vertically
      setPan((p) => ({ x: p.x, y: p.y - e.deltaY }));
    }
  }, []);

  if (!schema) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 13,
          gap: 10,
          background: "var(--surface-2)",
        }}
      >
        <div style={SPINNER_STYLE} />
        Loading schema…
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        overflow: "hidden",
        background: "var(--surface-2)",
        cursor: dragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      {/* ── Legend ── */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 10,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "5px 10px",
          fontSize: 10.5,
          display: "flex",
          gap: 14,
          color: "var(--text-muted)",
          pointerEvents: "none",
        }}
      >
        <span>
          <span style={{ color: "var(--blue)" }}>◇</span> Dimension
        </span>
        <span>
          <span style={{ color: "var(--accent)" }}>■</span> Fact
        </span>
        <span>
          <span style={{ color: "var(--amber)" }}>⬦</span> PK
        </span>
        <span style={{ color: "var(--text-xmuted)" }}>— FK</span>
        <span style={{ color: "var(--text-xmuted)", borderLeft: "1px solid var(--border)", paddingLeft: 12 }}>
          Drag · scroll ↕ · Shift+scroll ↔
        </span>
      </div>

      {/* ── Zoom controls ── */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          right: 14,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
          style={ZOOM_BTN}
        >
          +
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => { setZoom(0.78); setPan({ x: 30, y: 20 }); }}
          style={{ ...ZOOM_BTN, fontSize: 9, padding: "3px 4px" }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
          style={ZOOM_BTN}
        >
          −
        </button>
      </div>

      {/* ── Canvas ── */}
      <div
        style={{
          transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          position: "absolute",
          width: canvasW,
          height: canvasH,
        }}
      >
        {/* FK connection lines */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: canvasW,
            height: canvasH,
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <defs>
            <marker
              id="fk-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,1 L5,3 L0,5 Z" fill="#9CA3AF" />
            </marker>
          </defs>

          {schema.relationships.map((rel, i) => {
            const sp = positions[rel.source_table];
            const tp = positions[rel.target_table];
            if (!sp || !tp || rel.source_table === rel.target_table) return null;

            const srcTable = schema.tables.find((t) => t.name === rel.source_table);
            const colIdx   = srcTable?.columns.findIndex((c) => c.name === rel.source_column) ?? 0;

            const srcY = sp.y + HH + colIdx * RH + RH / 2;
            const tgtY = tp.y + HH / 2;

            // Choose near edges
            const srcLeft  = sp.x < tp.x;
            const srcX = srcLeft ? sp.x + TW : sp.x;
            const tgtX = srcLeft ? tp.x      : tp.x + TW;

            const offset = Math.min(60, Math.abs(tgtX - srcX) / 2.5);
            const cp1x = srcLeft ? srcX + offset : srcX - offset;
            const cp2x = srcLeft ? tgtX - offset : tgtX + offset;

            return (
              <path
                key={i}
                d={`M${srcX},${srcY} C${cp1x},${srcY} ${cp2x},${tgtY} ${tgtX},${tgtY}`}
                fill="none"
                stroke="#D1D5DB"
                strokeWidth="1.5"
                markerEnd="url(#fk-arrow)"
              />
            );
          })}
        </svg>

        {/* Table nodes */}
        {schema.tables.map((table) => {
          const pos = positions[table.name];
          if (!pos) return null;
          return (
            <TableNode
              key={table.name}
              table={table}
              pos={pos}
              isDim={table.name.startsWith("dim_")}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   EditorPanel
───────────────────────────────────────────────────────────── */
function EditorPanel({ value, onChange, onRun, loading }) {
  const onRunRef = useRef(onRun);
  useEffect(() => { onRunRef.current = onRun; }, [onRun]);

  const extensions = useMemo(() => [sql({ dialect: PostgreSQL })], []);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* toolbar */}
      <div
        style={{
          flexShrink: 0,
          height: 40,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", flex: 1 }}>
          SQL EDITOR
        </span>
        <span style={{ fontSize: 10.5, color: "var(--text-xmuted)" }}>Ctrl+Enter to run</span>
        <button
          onClick={onRun}
          disabled={loading}
          style={{
            background: loading ? "var(--border)" : "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: 5,
            padding: "5px 14px",
            fontSize: 12,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
          }}
        >
          {loading ? (
            <>
              <span style={MINI_SPINNER} />
              Running…
            </>
          ) : (
            "▶ Run"
          )}
        </button>
      </div>

      {/* CodeMirror */}
      <div
        style={{ flex: 1, overflow: "hidden", minHeight: 0 }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            onRunRef.current();
          }
        }}
      >
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={extensions}
          height="100%"
          style={{ height: "100%", fontSize: 13 }}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            foldGutter: false,
            drawSelection: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            searchKeymap: true,
          }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ResultsPanel
───────────────────────────────────────────────────────────── */
const fmtCell = (v) => {
  if (v == null) return <span style={{ color: "var(--text-xmuted)", fontStyle: "italic" }}>null</span>;
  if (typeof v === "number") return Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

function ResultsPanel({ results, error, loading }) {
  const HEADER = (
    <div
      style={{
        flexShrink: 0,
        height: 36,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 14px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>RESULTS</span>
      {results && (
        <>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "1px 8px",
            }}
          >
            {results.total} {results.total === 1 ? "row" : "rows"}
            {results.capped ? " (capped at 1 000)" : ""}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-xmuted)" }}>
            {results.columns.length} col{results.columns.length !== 1 ? "s" : ""}
          </span>
        </>
      )}
    </div>
  );

  if (loading && !results) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {HEADER}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)", animation: "pulse 1s infinite" }} />
          Executing…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {HEADER}
        <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
          <div
            style={{
              background: "var(--red-light)",
              border: "1px solid rgba(229,52,42,0.25)",
              borderRadius: 6,
              padding: "10px 14px",
              fontSize: 12.5,
              color: "var(--accent)",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {HEADER}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          <div>Run a query to see results</div>
          <div style={{ fontSize: 11, color: "var(--text-xmuted)" }}>Ctrl+Enter or click ▶ Run</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {HEADER}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {results.rows.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            Query returned 0 rows
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {results.columns.map((col) => (
                  <th
                    key={col}
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      padding: "6px 12px",
                      textAlign: "left",
                      background: "var(--surface-2)",
                      borderBottom: "2px solid var(--border)",
                      color: "var(--text-muted)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      fontSize: 11,
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.rows.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: "1px solid var(--border-light)",
                    background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                  }}
                >
                  {results.columns.map((col) => (
                    <td
                      key={col}
                      style={{
                        padding: "5px 12px",
                        whiteSpace: "nowrap",
                        maxWidth: 320,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontSize: 12,
                      }}
                    >
                      {fmtCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Resize handles
───────────────────────────────────────────────────────────── */
function HHandle() {
  return (
    <PanelResizeHandle>
      <div
        style={{
          width: 5,
          height: "100%",
          background: "var(--border)",
          cursor: "col-resize",
          transition: "background 0.15s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = "var(--blue)")}
        onMouseOut={(e)  => (e.currentTarget.style.background = "var(--border)")}
      />
    </PanelResizeHandle>
  );
}

function VHandle() {
  return (
    <PanelResizeHandle>
      <div
        style={{
          height: 5,
          width: "100%",
          background: "var(--border)",
          cursor: "row-resize",
          transition: "background 0.15s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = "var(--blue)")}
        onMouseOut={(e)  => (e.currentTarget.style.background = "var(--border)")}
      />
    </PanelResizeHandle>
  );
}

/* ─────────────────────────────────────────────────────────────
   Shared style constants
───────────────────────────────────────────────────────────── */
const ZOOM_BTN = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 0",
  width: 28,
  fontSize: 14,
  cursor: "pointer",
  color: "var(--text)",
  textAlign: "center",
  lineHeight: 1,
};

const SPINNER_STYLE = {
  width: 18,
  height: 18,
  border: "2px solid var(--border)",
  borderTopColor: "var(--blue)",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const MINI_SPINNER = {
  display: "inline-block",
  width: 8,
  height: 8,
  border: "1.5px solid rgba(255,255,255,0.4)",
  borderTopColor: "white",
  borderRadius: "50%",
  animation: "spin 0.7s linear infinite",
};

/* ─────────────────────────────────────────────────────────────
   Default query
───────────────────────────────────────────────────────────── */
const DEFAULT_SQL = `SELECT
    s.state_name,
    s.region,
    COUNT(c.county_fips) AS county_count
FROM dim_state s
LEFT JOIN dim_county c ON c.state_fips = s.state_fips
GROUP BY s.state_name, s.region
ORDER BY county_count DESC
LIMIT 20;`;

/* ─────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────── */
export default function StandardQuery() {
  const [schema,  setSchema]  = useState(null);
  const [query,   setQuery]   = useState(DEFAULT_SQL);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    standardQueryService.getSchema().then(setSchema).catch(console.error);
  }, []);

  const runQuery = useCallback(async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await standardQueryService.executeQuery(query);
      setResults(res);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Query failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [query, loading]);

  return (
    <Layout>
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            flexShrink: 0,
            height: 57,
            padding: "0 24px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              ANALYTICS
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Standard Query</div>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--green)",
                display: "inline-block",
              }}
            />
            Read-only · PostgreSQL
          </div>
        </div>

        {/* ── Main panels ── */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <PanelGroup direction="horizontal" style={{ height: "100%" }}>
            {/* Left: schema diagram */}
            <Panel defaultSize={34} minSize={15} style={{ overflow: "hidden" }}>
              <SchemaDiagram schema={schema} />
            </Panel>

            <HHandle />

            {/* Right: editor + results */}
            <Panel defaultSize={66} minSize={30} style={{ overflow: "hidden" }}>
              <PanelGroup direction="vertical" style={{ height: "100%" }}>
                <Panel defaultSize={52} minSize={15} style={{ overflow: "hidden" }}>
                  <EditorPanel
                    value={query}
                    onChange={setQuery}
                    onRun={runQuery}
                    loading={loading}
                  />
                </Panel>

                <VHandle />

                <Panel defaultSize={48} minSize={15} style={{ overflow: "hidden" }}>
                  <ResultsPanel results={results} error={error} loading={loading} />
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </div>
      </div>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </Layout>
  );
}
