import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(`tests/.sessions.test.generated-${process.pid}.mjs`);

try {
  await build({
    entryPoints: [resolve("tests/sessions.test.ts")],
    bundle: true,
    packages: "external",
    platform: "node",
    format: "esm",
    outfile: output,
    logLevel: "silent",
  });
  const result = spawnSync(process.execPath, ["--test", output], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production", LOG_LEVEL: "silent" },
  });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(output, { force: true });
}