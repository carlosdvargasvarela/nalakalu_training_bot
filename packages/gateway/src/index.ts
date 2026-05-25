import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { chatRoutes } from "./routes/chat.js";
import { adminRoutes } from "./routes/admin.js";

const app = Fastify({ logger: true });

await app.register(multipart);

app.register(chatRoutes, { prefix: "/api" });
app.register(adminRoutes, { prefix: "/api/admin" });

app.get("/health", async () => ({ ok: true }));

const port = Number(process.env.GATEWAY_PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
console.log(`Gateway corriendo en http://localhost:${port}`);
