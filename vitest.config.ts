import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// 브라우저 DOM을 사용하는 프론트 컴포넌트 테스트 환경
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: true,
  },
});
