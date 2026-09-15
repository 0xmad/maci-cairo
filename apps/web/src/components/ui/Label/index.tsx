import classNames from "classnames";
import { type ComponentProps, type JSX } from "react";

import { useField } from "../Field/fieldContext";

export type LabelProps = ComponentProps<"label">;

export const Label = ({ className, htmlFor, ...props }: LabelProps): JSX.Element => {
  const field = useField();

  return (
    <label
      className={classNames(field === undefined ? undefined : "block text-base", className)}
      htmlFor={htmlFor ?? field?.controlId}
      {...props}
    />
  );
};
