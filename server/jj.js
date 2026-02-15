import { argv } from 'node:process';
import { execSync } from 'child_process';
import { IncomingMessage, ServerResponse } from 'http';

const isDev = argv.includes('--dev');

/**
 * @param {string} input
 * @param {RegExp} regexp
 * @returns {string}
 */
function validate(input, regexp) {
  if (regexp.test(input)) {
    return input;
  }
  throw `Validation Failed: ${input} !~ ${regexp}`;
}

/**
 * @param {string} input
 * @param {RegExp} regexp
 * @returns {string}
 */
function validateRevision(input) {
  if (input == '@') {
    return input;
  }
  return validate(input, /^[k-z]{8,32}$/);
}

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
      let command = 'jj log -r "ancestors(visible_heads(), 20)"';
      let options = {cwd: json.cwd};
      if (request.url == '/jj/abandon') {
        const r = validateRevision(json.r);
        command = `jj abandon -r "${r}"`;
      } else if (request.url == '/jj/bookmark-move') {
        const r = validateRevision(json.r);
        const b = validate(json.b, /^[\w\d\.]+$/);
        command = `jj bookmark move "${b}" -t "${r}"`;
      } else if (request.url == '/jj/describe') {
        const r = validateRevision(json.r);
        command = `jj describe -r "${r}" --stdin`;
        options.input = json.m;
      } else if (request.url == '/jj/diff') {
        const r = validateRevision(json.r);
        const c = validate(json.c, /^\d+$/);
        const f = validate(json.f, /^[^\"]+$/);
        command = `jj diff --git -r "${r}" --context ${c} "file:'${f}'"`;
      } else if (request.url == '/jj/edit') {
        const r = validateRevision(json.r);
        command = `jj edit -r "${r}"`;
      } else if (request.url == '/jj/new') {
        const r = validateRevision(json.r);
        command = `jj new -r "${r}"`;
      } else if (request.url == '/jj/rebase') {
        const s = validateRevision(json.s);
        const o = validateRevision(json.o);
        command = `jj rebase -s "${s}" -o "${o}"`;
      } else if (request.url == '/jj/show') {
        const r = validateRevision(json.r);
        command = `jj show --name-only -r "${r}"`;
      } else if (request.url == '/jj/squash') {
        const r = validateRevision(json.r);
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
