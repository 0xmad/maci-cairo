import { localAuthenticationEnrolledLevel, takeAuthenticationResult } from "../src/test/localAuthenticationState";

export const SecurityLevel = {
  NONE: 0,
  SECRET: 1,
} as const;

export const getEnrolledLevelAsync = (): Promise<number> => Promise.resolve(localAuthenticationEnrolledLevel());

export const authenticateAsync = async (): Promise<{ success: boolean; error?: string }> => {
  const result = await takeAuthenticationResult();

  if (result === "success") {
    return { success: true };
  }

  return { success: false, error: "user_cancel" };
};
