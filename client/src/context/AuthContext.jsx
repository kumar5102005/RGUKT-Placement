import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API_BASE_URL = "/api/v1/auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("rgukt_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [accessToken, setAccessToken] = useState(() => {
    return localStorage.getItem("rgukt_access_token") || null;
  });

  const [refreshToken, setRefreshToken] = useState(() => {
    return localStorage.getItem("rgukt_refresh_token") || null;
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If token exists, verify session with backend
    async function verifySession() {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const data = await res.json();
        if (data.success && data.data?.user) {
          setUser(data.data.user);
          localStorage.setItem("rgukt_user", JSON.stringify(data.data.user));
        } else {
          // Token expired or invalid, attempt refresh if refresh token is present
          if (refreshToken) {
            await refreshSession();
          } else {
            logout();
          }
        }
      } catch (err) {
        console.error("Session verification error:", err);
      } finally {
        setLoading(false);
      }
    }

    verifySession();
  }, []);

  async function refreshSession() {
    try {
      if (!refreshToken) {
        logout();
        return false;
      }
      const res = await fetch(`${API_BASE_URL}/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await res.json();
      if (data.success && data.data?.accessToken) {
        setAccessToken(data.data.accessToken);
        setRefreshToken(data.data.refreshToken);
        localStorage.setItem("rgukt_access_token", data.data.accessToken);
        localStorage.setItem("rgukt_refresh_token", data.data.refreshToken);
        return true;
      } else {
        logout();
        return false;
      }
    } catch (err) {
      logout();
      return false;
    }
  }

  async function login(email, password) {
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || "Failed to log in");
    }

    const { accessToken: newAccess, refreshToken: newRefresh, user: newUser } = data.data;

    setAccessToken(newAccess);
    setRefreshToken(newRefresh);
    setUser(newUser);

    localStorage.setItem("rgukt_access_token", newAccess);
    localStorage.setItem("rgukt_refresh_token", newRefresh);
    localStorage.setItem("rgukt_user", JSON.stringify(newUser));

    return newUser;
  }

  async function register(formData) {
    const res = await fetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      const details = data.error?.details ? ` (${data.error.details.join(", ")})` : "";
      throw new Error((data.error?.message || "Registration failed") + details);
    }

    const { accessToken: newAccess, refreshToken: newRefresh, user: newUser } = data.data;

    setAccessToken(newAccess);
    setRefreshToken(newRefresh);
    setUser(newUser);

    localStorage.setItem("rgukt_access_token", newAccess);
    localStorage.setItem("rgukt_refresh_token", newRefresh);
    localStorage.setItem("rgukt_user", JSON.stringify(newUser));

    return newUser;
  }

  async function logout() {
    try {
      if (refreshToken) {
        await fetch(`${API_BASE_URL}/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (err) {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      localStorage.removeItem("rgukt_access_token");
      localStorage.removeItem("rgukt_refresh_token");
      localStorage.removeItem("rgukt_user");
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: Boolean(user && accessToken),
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

