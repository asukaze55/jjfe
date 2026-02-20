net.asukaze.module((module, require) => {

/**
 * @param {string} command
 * @param {Object} json
 * @returns {Promise<string>}
 */
function fetchJj(command, json) {
  return /** @type {any} */(window).__TAURI__.core.invoke(command, json);
}

module.exports = { fetchJj };
});
