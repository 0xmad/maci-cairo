import { useEffect, useRef, useState } from "react";

const TOAST_EXIT_MS = 300;

interface ToastState {
  message?: string;
  isOpen: boolean;
}

export function useToast(message?: string): ToastState | undefined {
  const previousMessage = useRef(message);
  const [toast, setToast] = useState<ToastState>();

  useEffect(() => {
    if (message) {
      previousMessage.current = message;
      setToast({ message, isOpen: true });
      return undefined;
    }

    if (previousMessage.current === undefined) {
      return undefined;
    }

    previousMessage.current = undefined;
    setToast((current) => (current === undefined ? undefined : { message: current.message, isOpen: false }));

    const timeoutId = window.setTimeout(() => {
      setToast(undefined);
    }, TOAST_EXIT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message]);

  return toast;
}
