import api from "./api";

export const dashboardService = {
  getSummary:           (electionId) =>
    api.get("/dashboard/summary",             { params: { election_id: electionId } }).then((r) => r.data),
  getTrends:            ()           =>
    api.get("/dashboard/trends").then((r) => r.data),
  getStateSummary:      (electionId) =>
    api.get("/dashboard/state-summary",       { params: { election_id: electionId } }).then((r) => r.data),
  getCompetitive:       (electionId, limit = 25) =>
    api.get("/dashboard/competitive-counties",{ params: { election_id: electionId, limit } }).then((r) => r.data),
  getMapData:           (electionId) =>
    api.get("/dashboard/map",                 { params: { election_id: electionId } }).then((r) => r.data),
  getPartyComparison:   (electionId) =>
    api.get("/dashboard/party-comparison",    { params: { election_id: electionId } }).then((r) => r.data),
  getStateMapData:      (electionId) =>
    api.get("/dashboard/state-map",           { params: { election_id: electionId } }).then((r) => r.data),
  getSwingAnalysis:     (fromId, toId) =>
    api.get("/dashboard/swing-analysis",      { params: { from_election_id: fromId, to_election_id: toId } }).then((r) => r.data),
  getInequalityProxy: (electionId, state = null, limit = 50) =>
    api.get("/analytics/income/inequality-proxy", { params: { election_id: electionId, limit, ...(state && { state }) } }).then((r) => r.data),
  getIncomePopulation: (electionId, state = null) =>
    api.get("/analytics/income/population", { params: { election_id: electionId, ...(state && { state }) } }).then((r) => r.data),
  getIncomeSegments: (electionId, state = null) =>
    api.get("/analytics/income/segments", { params: { election_id: electionId, ...(state && { state }) } }).then((r) => r.data),
  getHousingAffordability: (electionId, state = null) =>
    api.get("/analytics/housing/affordability", { params: { election_id: electionId, ...(state && { state }) } }).then((r) => r.data),
  getEconomicStress: (electionId, state = null, limit = 20) =>
    api.get("/analytics/economic/stress", { params: { election_id: electionId, limit, ...(state && { state }) } }).then((r) => r.data),
  getIncomeCompetitiveness: (electionId, state = null) =>
    api.get("/analytics/income/competitiveness", { params: { election_id: electionId, ...(state && { state }) } }).then((r) => r.data),
  getIncomeQuintiles:   (electionId, state = null) =>
    api.get("/analytics/income/quintile-breakdown", { params: { election_id: electionId, ...(state && { state }) } }).then((r) => r.data),
  getPersuasionSegments: (electionId, state = null) =>
    api.get("/analytics/income/persuasion-segments", { params: { election_id: electionId, ...(state && { state }) } }).then((r) => r.data),
};
