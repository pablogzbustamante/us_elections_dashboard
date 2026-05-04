#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const path = require("path");

let count = 0;
try {
  const out = execSync(
    'docker compose exec -T db psql -U elections -d electoral_dashboard -t -c "SELECT COUNT(*) FROM dim_state;"',
    { encoding: "utf8", stdio: "pipe" }
  );
  count = parseInt(out.trim()) || 0;
} catch {
  count = 0;
}

if (count > 0) {
  console.log(`Data already loaded (${count} states found). Skipping ETL.`);
  process.exit(0);
}

console.log("No data found — running ETL (this may take a few minutes)...");
const backendDir = path.join(__dirname, "..", "backend");
try {
  execSync("python etl/load.py", { stdio: "inherit", cwd: backendDir });
  console.log("ETL complete.");
} catch (err) {
  console.error("ETL failed:", err.message);
  process.exit(1);
}
