import { validate } from 'class-validator';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { AppError } from '../errors/AppError';

export async function validateDto<T extends object>(cls: ClassConstructor<T>, plain: unknown): Promise<T> {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance as object);
  if (errors.length > 0) {
    throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
  }
  return instance;
}
