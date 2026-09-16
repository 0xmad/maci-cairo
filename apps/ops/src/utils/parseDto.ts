import { BadRequestException } from "@nestjs/common";
import { plainToInstance, type ClassConstructor } from "class-transformer";
import { validateSync, type ValidatorOptions } from "class-validator";

const DEFAULT_VALIDATE: ValidatorOptions = { whitelist: true, forbidNonWhitelisted: true };

/** Instantiates and validates a DTO, or throws `BadRequestException`. */
export function parseDto<T extends object>(
  cls: ClassConstructor<T>,
  value: unknown,
  error: string,
  options: ValidatorOptions = DEFAULT_VALIDATE,
): T {
  const source = value === undefined ? {} : value;

  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    throw new BadRequestException({ error });
  }

  const dto = plainToInstance(cls, source);

  if (validateSync(dto, options).length > 0) {
    throw new BadRequestException({ error });
  }

  return dto;
}
