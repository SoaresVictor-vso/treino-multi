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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PersonsService } from './persons.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permission.enum';

/**
 * CRUD de Person.
 * Todas as rotas exigem JWT ativo (JwtAuthGuard global).
 * Cada operação requer a permissão correspondente.
 */
@ApiTags('persons')
@ApiBearerAuth('JWT')
@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  /** POST /persons — cria uma nova pessoa física */
  @ApiOperation({ summary: 'Cria uma nova pessoa física' })
  @ApiResponse({ status: 201, description: 'Pessoa criada com sucesso' })
  @Post()
  @RequirePermissions(Permission.USER_CREATE)
  create(@Body() dto: CreatePersonDto) {
    return this.personsService.create(dto);
  }

  /** GET /persons — lista todas as pessoas */
  @ApiOperation({ summary: 'Lista todas as pessoas físicas' })
  @ApiResponse({ status: 200, description: 'Lista de pessoas' })
  @Get()
  @RequirePermissions(Permission.USER_READ)
  findAll() {
    return this.personsService.findAll();
  }

  /** GET /persons/:id — detalhe de uma pessoa */
  @ApiOperation({ summary: 'Busca pessoa por ID' })
  @ApiResponse({ status: 200, description: 'Pessoa encontrada' })
  @ApiResponse({ status: 404, description: 'Pessoa não encontrada' })
  @Get(':id')
  @RequirePermissions(Permission.USER_READ)
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.personsService.findOne(id);
  }

  /** PATCH /persons/:id — atualiza dados de uma pessoa */
  @ApiOperation({ summary: 'Atualiza dados da pessoa' })
  @ApiResponse({ status: 200, description: 'Pessoa atualizada' })
  @Patch(':id')
  @RequirePermissions(Permission.USER_UPDATE)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePersonDto,
  ) {
    return this.personsService.update(id, dto);
  }

  /** DELETE /persons/:id — remove uma pessoa */
  @ApiOperation({ summary: 'Remove uma pessoa (soft delete)' })
  @ApiResponse({ status: 204, description: 'Removida com sucesso' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.USER_DELETE)
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.personsService.remove(id);
  }
}
