net.asukaze.module((module, require) => {

/**
 * @param {string} path
 * @param {Object} json
 * @returns {Promise<Response>}
 */
function fetchJj(path, json) {
  return fetch(path, {
    method: 'POST',
    headers: [['Content-Type', 'application/json']],
    body: JSON.stringify(json)
  });
}

module.exports = { fetchJj };
});
