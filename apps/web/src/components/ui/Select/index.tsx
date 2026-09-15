import classNames from "classnames";
import { type ComponentProps, type JSX } from "react";

import { useField } from "../Field/fieldContext";

import styles from "./index.module.css";

const SELECT_SIZE = {
  compact: "rounded border border-zinc-600 bg-zinc-950 py-1 pl-2",
  field: "block h-11 w-full rounded border border-zinc-600 bg-zinc-950 pl-3 text-base leading-none",
} as const;

export type SelectProps = Omit<ComponentProps<"select">, "size"> & {
  size?: keyof typeof SELECT_SIZE;
};

export const Select = ({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
  id,
  size = "field",
  ...props
}: SelectProps): JSX.Element => {
  const field = useField();
  const describedBy = field?.hasError === true ? field.errorId : undefined;
  const invalid = field?.hasError === true ? true : undefined;

  return (
    <select
      aria-describedby={ariaDescribedBy ?? describedBy}
      aria-invalid={ariaInvalid ?? invalid}
      className={classNames(styles.select, styles[size], SELECT_SIZE[size], className)}
      id={id ?? field?.controlId}
      {...props}
    />
  );
};
