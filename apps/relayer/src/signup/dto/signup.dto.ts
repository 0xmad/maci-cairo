import { literal, strictObject, string } from "zod";

const COORDINATE = /^(?:0x[0-9a-fA-F]+|[0-9]+)$/u;
const MACI_ADDRESS = /^0x[0-9a-fA-F]+$/u;

/** HTTP body: user public key, empty Evidence, and the MACI. Extra fields are rejected. */
export const signupBodySchema = strictObject({
  userPublicKey: strictObject({
    x: string().regex(COORDINATE),
    y: string().regex(COORDINATE),
  }),
  evidence: literal(""),
  maci: string().regex(MACI_ADDRESS),
});

export interface SignupBody {
  userPublicKey: { x: string; y: string };
  evidence: "";
  maci: string;
}
