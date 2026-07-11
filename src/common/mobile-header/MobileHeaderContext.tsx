import React from "react";

export type MobileHeaderMenuItem = {
  id: string;
  label: string;
  active?: boolean;
  onSelect?: () => void;
  children?: MobileHeaderMenuItem[];
};

export type MobileHeaderConfig = {
  title?: string;
  menuItems?: MobileHeaderMenuItem[];
};

type MobileHeaderContextValue = {
  config: MobileHeaderConfig;
  setConfig: (config: MobileHeaderConfig) => void;
  resetConfig: () => void;
};

const MobileHeaderContext = React.createContext<MobileHeaderContextValue | null>(null);

// 모바일 상단 헤더 설정 공유 Provider
export const MobileHeaderProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [config, setConfigState] = React.useState<MobileHeaderConfig>({});

  // 화면별 모바일 헤더 설정 적용
  const setConfig = React.useCallback((nextConfig: MobileHeaderConfig) => {
    setConfigState(nextConfig);
  }, []);

  // 모바일 헤더 설정 기본값 초기화
  const resetConfig = React.useCallback(() => {
    setConfigState({});
  }, []);

  const value = React.useMemo(
    () => ({
      config,
      setConfig,
      resetConfig,
    }),
    [config, resetConfig, setConfig]
  );

  return <MobileHeaderContext.Provider value={value}>{children}</MobileHeaderContext.Provider>;
};

// 모바일 헤더 설정 접근 훅
export const useMobileHeader = () => {
  const context = React.useContext(MobileHeaderContext);
  if (!context) {
    throw new Error("useMobileHeader must be used within MobileHeaderProvider");
  }

  return context;
};
