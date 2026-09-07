import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { TicketPriority } from '../../domain/value-objects/TicketPriority';

export class CreateTicketDto {
  @IsString()
  @MinLength(5)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @IsUUID()
  clientId!: string;

  @IsUUID()
  @IsOptional()
  assignedTo?: string;
}
