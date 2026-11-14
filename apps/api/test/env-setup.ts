// Runs before every test file, before any application module is imported.
// Real environment variables win over .env, so tests never touch dev data.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://inspectflow@127.0.0.1:5433/inspectflow_test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-0123456789abcdef";
process.env.STORAGE_DRIVER = "local";
process.env.PUBLIC_API_URL = "http://localhost:5001";
process.env.CORS_ORIGINS = "http://localhost:3000";
process.env.WIDGET_RATE_LIMIT_PER_MIN = "1000";
process.env.AUTH_RATE_LIMIT_PER_MIN = "1000";
