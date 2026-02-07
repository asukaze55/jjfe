net.asukaze.module((module, require) => {

// DEV setting.
// Used if the uncompiled index.html is loaded.
// The server needs to run with `npm run start-dev`.

/**
 * @param {string} path
 * @param {Object} json
 * @returns {Promise<Response>}
 */
function fetchJj(path, json) {
  return fetch('http://localhost:7474' + path, {
    method: 'POST',
    body: JSON.stringify(json)
  });
}

module.exports = { fetchJj };
});
