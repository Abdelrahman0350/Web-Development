"use strict";
 
const displayEl = document.getElementById("display");
const keypadEl  = document.getElementById("keypad");
const opButtons = keypadEl.querySelectorAll('[data-action="operator"]');
 
const MAX_DIGITS = 12;
const state = {
  current: "0",     
  previous: null,   
  operator: null,   
  overwrite: false, 
};
 
 
const OPERATIONS = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => (b === 0 ? NaN : a / b),
};
 
function format(n) {
  if (!Number.isFinite(n)) return "Error";
  const rounded = Number(n.toPrecision(MAX_DIGITS)); 
  let s = String(rounded);
  if (s.replace(/[-.]/g, "").length > MAX_DIGITS) s = rounded.toExponential(6);
  return s;
}
 
function render() {
  displayEl.textContent = state.current;
  const len = state.current.length;
  displayEl.classList.toggle("shrink-1", len > 9 && len <= 12);
  displayEl.classList.toggle("shrink-2", len > 12);
  opButtons.forEach((b) =>
    b.classList.toggle("active", state.overwrite && b.dataset.value === state.operator)
  );
}
 
/* Calculate previous <operator> current, store the result in state.current */
function compute() {
  const result = OPERATIONS[state.operator](Number(state.previous), Number(state.current));
  state.current = format(result);
}
 
const actions = {
  digit(value) {
    if (state.current === "Error" || state.overwrite) {
      state.current = "0";
      state.overwrite = false;
    }
    if (state.current === "0") {
      state.current = value === "00" ? "0" : value; // "00" on 0 stays 0
    } else if (state.current.replace(/[-.]/g, "").length < MAX_DIGITS) {
      state.current += value;
    }
  },
 
  decimal() {
    if (state.current === "Error" || state.overwrite) {
      state.current = "0";
      state.overwrite = false;
    }
    if (!state.current.includes(".")) state.current += ".";
  },
 
  operator(op) {
    if (state.current === "Error") return;
    if (state.operator && !state.overwrite) compute();
    state.previous = state.current;
    state.operator = op;
    state.overwrite = true;
  },
 
  equals() {
    if (!state.operator || state.current === "Error") return;
    compute();
    state.previous = null;
    state.operator = null;
    state.overwrite = true;
  },
 
  percent() {
    if (state.current === "Error") return;
    state.current = format(Number(state.current) / 100);
  },
 
  clear() {
    state.current = "0";
    state.previous = null;
    state.operator = null;
    state.overwrite = false;
  },
};
 
 
keypadEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  actions[btn.dataset.action](btn.dataset.value);
  render();
});
 
document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (/^[0-9]$/.test(k))            actions.digit(k);
  else if (k === ".")               actions.decimal();
  else if ("+-*/".includes(k))      actions.operator(k);
  else if (k === "Enter" || k === "=") { e.preventDefault(); actions.equals(); }
  else if (k === "%")               actions.percent();
  else if (k === "Escape" || k === "Delete") actions.clear();
  else if (k === "Backspace") {
    if (!state.overwrite && state.current !== "Error") {
      state.current = state.current.length > 1 ? state.current.slice(0, -1) : "0";
      if (state.current === "-") state.current = "0";
    }
  } else return;
  render();
});
 
render(); 
 