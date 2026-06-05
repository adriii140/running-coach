import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
    // directUrl se usa para migraciones (bypassa pgbouncer)
    ...(process.env["DIRECT_URL"] ? { directUrl: process.env["DIRECT_URL"] } : {}),
  },
});
