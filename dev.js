// Dev runner for the serverless entry (api/index.js) — mirrors Vercel locally.
import app from "./api/index.js";
const PORT = process.env.PORT ?? 4031;
app.listen(PORT, () => console.log(`serverless entry listening on :${PORT}`));
