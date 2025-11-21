/**
 * Custom Jest environment that extends node environment
 * but prevents localStorage initialization error in Node v22+
 */

import JestNodeEnvironment from 'jest-environment-node';

// Handle ES module default export
const NodeEnvironment = JestNodeEnvironment.default || JestNodeEnvironment;

export default class CustomNodeEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    
    // Prevent localStorage initialization
    this.global.localStorage = undefined;
  }

  async setup() {
    await super.setup();
  }

  async teardown() {
    await super.teardown();
  }
}
