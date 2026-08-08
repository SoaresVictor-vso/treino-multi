import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePersonalRecordDto } from './create-personal-record.dto';

export class UpdatePersonalRecordDto extends PartialType(
	OmitType(CreatePersonalRecordDto, ['athleteId', 'exerciseGroupId'] as const),
) {}
