import "dotenv/config";

export const env = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDev: (process.env.NODE_ENV ?? "development") !== "production",

  databaseUrl: process.env.DATABASE_URL ?? "./data/live-data.json",
};
