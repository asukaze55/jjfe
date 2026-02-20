net.asukaze.module((module, require) => {

/**
 * @param {string} command
 * @param {Object} json
 * @returns {Promise<string>}
 */
async function fetchJj(command, json) {
  const response = await fetch('/jj/' + command, {
    method: 'POST',
    headers: [['Content-Type', 'application/json']],
    body: JSON.stringify(json)
  });
  return response.text()
}

module.exports = { fetchJj };
});
