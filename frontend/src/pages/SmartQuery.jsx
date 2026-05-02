import { useState, useRef, useEffect, useCallback } from "react";
import Layout from "../components/layout/Layout";
import { chatQueryService } from "../services/chatQueryService";

/* ── helpers ──────────────────────────────────────────────── */
const fmt = (v, field) => {
  if (v == null) return "-";
  if (typeof v === "string") return v;
  if (field && (field.includes("income") || field.includes("value") || field.includes("per_capita")))
    return `$${Number(v).toLocaleString()}`;
  if (field && field.includes("pct")) return `${Number(v).toFixed(1)}%`;
  if (typeof v === "number") return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(v);
};

const WINNER_COLOR = (w) => {
  if (!w) return {};
  if (w.toLowerCase().includes("trump"))  return { color: "var(--accent)" };
  if (w.toLowerCase().includes("harris")) return { color: "var(--blue)" };
  return {};
};

const ACTION_BADGE = {
  Invest:         { bg: "#D1FAE5", color: "#065F46" },
  Persuade:       { bg: "#FEF3C7", color: "#92400E" },
  Defend:         { bg: "#DBEAFE", color: "#1E40AF" },
  Monitor:        { bg: "#F3F4F6", color: "#374151" },
  "Low Priority": { bg: "#F9FAFB", color: "#6B7280" },
};

const EXAMPLES = [
  "Find counties where Harris lost by less than 5 points",
  "Show competitive counties with low median income",
  "Which counties should Republicans defend in Texas?",
  "Muéstrame condados con alto ingreso y alta educación",
  "Find counties with high Hispanic population and close 2024 margins",
  "Compare Florida and Texas by income and Trump margin",
  "Rank Pennsylvania counties by campaign priority for Democrats",
  "Which counties should Democrats prioritize in Arizona?",
];

