import api from "./api";

export const analyticsService = {
  getDemographics: (fips, period) =>
    api.get(`/analytics/counties/${fips}/demographics`, { params: { period } }).then((r) => r.data),
  getEducation: (fips, period) =>
    api.get(`/analytics/counties/${fips}/education`, { params: { period } }).then((r) => r.data),
  getReligion: (fips) => api.get(`/analytics/counties/${fips}/religion`).then((r) => r.data),
  getCorrelation: (indicator, electionId) =>
    api.get("/analytics/correlation", { params: { indicator, election_id: electionId } }).then((r) => r.data),
  getEducationCountySummary: (electionId) =>
    api.get("/analytics/education/county-summary", { params: { election_id: electionId } }).then((r) => r.data),
  getEthnicityCountySummary: (electionId) =>
    api.get("/analytics/ethnicity/county-summary", { params: { election_id: electionId } }).then((r) => r.data),
  getAgeCountySummary: (electionId) =>
    api.get("/analytics/age/county-summary", { params: { election_id: electionId } }).then((r) => r.data),
};
