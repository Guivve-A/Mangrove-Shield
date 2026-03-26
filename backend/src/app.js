const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const env = require("./config/env");
const sarRoutes = require("./routes/sarRoutes");
const weatherRoutes = require("./routes/weatherRoutes");
const vulnerabilityRoutes = require("./routes/vulnerabilityRoutes");
const { errorHandler, notFoundHandler } = require("./utils/errors");

const app = express();

const limiter = rateLimit({
  windowMs: env.rateLimitWindowSeconds * 1000,
  limit: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "rate_limit_exceeded",
    message: "Too many requests. Slow down and retry shortly.",
  },
});

app.use(helmet());
app.use(cors());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(limiter);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "mangroveshield-web-agent-backend",
    data_mode: env.dataMode,
    region: {
      id: env.regionId,
      name: env.regionName,
      bbox: env.guayaquilBbox,
    },
    now: new Date().toISOString(),
  });
});

app.use("/api/sar", sarRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/vulnerability", vulnerabilityRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