/* ── result table ─────────────────────────────────────────── */
function ResultTable({ rows }) {
  if (!rows?.length) return null;

  const PRIORITY_COLS = [
    "county_name", "state_abbr", "winner_2024", "margin_2024",
    "total_votes", "median_household_income", "hispanic_or_latino",
    "bachelor_degree_or_higher", "recommended_action", "priority_score",
  ];
  const allKeys     = Object.keys(rows[0]);
  const cols        = PRIORITY_COLS.filter(c => allKeys.includes(c));
  const extra       = allKeys.filter(k => !PRIORITY_COLS.includes(k) && k !== "fips" && k !== "state_name");
  const displayCols = [...cols, ...extra.slice(0, 6)];

  const label = k =>
    k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
      .replace("2024", "'24").replace("2020", "'20");

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--border)" }}>
            {displayCols.map(col => (
              <th key={col} style={{
                padding: "6px 10px", textAlign: "left",
                color: "var(--text-muted)", fontWeight: 600,
                whiteSpace: "nowrap", background: "var(--surface-2)",
              }}>
                {label(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.fips || i} style={{
              borderBottom: "1px solid var(--border-light)",
              background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
            }}>
              {displayCols.map(col => (
                <td key={col} style={{
                  padding: "5px 10px", whiteSpace: "nowrap",
                  ...(col === "winner_2024" ? WINNER_COLOR(row[col]) : {}),
                }}>
                  {col === "recommended_action" && row[col] ? (
                    <span style={{
                      padding: "2px 7px", borderRadius: 10,
                      fontSize: 10.5, fontWeight: 600,
                      background: ACTION_BADGE[row[col]]?.bg || "#F3F4F6",
                      color:      ACTION_BADGE[row[col]]?.color || "#374151",
                    }}>
                      {row[col]}
                    </span>
                  ) : fmt(row[col], col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── query interpretation chips ───────────────────────────── */
function QueryCard({ query }) {
  if (!query) return null;
  const filters = query.filters || [];
  const states  = query.geography?.states || [];
  return (
    <div style={{
      background: "var(--surface-2)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 14px", fontSize: 12, marginBottom: 12,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--text-muted)", fontSize: 11 }}>
        INTERPRETED QUERY
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        <span style={{ background: "#EFF6FF", color: "#1D4ED8", padding: "2px 8px", borderRadius: 10, fontWeight: 600, fontSize: 11 }}>
          {query.intent?.replace(/_/g, " ")}
        </span>
        {states.map(s => (
          <span key={s} style={{ background: "#F0FDF4", color: "#166534", padding: "2px 8px", borderRadius: 10, fontSize: 11 }}>{s}</span>
        ))}
        {filters.map((f, i) => (
          <span key={i} style={{ background: "#FEF3C7", color: "#92400E", padding: "2px 8px", borderRadius: 10, fontSize: 11 }}>
            {f.field} {f.operator} {Array.isArray(f.value) ? f.value.join("–") : f.value}
          </span>
        ))}
        {query.sort && (
          <span style={{ background: "#FEE2E2", color: "#991B1B", padding: "2px 8px", borderRadius: 10, fontSize: 11 }}>
            sort: {query.sort.field} {query.sort.direction}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── left panel: text-only bubbles ───────────────────────── */
function TextBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 10,
    }}>
      <div style={{
        maxWidth: "82%",
        background: isUser ? "var(--accent)" : "var(--surface)",
        color:      isUser ? "#fff" : "var(--text)",
        border:     isUser ? "none" : "1px solid var(--border)",
        borderRadius: isUser ? "12px 12px 2px 12px" : "2px 12px 12px 12px",
        padding: "9px 13px",
        fontSize: 13,
        lineHeight: 1.55,
        whiteSpace: "pre-wrap",
        boxShadow: "var(--shadow-sm)",
      }}>
        {msg.content}
      </div>
    </div>
  );
}

/* ── main page ────────────────────────────────────────────── */
export default function SmartQuery() {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));

  // latest assistant message that has data to display on the right
  const activeResult = [...messages].reverse().find(m => m.role === "assistant");

  const send = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError(null);
    setMessages(prev => [...prev, { id: Date.now(), role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const res = await chatQueryService.sendMessage(trimmed, conversationHistory);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: res.assistantMessage,
        structuredQuery: res.structuredQuery,
        results: res.results || [],
        followUps: res.suggestedFollowUps || [],
      }]);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Something went wrong.";
      setError(msg);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: `Error: ${msg}`,
        results: [],
        followUps: [],
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, conversationHistory]);

  const handleKeyDown = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const clearChat = () => { setMessages([]); setError(null); inputRef.current?.focus(); };

  return (
    <Layout>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── header ── */}
        <div style={{
          flexShrink: 0, padding: "0 24px",
          height: 57, borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--surface)",
        }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>ANALYTICS</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Campaign Data Assistant</div>
          </div>
          {messages.length > 0 && (
            <button onClick={clearChat} style={{
              background: "none", border: "1px solid var(--border)",
              borderRadius: 6, padding: "5px 12px",
              fontSize: 12, cursor: "pointer", color: "var(--text-muted)",
            }}>
              Clear
            </button>
          )}
        </div>

        {/* ── 2-column body ── */}
        <div style={{
          flex: 1, minHeight: 0, display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 0, overflow: "hidden",
        }}>

          {/* ══ LEFT: conversation + input ══ */}
          <div style={{
            display: "flex", flexDirection: "column",
            borderRight: "1px solid var(--border)",
            minHeight: 0, overflow: "hidden",
          }}>

            {/* message scroll */}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px" }}>
              {messages.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
                  <div style={{ textAlign: "center", marginBottom: 20, color: "var(--text-muted)", fontSize: 13 }}>
                    <div style={{ fontWeight: 600, marginBottom: 3 }}>Ask about US election data</div>
                    <div style={{ fontSize: 11 }}>English or Spanish · counties, demographics, strategy</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                    {EXAMPLES.map((ex, i) => (
                      <button key={i} onClick={() => send(ex)} style={{
                        background: "var(--surface)", border: "1px solid var(--border)",
                        borderRadius: 7, padding: "9px 12px",
                        textAlign: "left", fontSize: 11.5,
                        color: "var(--text)", cursor: "pointer", lineHeight: 1.4,
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.background = "var(--blue-light)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map(msg => <TextBubble key={msg.id} msg={msg} />)}
                  {loading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--text-muted)", fontSize: 12.5, marginTop: 4 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--blue)", animation: "pulse 1s infinite" }} />
                      Analyzing…
                    </div>
                  )}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* input bar */}
            <div style={{
              flexShrink: 0, padding: "12px 16px 14px",
              borderTop: "1px solid var(--border)",
              background: "var(--surface)",
            }}>
              <div style={{
                display: "flex", gap: 8, alignItems: "flex-end",
                background: "var(--surface-2)",
                border: `1px solid ${error ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 8, padding: "7px 10px",
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about counties, results, demographics…"
                  rows={1}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    resize: "none", fontFamily: "inherit",
                    fontSize: 13, lineHeight: 1.5,
                    color: "var(--text)", maxHeight: 100,
                  }}
                />
                <button
                  onClick={() => send(input)}
                  disabled={loading || !input.trim()}
                  style={{
                    background: loading || !input.trim() ? "var(--border)" : "var(--accent)",
                    color: "white", border: "none", borderRadius: 6,
                    padding: "6px 14px", fontSize: 13, fontWeight: 600,
                    cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "…" : "Send"}
                </button>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 5 }}>
                Enter to send · Shift+Enter for new line
              </div>
            </div>
          </div>

          {/* ══ RIGHT: results ══ */}
          <div style={{ minHeight: 0, overflowY: "auto", padding: "16px 20px" }}>
            {!activeResult && !loading ? (
              <div style={{
                height: "100%", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                color: "var(--text-muted)", gap: 8,
              }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Results will appear here</div>
                <div style={{ fontSize: 11 }}>Send a query on the left to get started</div>
              </div>
            ) : loading && !activeResult ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)", animation: "pulse 1s infinite", marginRight: 8 }} />
                Fetching results…
              </div>
            ) : activeResult && (
              <>
                {activeResult.structuredQuery && (
                  <QueryCard query={activeResult.structuredQuery} />
                )}

                {activeResult.results?.length > 0 && (
                  <div style={{
                    border: "1px solid var(--border)", borderRadius: 8,
                    overflow: "hidden", marginBottom: 14,
                  }}>
                    <div style={{
                      padding: "8px 14px",
                      background: "var(--surface-2)",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
                    }}>
                      {activeResult.results.length} counties
                    </div>
                    <ResultTable rows={activeResult.results} />
                  </div>
                )}

                {activeResult.results?.length === 0 && activeResult.structuredQuery && (
                  <div style={{
                    textAlign: "center", padding: "32px 20px",
                    color: "var(--text-muted)", fontSize: 13,
                    border: "1px solid var(--border)", borderRadius: 8, marginBottom: 14,
                  }}>
                    No counties matched the filters.
                  </div>
                )}

              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </Layout>
  );
}
