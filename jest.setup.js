// Jest setup file to bypass localStorage initialization in Node v22+
// This prevents SecurityError: Cannot initialize local storage without a `--localstorage-file` path

// Mock localStorage to prevent initialization error
globalThis.localStorage = undefined;
