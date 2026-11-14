module.exports = {
  testRegex: "test/.*\.test\.ts$",
  transform: {
    "^.+\.ts$": ["ts-jest", { diagnostics: false, tsconfig: { module: "commonjs", target: "ES2019", esModuleInterop: true } }],
  },
  testEnvironment: "jsdom",
};
