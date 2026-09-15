import { createContext, useContext, type Dispatch, type SetStateAction } from "react";

export interface FieldContextValue {
  controlId: string;
  errorId: string;
  hasError: boolean;
  setHasError: Dispatch<SetStateAction<boolean>>;
}

export const FieldContext = createContext<FieldContextValue | undefined>(undefined);

export const useField = (): FieldContextValue | undefined => useContext(FieldContext);
