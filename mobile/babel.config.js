module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // In this monorepo, force-resolve the Reanimated Babel plugin from `mobile/node_modules`
    // so it can correctly resolve `react-native-worklets/plugin` (also in `mobile/node_modules`).
    plugins: [require.resolve("react-native-reanimated/plugin", { paths: [__dirname] })],
  };
};


