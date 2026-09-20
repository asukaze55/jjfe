net.asukaze.module((module, require) => {
const { createButton, createDiv, createElement } = require('./asukaze_dom.js');
const { fetchJj } = require('./fetch_jj.js');

/** @typedef {{jj: string, cwd: string}} Environment */

const ExpansionState = /** @type {const} */({
  COLLAPSED: -1,
  CONTEXT: 5,
  EXPANDED: 1000
});
/** @typedef {(typeof ExpansionState)[keyof typeof ExpansionState]} ExpansionState */

/**
 * @param {number|string} lineNumber
 * @param {string=} className
 * @param {Array<Node|string>=} children
 * @returns {HTMLDivElement}
 */
function createLine(lineNumber, className = '', children = []) {
  const div = createElement('div', {className: 'line'}, children);
  div.dataset.lineNumber = String(lineNumber);
  if (className) {
    div.classList.add(className);
  }
  return div;
}

class DiffView {
  /** @type {Environment} */
  #env;
  /** @type {string} */
  #revision;
  /** @type {string} */
  #file;
  /** @type {ExpansionState} */
  #expansionState;
  /** @type {string} */
  #response = '';

  /**
   * @param {Environment} env
   * @param {string} revision
   * @param {string} file
   * @param {ExpansionState} expansionState
   */
  constructor(env, revision, file, expansionState) {
    this.#env = env;
    this.#revision = revision;
    this.#file = file;
    this.#expansionState = expansionState;
    this.element = createDiv();
    this.#fetch();
  }

  async #fetch() {
    if (this.#expansionState != ExpansionState.COLLAPSED) {
      this.#response = await fetchJj('diff', {
        ...this.#env,
        r: this.#revision,
        f: this.#file,
        c: this.#expansionState
      });
    }
    this.#render();
  }

  #render() {
    this.element.replaceChildren(
        createElement('div', {className: 'file-header'}, [
          createElement('span', {className: 'header-label'}, [this.#file]),
          createElement('span', {className: 'actions'}, [
            createButton('Collapse',
                () => this.setExpansionState(ExpansionState.COLLAPSED)),
            createButton('Diff',
                () => this.setExpansionState(ExpansionState.CONTEXT)),
            createButton('Expand',
                () => this.setExpansionState(ExpansionState.EXPANDED))
          ])
        ]));
    if (this.#expansionState == ExpansionState.COLLAPSED) {
      return;
    }
    const left = createElement('div', {className: 'diff'});
    const right = createElement('div', {className: 'diff'});
    let leftLineNumber = 1;
    let rightLineNumber = 1;
    const deletedLines = [];
    const insertedLines = [];
    for (const line of this.#response.split('\n')) {
      if (!line.startsWith('-') && !line.startsWith('+')) {
        while (deletedLines.length > 0 || insertedLines.length > 0) {
          let deleted = deletedLines.shift();
          let inserted = insertedLines.shift();
          if (deleted && inserted) {
            let p = 0;
            while (p < deleted.length && deleted[p] == inserted[p]) {
              p++;
            }
            let q = 0;
            while (q < deleted.length - p && q < inserted.length - p &&
                deleted.at(-q - 1) == inserted.at(-q - 1)) {
              q++;
            }
            left.append(createLine(leftLineNumber++, 'del', [
              deleted.substring(0, p),
              createElement('span', {className: 'del'},
                  [deleted.substring(p, deleted.length - q)]),
              deleted.substring(deleted.length - q)
            ]));
            right.append(createLine(rightLineNumber++, 'ins', [
              inserted.substring(0, p),
              createElement('span', {className: 'ins'},
                  [inserted.substring(p, inserted.length - q)]),
              inserted.substring(inserted.length - q)
            ]));
          } else {
            if (deleted != null) {
              left.append(createLine(leftLineNumber++, 'del', [deleted]));
            } else {
              left.append(createLine(''));
            }
            if (inserted != null) {
              right.append(createLine(rightLineNumber++, 'ins', [inserted]));
            } else {
              right.append(createLine(''));
            }
          }
        }
      }

      if (line.startsWith('@')) {
        const match = line.match(/-(\d+),(\d+)?\s*\+(\d+),(\d+)?/);
        if (match) {
          leftLineNumber = Number(match[1]);
          rightLineNumber = Number(match[3]);
          left.append(createElement(
              'div', {className: 'section'}, [`${match[1]},${match[2]}`]));
          right.append(createElement(
              'div', {className: 'section'}, [`${match[3]},${match[4]}`]));
        }
      } else if (line.startsWith(' ')) {
        left.append(createLine(leftLineNumber++, '', [line.substring(1)]));
        right.append(createLine(rightLineNumber++, '', [line.substring(1)]));
      } else if (line.startsWith('-') && !line.startsWith('--- ')) {
        deletedLines.push(line.substring(1));
      } else if (line.startsWith('+') && !line.startsWith('+++ ')) {
        insertedLines.push(line.substring(1));
      }
    }
    this.element.append(left, right);
  }

  /** @param {ExpansionState} expansionState */
  setExpansionState(expansionState) {
    if (expansionState != this.#expansionState) {
      this.#expansionState = expansionState;
      return this.#fetch();
    }
  }
}

