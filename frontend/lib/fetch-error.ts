export function toFetchErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (err instanceof TypeError) {
    return "서버에 연결하지 못했습니다. 네트워크를 확인하거나 잠시 후 다시 시도해 주세요.";
  }
  if (err instanceof Error && err.message === "Failed to fetch") {
    return "서버에 연결하지 못했습니다. 네트워크를 확인하거나 잠시 후 다시 시도해 주세요.";
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}
