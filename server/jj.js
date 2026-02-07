import { argv } from 'node:process';
import { execSync } from 'child_process';
import { IncomingMessage, ServerResponse } from 'http';

const isDev = argv.includes('--dev');

/**
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 */
function runJj(request, response) {
  if (request.method != 'POST') {
    response.writeHead(404, 'Use POST to run JJ commands.');
    return;
  }
  if (!isDev && request.headers['content-type'] != 'application/json') {
    response.writeHead(415, 'Use application/json to run JJ commands.');
    return;
  }

  let body = '';
  request.on('readable', () => {
    const read = request.read();
    if (read != null) {
      body += read;
    }
  });
  request.on('end', () => {
    try {
      const json = JSON.parse(body);
      const r = json.r ?? '@';
      let command = 'jj log';
      let options = {cwd: json.cwd};
      if (request.url == '/jj/abandon') {
        command = `jj abandon -r "${r}"`;
      } else if (request.url == '/jj/describe') {
        command = `jj describe -r "${r}" --stdin`;
        options.input = json.m;
      } else if (request.url == '/jj/diff') {
        command = `jj diff --git -r "${r}" --context ${json.c} "${json.f}"`;
      } else if (request.url == '/jj/edit') {
        command = `jj edit -r "${r}"`;
      } else if (request.url == '/jj/new') {
        command = `jj new -r "${r}"`;
      } else if (request.url == '/jj/rebase') {
        command = `jj rebase -s "${json.s}" -o "${json.o}"`;
      } else if (request.url == '/jj/show') {
        command = `jj show --name-only -r "${r}"`;
      } else if (request.url == '/jj/squash') {
        command = `jj squash -r "${r}"`;
      }
      const jjLog = execSync(command, options);

      const headers = {'Content-Type': 'text/plain; charset=utf-8'};
      if (isDev) {
        headers['Access-Control-Allow-Origin'] = '*';
      }
      response.writeHead(200, headers);
      response.end(String(jjLog));
    } catch (e) {
      console.error(e);
      response.writeHead(500, 'JJ command failed.');
      response.end(String(e));
    }
  });
}

export { runJj };
