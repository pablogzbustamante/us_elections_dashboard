import api from "./api";

export const countyService = {
  getAll: (state) => api.get("/counties/", { params: { state } }).then((r) => r.data),
  getByFips: (fips) => api.get(`/counties/${fips}`).then((r) => r.data),
  search: (q) => api.get("/counties/search", { params: { q } }).then((r) => r.data),
  getWinnerHistory: (fips) => api.get(`/counties/${fips}/winner-history`).then((r) => r.data),
  getStates: () => api.get("/states/").then((r) => r.data),
};
