/* ---------- [types] ---------- */
type Filter = "all" | "active" | "completed";
type Listener = () => void; // a callback with no arguments

interface TodoData {
  id: number;
  text: string;
  completed: boolean;
}

const TRASH_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
  '<path fill="currentColor" d="M9 3h6l1 1h4v2H4V4h4l1-1zm-3 5h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8z"/></svg>';



class Todo {
  private _text = "";

  constructor(
    public readonly id: number,
    text: string,
    public completed: boolean = false
  ) {
    this.text = text; // goes through the setter, so it is always trimmed
  }

  get text(): string {
    return this._text;
  }
  set text(value: string) {
    this._text = value.trim();
  }

  get isActive(): boolean {
    return !this.completed;
  }

  toJSON(): TodoData {
    return { id: this.id, text: this._text, completed: this.completed };
  }
}

/* ---------- [class] The data layer: knows nothing about the DOM ---------- */
class TodoStore {
  protected items: Todo[] = [];
  protected nextId = 1;
  private listeners: Listener[] = [];

  /* [callback] the view hands us a function; we call it back after every change */
  subscribe(listener: Listener): void {
    this.listeners = [...this.listeners, listener]; // [spread]
  }

  protected commit(): void {
    this.listeners.forEach((listener) => listener()); // [arrow] [callback]
  }

  protected load(items: Todo[]): void {
    this.items = items;
    // [array] reduce + [destruct] ({ id }) : find the biggest id so far
    this.nextId = items.reduce((max, { id }) => Math.max(max, id), 0) + 1;
  }

  get total(): number {
    return this.items.length;
  }

  get remaining(): number {
    return this.items.filter((todo) => todo.isActive).length; // [array] filter
  }

  get completedIds(): number[] {
    return this.items.filter((todo) => todo.completed).map(({ id }) => id); // filter + map
  }

  visible(filter: Filter): Todo[] {
    switch (filter) {
      case "active":
        return this.items.filter((todo) => todo.isActive);
      case "completed":
        return this.items.filter((todo) => todo.completed);
      default:
        return [...this.items]; // [spread] copy so callers cannot mutate our array
    }
  }

  add(text: string): boolean {
    const clean = text.trim();
    if (!clean) return false;
    this.items = this.items.concat(new Todo(this.nextId++, clean)); // [array] concat
    this.commit();
    return true;
  }

  toggle(id: number): void {
    const todo = this.items.find((item) => item.id === id); // [array] find
    if (!todo) return;
    todo.completed = !todo.completed;
    this.commit();
  }

  edit(id: number, text: string): void {
    const todo = this.items.find((item) => item.id === id);
    if (!todo) return;
    todo.text = text; // [get/set] setter trims the text
    if (!todo.text) {
      this.remove(id); // an empty text means "delete it"
      return;
    }
    this.commit();
  }

  remove(id: number): void {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return;
    this.items.splice(index, 1); // [array] splice(position, howManyToRemove)
    this.commit();
  }

  /* [spread/rest] `...ids` packs every argument into one array */
  removeMany(...ids: number[]): void {
    if (ids.length === 0) return;
    this.items = this.items.filter((todo) => !ids.includes(todo.id));
    this.commit();
  }

  clearCompleted(): void {
    this.removeMany(...this.completedIds); // [spread] unpack the array into arguments
  }

  clearAll(): void {
    if (this.items.length === 0) return;
    this.items.splice(0); // remove everything from index 0
    this.commit();
  }
}

/* ---------- [inherit] Same store, plus saving to localStorage ---------- */
class PersistentTodoStore extends TodoStore {
  constructor(private readonly key: string) {
    super(); // run the parent constructor first
    this.restore();
  }

  /* override the parent's commit: save first, then let the parent notify listeners */
  protected override commit(): void {
    this.persist();
    super.commit();
  }

  private persist(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.items));
    } catch {
      /* storage full or blocked: the app still works, it just won't remember */
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return;
      const saved: unknown = JSON.parse(raw);
      if (!Array.isArray(saved)) return;
      // [array] map + [destruct] turn plain objects back into Todo instances
      this.load(
        saved.map(({ id, text, completed }: TodoData) => new Todo(id, text, completed))
      );
    } catch {
      /* corrupt data: start empty */
    }
  }
}

