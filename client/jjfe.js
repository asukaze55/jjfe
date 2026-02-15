net.asukaze.module((module, require) => {
const { createButton, createDialog, createDiv, createElement, createTitleBar } = require('./asukaze_dom.js');
const { fetchJj } = require('./fetch_jj.js');

/** @enum {number} */
const DiffFileContext = {
  COLLAPSED: -1,
  DIFF: 5,
  EXPANDED: 1000
};

class DiffView {
  /** @type {string} */
  #path;
  /** @type {string} */
  #revision;
  /** @type {string} */
  #file;
  /** @type {DiffFileContext} */
  context = DiffFileContext.DIFF;

  /**
   * @param {string} path
   * @param {string} revision
   * @param {string} file
   */
  constructor(path, revision, file) {
    this.#path = path;
    this.#revision = revision;
    this.#file = file;
    this.element = createDiv();
  }

  async render() {
    this.element.innerHTML = '';
    this.element.append(createElement('div', {className: 'diff-file-summary'}, [
      createElement('span', {className: 'summary-label'}, [this.#file]),
      createElement('span', {className: 'actions'}, [
        createButton('Collapse', () => {
          this.context = DiffFileContext.COLLAPSED;
          this.render();
        }),
        createButton('Diff', () => {
          this.context = DiffFileContext.DIFF;
          this.render();
        }),
        createButton('Expand', () => {
          this.context = DiffFileContext.EXPANDED;
          this.render();
        })
      ])
    ]));
    if (this.context == DiffFileContext.COLLAPSED) {
      return;
    }
    const response = await fetchJj('/jj/diff',
        {cwd: this.#path, r: this.#revision, f: this.#file, c: this.context});
    const text = await response.text();
    const left = createElement('div', {className: 'diff'});
    const right = createElement('div', {className: 'diff'});
    const deletedLines = [];
    const insertedLines = [];
    for (const line of text.split('\n')) {
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
            left.append(createElement('div', {className: 'del'}, [
              deleted.substring(0, p),
              createElement('span', {className: 'del'},
                  [deleted.substring(p, deleted.length - q)]),
              deleted.substring(deleted.length - q)
            ]));
            right.append(createElement('div', {className: 'ins'}, [
              inserted.substring(0, p),
              createElement('span', {className: 'ins'},
                  [inserted.substring(p, inserted.length - q)]),
              inserted.substring(inserted.length - q)
            ]));
          } else {
            if (deleted != null) {
              left.append(createElement('div', {className: 'del'}, [deleted]));
            } else {
              left.append(createDiv());
            }
            if (inserted != null) {
              right.append(
                  createElement('div', {className: 'ins'}, [inserted]));
            } else {
              right.append(createDiv());
            }
          }
        }
      }

      if (line.startsWith('@')) {
        const match = line.match(/\-(\d+,\d+)\s*\+(\d+,\d+)/);
        if (match) {
          left.append(createElement('div', {className: 'section'}, [match[1]]));
          right.append(
              createElement('div', {className: 'section'}, [match[2]]));
        }
      } else if (line.startsWith(' ')) {
        left.append(createDiv(line.substring(1)));
        right.append(createDiv(line.substring(1)));
      } else if (line.startsWith('-') && !line.startsWith('--- ')) {
        deletedLines.push(line.substring(1));
      } else if (line.startsWith('+') && !line.startsWith('+++ ')) {
        insertedLines.push(line.substring(1));
      }
    }
    this.element.append(left, right);
  }
}

class DescribeDialog {
  /** @type {string} */
  #description;
  /** @type {string} */
  #path;
  /** @type {string} */
  #revision;

  /**
   * @param {string} description
   * @param {string} path
   * @param {string} revision
   */
  constructor(description, path, revision) {
    this.#description = description;
    this.#path = path;
    this.#revision = revision;
  }

  show() {
    return new Promise(resolve => {
      const textarea = createElement('textarea', {
        cols: 80,
        name: 'description',
        rows: 10,
        value: this.#description
      });
      const dialog = createDialog([
        createTitleBar(`Change: ${this.#revision}`, () => {
          dialog.close();
          document.body.removeChild(dialog);
          resolve(null);
        }),
        textarea,
        createElement('div', {className: 'actions'}, [
          createButton('Describe', async () => {
            await fetchJj('/jj/describe', {
              cwd: this.#path,
              r: this.#revision,
              m: textarea.value.trim()
            });
            dialog.close();
            document.body.removeChild(dialog);
            resolve(null);
          })
        ])
      ]);
      document.body.append(dialog);
      dialog.showModal();
    });
  }
}

class RebaseDialog {
  /** @type {Map<string, string>} */
  #revisionsMap;
  /** @type {string} */
  #path;
  /** @type {string} */
  #revision;

  /**
   * @param {Map<string, string>} revisionsMap
   * @param {string} path
   * @param {string} revision
   */
  constructor(revisionsMap, path, revision) {
    this.#revisionsMap = revisionsMap;
    this.#path = path;
    this.#revision = revision;
  }

  show() {
    return new Promise(resolve => {
      const sourceSelect = createElement('select');
      sourceSelect.append(createElement('option', {value: '@'}, ['@']));
      const ontoSelect = createElement('select');
      ontoSelect.append(createElement('option', {value: '@'}, ['@']));
      this.#revisionsMap.forEach((description, revision) => {
        sourceSelect.append(createElement('option', {
          selected: (revision == this.#revision),
          value: revision
        }, [`${revision}: ${description}`]));
        ontoSelect.append(createElement(
            'option', {value: revision}, [`${revision}: ${description}`]));
      });
      const dialog = createDialog([
        createTitleBar('', () => {
          dialog.close();
          document.body.removeChild(dialog);
          resolve(null);
        }),
        createDiv('Source:'),
        sourceSelect,
        createDiv('Onto:'),
        ontoSelect,
        createElement('div', {className: 'actions'}, [
          createButton('Rebase', async () => {
            await fetchJj('/jj/rebase', {
              cwd: this.#path,
              s: sourceSelect.value,
              o: ontoSelect.value
            });
            dialog.close();
            document.body.removeChild(dialog);
            resolve(null);
          })
        ])
      ]);
      document.body.append(dialog);
      dialog.showModal();
    });
  }
}

class ChangeView {
  /** @type {string} */
  #path;
  /** @type {string} */
  #revision;
  /** @type {DiffView[]} */
  #diffViews = [];
  /** @type {RepositoryView} */
  #parent;
  /** @type {Map<string, string>} */
  #revisionsMap = new Map();

  /**
   * @param {string} path
   * @param {string} revision
   * @param {RepositoryView} parent
   */
  constructor(path, revision, parent) {
    this.#path = path;
    this.#revision = revision;
    this.#parent = parent;
    this.attributesElement = createDiv();
    this.diffElement = createDiv();
  }

  async render() {
    const cwd = this.#path;
    const r = this.#revision;
    if (!cwd || !r) {
      return;
    }
    const response = await fetchJj('/jj/show', {cwd, r});
    const text = await response.text();

    this.attributesElement.innerHTML = '';
    this.diffElement.innerHTML = '';
    this.#diffViews = [];
    let attributes = '';
    let description = '';
    for (const line of text.split('\n')) {
      if (line == '    (empty)(no description set)' ||
          line == '    (no description set)') {
        continue;
      } else if (line.startsWith('    ')) {
        description += `${line.substring(4)}\n`;
      } else if (line == '') {
        if (description != '') {
          description += '\n';
        }
      } else if (line.includes(':')) {
        attributes += `${line}\n`;
      } else {
        const diffView = new DiffView(cwd, r, line);
        this.#diffViews.push(diffView);
        diffView.render();
      }
    }
    description = description.trim();

    const moreButtons =
        createElement('div', {className: 'actions', style: 'display: none'}, [
          createButton('Abandon', async () => {
            await fetchJj('/jj/abandon', {cwd, r});
            this.#parent.render();
          }),
          createButton('Rebase', async () => {
            await new RebaseDialog(this.#revisionsMap, cwd, r).show();
            this.#parent.render();
          }),
        ]);
    const moreButton = createButton('v', () => {
      if (moreButtons.style.display == 'none') {
        moreButtons.style.display = '';
        moreButton.innerText = '^';
      } else {
        moreButtons.style.display = 'none';
        moreButton.innerText = 'v';
      }
    });
    this.attributesElement.append(
        createDiv(`Change: ${r}`),
        createElement('div', {className: 'actions'}, [
          createButton('Describe', async () => {
            await new DescribeDialog(description, cwd, r).show();
            this.#parent.render();
          }),
          createButton('Edit', async () => {
            await fetchJj('/jj/edit', {cwd, r});
            this.#parent.render();
          }),
          createButton('New', async () => {
            await fetchJj('/jj/new', {cwd, r});
            this.#revision = '@';
            this.#parent.render();
          }),
          createButton('Squash', async () => {
            await fetchJj('/jj/squash', {cwd, r});
            this.#revision = '@';
            this.#parent.render();
          }),
          moreButton
        ]),
        moreButtons,
        createElement('pre', {}, [attributes]),
        createElement('pre', {}, [description]));
    const actionButtons = (this.#diffViews.length < 2) ? [] : [
      createButton('Collapse All', () => {
        for (const diffView of this.#diffViews) {
          diffView.context = DiffFileContext.COLLAPSED;
          diffView.render();
        }
      }),
      createButton('Diff All', () => {
        for (const diffView of this.#diffViews) {
          diffView.context = DiffFileContext.DIFF;
          diffView.render();
        }
      }),
      createButton('Expand All', () => {
        for (const diffView of this.#diffViews) {
          diffView.context = DiffFileContext.EXPANDED;
          diffView.render();
        }
      })
    ];
    this.diffElement.append(createElement('div', {className: 'diff-summary'}, [
      createElement('span', {className: 'summary-label'},
          [(this.#diffViews.length == 1)
              ? '1 file' : `${this.#diffViews.length} files`]),
      createElement('span', {className: 'actions'}, actionButtons)
    ]), ...this.#diffViews.map(view => view.element));
  }

  /** @param {string} revision */
  setRevision(revision) {
    if (revision != this.#revision) {
      this.#revision = revision;
      return this.render();
    }
  }

  /** @param {Map<string, string>} revisionsMap */
  setRevisionsMap(revisionsMap) {
    this.#revisionsMap = revisionsMap;
  }
}

class RepositoryView {
  /** @type {string} */
  #path;
  /** @type {HTMLSelectElement} */
  #select;
  /** @type {ChangeView} */
  #changeView;
  /** @type {Map<string, string>} */
  #revisionsMap = new Map();

  /** @param {string} path */
  constructor(path) {
    this.#path = path;
    this.#select = createElement('select', {
      className: 'log',
      name: 'log',
      size: 10,
      onchange: () => this.#changeView.setRevision(this.#select.value)
    });
    this.#changeView = new ChangeView(this.#path, '@', this);
    this.element = createDiv(
        createElement('div', {style: 'display: flex'}, [
          createElement('div', {style: 'flex: 1'},
            [createDiv('Log'), this.#select]),
          createElement('div', {style: 'flex: 1; padding-left: 1em;'},
            [this.#changeView.attributesElement])
        ]),
        createDiv(this.#changeView.diffElement));
  }

  async render() {
    const response = await fetchJj('/jj/log', {cwd: this.#path});
    const text = await response.text();

    this.#select.innerHTML = '';
    this.#revisionsMap = new Map();
    let revision = '';
    for (const line of text.split('\n')) {
      const match = line.match(/[@◆○×].*([k-z]{8,32})/);
      if (match) {
        revision = match[1];
      } else if (!this.#revisionsMap.has(revision)) {
        const match2 = line.match(/[\s│├─╯╮]*(.*)/);
        if (match2) {
          this.#revisionsMap.set(revision, match2[1]);
        }
      }
      this.#select.append(createElement('option', {value: revision}, [line]));
    }
    this.#changeView.setRevisionsMap(this.#revisionsMap);
    this.#changeView.render();
  }
}

class JjfeView {
  /** @type {string} */
  #path;
  /** @type {HTMLInputElement} */
  #input;

  /** @param {string} path */
  constructor(path) {
    this.#path = path;
    this.#input = createElement('input', {
      name: 'path',
      style: 'flex: auto; margin: 8px;',
      onchange: () => {
        this.#path = this.#input.value;
        location.hash = '#' + this.#path;
        this.render();
      }
    });
    this.element = createDiv(createElement('div', {style: 'display: flex;'}, [
      createElement('h1', {}, ['JJFE']),
      this.#input
    ]));
  }

  async render() {
    this.#input.value = this.#path;
    while (this.element.children.length > 1) {
      this.element.lastChild?.remove();
    }
    if (!this.#path) {
      return;
    }
    const repositoryView = new RepositoryView(this.#path);
    repositoryView.render();
    this.element.append(repositoryView.element);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const jjfeView = new JjfeView(location.hash.substring(1));
  jjfeView.render();
  document.getElementById('jjfe')?.append(jjfeView.element);
});

});
