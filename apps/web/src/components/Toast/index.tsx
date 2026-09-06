import { type JSX } from "react";

import styles from "./index.module.css";
import { useToast } from "./useToast";

interface ToastProps {
  message?: string;
}

export const Toast = ({ message }: ToastProps): JSX.Element | null => {
  const toast = useToast(message);

  if (toast === undefined) {
    return null;
  }

  return (
    <p className={styles.toast} data-open={toast.isOpen} role="status">
      {toast.message}
    </p>
  );
};
