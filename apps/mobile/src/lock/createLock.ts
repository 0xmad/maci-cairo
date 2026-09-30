import * as LocalAuthentication from "expo-local-authentication";
import { AppState, type AppStateStatus } from "react-native";

type ClosedReason = "prompting" | "dismissed" | "device-cannot-authenticate";

type AuthenticationResult = "success" | "dismissed" | "failed";

export type LockView = { status: "open" } | { status: "closed"; reason: ClosedReason };

const closed = (reason: ClosedReason): LockView => ({ status: "closed", reason });

export interface VisitLock {
  view: () => LockView;
  subscribe: (listener: () => void) => () => void;
  foreground: () => Promise<void>;
  watch: () => () => void;
}

const promptMessage = "Unlock the voter client";

const deviceEnrolled = async (): Promise<boolean> => {
  const level = await LocalAuthentication.getEnrolledLevelAsync();

  return level !== LocalAuthentication.SecurityLevel.NONE;
};

const authenticateWithDevice = async (): Promise<"success" | "dismissed"> => {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Cancel",
  });

  return result.success ? "success" : "dismissed";
};

export const createLock = (): VisitLock => {
  let view: LockView = closed("prompting");
  let prompting = false;
  let leftDuringPrompt = false;
  let systemPromptSettling = false;
  const listeners = new Set<() => void>();

  const emit = (next: LockView): void => {
    view = next;
    listeners.forEach((listener) => {
      listener();
    });
  };

  const viewAfterPrompt = (result: AuthenticationResult): LockView => {
    if (leftDuringPrompt) {
      return closed("prompting");
    }

    if (result === "success") {
      systemPromptSettling = true;
      return { status: "open" };
    }

    return closed("dismissed");
  };

  const foreground = async (): Promise<void> => {
    if (view.status === "open" || prompting) {
      return;
    }

    prompting = true;
    emit(closed("prompting"));

    try {
      const isEnrolled = await deviceEnrolled();

      if (!isEnrolled) {
        emit(closed("device-cannot-authenticate"));
        return;
      }

      emit(viewAfterPrompt(await authenticateWithDevice()));
    } catch (error) {
      emit(viewAfterPrompt("failed"));
      throw error;
    } finally {
      prompting = false;
      leftDuringPrompt = false;
    }
  };

  const cover = (): void => {
    if (view.status === "closed" && view.reason === "prompting") {
      return;
    }

    systemPromptSettling = false;
    emit(closed("prompting"));
  };

  const watch = (): (() => void) => {
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") {
        systemPromptSettling = false;

        if (view.status === "closed" && view.reason === "prompting") {
          foreground().catch(() => undefined);
        }
        return;
      }

      if (prompting) {
        if (next === "background") {
          leftDuringPrompt = true;
        }
        return;
      }

      if (systemPromptSettling && next === "inactive") {
        return;
      }

      cover();
    });

    foreground().catch(() => undefined);

    return (): void => {
      subscription.remove();
    };
  };

  return {
    view: (): LockView => view,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);

      return (): void => {
        listeners.delete(listener);
      };
    },
    foreground,
    watch,
  };
};
