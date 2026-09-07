import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TicketPriority } from '../../domain/value-objects/TicketPriority';
import { TicketStatus } from '../../domain/value-objects/TicketStatus';

export class UpdateTicketDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @IsUUID()
  @IsOptional()
  assignedTo?: string;
}
