const path = require("path");
const { createRequire } = require("module");

function safeRequireJson(p) {
  try {
    // eslint-disable-next-line import/no-dynamic-require
    return require(p);
  } catch (e) {
    return { error: String(e) };
  }
}

function main() {
  const reanimatedPluginPath = require.resolve("react-native-reanimated/plugin");
  const reqFromReanimatedPlugin = createRequire(reanimatedPluginPath);

  const workletsPluginPath = reqFromReanimatedPlugin.resolve("react-native-worklets/plugin");
  const workletsPkgPath = reqFromReanimatedPlugin.resolve("react-native-worklets/package.json");

  const workletsPkg = safeRequireJson(workletsPkgPath);

  console.log("reanimatedPluginPath:", reanimatedPluginPath);
  console.log("workletsPluginPath:", workletsPluginPath);
  console.log("workletsPkgPath:", workletsPkgPath);
  console.log("workletsPkgVersion:", workletsPkg.version || workletsPkg);

  // Also show the default resolution from the current cwd.
  const defaultWorkletsPkgPath = require.resolve("react-native-worklets/package.json");
  console.log("defaultWorkletsPkgPath:", defaultWorkletsPkgPath);
  console.log("defaultWorkletsPkgVersion:", safeRequireJson(defaultWorkletsPkgPath).version);

  console.log("cwd:", process.cwd());
  console.log("node:", process.version);
  console.log("platform:", process.platform);
  console.log("scriptDir:", __dirname);
  console.log("repoRootGuess:", path.resolve(__dirname, ".."));
}

main();


