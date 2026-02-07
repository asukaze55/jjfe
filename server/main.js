import { createServer } from 'http';
import { loadResources } from './resources.js';
import { runJj } from './jj.js';

const server = createServer((request, response) => {
  if (request.url.startsWith('/jj/')) {
    runJj(request, response);
  } else {
    loadResources(request, response);
  }
});

server.listen(7474);
console.log("Server running at http://localhost:7474/");