class FileView {
  /** @type {Environment} */
  #env;
  /** @type {string} */
  #revision;
  /** @type {string} */
  #file;
  /** @type {RegExp?} */
  #regExp = null;
  /** @type {ExpansionState} */
  #expansionState = ExpansionState.COLLAPSED;
  /** @type {string} */
  #response = '';

  /**
   * @param {Environment} env
   * @param {string} revision
   * @param {string} file
   */
  constructor(env, revision, file) {
    this.#env = env;
    this.#revision = revision;
    this.#file = file;
    this.element = createDiv();
  }

  async #fetch() {
    if (this.#response == '' &&
        this.#expansionState != ExpansionState.COLLAPSED) {
      this.#response = await fetchJj('file_show', {
        ...this.#env,
        r: this.#revision,
        f: this.#file
      });
    }
    this.#render();
  }

  #render() {
    this.element.replaceChildren(
        createElement('div', {className: 'file-header'}, [
          createElement('span', {className: 'header-label'}, [this.#file]),
          createElement('span', {className: 'actions'}, [
            createButton('Collapse',
                () => this.setExpansionState(ExpansionState.COLLAPSED)),
            createButton('Match',
                () => this.setExpansionState(ExpansionState.CONTEXT)),
            createButton('Expand',
                () => this.setExpansionState(ExpansionState.EXPANDED))
          ])
        ]));
    if (this.#expansionState == ExpansionState.COLLAPSED) {
      return;
    }
    const div = createElement('div', {className: 'file'});
    /** @type {string[]} */
    const contextLines = [];
    let lastMatch = -1;
    this.#response.split('\n').forEach((line, y) => {
      const matches = this.#regExp ? [...line.matchAll(this.#regExp)] : [];
      if (matches.length > 0) {
        if (div.hasChildNodes() &&
            lastMatch < y - 2 * this.#expansionState - 1) {
          div.append(createLine(''));
        }
        lastMatch = y;
        let contextLine;
        while ((contextLine = contextLines.shift()) != null) {
          div.append(createLine(y - contextLines.length, '', [contextLine]));
        }
        const lineDiv = createLine(y + 1);
        let lastIndex = 0;
        for (const match of matches) {
          const matchIndex = match.index;
          const matchText = match[0];
          if (matchIndex > lastIndex) {
            lineDiv.append(line.substring(lastIndex, matchIndex));
          }
          lineDiv.append(
              createElement('span', {className: 'match'}, [matchText]));
          lastIndex = matchIndex + matchText.length
        }
        if (lastIndex < line.length) {
          lineDiv.append(line.substring(lastIndex));
        }
        div.append(lineDiv);
      } else if (this.#expansionState == ExpansionState.EXPANDED ||
          (lastMatch >= 0 && y - lastMatch <= this.#expansionState)) {
        div.append(createLine(y + 1, '', [line]));
      } else {
        contextLines.push(line);
        if (contextLines.length > this.#expansionState) {
          contextLines.shift();
        }
      }
    });
    this.element.append(div);
  }

  /**
   * @param {RegExp?} regExp
   * @param {ExpansionState} expansionState
   */
  setContext(regExp, expansionState) {
    if (regExp != this.#regExp || expansionState != this.#expansionState) {
      this.#regExp = regExp;
      this.#expansionState = expansionState;
      this.#fetch();
    }
  }

  /** @param {ExpansionState} expansionState */
  setExpansionState(expansionState) {
    if (expansionState != this.#expansionState) {
      this.#expansionState = expansionState;
      this.#fetch();
    }
  }
}

module.exports = { DiffView, ExpansionState, FileView };
});
