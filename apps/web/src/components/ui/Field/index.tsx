import classNames from "classnames";
import { useId, useLayoutEffect, useMemo, useState, type ComponentProps, type JSX, type ReactNode } from "react";

import { FieldContext, useField } from "./fieldContext";

export type FieldProps = ComponentProps<"div">;

export const Field = ({ children, className, ...props }: FieldProps): JSX.Element => {
  const controlId = useId();
  const errorId = useId();
  const [hasError, setHasError] = useState(false);
  const value = useMemo(() => ({ controlId, errorId, hasError, setHasError }), [controlId, errorId, hasError]);

  return (
    <FieldContext.Provider value={value}>
      <div className={classNames("flex flex-col gap-1.5", className)} {...props}>
        {children}
      </div>
    </FieldContext.Provider>
  );
};

const hasMessage = (children: ReactNode): boolean => {
  if (children === undefined || children === null || children === false) {
    return false;
  }

  if (typeof children === "string" || typeof children === "number") {
    return String(children).length > 0;
  }

  return true;
};

export type FieldErrorProps = ComponentProps<"p">;

export const FieldError = ({ children, className, id, ...props }: FieldErrorProps): JSX.Element | null => {
  const field = useField();
  const show = hasMessage(children);

  const setHasError = field?.setHasError;

  useLayoutEffect(() => {
    if (setHasError === undefined) {
      return undefined;
    }

    setHasError(show);

    return () => {
      setHasError(false);
    };
  }, [setHasError, show]);

  if (!show) {
    return null;
  }

  return (
    <p className={classNames("text-base text-red-400", className)} id={id ?? field?.errorId} role="alert" {...props}>
      {children}
    </p>
  );
};
