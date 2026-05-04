#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");

const MAX_RETRIES = 30;
const DELAY_MS = 2000;

function sleep(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }
}

console.log("Waiting for database to be ready...");

let ready = false;
for (let i = 0; i < MAX_RETRIES; i++) {
  try {
    execSync(
      "docker compose exec -T db pg_isready -U elections -d electoral_dashboard",
      { stdio: "pipe" }
    );
    ready = true;
    break;
  } catch {
    console.log(`  attempt ${i + 1}/${MAX_RETRIES}, retrying in ${DELAY_MS / 1000}s...`);
    sleep(DELAY_MS);
  }
}

if (!ready) {
  console.error("Database did not become ready in time. Is Docker running?");
  process.exit(1);
}

console.log("Database is ready.");
