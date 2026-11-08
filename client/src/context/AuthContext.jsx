
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

const AuthContext = createContext(null);

const API_BASE_URL = "/api/v1/auth";

const STORAGE_KEYS = {
  user: "rgukt_user",
  accessToken: "rgukt_access_token",
  refreshToken: "rgukt_refresh_token",
};

// Safely read saved values
function getStoredValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Safely save authentication data
function saveSession({ user, accessToken, refreshToken }) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    }

    if (accessToken) {
      localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
    }

    if (refreshToken) {
      localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
    }
  } catch (error) {
    console.error("Unable to save authentication session:", error);
  }
}

// Remove authentication data
function clearSession() {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error("Unable to clear authentication session:", error);
  }
}

// Support common response structures used by the API
function extractTokens(data) {
  const payload = data?.data ?? data;

  return {
    accessToken:
      payload?.accessToken ??
      payload?.access_token ??
      payload?.tokens?.accessToken ??
      null,

    refreshToken:
      payload?.refreshToken ??
      payload?.refresh_token ??
      payload?.tokens?.refreshToken ??
      null,
  };
}

function extractUser(data) {
  const payload = data?.data ?? data;

  return (
    payload?.user ??
    payload?.profile ??
    null
  );
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    const error = new Error(
      data.error?.message ||
      data.message ||
      `Request failed (${response.status})`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const [accessToken, setAccessToken] = useState(
    () => getStoredValue(STORAGE_KEYS.accessToken)
  );

  const [refreshToken, setRefreshToken] = useState(
    () => getStoredValue(STORAGE_KEYS.refreshToken)
  );

  // Keep loading true until the saved session has been checked.
  const [loading, setLoading] = useState(true);

  const updateSession = useCallback((tokens, newUser = null) => {
    const nextAccessToken = tokens?.accessToken;
    const nextRefreshToken = tokens?.refreshToken;

    if (nextAccessToken) {
      setAccessToken(nextAccessToken);
    }

    if (nextRefreshToken) {
      setRefreshToken(nextRefreshToken);
    }

    if (newUser) {
      setUser(newUser);
    }

    saveSession({
      user: newUser,
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
    });
  }, []);

  // Fetch the logged-in user's profile
  const fetchCurrentUser = useCallback(async (token) => {
    const response = await fetch(`${API_BASE_URL}/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await parseResponse(response);
    const currentUser = extractUser(data);

    if (!currentUser) {
      throw new Error("User information was not returned by the server.");
    }

    setUser(currentUser);

    try {
      localStorage.setItem(
        STORAGE_KEYS.user,
        JSON.stringify(currentUser)
      );
    } catch (error) {
      console.error("Unable to save user information:", error);
    }

    return currentUser;
  }, []);

  // Refresh the access token using the refresh token
  const refreshSession = useCallback(async () => {
    const savedRefreshToken =
      refreshToken || getStoredValue(STORAGE_KEYS.refreshToken);

    if (!savedRefreshToken) {
      throw new Error("Refresh token not available.");
    }

    const response = await fetch(`${API_BASE_URL}/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refreshToken: savedRefreshToken,
      }),
    });

    const data = await parseResponse(response);
    const tokens = extractTokens(data);

    if (!tokens.accessToken) {
      throw new Error("Refresh endpoint did not return an access token.");
    }

    const nextRefreshToken =
      tokens.refreshToken || savedRefreshToken;

    updateSession(
      {
        accessToken: tokens.accessToken,
        refreshToken: nextRefreshToken,
      },
      extractUser(data)
    );

    return tokens.accessToken;
  }, [refreshToken, updateSession]);

  // Restore the session when the application starts or browser refreshes
  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const savedAccessToken =
        getStoredValue(STORAGE_KEYS.accessToken);

      const savedRefreshToken =
        getStoredValue(STORAGE_KEYS.refreshToken);

      if (!savedAccessToken && !savedRefreshToken) {
        if (active) {
          setLoading(false);
        }
        return;
      }

      try {
        // First, try the existing access token.
        if (savedAccessToken) {
          try {
            await fetchCurrentUser(savedAccessToken);

            if (active) {
              setAccessToken(savedAccessToken);
              setRefreshToken(savedRefreshToken);
            }

            return;
          } catch (error) {
            // Only attempt refresh when the access token is rejected.
            if (
              error.status !== 401 &&
              error.status !== 403
            ) {
              throw error;
            }
          }
        }

        // Access token is expired or missing. Get a new one.
        if (savedRefreshToken) {
          const response = await fetch(
            `${API_BASE_URL}/refresh-token`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                refreshToken: savedRefreshToken,
              }),
            }
          );

          const data = await parseResponse(response);
          const tokens = extractTokens(data);

          if (!tokens.accessToken) {
            throw new Error(
              "Refresh endpoint did not return an access token."
            );
          }

          const nextRefreshToken =
            tokens.refreshToken || savedRefreshToken;

          if (!active) return;

          updateSession({
            accessToken: tokens.accessToken,
            refreshToken: nextRefreshToken,
          });

          // Verify the newly issued access token.
          await fetchCurrentUser(tokens.accessToken);
          return;
        }

        throw new Error("No valid authentication tokens found.");
      } catch (error) {
        console.error("Session restoration failed:", error);

        // Do not destroy a potentially valid session on a network error.
        if (
          error.status === 401 ||
          error.status === 403 ||
          error.message.includes("Refresh endpoint")
        ) {
          clearSession();

          if (active) {
            setUser(null);
            setAccessToken(null);
            setRefreshToken(null);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, [fetchCurrentUser, updateSession]);

  // Login
  const login = useCallback(async (credentials) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    const data = await parseResponse(response);
    const tokens = extractTokens(data);
    const loggedInUser = extractUser(data);

    if (!tokens.accessToken) {
      throw new Error("Login response did not contain an access token.");
    }

    updateSession(tokens, loggedInUser);

    // If login response doesn't contain user details, retrieve them.
    if (!loggedInUser) {
      await fetchCurrentUser(tokens.accessToken);
    }

    return data;
  }, [fetchCurrentUser, updateSession]);

  // Register
  const register = useCallback(async (userData) => {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const data = await parseResponse(response);
    const tokens = extractTokens(data);
    const registeredUser = extractUser(data);

    if (tokens.accessToken) {
      updateSession(tokens, registeredUser);

      if (!registeredUser) {
        await fetchCurrentUser(tokens.accessToken);
      }
    }

    return data;
  }, [fetchCurrentUser, updateSession]);

  // Logout
  const logout = useCallback(async () => {
    const savedRefreshToken =
      refreshToken || getStoredValue(STORAGE_KEYS.refreshToken);

    try {
      await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {}),
        },
        body: JSON.stringify({
          refreshToken: savedRefreshToken,
        }),
      });
    } catch (error) {
      console.error("Logout API request failed:", error);
    } finally {
      clearSession();
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    }
  }, [accessToken, refreshToken]);

  const isAuthenticated = Boolean(user && accessToken);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        token: accessToken,
        refreshToken,
        isAuthenticated,
        loading,
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return context;
}