/* ---------- Helper: get an element or fail loudly ---------- */
function requireEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`); // [template]
  return el as T;
}

/* ---------- [class] The view/controller: DOM + events ---------- */
class TodoApp {
  private filter: Filter = "all";
  private editingId: number | null = null;
  private savedTimer: number | undefined;

  /* DOM: select every node once */
  private readonly form = requireEl<HTMLFormElement>("todo-form");
  private readonly input = requireEl<HTMLInputElement>("todo-input");
  private readonly filtersEl = requireEl<HTMLElement>("filters");
  private readonly listEl = requireEl<HTMLUListElement>("todo-list");
  private readonly emptyEl = requireEl<HTMLElement>("empty");
  private readonly countEl = requireEl<HTMLElement>("count");
  private readonly savedEl = requireEl<HTMLElement>("saved");
  private readonly clearCompletedBtn = requireEl<HTMLButtonElement>("clear-completed");
  private readonly clearAllBtn = requireEl<HTMLButtonElement>("clear-all");
  private readonly filterButtons = document.querySelectorAll<HTMLButtonElement>("#filters .filter");

  private readonly emptyMessages: Record<Filter, string> = {
    all: "Nothing to do yet. Add your first todo above.",
    active: "No active todos.",
    completed: "No completed todos yet.",
  };

  constructor(private readonly store: TodoStore) {
    // [callback] every store change re-draws the screen and flashes "Saved"
    this.store.subscribe(() => {
      this.render();
      this.flashSaved();
    });
    this.bindEvents();
    this.render();
  }

  /* Events: listen once on containers (event delegation) */
  private bindEvents(): void {
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (this.store.add(this.input.value)) this.input.value = "";
      this.input.focus();
    });

    this.filtersEl.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-filter]");
      if (!button) return;
      const { filter } = button.dataset; // [destruct]
      this.filter = filter as Filter;
      this.editingId = null;
      this.render();
    });

    this.listEl.addEventListener("change", (event) => {
      const { target } = event; // [destruct]
      // ignore "change" events coming from the text editor, only checkboxes toggle
      if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;
      const id = this.rowId(target);
      if (id !== null) this.store.toggle(id);
    });

    this.listEl.addEventListener("click", (event) => {
      if (!(event.target as HTMLElement).closest(".delete")) return;
      const id = this.rowId(event.target);
      if (id !== null) this.store.remove(id);
    });

    this.listEl.addEventListener("dblclick", (event) => {
      if (!(event.target as HTMLElement).closest(".label")) return;
      const id = this.rowId(event.target);
      if (id === null) return;
      this.editingId = id;
      this.render();
    });

    this.clearCompletedBtn.addEventListener("click", () => this.store.clearCompleted());
    this.clearAllBtn.addEventListener("click", () => this.store.clearAll());
  }

  /* Which todo does this event belong to? Read it from the nearest <li data-id> */
  private rowId(target: EventTarget | null): number | null {
    const row = (target as HTMLElement | null)?.closest<HTMLLIElement>("li[data-id]");
    return row ? Number(row.dataset.id) : null;
  }

  /* Logic: rebuild the visible list from the store */
  private render(): void {
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
      const editor = this.listEl.querySelector<HTMLInputElement>(".edit");
      editor?.focus();
      editor?.select();
    }
  }

  private createRow(todo: Todo): HTMLLIElement {
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
    del.innerHTML = TRASH_SVG; // constant string, no user text involved

    row.append(check, body, del);
    return row;
  }

  private createLabel(text: string): HTMLSpanElement {
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = text; // textContent (not innerHTML) => user text can never inject HTML
    return label;
  }

  private createEditor({ id, text }: Todo): HTMLInputElement { // [destruct] in the parameter
    const editor = document.createElement("input");
    editor.type = "text";
    editor.className = "edit";
    editor.value = text;
    editor.maxLength = 120;

    let finished = false; // blur can fire again while the editor is being removed
    const finish = (save: boolean): void => {
      if (finished) return;
      finished = true;
      this.editingId = null;
      if (save) this.store.edit(id, editor.value); // store re-renders for us
      else this.render();
    };

    editor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") finish(true);
      else if (event.key === "Escape") finish(false);
    });
    editor.addEventListener("blur", () => finish(true));
    return editor;
  }

  /* [callback] ASYNC callback: the arrow function runs 1.2 s later, nothing is blocked */
  private flashSaved(): void {
    this.savedEl.classList.add("show");
    window.clearTimeout(this.savedTimer);
    this.savedTimer = window.setTimeout(() => this.savedEl.classList.remove("show"), 1200);
  }
}

/* ---------- Start ---------- */
new TodoApp(new PersistentTodoStore("cse343-lab-todos"));