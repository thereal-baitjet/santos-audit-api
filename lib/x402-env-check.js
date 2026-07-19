export function x402EnvCheck() {
  const missing = [];
  if (!process.env.CDP_API_KEY_ID) missing.push("CDP_API_KEY_ID");
  if (!process.env.CDP_API_KEY_SECRET) missing.push("CDP_API_KEY_SECRET");
  return missing;
}
