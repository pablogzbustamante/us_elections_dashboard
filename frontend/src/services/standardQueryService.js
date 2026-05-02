import axios from "axios";

export const standardQueryService = {
  async getSchema() {
    const res = await axios.get("/api/standard-query/schema");
    return res.data;
  },

  async executeQuery(sql) {
    const res = await axios.post("/api/standard-query/execute", { sql });
    return res.data;
  },
};
