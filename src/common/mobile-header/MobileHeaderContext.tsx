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

export const MobileHeaderProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [config, setConfigState] = React.useState<MobileHeaderConfig>({});

  const setConfig = React.useCallback((nextConfig: MobileHeaderConfig) => {
    setConfigState(nextConfig);
  }, []);

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

export const useMobileHeader = () => {
  const context = React.useContext(MobileHeaderContext);
  if (!context) {
    throw new Error("useMobileHeader must be used within MobileHeaderProvider");
  }

  return context;
};
