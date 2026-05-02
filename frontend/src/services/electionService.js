import api from "./api";

export const electionService = {
  getAll: () => api.get("/elections/").then((r) => r.data),
  getResults: (electionId, state) =>
    api.get(`/elections/${electionId}/results`, { params: { state } }).then((r) => r.data),
  getCountyResult: (electionId, fips) =>
    api.get(`/elections/${electionId}/county/${fips}`).then((r) => r.data),
  getSwingCounties: (fromId, toId) =>
    api.get("/elections/swing-counties", { params: { from_id: fromId, to_id: toId } }).then((r) => r.data),
};
