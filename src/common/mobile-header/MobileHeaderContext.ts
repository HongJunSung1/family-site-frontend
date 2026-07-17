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

export type MobileHeaderContextValue = {
  config: MobileHeaderConfig;
  setConfig: (config: MobileHeaderConfig) => void;
  resetConfig: () => void;
};

// 모바일 상단 헤더 설정 공유 Context
export const MobileHeaderContext = React.createContext<MobileHeaderContextValue | null>(null);
