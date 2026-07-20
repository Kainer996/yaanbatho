#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "tmp", "imagegen", "burbz-placeholder-manifest.json");
const args = process.argv.slice(2);

function numberArg(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

const skip = numberArg("--skip", 0);
const count = numberArg("--count", 10);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const selected = manifest.birds
  .filter((bird) => bird.status === "pending")
  .slice(skip, skip + count)
  .map(({ species, prompt, targetRelativePath }) => ({
    species,
    prompt,
    targetRelativePath,
  }));

process.stdout.write(JSON.stringify(selected));
