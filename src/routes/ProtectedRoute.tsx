import { Navigate } from "react-router-dom";
import React from "react";

// 로그인 여부에 따른 보호 라우트 접근 제어
export default function ProtectedRoute({
  isLoggedIn,
  children,
}: {
  isLoggedIn: boolean;
  children: React.ReactNode;
}) {
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
