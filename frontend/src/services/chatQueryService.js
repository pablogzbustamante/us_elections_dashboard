import api from "./api";

export const chatQueryService = {
  sendMessage: (message, conversationHistory = []) =>
    api.post("/chat/query", { message, conversationHistory }).then((r) => r.data),
};
