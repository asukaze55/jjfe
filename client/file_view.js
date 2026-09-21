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

/** @typedef {{ lineNumber?: number, text: string, isWarning?: boolean }} DiffLineData */
/** @typedef {{ type: 'change'|'content'|'section', deleted?: DiffLineData, inserted?: DiffLineData }} DiffLine */

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

/**
 * @param {string[]} lines
 * @returns {DiffLine[]}
 */
function parseDiffLines(lines) {
  /** @type {DiffLine[]} */
  const diffLines = [];
  let deletedLineNumber = 1;
  let insertedLineNumber = 1;
  /** @type {DiffLineData[]} */
  const deletedLines = [];
  /** @type {DiffLineData[]} */
  const insertedLines = [];
  let currentLines = insertedLines;
  for (const line of lines) {
    if (!line.startsWith('-') && !line.startsWith('+') &&
        !line.startsWith('\\')) {
      while (deletedLines.length > 0 || insertedLines.length > 0) {
        diffLines.push({
          type: 'change',
          deleted: deletedLines.shift(),
          inserted: insertedLines.shift()
        });
      }
    }

    if (line.startsWith('@')) {
      const match = line.match(/-(\d+),(\d+)?\s*\+(\d+),(\d+)?/);
      if (match) {
        deletedLineNumber = Number(match[1]);
        insertedLineNumber = Number(match[3]);
        diffLines.push({
          type: 'section',
          deleted: {text: `${match[1]},${match[2]}`},
          inserted: {text: `${match[3]},${match[4]}`}
        });
      }
    } else if (line.startsWith(' ')) {
      diffLines.push({
        type: 'content',
        deleted: {lineNumber: deletedLineNumber++, text: line.substring(1)},
        inserted: {lineNumber: insertedLineNumber++, text: line.substring(1)}
      });
    } else if (line.startsWith('-') && !line.startsWith('--- ')) {
      deletedLines.push({
        lineNumber: deletedLineNumber++,
        text: line.substring(1)
      });
      currentLines = deletedLines;
    } else if (line.startsWith('+') && !line.startsWith('+++ ')) {
      insertedLines.push({
        lineNumber: insertedLineNumber++,
        text: line.substring(1)
      });
      currentLines = insertedLines;
    } else if (line.startsWith('\\')) {
      currentLines.push({
        text: '⚠️' + line.substring(1),
        isWarning: true
      })
    }
  }
  return diffLines;
}

/**
 * @param {DiffLine[]} lines
 * @returns {HTMLDivElement[]}
 */
function renderDiffLines(lines) {
  const left = createElement('div', {className: 'diff'});
  const right = createElement('div', {className: 'diff'});
  for (const line of lines) {
    const deletedText = line.deleted?.text;
    const deletedLineNumber = line.deleted?.lineNumber ?? '';
    const insertedText = line.inserted?.text;
    const insertedLineNumber = line.inserted?.lineNumber ?? '';
    if (line.type == 'section') {
      left.append(createElement('div', {className: 'section'}, [deletedText]));
      right.append(
          createElement('div', {className: 'section'}, [insertedText]));
      continue;
    }
    if (line.type == 'content') {
      left.append(createLine(deletedLineNumber, '', [deletedText]));
      right.append(createLine(insertedLineNumber, '', [insertedText]));
      continue;
    }
    if (!deletedText || !insertedText ||
        line.deleted?.isWarning || line.inserted?.isWarning) {
      left.append((deletedText != null)
          ? createLine(deletedLineNumber, 'del', [deletedText])
          : createLine(''));
      right.append((insertedText != null)
          ? createLine(insertedLineNumber, 'ins', [insertedText])
          : createLine(''));
      continue;
    }

    let p = 0;
    while (p < deletedText.length && deletedText[p] == insertedText[p]) {
      p++;
    }
    let q = 0;
    while (q < deletedText.length - p && q < insertedText.length - p &&
        deletedText.at(-q - 1) == insertedText.at(-q - 1)) {
      q++;
    }
    left.append(createLine(deletedLineNumber, 'del', [
      deletedText.substring(0, p),
      createElement('span', {className: 'del'},
          [deletedText.substring(p, deletedText.length - q)]),
      deletedText.substring(deletedText.length - q)
    ]));
    right.append(createLine(insertedLineNumber, 'ins', [
      insertedText.substring(0, p),
      createElement('span', {className: 'ins'},
          [insertedText.substring(p, insertedText.length - q)]),
      insertedText.substring(insertedText.length - q)
    ]));
  }
  return [left, right];
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
    const diffLines = parseDiffLines(this.#response.split('\n'));
    this.element.append(...renderDiffLines(diffLines));
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
