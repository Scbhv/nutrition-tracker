import { Capacitor } from "@capacitor/core";

/**
 * Native shell bootstrap: keeps the iOS/Android webview looking and
 * behaving like a real app (status bar, splash screen, body class).
 * Safe no-op on the web.
 */
export async function initNativeShell(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!Capacitor.isNativePlatform()) return;

  document.body.classList.add("is-native");

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#141614" });
    }
  } catch {
    // Plugin unavailable (e.g. not synced yet) — ignore.
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    // Ignore.
  }
}
