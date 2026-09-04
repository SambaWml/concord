import { io } from "socket.io-client";

// Em dev, o Vite faz proxy de /socket.io pro backend (porta 5000).
// Em produção, front e back são o mesmo serviço, então "" (mesma origem) basta.
export const socket = io("/", {
  autoConnect: false,
});
