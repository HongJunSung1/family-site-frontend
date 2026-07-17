import React from "react";
import { MobileHeaderContext } from "./MobileHeaderContext";

// 모바일 헤더 설정 접근 훅
export function useMobileHeader() {
  const context = React.useContext(MobileHeaderContext);
  if (!context) {
    throw new Error("useMobileHeader must be used within MobileHeaderProvider");
  }

  return context;
}
