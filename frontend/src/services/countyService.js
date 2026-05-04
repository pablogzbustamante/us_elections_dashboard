import api from "./api";

export const countyService = {
  getByFips: (fips) => api.get(`/counties/${fips}`).then((r) => r.data),
  getWinnerHistory: (fips) => api.get(`/counties/${fips}/winner-history`).then((r) => r.data),
};
