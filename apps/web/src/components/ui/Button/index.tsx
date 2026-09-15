import classNames from "classnames";
import { type ComponentProps, type JSX } from "react";

const BUTTON_SIZE = {
  compact: "rounded border border-zinc-600 px-3 py-1 text-sm hover:bg-zinc-800 disabled:opacity-50",
  field: "rounded border border-zinc-600 px-4 py-2.5 text-base hover:bg-zinc-800 disabled:opacity-50",
} as const;

export type ButtonProps = ComponentProps<"button"> & {
  size?: keyof typeof BUTTON_SIZE;
};

export const Button = ({ className, size = "compact", type = "button", ...props }: ButtonProps): JSX.Element => (
  // eslint-disable-next-line react/button-has-type -- native type with default "button"
  <button className={classNames(BUTTON_SIZE[size], className)} type={type} {...props} />
);
