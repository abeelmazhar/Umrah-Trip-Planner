/**
 * Thin CommonJS wrapper around the ESM `web-push` package.
 * Tests replace `sendNotification` on this object; that does not work on the
 * ESM namespace Node returns from require('web-push').
 */
function lib() {
  return require('web-push');
}

module.exports = {
  setVapidDetails(...args) {
    return lib().setVapidDetails(...args);
  },
  sendNotification(...args) {
    return lib().sendNotification(...args);
  },
};
