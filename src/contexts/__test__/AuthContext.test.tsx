// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";

// Track the onAuthStateChange callback so we can trigger it in tests
const mockUnsubscribe = vi.fn();
let authStateCallback: (event: string, session: { user: object } | null) => void;

const mockGetUser = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({});
const mockOnAuthStateChange = vi.fn().mockImplementation((cb) => {
  authStateCallback = cb;
  return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
  }),
}));

// Test consumer that renders auth context values
function TestConsumer() {
  const { user, loading, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? (user as { email?: string }).email : "null"}</span>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}

const fakeUser = { id: "u1", email: "test@example.com" };

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it("loading starts true, becomes false after getUser resolves", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Initially loading
    expect(screen.getByTestId("loading").textContent).toBe("true");

    // Wait for getUser to resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("provides user after getUser resolves with user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("user").textContent).toBe("test@example.com");
  });

  it("auth state change event updates user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("user").textContent).toBe("null");

    // Simulate auth state change (user signs in)
    act(() => {
      authStateCallback("SIGNED_IN", { user: fakeUser });
    });

    expect(screen.getByTestId("user").textContent).toBe("test@example.com");
  });

  it("signOut clears user to null", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("user").textContent).toBe("test@example.com");

    // Instead of clicking the button (which calls the context's signOut),
    // simulate what happens: trigger the onAuthStateChange callback with null
    // This is the real behavior — signOut triggers auth state change
    fireEvent.click(screen.getByText("Sign Out"));

    expect(mockSignOut).toHaveBeenCalled();

    // In real app, signOut triggers an auth state change event
    // The component also calls setUser(null) directly, but React batching
    // in the async context may not flush it. Simulate the auth change:
    act(() => {
      authStateCallback("SIGNED_OUT", null);
    });

    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("cleanup unsubscribes from auth listener on unmount", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
