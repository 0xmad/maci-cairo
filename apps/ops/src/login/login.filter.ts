import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException } from "@nestjs/common";
import { type FastifyReply } from "fastify";
import { object, string, union } from "zod";

const httpErrorBodySchema = union([
  string(),
  object({
    error: string().optional(),
    message: string().optional(),
  }),
]);

@Catch()
export class LoginFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    if (exception instanceof HttpException) {
      reply.status(exception.getStatus()).send({ error: this.errorMessage(exception.getResponse()) });

      return;
    }

    const error = exception instanceof Error ? exception : new Error("failed");
    reply.status(this.statusFor(error)).send({ error: error.message });
  }

  private statusFor(error: Error): number {
    if (error.message === "invalid nonce" || error.message === "invalid token" || error.message === "not allowlisted") {
      return 401;
    }

    return 400;
  }

  private errorMessage(payload: string | object): string {
    const parsed = httpErrorBodySchema.safeParse(payload);

    if (!parsed.success) {
      return "failed";
    }

    if (typeof parsed.data === "string") {
      return parsed.data;
    }

    return parsed.data.error ?? parsed.data.message ?? "failed";
  }
}
