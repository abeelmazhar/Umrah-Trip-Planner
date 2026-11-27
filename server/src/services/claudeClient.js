/**
 * Thin wrapper around the official Anthropic SDK.
 * Tests replace `streamAnswer` on this object.
 */
function sdk() {
  const mod = require('@anthropic-ai/sdk');
  return mod.default || mod;
}

let client;

function getClient() {
  if (!client) {
    const Anthropic = sdk();
    client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  }
  return client;
}

module.exports = {
  /** The SDK constructor, used to recognise typed API errors. */
  sdk,
  /** Returns the SDK MessageStream. The caller iterates it and calls finalMessage(). */
  streamAnswer(params) {
    return getClient().beta.messages.stream(params);
  },
};
