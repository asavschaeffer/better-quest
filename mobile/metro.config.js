/**
 * NOTE: Keep this file CommonJS.
 * Metro/Expo loads `metro.config.js` with `require()`. If `mobile/package.json` has
 * `"type": "module"`, Node will treat this `.js` file as ESM and Expo can fail to start.
 * If you ever need ESM-by-default in `mobile/`, rename this to `metro.config.cjs`.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Resolve modules from both mobile and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Ensure single instances of React and React Native (prevents duplicate module errors)
config.resolver.extraNodeModules = {
  'react': path.resolve(monorepoRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
};

module.exports = config;
