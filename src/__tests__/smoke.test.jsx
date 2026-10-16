import React from "react";
import { createRoot } from "react-dom/client";

// React 18.3 exposes `act` on the React export; older builds keep it in
// react-dom/test-utils.
// eslint-disable-next-line react/jsx-no-useless-fragment
const { act } = React;
import { MemoryRouter } from "react-router-dom";

import App from "../App";
import { AuthProvider } from "../context/AuthContext";
import useLibraryStore from "../store/libraryStore";
import { initialBooks, initialMember, initialHistory } from "../data/sampleData";

jest.mock("../services/bookService");
jest.mock("../services/memberService");
jest.mock("../services/recommendationService");
jest.mock("../services/authService");

const bookService = require("../services/bookService");
const memberService = require("../services/memberService");
const recommendationService = require("../services/recommendationService");
const authService = require("../services/authService");

global.IS_REACT_ACT_ENVIRONMENT = true;

// The store's true initial state (captured before any test touches it), so
// every test starts from exactly what a fresh page load would see.
const INITIAL_STATE = useLibraryStore.getState();

let container;
let root;
const errors = [];

beforeEach(() => {
  errors.length = 0;
  window.localStorage.clear();
  window.console.error = (...args) => {
    errors.push(args.map(String).join(" "));
  };

  bookService.getBooks.mockImplementation(() => Promise.resolve(initialBooks));
  bookService.getBook.mockImplementation((id) => {
    const found = initialBooks.find((b) => String(b.id) === String(id));
    return found ? Promise.resolve(found) : Promise.reject(Object.assign(new Error("nf"), { status: 404 }));
  });
  bookService.getRelatedBooks.mockImplementation(() => Promise.resolve([]));
  memberService.getMember.mockImplementation(() => Promise.resolve({ ...initialMember }));
  recommendationService.getRecommendations.mockImplementation(() => Promise.resolve([]));
  authService.restoreSession.mockResolvedValue(null);
  authService.login.mockResolvedValue({ ...initialMember });
  authService.logout.mockResolvedValue(undefined);

  useLibraryStore.setState(INITIAL_STATE);

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderRoute(path) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );
  });
  // let pending promises settle
  await act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 20));
  });
}

const text = () => container.textContent;
const boxes = () =>
  Array.from(container.querySelectorAll(".stat-box")).map((el) => ({
    label: el.querySelector(".label")?.textContent,
    num: el.querySelector(".num")?.textContent,
  }));

test("home renders catalog stats", async () => {
  await renderRoute("/");
  expect(text()).toContain("Titles in Catalog");
  const stat = Array.from(container.querySelectorAll(".hero-stat")).find((s) =>
    s.textContent.includes("Titles in Catalog")
  );
  expect(stat.querySelector(".num").textContent).toBe("12");
  expect(errors.join("\n")).toBe("");
});

test("profile reading stats are populated", async () => {
  await renderRoute("/profile");
  const list = boxes();
  list.forEach((b) => {
    expect(String(b.num ?? "")).not.toBe("");
    expect(b.num).not.toBe("undefined");
  });
  // The three stats that come straight out of getReadingStats().
  expect(list.find((b) => b.label === "Favorite category").num).toBe("Self-Help");
  expect(Number(list.find((b) => b.label === "Avg. days per book").num)).toBeGreaterThan(0);
  expect(list.find((b) => b.label === "Total borrowed all-time").num).toBe("5");
});

