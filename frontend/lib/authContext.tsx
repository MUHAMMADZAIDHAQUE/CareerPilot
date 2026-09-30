"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  UserProfile,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  fetchCurrentUser,
  loginUser,
  registerUser,
} from "./api";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    fullName: string,
    headline?: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const existingToken = getAuthToken();
    if (!existingToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }
    setToken(existingToken);
    const { data, error } = await fetchCurrentUser();
    if (data && !error) {
      setUser(data);
    } else {
      clearAuthToken();
      setUser(null);
      setToken(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await loginUser(email, password);
    if (error || !data) {
      return { success: false, error: error || "Login failed" };
    }
    setToken(data.access_token);
    setUser(data.user);
    return { success: true };
  };

  const register = async (
    email: string,
    password: string,
    fullName: string,
    headline?: string
  ) => {
    const { data, error } = await registerUser(email, password, fullName, headline);
    if (error || !data) {
      return { success: false, error: error || "Registration failed" };
    }
    setToken(data.access_token);
    setUser(data.user);
    return { success: true };
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    setToken(null);
  };

  const isAdmin = user?.role?.toUpperCase() === "ADMIN";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAdmin,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
