import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("accessToken");
  const isLoggedIn = !!token;

  const location = useLocation();

  if (!isLoggedIn) {
    // 로그인 후 원래 가려던 페이지로 돌아오기 위해 state로 저장
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
