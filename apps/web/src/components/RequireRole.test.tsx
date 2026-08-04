import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireRole } from "./RequireRole";

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
  it("renders nothing while the current user is loading", () => {
    mockUseCurrentUser.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderWithRole("ADMIN");
    expect(container).toBeEmptyDOMElement();
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
