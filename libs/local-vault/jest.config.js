const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

/** @type {import('jest').Config} */
module.exports = {
  displayName: "local-vault",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  // Resolve the workspace aliases (@localpass/*) the same way the build does.
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths ?? {}, {
    prefix: "<rootDir>/../../",
  }),
  moduleFileExtensions: ["ts", "js", "html"],
  coverageDirectory: "../../coverage/libs/local-vault",
};
