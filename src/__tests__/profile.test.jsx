import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Profile from "../pages/Profile";
import { LibraryProvider } from "../context/LibraryContext";
import { AuthProvider } from "../context/AuthContext";
import useLibraryStore from "../store/libraryStore";
import { ApiError } from "../services/apiClient";
import { initialBooks, initialMember } from "../data/sampleData";

// Experiment 1 — component test: the member profile, including its loading
// and error states and the guest sign-in hint (Experiment 4d).

jest.mock("../services/bookService");
jest.mock("../services/memberService");
jest.mock("../services/recommendationService");
jest.mock("../services/authService");

const bookService = require("../services/bookService");
const memberService = require("../services/memberService");
const recommendationService = require("../services/recommendationService");
const authService = require("../services/authService");

const INITIAL_STATE = useLibraryStore.getState();

const renderProfile = () =>
  render(
    <MemoryRouter initialEntries={["/profile"]}>
      <AuthProvider>
        <LibraryProvider>
          <Profile />
        </LibraryProvider>
      </AuthProvider>
    </MemoryRouter>
  );

// The value shown inside the stat box that carries `label`.
const statValue = (label) =>
  screen.getByText(label).closest(".stat-box").querySelector(".num").textContent;

beforeEach(() => {
  window.localStorage.clear();
  bookService.getBooks.mockImplementation(() => Promise.resolve(initialBooks));
  bookService.getBook.mockImplementation(() => Promise.resolve(initialBooks[0]));
  bookService.getRelatedBooks.mockImplementation(() => Promise.resolve([]));
  memberService.getMember.mockImplementation(() => Promise.resolve({ ...initialMember }));
  recommendationService.getRecommendations.mockImplementation(() => Promise.resolve([]));
  authService.restoreSession.mockResolvedValue(null);
  authService.login.mockResolvedValue({ ...initialMember });
  authService.logout.mockResolvedValue(undefined);
  useLibraryStore.setState(INITIAL_STATE);
});

describe("Member profile", () => {
  test("shows the member's details", async () => {
    renderProfile();

    expect(await screen.findByRole("heading", { name: initialMember.name })).toBeInTheDocument();
    expect(screen.getByText(`Member #${initialMember.id}`)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`${initialMember.membershipTier} member`, "i"))
    ).toBeInTheDocument();
    expect(screen.getByText(/member since/i)).toBeInTheDocument();
    initialMember.favoriteCategories.forEach((category) => {
      expect(screen.getByText(category)).toBeInTheDocument();
    });
  });

  test("fills every reading-stat box (none left blank)", async () => {
    renderProfile();
    await screen.findByRole("heading", { name: initialMember.name });
    // Stats depend on the catalog (category counts), so wait for it too.
    await waitFor(() => expect(useLibraryStore.getState().booksStatus).toBe("success"));

    const stats = useLibraryStore.getState().getReadingStats();

    // Regression guard: these three used to render as empty boxes.
    expect(statValue("Favorite category")).toBe(stats.favoriteCategory);
    expect(statValue("Avg. days per book")).toBe(String(stats.avgDaysKept));
    expect(statValue("Total borrowed all-time")).toBe(String(stats.totalBorrowed));

    expect(statValue("Currently borrowed")).toBe(String(useLibraryStore.getState().loans.length));
    expect(statValue("Books read total")).toBe(String(stats.totalRead));
    expect(statValue("Active holds")).toBe(String(useLibraryStore.getState().holds.length));
    expect(statValue("Favorite category")).not.toBe("");
  });

  test("shows a loading state until the member arrives", () => {
    memberService.getMember.mockImplementation(() => new Promise(() => {}));
    renderProfile();

    expect(screen.getByText("Loading your profile...")).toBeInTheDocument();
    expect(screen.queryByText(initialMember.name)).not.toBeInTheDocument();
  });

  test("shows the API error and recovers when 'Try again' succeeds", async () => {
    memberService.getMember.mockImplementationOnce(() =>
      Promise.reject(new ApiError("Profile service is down", { status: 500, kind: "http" }))
    );
    const user = userEvent.setup();
    renderProfile();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Profile service is down");

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByRole("heading", { name: initialMember.name })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("shows the guest sign-in hint for signed-out members", async () => {
    renderProfile();
    await screen.findByRole("heading", { name: initialMember.name });

    // findByRole also waits for the session check (isInitializing) to finish.
    const hint = await screen.findByRole("note");
    expect(hint).toHaveTextContent(/browsing as a guest/i);
  });

  test("hides the guest hint once the member is signed in", async () => {
    authService.restoreSession.mockResolvedValue({ ...initialMember });
    renderProfile();

    expect(await screen.findByRole("heading", { name: initialMember.name })).toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
