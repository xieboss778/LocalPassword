const { existsSync } = require("fs");
const { join } = require("path");

const { platform, arch } = process;

let nativeBinding = null;
let localFileExisted = false;
let loadError = null;

function loadFirstAvailable(localFiles, nodeModule) {
  for (const localFile of localFiles) {
    if (existsSync(join(__dirname, localFile))) {
      return require(`./${localFile}`);
    }
  }

  require(nodeModule);
}

switch (platform) {
  case "android":
    switch (arch) {
      case "arm64":
        nativeBinding = loadFirstAvailable(
          ["desktop_napi.android-arm64.node"],
          "@localpass/desktop-napi-android-arm64",
        );
        break;
      case "arm":
        nativeBinding = loadFirstAvailable(
          ["desktop_napi.android-arm.node"],
          "@localpass/desktop-napi-android-arm",
        );
        break;
      default:
        throw new Error(`Unsupported architecture on Android ${arch}`);
    }
    break;
  case "win32":
    switch (arch) {
      case "x64":
        nativeBinding = loadFirstAvailable(
          ["desktop_napi.win32-x64-msvc.node"],
          "@localpass/desktop-napi-win32-x64-msvc",
        );
        break;
      case "arm64":
        nativeBinding = loadFirstAvailable(
          ["desktop_napi.win32-arm64-msvc.node"],
          "@localpass/desktop-napi-win32-arm64-msvc",
        );
        break;
      default:
        throw new Error(`Unsupported architecture on Windows: ${arch}`);
    }
    break;
  case "darwin":
    switch (arch) {
      case "x64":
        nativeBinding = loadFirstAvailable(
          ["desktop_napi.darwin-x64.node"],
          "@localpass/desktop-napi-darwin-x64",
        );
        break;
      case "arm64":
        nativeBinding = loadFirstAvailable(
          ["desktop_napi.darwin-arm64.node"],
          "@localpass/desktop-napi-darwin-arm64",
        );
        break;
      default:
        throw new Error(`Unsupported architecture on macOS: ${arch}`);
    }
    break;
  case "linux":
    switch (arch) {
      case "x64":
        nativeBinding = loadFirstAvailable(
          ["desktop_napi.linux-x64-gnu.node"],
          "@localpass/desktop-napi-linux-x64-gnu",
        );
        break;
      case "arm64":
        nativeBinding = loadFirstAvailable(
          ["desktop_napi.linux-arm64-gnu.node"],
          "@localpass/desktop-napi-linux-arm64-gnu",
        );
        break;
      default:
        throw new Error(`Unsupported architecture on Linux: ${arch}`);
    }
    break;
  default:
    throw new Error(`Unsupported OS: ${platform}, architecture: ${arch}`);
}

if (!nativeBinding) {
  if (loadError) {
    throw loadError;
  }
  throw new Error(`Failed to load native binding`);
}

module.exports = nativeBinding;
