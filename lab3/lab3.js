"use strict";
const TRASH_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
    '<path fill="currentColor" d="M9 3h6l1 1h4v2H4V4h4l1-1zm-3 5h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8z"/></svg>';
/* ---------- [class] [get/set] One todo item ---------- */
class Todo {
    constructor(id, text, completed = false) {
        this.id = id;
        this.completed = completed;
        this._text = "";
        this.text = text; // goes through the setter, so it is always trimmed
    }
    get text() {
        return this._text;
    }
    set text(value) {
        this._text = value.trim();
    }
    get isActive() {
        return !this.completed;
    }
    toJSON() {
        return { id: this.id, text: this._text, completed: this.completed };
    }
}
class TodoStore {
    constructor() {
        this.items = [];
        this.nextId = 1;
        this.listeners = [];
    }
    subscribe(listener) {
        this.listeners = [...this.listeners, listener]; // [spread]
    }
    commit() {
        this.listeners.forEach((listener) => listener()); // [arrow] [callback]
    }
    load(items) {
        this.items = items;
        this.nextId = items.reduce((max, { id }) => Math.max(max, id), 0) + 1;
    }
    get total() {
        return this.items.length;
    }
    get remaining() {
        return this.items.filter((todo) => todo.isActive).length; 
    }
    get completedIds() {
        return this.items.filter((todo) => todo.completed).map(({ id }) => id); 
    }
    visible(filter) {
        switch (filter) {
            case "active":
                return this.items.filter((todo) => todo.isActive);
            case "completed":
                return this.items.filter((todo) => todo.completed);
            default:
                return [...this.items]; 
        }
    }
    add(text) {
        const clean = text.trim();
        if (!clean)
            return false;
        this.items = this.items.concat(new Todo(this.nextId++, clean)); // [array] concat
        this.commit();
        return true;
    }
    toggle(id) {
        const todo = this.items.find((item) => item.id === id); // [array] find
        if (!todo)
            return;
        todo.completed = !todo.completed;
        this.commit();
    }
    edit(id, text) {
        const todo = this.items.find((item) => item.id === id);
        if (!todo)
            return;
        todo.text = text; 
        if (!todo.text) {
            this.remove(id); 
            return;
        }
        this.commit();
    }
    remove(id) {
        const index = this.items.findIndex((item) => item.id === id);
        if (index === -1)
            return;
        this.items.splice(index, 1); // [array] splice(position, howManyToRemove)
        this.commit();
    }
    removeMany(...ids) {
        if (ids.length === 0)
            return;
        this.items = this.items.filter((todo) => !ids.includes(todo.id));
        this.commit();
    }
    clearCompleted() {
        this.removeMany(...this.completedIds); 
    }
    clearAll() {
        if (this.items.length === 0)
            return;
        this.items.splice(0); 
        this.commit();
    }
}
class PersistentTodoStore extends TodoStore {
    constructor(key) {
        super(); // run the parent constructor first
        this.key = key;
        this.restore();
    }
    commit() {
        this.persist();
        super.commit();
    }
    persist() {
        try {
            localStorage.setItem(this.key, JSON.stringify(this.items));
        }
        catch {
        }
    }
    restore() {
        try {
            const raw = localStorage.getItem(this.key);
            if (!raw)
                return;
            const saved = JSON.parse(raw);
            if (!Array.isArray(saved))
                return;
            this.load(saved.map(({ id, text, completed }) => new Todo(id, text, completed)));
        }
        catch {
        }
    }
}
/* ---------- Helper: get an element or fail loudly ---------- */
function requireEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`Missing element #${id}`); // [template]
    return el;
}
class TodoApp {
    constructor(store) {
        this.store = store;
        this.filter = "all";
        this.editingId = null;
        /* DOM: select every node once */
        this.form = requireEl("todo-form");
        this.input = requireEl("todo-input");
        this.filtersEl = requireEl("filters");
        this.listEl = requireEl("todo-list");
        this.emptyEl = requireEl("empty");
        this.countEl = requireEl("count");
        this.savedEl = requireEl("saved");
        this.clearCompletedBtn = requireEl("clear-completed");
        this.clearAllBtn = requireEl("clear-all");
        this.filterButtons = document.querySelectorAll("#filters .filter");
        this.emptyMessages = {
            all: "Nothing to do yet. Add your first todo above.",
            active: "No active todos.",
            completed: "No completed todos yet.",
        };
        this.store.subscribe(() => {
            this.render();
            this.flashSaved();
        });
        this.bindEvents();
        this.render();
    }
    bindEvents() {
        this.form.addEventListener("submit", (event) => {
            event.preventDefault();
            if (this.store.add(this.input.value))
                this.input.value = "";
            this.input.focus();
        });
        this.filtersEl.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-filter]");
            if (!button)
                return;
            const { filter } = button.dataset; // [destruct]
            this.filter = filter;
            this.editingId = null;
            this.render();
        });
        this.listEl.addEventListener("change", (event) => {
            const { target } = event; // [destruct]
            if (!(target instanceof HTMLInputElement) || target.type !== "checkbox")
                return;
            const id = this.rowId(target);
            if (id !== null)
                this.store.toggle(id);
        });
        this.listEl.addEventListener("click", (event) => {
            if (!event.target.closest(".delete"))
                return;
            const id = this.rowId(event.target);
            if (id !== null)
                this.store.remove(id);
        });
        this.listEl.addEventListener("dblclick", (event) => {
            if (!event.target.closest(".label"))
                return;
            const id = this.rowId(event.target);
            if (id === null)
                return;
            this.editingId = id;
            this.render();
        });
        this.clearCompletedBtn.addEventListener("click", () => this.store.clearCompleted());
        this.clearAllBtn.addEventListener("click", () => this.store.clearAll());
    }
    rowId(target) {
        const row = target?.closest("li[data-id]");
        return row ? Number(row.dataset.id) : null;
    }
    render() {
        const visible = this.store.visible(this.filter);
        // [array] map each todo to a <li>, then [spread] hand them all to replaceChildren
        this.listEl.replaceChildren(...visible.map((todo) => this.createRow(todo)));
        const { remaining } = this.store; // [destruct] (a getter works too)
        this.countEl.textContent = `${remaining} item${remaining === 1 ? "" : "s"} left`; // [template]
        this.emptyEl.hidden = visible.length > 0;
        this.emptyEl.textContent = this.emptyMessages[this.filter];
        this.filterButtons.forEach((button) => {
            const isActive = button.dataset.filter === this.filter;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
        this.clearCompletedBtn.disabled = this.store.completedIds.length === 0;
        this.clearAllBtn.disabled = this.store.total === 0;
        if (this.editingId !== null) {
            const editor = this.listEl.querySelector(".edit");
            editor?.focus();
            editor?.select();
        }
    }
    createRow(todo) {
        const { id, text, completed } = todo; // [destruct]
        const row = document.createElement("li");
        row.className = completed ? "item done" : "item";
        row.dataset.id = String(id);
        const check = document.createElement("input");
        check.type = "checkbox";
        check.className = "check";
        check.checked = completed;
        check.setAttribute("aria-label", `Mark "${text}" as completed`);
        const body = this.editingId === id ? this.createEditor(todo) : this.createLabel(text);
        const del = document.createElement("button");
        del.type = "button";
        del.className = "delete";
        del.setAttribute("aria-label", `Delete "${text}"`);
        del.innerHTML = TRASH_SVG; 
        row.append(check, body, del);
        return row;
    }
    createLabel(text) {
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = text; 
        return label;
    }
    createEditor({ id, text }) {
        const editor = document.createElement("input");
        editor.type = "text";
        editor.className = "edit";
        editor.value = text;
        editor.maxLength = 120;
        let finished = false; 
        const finish = (save) => {
            if (finished)
                return;
            finished = true;
            this.editingId = null;
            if (save)
                this.store.edit(id, editor.value); 
            else
                this.render();
        };
        editor.addEventListener("keydown", (event) => {
            if (event.key === "Enter")
                finish(true);
            else if (event.key === "Escape")
                finish(false);
        });
        editor.addEventListener("blur", () => finish(true));
        return editor;
    }
    flashSaved() {
        this.savedEl.classList.add("show");
        window.clearTimeout(this.savedTimer);
        this.savedTimer = window.setTimeout(() => this.savedEl.classList.remove("show"), 1200);
    }
}
new TodoApp(new PersistentTodoStore("cse343-lab-todos"));