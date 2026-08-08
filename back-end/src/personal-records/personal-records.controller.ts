import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePersonalRecordDto } from './dto/create-personal-record.dto';
import { UpdatePersonalRecordDto } from './dto/update-personal-record.dto';
import { PersonalRecordsService } from './personal-records.service';

const MANAGE_ROLES = [Role.ORG_ADMIN, Role.ORG_SUPPORT, Role.TENANT_ADMIN];

@ApiTags('personal-records')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('personal-records')
export class PersonalRecordsController {
	constructor(private readonly service: PersonalRecordsService) {}

	@Get('athletes/:athleteId')
	@ApiOperation({ summary: 'Lista os 1RMs de um atleta autorizado' })
	findByAthlete(
		@Param('athleteId', new ParseUUIDPipe()) athleteId: string,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.findByAthlete(athleteId, actor);
	}

	@Post()
	@UseGuards(RolesGuard)
	@Roles(...MANAGE_ROLES)
	@ApiOperation({ summary: 'Registra o 1RM de referência de um atleta' })
	create(
		@Body() dto: CreatePersonalRecordDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.create(dto, actor);
	}

	@Patch(':id')
	@UseGuards(RolesGuard)
	@Roles(...MANAGE_ROLES)
	@ApiOperation({ summary: 'Atualiza um 1RM de referência' })
	update(
		@Param('id', new ParseUUIDPipe()) id: string,
		@Body() dto: UpdatePersonalRecordDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.update(id, dto, actor);
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@UseGuards(RolesGuard)
	@Roles(...MANAGE_ROLES)
	@ApiOperation({ summary: 'Remove um 1RM de referência' })
	async remove(
		@Param('id', new ParseUUIDPipe()) id: string,
		@CurrentUser() actor: JwtPayload,
	) {
		await this.service.remove(id, actor);
	}
}
