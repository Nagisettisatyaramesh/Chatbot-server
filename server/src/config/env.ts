import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const env = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:4000",

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",

  adminCorsOrigin: (process.env.ADMIN_CORS_ORIGIN ?? "http://localhost:5173").split(","),

  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB ?? "10", 10),
};

export const isAiConfigured = () => env.anthropicApiKey.trim().length > 0;
