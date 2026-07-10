// @vitest-environment jsdom

import { createElement } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogoutButton } from "@/components/logout-button";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LogoutButton", () => {
  it("revokes the session before returning to login", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const onLoggedOut = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(LogoutButton, { onLoggedOut }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
        method: "POST",
      });
      expect(onLoggedOut).toHaveBeenCalledOnce();
    });
  });

  it("shows a failure and keeps the operator in place when revocation fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const onLoggedOut = vi.fn();

    render(createElement(LogoutButton, { onLoggedOut }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo cerrar la sesión",
    );
    expect(onLoggedOut).not.toHaveBeenCalled();
  });
});
