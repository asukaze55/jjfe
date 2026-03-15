net.asukaze.module((module, require) => {
const { createButton, createDialog, createDiv, createElement, createTitleBar } = require('./asukaze_dom.js');
const { fetchJj } = require('./fetch_jj.js');

/** @enum {number} */
const ExpansionState = {
  COLLAPSED: -1,
  MATCH: 0,
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
  /** @type {ExpansionState} */
  #expansionState;
  /** @type {string} */
  #response = '';

  /**
   * @param {string} path
   * @param {string} revision
   * @param {string} file
   * @param {ExpansionState} expansionState
   */
  constructor(path, revision, file, expansionState) {
    this.#path = path;
    this.#revision = revision;
    this.#file = file;
    this.#expansionState = expansionState;
    this.element = createDiv();
    this.#fetch();
  }

  async #fetch() {
    if (this.#expansionState != ExpansionState.COLLAPSED) {
      this.#response = await fetchJj('diff', {
        cwd: this.#path,
        r: this.#revision,
        f: this.#file,
        c: this.#expansionState
      });
    }
    this.#render();
  }

  #render() {
    this.element.innerHTML = '';
    this.element.append(createElement('div', {className: 'file-header'}, [
      createElement('span', {className: 'header-label'}, [this.#file]),
      createElement('span', {className: 'actions'}, [
        createButton('Collapse',
            () => this.setExpansionState(ExpansionState.COLLAPSED)),
        createButton('Diff',
            () => this.setExpansionState(ExpansionState.DIFF)),
        createButton('Expand',
            () => this.setExpansionState(ExpansionState.EXPANDED))
      ])
    ]));
    if (this.#expansionState == ExpansionState.COLLAPSED) {
      return;
    }
    const left = createElement('div', {className: 'diff'});
    const right = createElement('div', {className: 'diff'});
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

  /** @param {ExpansionState} expansionState */
  setExpansionState(expansionState) {
    if (expansionState != this.#expansionState) {
      this.#expansionState = expansionState;
      return this.#fetch();
    }
  }
}

class DiffsView {
  /** @type {string} */
  #path;
  /** @type {string} */
  #revision;
  /** @type {DiffView[]} */
  #diffViews = [];

  /**
   * @param {string} path
   * @param {string} revision
   */
  constructor(path, revision) {
    this.#path = path;
    this.#revision = revision;
    this.element = createDiv();
    this.#render();
  }

  #render() {
    this.element.innerHTML = '';
    const fileCount = this.#diffViews.length;
    const actionButtons = (fileCount < 2) ? [] : [
      createButton('Collapse All', () => {
        for (const diffView of this.#diffViews) {
          diffView.setExpansionState(ExpansionState.COLLAPSED);
        }
      }),
      createButton('Diff All', () => {
        for (const diffView of this.#diffViews) {
          diffView.setExpansionState(ExpansionState.DIFF);
        }
      }),
      createButton('Expand All', () => {
        for (const diffView of this.#diffViews) {
          diffView.setExpansionState(ExpansionState.EXPANDED);
        }
      })
    ];
    this.element.append(
      createElement('div', {className: 'section-header'}, [
        createElement('span', {className: 'header-label'}, [
          (fileCount == 1) ? '1 file changed' : `${fileCount} files changed`
        ]),
        createElement('span', {className: 'actions'}, actionButtons)
      ]), ...this.#diffViews.map(view => view.element));
  }

  /** @param {string[]} files */
  async setFiles(files) {
    const expansionState =
        (files.length > 1) ? ExpansionState.COLLAPSED : ExpansionState.DIFF;
    this.#diffViews = files.map(
        f => new DiffView(this.#path, this.#revision, f, expansionState));
    this.#render();
  }
}

class FileView {
  /** @type {string} */
  #path;
  /** @type {string} */
  #revision;
  /** @type {string} */
  #file;
  /** @type {string} */
  #string = '';
  /** @type {ExpansionState} */
  #expansionState = ExpansionState.COLLAPSED;
  /** @type {string} */
  #response = '';

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

  async #fetch() {
    if (this.#response == '' && this.#expansionState != ExpansionState.COLLAPSED) { 
      this.#response = await fetchJj('file_show', {
        cwd: this.#path,
        r: this.#revision,
        f: this.#file
      });
    }
    this.#render();
  }

  #render() {
    this.element.innerHTML = '';
    this.element.append(createElement('div', {className: 'file-header'}, [
      createElement('span', {className: 'header-label'}, [this.#file]),
      createElement('span', {className: 'actions'}, [
        createButton('Collapse',
            () => this.setExpansionState(ExpansionState.COLLAPSED)),
        createButton('Match',
            () => this.setExpansionState(ExpansionState.MATCH)),
        createButton('Expand',
            () => this.setExpansionState(ExpansionState.EXPANDED))
      ])
    ]));
    if (this.#expansionState == ExpansionState.COLLAPSED) {
      return;
    }
    const div = createElement('div', {className: 'file'});
    this.#response.split('\n').forEach((line, y) => {
      const match = line.includes(this.#string);
      if (!match && this.#expansionState != ExpansionState.EXPANDED) {
        return;
      }
      const lineDiv = createElement('div', {className: 'line'});
      lineDiv.dataset.lineNumber = String(y + 1);
      if (line.includes(this.#string)) {
        const spans = line.split(this.#string);
        lineDiv.append(spans[0]);
        for (let i = 1; i < spans.length; i++) {
          lineDiv.append(
              createElement('span', {className: 'match'}, [this.#string]),
              spans[i]);
        }
      } else {
        lineDiv.append(line);
      }
      div.append(lineDiv);
    });
    this.element.append(div);
  }

  /**
   * @param {string} string
   * @param {ExpansionState} expansionState
   */
  setContext(string, expansionState) {
    if (string != this.#string || expansionState != this.#expansionState) {
      this.#string = string;
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

class SearchView {
  /** @type {string} */
  #path;
  /** @type {string} */
  #revision;
  /** @type {string} */
  #string = '';
  /** @type {string[]} */
  #files = []
  /** @type {Map<string, FileView>} */
  #fileViews = new Map();

  /**
   * @param {string} path
   * @param {string} revision
   */
  constructor(path, revision) {
    this.#path = path;
    this.#revision = revision;
    this.element = createDiv();
    this.#render();
  }

  async #fetch() {
    const response = await fetchJj('file_search', {
      cwd: this.#path,
      r: this.#revision,
      p: '*' + this.#string + '*'
    });
    this.#files = response.split('\n').filter(f => f);
    this.#render();
  }

  #render() {
    this.element.innerHTML = '';
    const fileCount = this.#files.length;
    /** @type {FileView[]} */
    const fileViews = [];
    for (const file of this.#files) {
      let view = this.#fileViews.get(file);
      if (!view) {
        view = new FileView(this.#path, this.#revision, file);
        this.#fileViews.set(file, view);
      }
      view.setContext(this.#string,
          (fileCount > 1) ? ExpansionState.COLLAPSED : ExpansionState.DIFF);
      fileViews.push(view);
    }
    const actionButtons = (fileCount < 2) ? [] : [
      createButton('Collapse All', () => {
        for (const fileView of fileViews) {
          fileView.setExpansionState(ExpansionState.COLLAPSED);
        }
      }),
      createButton('Match All', () => {
        for (const fileView of fileViews) {
          fileView.setExpansionState(ExpansionState.MATCH);
        }
      }),
      createButton('Expand All', () => {
        for (const fileView of fileViews) {
          fileView.setExpansionState(ExpansionState.EXPANDED);
        }
      })
    ];
    this.element.append(
      createElement('div', {className: 'section-header'}, [
        createElement('span', {className: 'header-label'},
            [(fileCount == 1) ? '1 file found' : `${fileCount} files found`]),
        createElement('span', {className: 'actions'}, actionButtons)
      ]), ...fileViews.map(view => view.element));
  }

  /** @param {string} string */
  setSearchString(string) {
    if (string != this.#string) {
      this.#string = string;
      this.#fetch();
    }
  }
}

class BookmarkDialog {
  /** @type {Set<string>} */
  #bookmarksSet;
  /** @type {string} */
  #description;
  /** @type {string} */
  #path;
  /** @type {string} */
  #revision;

  /**
   * @param {Set<string>} bookmarksSet
   * @param {string} description
   * @param {string} path
   * @param {string} revision
   */
  constructor(bookmarksSet, description, path, revision) {
    this.#bookmarksSet = bookmarksSet;
    this.#description = description;
    this.#path = path;
    this.#revision = revision;
  }

  show() {
    return new Promise(resolve => {
      const select = createElement('select');
      for (const bookmark of this.#bookmarksSet) {
        select.append(createElement('option', {}, [bookmark]));
      }
      const dialog = createDialog([
        createTitleBar(`Change: ${this.#revision}`, () => {
          dialog.close();
          document.body.removeChild(dialog);
          resolve(null);
        }),
        createDiv('Bookmark: ', select),
        createElement('pre', {}, [this.#description]),
        createElement('div', {className: 'actions'}, [
          createButton('Move', async () => {
            await fetchJj('bookmark_move', {
              cwd: this.#path,
              r: this.#revision,
              b: select.value
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
            await fetchJj('describe', {
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
      this.#revisionsMap.forEach((line, revision) => {
        sourceSelect.append(createElement('option', {
          selected: (revision == this.#revision),
          value: revision
        }, [line]));
        ontoSelect.append(createElement('option', {value: revision}, [line]));
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
            await fetchJj('rebase', {
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
  /** @type {Map<string, string>} */
  #revisionsMap;
  /** @type {Set<string>} */
  #bookmarksSet;
  /** @type {RepositoryView} */
  #parent;
  /** @type {string} */
  #response = '';
  /** @type {HTMLDivElement} */
  #attributesDiv;
  /** @type {HTMLInputElement} */
  #searchInput;
  /** @type {DiffsView} */
  #diffsView;
  /** @type {SearchView} */
  #searchView;

  /**
   * @param {string} path
   * @param {string} revision
   * @param {Map<string, string>} revisionsMap
   * @param {Set<string>} bookmarksSet
   * @param {RepositoryView} parent
   */
  constructor(path, revision, revisionsMap, bookmarksSet, parent) {
    this.#path = path;
    this.#revision = revision;
    this.#revisionsMap = revisionsMap;
    this.#bookmarksSet = bookmarksSet;
    this.#parent = parent;
    this.#diffsView = new DiffsView(path, revision);
    this.#searchView = new SearchView(path, revision);
    this.#attributesDiv = createElement('div', {style: 'flex: 1'});
    this.#searchInput = createElement('input', {
      name: 'q',
      oninput: () => {
        this.#searchView.setSearchString(this.#searchInput.value);
        this.#render();
      }
    });
    this.attributesElement = createElement('div',
        {style: 'display: flex; flex-direction: column; height: 100%;'}, [
          this.#attributesDiv,
          createElement('div', {className: 'section-header'}, [
            createElement('span', {className: 'header-label'}),
            createElement('span', {className: 'actions'}, [
              createElement('label', {}, ['🔍', this.#searchInput])
            ])
          ])
        ]);
    this.filesElement = createDiv();
    this.#fetch();
  }

  async #fetch() {
    const cwd = this.#path;
    const r = this.#revision;
    if (!cwd || !r) {
      return;
    }

    this.#response = await fetchJj('show', {cwd, r});
    this.#render();
  }

  #render() {
    const cwd = this.#path;
    const r = this.#revision;
    if (!cwd || !r) {
      return;
    }

    const files = [];
    let attributes = '';
    let description = '';
    for (const line of this.#response.split('\n')) {
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
        files.push(line);
      }
    }
    description = description.trim();
    this.#diffsView.setFiles(files);

    const moreButtons =
        createElement('div', {style: 'display: none'}, [
          createButton('Abandon', async () => {
            await fetchJj('abandon', {cwd, r});
            this.#parent.fetch();
          }),
          createButton('Bookmark', async () => {
            await new BookmarkDialog(this.#bookmarksSet, description, cwd, r)
                .show();
            this.#parent.fetch();
          }),
          createButton('Rebase', async () => {
            await new RebaseDialog(this.#revisionsMap, cwd, r).show();
            this.#parent.fetch();
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
    this.#attributesDiv.innerHTML = '';
    this.#attributesDiv.append(
        createElement('div', {className: 'section-header'}, [
          createElement('span', {className: 'header-label'}, [`Change: ${r}`]),
          createElement('div', {className: 'actions'}, [
            createDiv(
                createButton('Describe', async () => {
                  await new DescribeDialog(description, cwd, r).show();
                  this.#parent.fetch();
                }),
                createButton('Edit', async () => {
                  await fetchJj('edit', {cwd, r});
                  this.#parent.fetch();
                }),
                createButton('New', async () => {
                  await fetchJj('new', {cwd, r});
                  this.#revision = '@';
                  this.#parent.fetch();
                }),
                createButton('Squash', async () => {
                  await fetchJj('squash', {cwd, r});
                  this.#revision = '@';
                  this.#parent.fetch();
                }),
                moreButton),
            moreButtons
          ]),
        ]),
        createElement('pre', {}, [attributes]),
        createElement('pre', {}, [description]));
    this.filesElement.innerHTML = '';
    if (this.#searchInput.value) {
      this.filesElement.append(this.#searchView.element);
    } else {
      this.filesElement.append(this.#diffsView.element);
    }
  }

  /** @param {string} revision */
  setRevision(revision) {
    if (revision != this.#revision) {
      this.#revision = revision;
      this.#searchInput.value = '';
      this.#diffsView = new DiffsView(this.#path, revision);
      this.#searchView = new SearchView(this.#path, revision);
      return this.#fetch();
    }
  }
}

class RepositoryView {
  /** @type {string} */
  #path;
  /** @type {ChangeView} */
  #changeView;
  /** @type {Array<{line: string, revision: string}>} */
  #revisionsTree = [];

  /** @param {string} path */
  constructor(path) {
    this.#path = path;
    this.#changeView =
        new ChangeView(this.#path, '@', new Map(), new Set(), this);
    this.element = createDiv();
    this.fetch();
  }

  async fetch() {
    const response = await fetchJj('log', {cwd: this.#path});

    const revisionsTree = [];
    const revisionsMap = new Map();
    const bookmarksSet = new Set();
    let revision = '';
    for (const line of response.split('\n')) {
      const match = line.match(/([k-z]{4})\s+([^\:]*)\:.*$/);
      if (match) {
        revision = match[1];
        const bookmarks = match[2].split(/\s/);
        for (const bookmark of bookmarks) {
          const bookmarkMatch = bookmark.match(/^[\w\d\.]+/);
          if (bookmarkMatch) {
            bookmarksSet.add(bookmarkMatch[0]);
          }
        }
        revisionsMap.set(revision, match[0]);
      }
      revisionsTree.push({line, revision});
    }

    this.#revisionsTree = revisionsTree;
    this.#changeView =
        new ChangeView(this.#path, '@', revisionsMap, bookmarksSet, this);
    localStorage.setItem('path', this.#path);
    this.#render();
  }

  #render() {
    const select = createElement('select', {
      className: 'log',
      name: 'log',
      size: 10,
      onchange: () => this.#changeView.setRevision(select.value)
    });
    for (const {line, revision} of this.#revisionsTree) {
      select.append(createElement('option', {value: revision}, [line]));
    }

    this.element.innerHTML = '';
    this.element.append(
        createElement('div', {style: 'display: flex'}, [
          createElement('div', {style: 'flex: 1'}, [
            createElement('div', {className: 'section-header'}, [
              createElement('span', {className: 'header-label'}, ['Log']),
              createElement('span', {className: 'actions'}, [
                createButton('Reload', () => {
                  this.fetch();
                })
              ])
            ]), select]),
          createElement('div', {style: 'flex: 1; padding-left: 1em;'},
            [this.#changeView.attributesElement])
        ]),
        createDiv(this.#changeView.filesElement));
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
        this.#render();
      }
    });
    this.element = createDiv(createElement('div', {style: 'display: flex;'}, [
      createElement('h1', {}, ['JJFE']),
      this.#input
    ]));
    this.#render();
  }

  #render() {
    this.#input.value = this.#path;
    while (this.element.children.length > 1) {
      this.element.lastChild?.remove();
    }
    if (!this.#path) {
      return;
    }
    this.element.append(new RepositoryView(this.#path).element);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const path = location.hash.substring(1) || localStorage.getItem('path') || '';
  document.getElementById('jjfe')?.append(new JjfeView(path).element);
});

});
