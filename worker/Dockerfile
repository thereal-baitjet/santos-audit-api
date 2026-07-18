# Santos Deep Audit worker — isolated Chromium container for Fly.io.
# Build from the REPO ROOT (needs lib/ + db/ + worker/):
#   fly deploy --config worker/fly.toml --dockerfile worker/Dockerfile
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

COPY worker/package.json worker/
RUN cd worker && npm install --omit=dev && npx playwright install chromium

COPY lib/ lib/
COPY db/ db/
COPY worker/ worker/

# Non-root: the Playwright base image ships the pwuser account.
RUN chown -R pwuser:pwuser /app
USER pwuser

ENV NODE_ENV=production
WORKDIR /app/worker
CMD ["node", "worker.js"]
