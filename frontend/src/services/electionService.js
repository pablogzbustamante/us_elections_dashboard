import api from "./api";

export const electionService = {
  getAll: () => api.get("/elections/").then((r) => r.data),
  getCountyResult: (electionId, fips) =>
    api.get(`/elections/${electionId}/county/${fips}`).then((r) => r.data),
};
