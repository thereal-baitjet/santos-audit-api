// Test-only resolve hook: Next resolves "next/server" through its bundler,
// but plain Node ESM needs the file extension. Lets node --test import route
// handlers (and the lib modules they use) unmodified.
export async function resolve(specifier, context, next) {
  return next(specifier === "next/server" ? "next/server.js" : specifier, context);
}
