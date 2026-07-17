import React from "react";
import {
  MobileHeaderContext,
  type MobileHeaderConfig,
  type MobileHeaderContextValue,
} from "./MobileHeaderContext";

// 모바일 상단 헤더 설정 공유 Provider
export function MobileHeaderProvider({ children }: React.PropsWithChildren) {
  const [config, setConfigState] = React.useState<MobileHeaderConfig>({});

  // 화면별 모바일 헤더 설정 적용
  const setConfig = React.useCallback((nextConfig: MobileHeaderConfig) => {
    setConfigState(nextConfig);
  }, []);

  // 모바일 헤더 설정 기본값 초기화
  const resetConfig = React.useCallback(() => {
    setConfigState({});
  }, []);

  const value = React.useMemo<MobileHeaderContextValue>(
    () => ({ config, setConfig, resetConfig }),
    [config, resetConfig, setConfig]
  );

  return <MobileHeaderContext.Provider value={value}>{children}</MobileHeaderContext.Provider>;
}
