const STORAGE_KEY = "sechahaemal-onboarding-dismissed";

function getTodayKey(): string {
  return new Date().toLocaleDateString("sv-SE");
}

export function shouldShowOnboarding(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return localStorage.getItem(STORAGE_KEY) !== getTodayKey();
}

export function dismissOnboardingForToday(): void {
  localStorage.setItem(STORAGE_KEY, getTodayKey());
}
