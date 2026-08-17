import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireRole } from "./RequireRole";
import { SESSION_CHECK_LOADER_DELAY_MS } from "@/components/Loader";

const mockUseCurrentUser = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useCurrentUser: () => mockUseCurrentUser() }));

function renderWithRole(role: "MODERATOR" | "ADMIN") {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route
          path="/admin"
          element={
            <RequireRole role={role}>
              <div>protected content</div>
            </RequireRole>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireRole", () => {
  it("shows nothing at first while the current user is loading", () => {
    // The important half of this assertion is that the protected content is
    // NOT rendered and no redirect fires while the role is still unknown.
    // Staying blank at first is also deliberate: the loader is delayed so a
    // fast session check never flashes one.
    mockUseCurrentUser.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderWithRole("ADMIN");
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    expect(screen.queryByText("login page")).not.toBeInTheDocument();
  });

  it("shows a loader once a slow session check passes the delay", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockUseCurrentUser.mockReturnValue({ data: undefined, isLoading: true });
      renderWithRole("ADMIN");

      await act(async () => {
        vi.advanceTimersByTime(SESSION_CHECK_LOADER_DELAY_MS + 10);
      });

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("Checking your session")).toBeInTheDocument();
      // Still no premature decision about access.
      expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("redirects to /login when there is no user", () => {
    mockUseCurrentUser.mockReturnValue({ data: undefined, isLoading: false });
    renderWithRole("ADMIN");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("shows an inline message instead of the content when the role is too low", () => {
    mockUseCurrentUser.mockReturnValue({ data: { role: "USER" }, isLoading: false });
    renderWithRole("ADMIN");
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    expect(screen.getByText(/isn't available to your account/i)).toBeInTheDocument();
  });

  it("renders the protected content once the role rank is sufficient", () => {
    mockUseCurrentUser.mockReturnValue({ data: { role: "ADMIN" }, isLoading: false });
    renderWithRole("MODERATOR");
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("treats ADMIN as satisfying a MODERATOR requirement (rank, not exact match)", () => {
    mockUseCurrentUser.mockReturnValue({ data: { role: "ADMIN" }, isLoading: false });
    renderWithRole("MODERATOR");
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });
});
