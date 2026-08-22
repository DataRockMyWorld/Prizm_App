module.exports = {
  testEnvironment: "node",
  // expo-constants pulls in the whole expo-modules-core -> react-native
  // native-module chain, which has no business loading in a plain-Node
  // jest environment — stub it at the boundary instead.
  moduleNameMapper: {
    "^expo-constants$": "<rootDir>/test/mocks/expo-constants.js",
  },
};
