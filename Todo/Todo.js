"use strict";

const TRASH_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
  '<path fill="currentColor" d="M9 3h6l1 1h4v2H4V4h4l1-1zm-3 5h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8z"/></svg>';

/* Allowed filters. TypeScript checked this for us; in JS we list them ourselves. */
const FILTERS = ["all", "active", "completed"];

/* ---------- [class] [get/set] One todo item ---------- */
class Todo {
  #id;
  #text = "";
  completed;

  constructor(id, text, completed = false) {
    this.#id = id;
    this.completed = completed;
    this.text = text; // goes through the setter, so it is always trimmed
  }

  /* read-only: there is a getter but no setter, so `todo.id = 5` is ignored/throws in strict mode */
  get id() {
    return this.#id;
  }

  /* [get/set] reading/writing `todo.text` runs these functions */
  get text() {
    return this.#text;
  }
  set text(value) {
    this.#text = String(value).trim();
  }

  /* [get/set] computed property: no parentheses needed when reading it */
  get isActive() {
    return !this.completed;
  }

  /* JSON.stringify calls this, so only plain data is saved */
  toJSON() {
    return { id: this.#id, text: this.#text, completed: this.completed };
  }
}

/* ---------- [class] The data layer: knows nothing about the DOM ---------- */
class TodoStore {
  _items = [];
  _nextId = 1;
  #listeners = [];

  /* [callback] the view hands us a function; we call it back after every change */
  subscribe(listener) {
    this.#listeners = [...this.#listeners, listener]; // [spread]
  }

  _commit() {
    this.#listeners.forEach((listener) => listener()); // [arrow] [callback]
  }

  _load(items) {
    this._items = items;
    // [array] reduce + [destruct] ({ id }) : find the biggest id so far
    this._nextId = items.reduce((max, { id }) => Math.max(max, id), 0) + 1;
  }

  get total() {
    return this._items.length;
  }

  get remaining() {
    return this._items.filter((todo) => todo.isActive).length; // [array] filter
  }

  get completedIds() {
    return this._items.filter((todo) => todo.completed).map(({ id }) => id); // filter + map
  }

  visible(filter) {
    switch (filter) {
      case "active":
        return this._items.filter((todo) => todo.isActive);
      case "completed":
        return this._items.filter((todo) => todo.completed);
      default:
        return [...this._items]; // [spread] copy so callers cannot mutate our array
    }
  }

  add(text) {
    const clean = text.trim();
    if (!clean) return false;
    this._items = this._items.concat(new Todo(this._nextId++, clean)); // [array] concat
    this._commit();
    return true;
  }

  toggle(id) {
    const todo = this._items.find((item) => item.id === id); // [array] find
    if (!todo) return;
    todo.completed = !todo.completed;
    this._commit();
  }

  edit(id, text) {
    const todo = this._items.find((item) => item.id === id);
    if (!todo) return;
    todo.text = text; // [get/set] setter trims the text
    if (!todo.text) {
      this.remove(id); // an empty text means "delete it"
      return;
    }
    this._commit();
  }

  remove(id) {
    const index = this._items.findIndex((item) => item.id === id);
    if (index === -1) return;
    this._items.splice(index, 1); // [array] splice(position, howManyToRemove)
    this._commit();
  }

  /* [spread/rest] `...ids` packs every argument into one array */
  removeMany(...ids) {
    if (ids.length === 0) return;
    this._items = this._items.filter((todo) => !ids.includes(todo.id));
    this._commit();
  }

  clearCompleted() {
    this.removeMany(...this.completedIds); // [spread] unpack the array into arguments
  }

  clearAll() {
    if (this._items.length === 0) return;
    this._items.splice(0); // remove everything from index 0
    this._commit();
  }
}

/* ---------- [inherit] Same store, plus saving to localStorage ---------- */
class PersistentTodoStore extends TodoStore {
  #key;

  constructor(key) {
    super(); // run the parent constructor first
    this.#key = key;
    this.#restore();
  }

  /* override the parent's _commit: save first, then let the parent notify listeners */
  _commit() {
    this.#persist();
    super._commit();
  }

  #persist() {
    try {
      localStorage.setItem(this.#key, JSON.stringify(this._items));
    } catch {
      /* storage full or blocked: the app still works, it just won't remember */
    }
  }

