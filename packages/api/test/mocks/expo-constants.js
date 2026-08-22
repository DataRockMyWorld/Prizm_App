// Test-only stand-in for expo-constants: the real package pulls in the
// whole expo-modules-core -> react-native native-module chain, which has
// no business loading under a plain-Node jest environment. Tests that need
// a specific expoConfig.hostUri can reassign `Constants.expoConfig` before
// calling the code under test.
module.exports = {
  __esModule: true,
  default: {
    expoConfig: null,
  },
};