test("books search + category filter work", async () => {
  await renderRoute("/books");
  const inputs = container.querySelectorAll("input[type=text]");
  await act(async () => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    nativeInputValueSetter.call(inputs[0], "dune");
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(text()).toContain("Dune");
  expect(text()).not.toContain("The Hobbit");
  expect(errors.join("\n")).toBe("");
});

test("borrow a book then see it under borrowed", async () => {
  await renderRoute("/books/5");
  const borrowBtn = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Borrow this book"
  );
  expect(borrowBtn).toBeTruthy();
  await act(async () => {
    borrowBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(useLibraryStore.getState().loans.some((l) => l.bookId === 5)).toBe(true);

  await renderRoute("/borrowed");
  expect(text()).toContain("Educated");
  expect(errors.join("\n")).toBe("");
});

test("renew and return actions work", async () => {
  await renderRoute("/borrowed");
  const renew = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent.startsWith("Renew")
  );
  expect(renew).toBeTruthy();
  // The first loan row is the one whose Renew button we clicked.
  const targetId = useLibraryStore.getState().loans[0].bookId;
  const before = useLibraryStore.getState().loans[0];
  await act(async () => {
    renew.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const after = useLibraryStore.getState().loans.find((l) => l.bookId === targetId);
  expect(after.renewals).toBe(before.renewals + 1);

  const ret = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Return");
  await act(async () => {
    ret.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(useLibraryStore.getState().history.length).toBe(initialHistory.length + 1);
  expect(errors.join("\n")).toBe("");
});

test("reading history page lists returned books", async () => {
  await renderRoute("/history");
  expect(text()).toContain("Atomic Habits");
  expect(text()).toContain("The Hobbit");
  expect(errors.join("\n")).toBe("");
});

test("recommendations page renders without crashing", async () => {
  await renderRoute("/recommendations");
  expect(errors.join("\n")).toBe("");
});

test("book detail for missing book shows not-found message", async () => {
  await renderRoute("/books/999");
  expect(text()).toContain("could not be found");
  expect(errors.join("\n")).toBe("");
});

test("search by ISBN matches (title box)", async () => {
  const withIsbn = initialBooks.map((b) =>
    b.id === 12 ? { ...b, isbn: "978-0-547-92822-7" } : b
  );
  bookService.getBooks.mockImplementation(() => Promise.resolve(withIsbn));
  await renderRoute("/books");
  const inputs = container.querySelectorAll("input[type=text]");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inputs[0], "9780547928227");
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(text()).toContain("The Hobbit");
});

test("first paint shows a loading state, not an empty-state message", async () => {
  // The very first render happens before any effect has run, so the store's
  // initial status is what decides whether an empty-state message flashes.
  expect(INITIAL_STATE.booksStatus).toBe("loading");
  expect(INITIAL_STATE.memberStatus).toBe("loading");

  const { flushSync } = require("react-dom");
  flushSync(() => {
    root.render(
      <MemoryRouter initialEntries={["/books"]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );
  });
  expect(text()).toContain("Loading books...");
  expect(text()).not.toContain("No books found");
});

test("logging out reloads the member instead of leaving Profile stuck loading", async () => {
  authService.restoreSession.mockResolvedValue({ ...initialMember, email: "priya@athenaeum.example" });
  await renderRoute("/profile");
  expect(text()).toContain("Priya Natarajan");

  const logoutBtn = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Log out"
  );
  expect(logoutBtn).toBeTruthy();
  await act(async () => {
    logoutBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });

  expect(useLibraryStore.getState().member).not.toBeNull();
  expect(text()).not.toContain("Loading your profile");
  expect(text()).toContain("Priya Natarajan");
  expect(errors.join("\n")).toBe("");
});

test("place a hold on an unavailable book", async () => {
  await renderRoute("/books/2"); // availableCopies: 0
  expect(text()).toContain("Book currently unavailable");
  const holdBtn = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Place a hold"
  );
  expect(holdBtn).toBeTruthy();
  await act(async () => {
    holdBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(useLibraryStore.getState().holds.some((h) => h.bookId === 2)).toBe(true);
  expect(text()).toContain("Hold placed");
  expect(errors.join("\n")).toBe("");
});

test("recommendations fall back to local suggestions when the API fails", async () => {
  recommendationService.getRecommendations.mockImplementation(() =>
    Promise.reject(new Error("network down"))
  );
  await renderRoute("/recommendations");
  expect(text()).toContain("Something went wrong");
  expect(text()).toContain("not personalised recommendations from the server");
  expect(text()).toContain("Sapiens");
  expect(errors.join("\n")).toBe("");
});

test("borrowing data survives a reload (persisted to storage)", async () => {
  await renderRoute("/borrowed");
  await act(async () => {
    useLibraryStore.getState().borrowBook(5);
  });
  const persistedRaw = window.localStorage.getItem("athenaeum_library_store_v1");
  const persisted = JSON.parse(persistedRaw);
  expect(persisted.state.loans.some((l) => l.bookId === 5)).toBe(true);

  // Simulate a page refresh: in-memory state goes back to defaults while
  // browser storage keeps the saved data. (setState rewrites storage, so put
  // the saved snapshot back afterwards — exactly what a fresh load sees.)
  useLibraryStore.setState(INITIAL_STATE);
  window.localStorage.setItem("athenaeum_library_store_v1", persistedRaw);
  await act(async () => {
    await useLibraryStore.persist.rehydrate();
  });
  expect(useLibraryStore.getState().loans.some((l) => l.bookId === 5)).toBe(true);
});