  #restore() {
    try {
      const raw = localStorage.getItem(this.#key);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved)) return;
      // [array] map + [destruct] turn plain objects back into Todo instances
      this._load(saved.map(({ id, text, completed }) => new Todo(id, text, completed)));
    } catch {
      /* corrupt data: start empty */
    }
  }
}

/* ---------- Helper: get an element or fail loudly ---------- */
function requireEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`); // [template]
  return el;
}

/* ---------- [class] The view/controller: DOM + events ---------- */
class TodoApp {
  #store;
  #filter = "all";
  #editingId = null;
  #savedTimer;

  /* DOM: select every node once */
  #form = requireEl("todo-form");
  #input = requireEl("todo-input");
  #filtersEl = requireEl("filters");
  #listEl = requireEl("todo-list");
  #emptyEl = requireEl("empty");
  #countEl = requireEl("count");
  #savedEl = requireEl("saved");
  #clearCompletedBtn = requireEl("clear-completed");
  #clearAllBtn = requireEl("clear-all");
  #filterButtons = document.querySelectorAll("#filters .filter");

  #emptyMessages = {
    all: "Nothing to do yet. Add your first todo above.",
    active: "No active todos.",
    completed: "No completed todos yet.",
  };

  constructor(store) {
    this.#store = store;
    // [callback] every store change re-draws the screen and flashes "Saved"
    this.#store.subscribe(() => {
      this.#render();
      this.#flashSaved();
    });
    this.#bindEvents();
    this.#render();
  }

  /* Events: listen once on containers (event delegation) */
  #bindEvents() {
    this.#form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (this.#store.add(this.#input.value)) this.#input.value = "";
      this.#input.focus();
    });

    this.#filtersEl.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-filter]");
      if (!button) return;
      const { filter } = button.dataset; // [destruct]
      if (!FILTERS.includes(filter)) return;
      this.#filter = filter;
      this.#editingId = null;
      this.#render();
    });

    this.#listEl.addEventListener("change", (event) => {
      const { target } = event; // [destruct]
      // ignore "change" events coming from the text editor, only checkboxes toggle
      if (target.type !== "checkbox") return;
      const id = this.#rowId(target);
      if (id !== null) this.#store.toggle(id);
    });

    this.#listEl.addEventListener("click", (event) => {
      if (!event.target.closest(".delete")) return;
      const id = this.#rowId(event.target);
      if (id !== null) this.#store.remove(id);
    });

    this.#listEl.addEventListener("dblclick", (event) => {
      if (!event.target.closest(".label")) return;
      const id = this.#rowId(event.target);
      if (id === null) return;
      this.#editingId = id;
      this.#render();
    });

    this.#clearCompletedBtn.addEventListener("click", () => this.#store.clearCompleted());
    this.#clearAllBtn.addEventListener("click", () => this.#store.clearAll());
  }

  /* Which todo does this event belong to? Read it from the nearest <li data-id> */
  #rowId(target) {
    const row = target?.closest("li[data-id]");
    return row ? Number(row.dataset.id) : null;
  }

  /* Logic: rebuild the visible list from the store */
  #render() {
    const visible = this.#store.visible(this.#filter);

    // [array] map each todo to a <li>, then [spread] hand them all to replaceChildren
    this.#listEl.replaceChildren(...visible.map((todo) => this.#createRow(todo)));

    const { remaining } = this.#store; // [destruct] (a getter works too)
    this.#countEl.textContent = `${remaining} item${remaining === 1 ? "" : "s"} left`; // [template]

    this.#emptyEl.hidden = visible.length > 0;
    this.#emptyEl.textContent = this.#emptyMessages[this.#filter];

    this.#filterButtons.forEach((button) => {
      const isActive = button.dataset.filter === this.#filter;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    this.#clearCompletedBtn.disabled = this.#store.completedIds.length === 0;
    this.#clearAllBtn.disabled = this.#store.total === 0;

    if (this.#editingId !== null) {
      const editor = this.#listEl.querySelector(".edit");
      editor?.focus();
      editor?.select();
    }
  }

  #createRow(todo) {
    const { id, text, completed } = todo; // [destruct]

    const row = document.createElement("li");
    row.className = completed ? "item done" : "item";
    row.dataset.id = String(id);

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "check";
    check.checked = completed;
    check.setAttribute("aria-label", `Mark "${text}" as completed`);

    const body = this.#editingId === id ? this.#createEditor(todo) : this.#createLabel(text);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.setAttribute("aria-label", `Delete "${text}"`);
    del.innerHTML = TRASH_SVG; // constant string, no user text involved

    row.append(check, body, del);
    return row;
  }

  #createLabel(text) {
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = text; // textContent (not innerHTML) => user text can never inject HTML
    return label;
  }

  #createEditor({ id, text }) { // [destruct] in the parameter
    const editor = document.createElement("input");
    editor.type = "text";
    editor.className = "edit";
    editor.value = text;
    editor.maxLength = 120;

    let finished = false; // blur can fire again while the editor is being removed
    const finish = (save) => {
      if (finished) return;
      finished = true;
      this.#editingId = null;
      if (save) this.#store.edit(id, editor.value); // store re-renders for us
      else this.#render();
    };

    editor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") finish(true);
      else if (event.key === "Escape") finish(false);
    });
    editor.addEventListener("blur", () => finish(true));
    return editor;
  }

  /* [callback] ASYNC callback: the arrow function runs 1.2 s later, nothing is blocked */
  #flashSaved() {
    this.#savedEl.classList.add("show");
    window.clearTimeout(this.#savedTimer);
    this.#savedTimer = window.setTimeout(() => this.#savedEl.classList.remove("show"), 1200);
  }
}

/* ---------- Start ---------- */
new TodoApp(new PersistentTodoStore("cse343-lab-todos"));