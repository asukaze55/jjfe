import { existsSync, readFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';

/**
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 */
function loadResources(request, response) {
  if (request.method != 'GET') {
    response.writeHead(404, 'Use GET to load resources.');
    return;
  }
  const url = URL.parse(request.url, 'http://localhost/');
  let filePath = 'resources/' + url.pathname;
  if (filePath.endsWith('/')) {
    filePath += 'index.html';
  }
  if (!existsSync(filePath)) {
    response.writeHead(404, 'Not Found');
    return;
  }

  let type = 'text/plain';
  if (filePath.endsWith('.html') || filePath.endsWith('/')) {
    type = 'text/html';
  } else if (filePath.endsWith('.js')) {
    type = 'text/javascript';
  }

  response.writeHead(200, {'Content-Type': `${type}; charset=utf-8`});
  response.end(readFileSync(filePath, {encoding: 'utf8'}));
}

export { loadResources };