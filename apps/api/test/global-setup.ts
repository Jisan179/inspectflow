import { execSync } from "child_process";

/** Applies all migrations to the test database once before the suite runs. */
export default async function globalSetup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://inspectflow@127.0.0.1:5433/inspectflow_test";
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url },
  });
}
