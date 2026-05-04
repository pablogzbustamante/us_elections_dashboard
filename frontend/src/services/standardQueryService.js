import api from "./api";

export const standardQueryService = {
  async getSchema() {
    const res = await api.get("/standard-query/schema");
    return res.data;
  },

  async executeQuery(sql) {
    const res = await api.post("/standard-query/execute", { sql });
    return res.data;
  },
};
