const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const existingBlockList = config.resolver.blockList;

config.resolver.blockList = [
  ...(Array.isArray(existingBlockList) ? existingBlockList : existingBlockList != null ? [existingBlockList] : []),
  /.*\/__tests__\/.*/,
  /.*\/src\/.*\.test\.[jt]sx?$/,
];

module.exports = config;
