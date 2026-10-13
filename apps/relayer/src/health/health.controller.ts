import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("health")
  health(): { service: string } {
    return { service: "Relayer" };
  }
}
