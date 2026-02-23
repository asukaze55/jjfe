net.asukaze.module((module, require) => {

/**
 * @param {string} command
 * @param {Object} json
 * @returns {Promise<string>}
 */
async function fetchJj(command, json) {
  try {
    const {invoke} = /** @type {any} */(window).__TAURI__.core;
    return await invoke(command, json);
  } catch (e) {
    alert(e);
    throw e;
  }
}

module.exports = { fetchJj };
});
