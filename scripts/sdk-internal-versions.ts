/* eslint-disable no-console */

/// Ensure that `sdk-internal` and `commercial-sdk-internal` dependencies have matching versions.

import fs from "fs";
import path from "path";

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"),
);

const sdkInternal = packageJson.dependencies["@localpass/sdk-internal"];
const commercialSdkInternal = packageJson.dependencies["@localpass/commercial-sdk-internal"];

if (sdkInternal !== commercialSdkInternal) {
  console.error(
    `Version mismatch between @localpass/sdk-internal (${sdkInternal}) and @localpass/commercial-sdk-internal (${commercialSdkInternal}), must be an exact match.`,
  );
  process.exit(1);
}

console.log(`All dependencies have matching versions: ${sdkInternal}`);
