net.asukaze.module((module, require) => {

// DEV setting.
// Used if the uncompiled index.html is loaded.
// The server needs to run with `npm run start-dev`.

/**
 * @param {string} command
 * @param {Object} json
 * @returns {Promise<string>}
 */
async function fetchJj(command, json) {
  try {
    const response = await fetch('http://localhost:7474/jj/' + command, {
      method: 'POST',
      body: JSON.stringify(json)
    });
    if (response.status != 200) {
      throw new Error(response.statusText + '\n\n' + await response.text());
    }
    return await response.text();
  } catch (e) {
    alert(e);
    throw e;
  }
}

module.exports = { fetchJj };
});
