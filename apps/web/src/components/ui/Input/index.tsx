import classNames from "classnames";
import { type ComponentProps, type JSX } from "react";

import { useField } from "../Field/fieldContext";

const INPUT_SIZE = "block h-11 w-full rounded border border-zinc-600 bg-zinc-950 px-3 text-base leading-none";

export type InputProps = ComponentProps<"input">;

export const Input = ({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
  id,
  ...props
}: InputProps): JSX.Element => {
  const field = useField();
  const describedBy = field?.hasError === true ? field.errorId : undefined;
  const invalid = field?.hasError === true ? true : undefined;

  return (
    <input
      aria-describedby={ariaDescribedBy ?? describedBy}
      aria-invalid={ariaInvalid ?? invalid}
      className={classNames(INPUT_SIZE, className)}
      id={id ?? field?.controlId}
      {...props}
    />
  );
};
