import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateAthleteTrainerAssociationDto } from './dto/create-athlete-trainer-association.dto';
import { CreateAthleteTrainerAssociationsDto } from './dto/create-athlete-trainer-associations.dto';
import { EndAthleteTrainerAssociationDto } from './dto/end-athlete-trainer-association.dto';
import { AthleteService } from './athlete.service';

@ApiTags('athlete')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('athlete')
export class AthleteController {
	constructor(private readonly service: AthleteService) {}

	@Get('athletes')
	@ApiOperation({
		summary: 'Lista os atletas visíveis ao treinador ou à administração',
	})
	@RequirePermissions(Permission.ATHLETE_READ)
	findAthletes(@CurrentUser() actor: JwtPayload) {
		return this.service.findAthletes(actor);
	}

	@Get('trainers')
	@ApiOperation({ summary: 'Lista treinadores disponíveis para associação' })
	@RequirePermissions(Permission.ATHLETE_MANAGE)
	findTrainers(@CurrentUser() actor: JwtPayload) {
		return this.service.findTrainers(actor);
	}

	@Post('associations')
	@ApiOperation({
		summary:
			'Associa um atleta a um treinador e encerra o vínculo ativo anterior',
	})
	@RequirePermissions(Permission.ATHLETE_MANAGE)
	createAssociation(
		@Body() dto: CreateAthleteTrainerAssociationDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.createAssociation(dto, actor);
	}

	@Post('associations/bulk')
	@ApiOperation({ summary: 'Associa vários atletas ao mesmo treinador' })
	@RequirePermissions(Permission.ATHLETE_MANAGE)
	createAssociations(
		@Body() dto: CreateAthleteTrainerAssociationsDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.createAssociations(dto, actor);
	}

	@Patch('associations/:id/end')
	@ApiOperation({ summary: 'Encerra um vínculo ativo entre atleta e treinador' })
	@RequirePermissions(Permission.ATHLETE_MANAGE)
	endAssociation(
		@Param('id', new ParseUUIDPipe()) id: string,
		@Body() dto: EndAthleteTrainerAssociationDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.endAssociation(id, dto.endDate, actor);
	}
}
