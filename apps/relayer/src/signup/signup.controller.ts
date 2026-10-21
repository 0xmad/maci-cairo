import { Body, ConflictException, Controller, HttpCode, Inject, Post } from "@nestjs/common";

import { signupBodySchema, type SignupBody } from "./dto/signup.dto.js";
import { PublicKeyAlreadySignedUp, type SignupService } from "./signup.service.js";

export const SIGNUP_SERVICE = "SIGNUP_SERVICE";

@Controller()
export class SignupController {
  constructor(@Inject(SIGNUP_SERVICE) private readonly signupService: SignupService) {}

  @Post("signup")
  @HttpCode(200)
  async signup(@Body({ schema: signupBodySchema }) body: SignupBody): Promise<{ transactionHash: string }> {
    try {
      return await this.signupService.submit(body);
    } catch (caught) {
      if (caught instanceof PublicKeyAlreadySignedUp) {
        throw new ConflictException({ error: "Public key already signed up" });
      }

      throw caught;
    }
  }
}
