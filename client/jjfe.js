net.asukaze.module((module, require) => {
const { createButton, createDialog, createDiv, createElement, createTitleBar } = require('./asukaze_dom.js');
const { fetchJj } = require('./fetch_jj.js');

/** @typedef {{jj: string, cwd: string}} Environment */

/** @enum {number} */
const ExpansionState = {
  COLLAPSED: -1,
  MATCH: 0,
  DIFF: 5,
  EXPANDED: 1000
};

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
  /** @type {Environment} */
  #env;
  /** @type {string} */
  #revision;
  /** @type {DiffView[]} */
  #diffViews = [];

  /**
   * @param {Environment} env
   * @param {string} revision
   */
  constructor(env, revision) {
    this.#env = env;
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
        f => new DiffView(this.#env, this.#revision, f, expansionState));
    this.#render();
  }
}

class FileView {
  /** @type {Environment} */
  #env;
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
    if (this.#response == '' && this.#expansionState != ExpansionState.COLLAPSED) { 
      this.#response = await fetchJj('file_show', {
        ...this.#env,
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
  /** @type {Environment} */
  #env;
  /** @type {string} */
  #revision;
  /** @type {string} */
  #string = '';
  /** @type {string[]} */
  #files = []
  /** @type {Map<string, FileView>} */
  #fileViews = new Map();

  /**
   * @param {Environment} env
   * @param {string} revision
   */
  constructor(env, revision) {
    this.#env = env;
    this.#revision = revision;
    this.element = createDiv();
    this.#render();
  }

  async #fetch() {
    const response = await fetchJj('file_search', {
      ...this.#env,
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
        view = new FileView(this.#env, this.#revision, file);
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
  /** @type {Environment} */
  #env;
  /** @type {string} */
  #revision;

  /**
   * @param {Set<string>} bookmarksSet
   * @param {string} description
   * @param {Environment} env
   * @param {string} revision
   */
  constructor(bookmarksSet, description, env, revision) {
    this.#bookmarksSet = bookmarksSet;
    this.#description = description;
    this.#env = env;
    this.#revision = revision;
  }

  /** @returns {Promise<void>} */
  show() {
    return new Promise(resolve => {
      const select = createElement('select');
      for (const bookmark of this.#bookmarksSet) {
        select.append(createElement('option', {}, [bookmark]));
      }
      const dialog = createDialog([
        createTitleBar(`Bookmark ${this.#revision}`, () => dialog.close()),
        createDiv('Name: ', select),
        createElement('pre', {}, [this.#description]),
        createElement('div', {className: 'actions'}, [
          createButton('Move', async () => {
            await fetchJj('bookmark_move', {
              ...this.#env,
              r: this.#revision,
              b: select.value
            });
            dialog.close();
          })
        ])
      ]);
      dialog.addEventListener('close', () => {
        document.body.removeChild(dialog);
        resolve();
      }, {once: true});
      document.body.append(dialog);
      dialog.showModal();
    });
  }
}

class DescribeDialog {
  /** @type {string} */
  #description;
  /** @type {Environment} */
  #env;
  /** @type {string} */
  #revision;

  /**
   * @param {string} description
   * @param {Environment} env
   * @param {string} revision
   */
  constructor(description, env, revision) {
    this.#description = description;
    this.#env = env;
    this.#revision = revision;
  }

  /** @returns {Promise<void>} */
  show() {
    return new Promise(resolve => {
      const textarea = createElement('textarea', {
        cols: 80,
        name: 'description',
        rows: 10,
        value: this.#description
      });
      const dialog = createDialog([
        createTitleBar(`Describe ${this.#revision}`, () => dialog.close()),
        textarea,
        createElement('div', {className: 'actions'}, [
          createButton('Describe', async () => {
            await fetchJj('describe', {
              ...this.#env,
              r: this.#revision,
              m: textarea.value.trim()
            });
            dialog.close();
          })
        ])
      ]);
      dialog.addEventListener('close', () => {
        document.body.removeChild(dialog);
        resolve();
      }, {once: true});
      document.body.append(dialog);
      dialog.showModal();
    });
  }
}

class RebaseDialog {
  /** @type {Map<string, string>} */
  #revisionsMap;
  /** @type {Environment} */
  #env;
  /** @type {string} */
  #sourceRevision;
  /** @type {string} */
  #ontoRevision;

  /**
   * @param {Map<string, string>} revisionsMap
   * @param {Environment} env
   * @param {string} sourceRevision
   * @param {string=} ontoRevision
   */
  constructor(revisionsMap, env, sourceRevision, ontoRevision = '@') {
    this.#revisionsMap = revisionsMap;
    this.#env = env;
    this.#sourceRevision = sourceRevision;
    this.#ontoRevision = ontoRevision;
  }

  /** @returns {Promise<void>} */
  show() {
    return new Promise(resolve => {
      const sourceSelect = createElement('select');
      sourceSelect.append(createElement('option', {value: '@'}, ['@']));
      const ontoSelect = createElement('select');
      ontoSelect.append(createElement('option', {value: '@'}, ['@']));
      this.#revisionsMap.forEach((line, revision) => {
        sourceSelect.append(createElement('option', {
          selected: (revision == this.#sourceRevision),
          value: revision
        }, [line]));
        ontoSelect.append(createElement('option', {
          selected: (revision == this.#ontoRevision),
          value: revision
        }, [line]));
      });
      const dialog = createDialog([
        createTitleBar('Rebase', () => dialog.close()),
        createDiv('Source:'),
        sourceSelect,
        createDiv('Onto:'),
        ontoSelect,
        createElement('div', {className: 'actions'}, [
          createButton('Rebase', async () => {
            await fetchJj('rebase', {
              ...this.#env,
              s: sourceSelect.value,
              o: ontoSelect.value
            });
            dialog.close();
          })
        ])
      ]);
      dialog.addEventListener('close', () => {
        document.body.removeChild(dialog);
        resolve();
      }, {once: true});
      document.body.append(dialog);
      dialog.showModal();
    });
  }
}

class ChangeDetails {
  /**
   * @param {string} attributes
   * @param {string} description
   * @param {string[]} files
   */
  constructor(attributes, description, files) {
    /** @type {string} */
    this.attributes = attributes;
    /** @type {string} */
    this.description = description;
    /** @type {string[]} */
    this.files = files;
  }

  static EMPTY = new ChangeDetails(
      /* attributes= */ '', /* description= */ '', /* files= */ []);
}

class ChangeView {
  /** @type {Environment} */
  #env;
  /** @type {RepositoryView} */
  #parent;
  /** @type {string} */
  #revision = '';
  /** @type {ChangeDetails} */
  #changeDetails = ChangeDetails.EMPTY;
  /** @type {HTMLDivElement} */
  #attributesDiv;
  /** @type {HTMLInputElement} */
  #searchInput;
  /** @type {DiffsView?} */
  #diffsView = null;
  /** @type {SearchView?} */
  #searchView = null;

  /**
   * @param {Environment} env
   * @param {RepositoryView} parent
   */
  constructor(env, parent) {
    this.#env = env;
    this.#parent = parent;
    this.#attributesDiv = createElement('div', {style: 'flex: 1'});
    this.#searchInput = createElement('input', {
      name: 'q',
      oninput: () => {
        this.#searchView?.setSearchString(this.#searchInput.value);
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
  }

  /** @returns {Promise<ChangeDetails>} */
  async #fetch() {
    const cwd = this.#env.cwd;
    const r = this.#revision;
    if (!cwd || !r) {
      return ChangeDetails.EMPTY;
    }

    const response = await fetchJj('show', {...this.#env, r});

    const files = [];
    let attributes = '';
    let description = '';
    for (const line of response.split('\n')) {
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

    const changeDetails =
        new ChangeDetails(attributes, description.trim(), files);
    this.#changeDetails = changeDetails;
    this.#render();
    return changeDetails;
  }

  #render() {
    const cwd = this.#env.cwd;
    const r = this.#revision;
    if (!cwd || !r || !this.#diffsView || !this.#searchView) {
      return;
    }

    this.#diffsView.setFiles(this.#changeDetails.files);

    const moreMenu =
        new PopupMenu(createElement('dialog', {className: 'menu'}, [
          createElement('ul', {}, [
            createElement('li', {}, [
              createButton('Bookmark',
                  () => this.#parent.bookmark(r, this.#changeDetails))
            ]),
            createElement('li', {}, [
              createButton('Rebase', () => this.#parent.rebase(r))
            ]),
            createElement('li', {}, [
              createButton('Abandon', () => this.#parent.abandon(r))
            ])
          ])
        ]));

    this.#attributesDiv.innerHTML = '';
    this.#attributesDiv.append(
        createElement('div', {className: 'section-header'}, [
          createElement('span', {className: 'header-label'}, [`Change: ${r}`]),
          createElement('div', {className: 'actions'}, [
            createButton('Describe',
                () => this.#parent.describe(r, this.#changeDetails)),
            createButton('Edit', () => this.#parent.edit(r)),
            createButton('New', () => this.#parent.new(r)),
            createButton('Squash', () => this.#parent.squash(r)),
            moreMenu.createMoreButton(),
          ]),
        ]),
        createElement('pre', {}, [this.#changeDetails.attributes]),
        createElement('pre', {}, [this.#changeDetails.description]));
    this.filesElement.innerHTML = '';
    if (this.#searchInput.value) {
      this.filesElement.append(this.#searchView.element);
    } else {
      this.filesElement.append(this.#diffsView.element);
    }
  }

  revision() {
    return this.#revision;
  }

  /**
   * @param {string} revision
   * @returns {ChangeDetails|Promise<ChangeDetails>}
   */
  setRevision(revision) {
    if (revision == this.#revision) {
      return this.#changeDetails;
    }
    this.#revision = revision;
    this.#searchInput.value = '';
    this.#diffsView = new DiffsView(this.#env, revision);
    this.#searchView = new SearchView(this.#env, revision);
    return this.#fetch();
  }
}

class PopupMenu {
  /** @type {HTMLDialogElement} */
  #dialog;

  /** @param {HTMLDialogElement} dialog */
  constructor(dialog) {
    this.#dialog = dialog;
  }

  /** @returns {HTMLSpanElement} */
  createMoreButton() {
    const button = createElement('button', {
      ariaLabel: 'More options',
      className: 'icon-button',
      type: 'button'
    }, ['︙']);
    button.addEventListener('click', event => {
      if (!this.#dialog.open) {
        const rect = button.getBoundingClientRect();
        this.show(
            button, {right: rect.right+ scrollX, top: rect.bottom + scrollY});
        event.stopPropagation();
      }
    });
    return button;
  }

  /**
   * @param {Element} referenceElement
   * @param {{left?: number, right?: number, top?: number}} position
   * @returns {Promise<void>}
   */
  show(referenceElement, position) {
    return new Promise(resolve => {
      const dialog = this.#dialog;
      const closeDialog = () => dialog.close();
      dialog.addEventListener('close', () => {
        dialog.remove();
        document.removeEventListener('click', closeDialog);
        resolve();
      }, {once: true});
      referenceElement.after(dialog);
      document.addEventListener('click', closeDialog);
      if (position.left != null) {
        dialog.style.left = position.left + 'px';
      }
      if (position.top != null) {
        dialog.style.top = position.top + 'px';
      }
      dialog.show();
      if (position.right != null) {
        dialog.style.left =
            (position.right - dialog.getBoundingClientRect().width) + 'px';
      }
    });
  }
}

class RepositoryView {
  /** @type {Environment} */
  #env;
  /** @type {ChangeView} */
  #changeView;
  /** @type {Array<{line: string, revision: string}>} */
  #revisionsTree = [];
  /** @type {Map<string, string>} */
  #revisionsMap = new Map();
  /** @type {Set<string>} */
  #bookmarksSet = new Set();
  /** @type {number} */
  #fetchCount = 20;

  /** @param {Environment} env */
  constructor(env) {
    this.#env = env;
    this.#changeView = new ChangeView(this.#env, this);
    this.element = createDiv();
    this.fetch();
  }

  /** @param {string} revision */
  async abandon(revision) {
    await fetchJj('abandon', {...this.#env, r: revision});
    await this.fetch();
  }

  /**
   * @param {string} revision
   * @param {ChangeDetails|Promise<ChangeDetails>} changeDetails
   */
  async bookmark(revision, changeDetails) {
    const details = await changeDetails;
    await new BookmarkDialog(this.#bookmarksSet, details.description,
        this.#env, revision).show();
    await this.fetch();
  }

  /**
   * @param {string} revision
   * @param {ChangeDetails|Promise<ChangeDetails>} changeDetails
   */
  async describe(revision, changeDetails) {
    const details = await changeDetails;
    await new DescribeDialog(details.description, this.#env, revision).show();
    await this.fetch();
  }

  /** @param {string} revision */
  async edit(revision) {
    await fetchJj('edit', {...this.#env, r: revision});
    await this.fetch();
  }

  async fetch(fetchCount = 20, scrollTop = 0) {
    this.#fetchCount = fetchCount;
    const response = await fetchJj('log', {...this.#env, n: fetchCount});

    const revisionsTree = [];
    const revisionsMap = new Map();
    const bookmarksSet = new Set();
    for (const line of response.split('\n')) {
      const match = line.match(/([k-z]{4})\s+([^\:]*)\:.*$/);
      if (match) {
        const revision = match[1];
        const bookmarks = match[2].split(/\s/);
        for (const bookmark of bookmarks) {
          const bookmarkMatch = bookmark.match(/^[\w\d\.]+/);
          if (bookmarkMatch) {
            bookmarksSet.add(bookmarkMatch[0]);
          }
        }
        revisionsMap.set(revision, match[0]);
        if (!this.#changeView.revision() && /^[^\w]*\@/.test(line)) {
          this.#changeView.setRevision(revision);
        }
        revisionsTree.push({line, revision});
      } else if (/^[^\w]*\~/.test(line)) {
        revisionsTree.push({line, revision: '~'});
      } else {
        revisionsTree.push({line, revision: ''});
      }      
    }

    this.#revisionsTree = revisionsTree;
    this.#revisionsMap = revisionsMap;
    this.#bookmarksSet = bookmarksSet;
    localStorage.setItem('path', this.#env.cwd);
    this.#render(scrollTop);
  }

  /** @param {string} revision */
  async new(revision) {
    await fetchJj('new', {...this.#env, r: revision});
    await this.fetch();
  }

  /** @param {string} revision */
  async rebase(revision) {
    await new RebaseDialog(this.#revisionsMap, this.#env, revision).show();
    await this.fetch();
  }

  /** @param {number} scrollTop */
  #render(scrollTop) {
    const select = createElement('select', {
      className: 'log',
      name: 'log',
      size: 10
    });
    select.addEventListener('change', () => {
      const revision = select.value;
      if (revision != '' && revision != '~') {
        this.#changeView.setRevision(revision);
      }
    });
    select.addEventListener('mousedown', mouseDownEvent => {
      if (mouseDownEvent.button != 0) {
        return;
      }
      const revision =
          /** @type {HTMLOptionElement?} */(mouseDownEvent.target)?.value;
      if (!revision) {
        return;
      }
      /** @type {HTMLDivElement?} */
      let tip = null;
      /** @type {(event: MouseEvent) => void} */
      const onMouseMove = event => {
        if (!tip) {
          tip = createElement('div', {className: 'tip'}, [revision]);
          document.body.append(tip);
        }
        tip.style.left = (event.pageX + 8) + 'px';
        tip.style.top = event.pageY + 'px';
        select.style.cursor = 'grabbing';
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', async event => {
        document.removeEventListener('mousemove', onMouseMove);
        select.style.cursor = 'auto';
        if (!tip) {
          return;
        }
        document.body.removeChild(tip);
        const dropRevision = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest('option')?.value;
        if (dropRevision && revision != dropRevision) {
          await new RebaseDialog(
              this.#revisionsMap, this.#env, revision, dropRevision).show();
          await this.fetch();
        }
      }, {once: true});
    });
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        this.fetch(this.#fetchCount + 20, select.scrollTop);
      }
    }, {root: select});

    for (const {line, revision} of this.#revisionsTree) {
      const option = createElement('option', {
        value: revision,
        selected: revision == this.#changeView.revision()
      }, [line]);
      if (revision == '~') {
        observer.observe(option);
      } else if (revision != '') {
        option.addEventListener('contextmenu', event => {
          option.selected = true;
          const changeDetails = this.#changeView.setRevision(revision);
          new PopupMenu(createElement('dialog', {className: 'menu'}, [
            createElement('ul', {}, [
              createElement('li', {}, [
                createButton(
                    'Describe', () => this.describe(revision, changeDetails))
              ]),
              createElement('li', {}, [
                createButton('Edit', () => this.edit(revision))
              ]),
              createElement('li', {}, [
                createButton('New', () => this.new(revision))
              ]),
              createElement('li', {}, [
                createButton('Squash', () => this.squash(revision))
              ]),
              createElement('li', {}, [
                createButton(
                    'Bookmark', () => this.bookmark(revision, changeDetails))
              ]),
              createElement('li', {}, [
                createButton('Rebase', () => this.rebase(revision))
              ]),
              createElement('li', {}, [
                createButton('Abandon', () => this.abandon(revision))
              ]),
            ])
          ])).show(select, {left: event.pageX, top: event.pageY});
          event.preventDefault();
        });
      }
      select.append(option);
    }

    const moreMenu =
        new PopupMenu(createElement('dialog', {className: 'menu'}, [
          createElement('ul', {}, [
            createElement('li', {}, [createButton('Undo', () => this.#undo())])
          ])
        ]));

    this.element.innerHTML = '';
    this.element.append(
        createElement('div', {style: 'display: flex'}, [
          createElement('div', {style: 'flex: 1'}, [
            createElement('div', {className: 'section-header'}, [
              createElement('span', {className: 'header-label'}, ['Log']),
              createElement('span', {className: 'actions'}, [
                createButton('Reload', () => {
                  this.#changeView = new ChangeView(this.#env, this);
                  this.fetch();
                }),
                moreMenu.createMoreButton()
              ])
            ]), select]),
          createElement('div', {style: 'flex: 1; padding-left: 1em;'},
            [this.#changeView.attributesElement])
        ]),
        createDiv(this.#changeView.filesElement));
    select.focus();
    setTimeout(() => select.scrollTop = scrollTop);
  }

  /** @param {string} revision */
  async squash(revision) {
    await fetchJj('squash', {...this.#env, r: revision});
    await this.fetch();
  }

  async #undo() {
    await fetchJj('undo', this.#env);
    await this.fetch();
  }
}

class SettingsDialog {
  /** @type {Environment} */
  #env;

  /** @param {Environment} env */
  constructor(env) {
    this.#env = env;
  }

  /** @returns {Promise<void>} */
  show() {
    return new Promise(resolve => {
      const input = createElement('input', {value: this.#env.jj});
      const dialog = createDialog([
        createTitleBar('Settings', () => dialog.close()),
        createDiv('Path to jj: ', input),
        createElement('div', {className: 'actions'}, [
          createButton('Done', async () => {
            this.#env.jj = input.value || 'jj';
            localStorage.setItem('jj', this.#env.jj);
            dialog.close();
          })
        ])
      ]);
      dialog.addEventListener('close', () => {
        document.body.removeChild(dialog);
        resolve();
      }, {once: true});
      document.body.append(dialog);
      dialog.showModal();
    });
  }
}

class JjfeView {
  /** @type {Environment} */
  #env;
  /** @type {HTMLInputElement} */
  #input;

  /** @param {Environment} env */
  constructor(env) {
    this.#env = env;
    this.#input = createElement('input', {
      name: 'env',
      style: 'flex: auto; margin: 8px;',
      onchange: () => {
        this.#env.cwd = this.#input.value;
        location.hash = '#' + this.#env.cwd;
        this.#render();
      }
    });
    this.element = createDiv(createElement('div', {style: 'display: flex;'}, [
      createElement('h1', {}, ['JJFE']),
      this.#input,
      createButton('🛠️',
          () => new SettingsDialog(this.#env).show(), {style: 'margin: 8px 0'})
    ]));
    this.#render();
  }

  #render() {
    this.#input.value = this.#env.cwd;
    while (this.element.children.length > 1) {
      this.element.lastChild?.remove();
    }
    if (!this.#env.cwd) {
      return;
    }
    this.element.append(new RepositoryView(this.#env).element);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const jj = localStorage.getItem('jj') || 'jj'; 
  const cwd = location.hash.substring(1) || localStorage.getItem('path') || '';
  document.getElementById('jjfe')?.append(new JjfeView({jj, cwd}).element);
});

});
