/**
 * Testes unitários do PersonsService — Fase 4
 *
 * Estratégia: isolamento total via mocks do Repository<Person>.
 * Todas as operações de banco são simuladas com jest.fn().
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonsService } from './persons.service';
import { Person } from './entities/person.entity';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';

// ── fixtures ─────────────────────────────────────────────────────────────────

const makePerson = (overrides: Partial<Person> = {}): Person =>
  ({
    id: 'person-uuid-1',
    name: 'João Silva',
    email: 'joao@example.com',
    document: '12345678901',
    phone: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    users: [],
    ...overrides,
  }) as Person;

// ── testes ───────────────────────────────────────────────────────────────────

describe('PersonsService', () => {
  let service: PersonsService;
  let repo: jest.Mocked<Repository<Person>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonsService,
        {
          provide: getRepositoryToken(Person),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn((dto) => ({ ...dto })),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            logCriticalOperation: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(PersonsService);
    repo = module.get(getRepositoryToken(Person));
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto: CreatePersonDto = {
      name: 'João Silva',
      email: 'joao@example.com',
      document: '12345678901',
    };

    it('deve criar e retornar a Person quando o e-mail não existe', async () => {
      repo.findOne.mockResolvedValue(null);
      const expected = makePerson();
      repo.save.mockResolvedValue(expected);

      const result = await service.create(dto);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });

    it('deve lançar ConflictException quando o e-mail já está em uso', async () => {
      repo.findOne.mockResolvedValue(makePerson());

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('deve retornar lista de pessoas ordenadas por nome', async () => {
      const list = [makePerson(), makePerson({ id: 'uuid-2', name: 'Ana' })];
      repo.find.mockResolvedValue(list);

      const result = await service.findAll();

      expect(repo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
      expect(result).toEqual(list);
    });

    it('deve retornar lista vazia quando não há pessoas', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('deve retornar a Person quando o id existe', async () => {
      const person = makePerson();
      repo.findOne.mockResolvedValue(person);

      const result = await service.findOne('person-uuid-1');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'person-uuid-1' },
      });
      expect(result).toEqual(person);
    });

    it('deve lançar NotFoundException quando o id não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('deve atualizar os dados da Person e retornar a versão atualizada', async () => {
      const person = makePerson();
      repo.findOne.mockResolvedValue(person);

      const updatedPerson = { ...person, name: 'João Atualizado' };
      repo.save.mockResolvedValue(updatedPerson as Person);

      const dto: UpdatePersonDto = { name: 'João Atualizado' };
      const result = await service.update('person-uuid-1', dto);

      expect(result.name).toBe('João Atualizado');
      expect(repo.save).toHaveBeenCalled();
    });

    it('deve lançar NotFoundException quando o id não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('id-inexistente', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar ConflictException ao tentar atualizar para e-mail já em uso', async () => {
      const person = makePerson();
      const personComEmailConflitante = makePerson({
        id: 'outro-uuid',
        email: 'outro@example.com',
      });

      // Primeira chamada: findOne pelo id → person encontrado
      // Segunda chamada: findOne pelo e-mail → conflito encontrado
      repo.findOne
        .mockResolvedValueOnce(person)
        .mockResolvedValueOnce(personComEmailConflitante);

      await expect(
        service.update('person-uuid-1', { email: 'outro@example.com' }),
      ).rejects.toThrow(ConflictException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('deve permitir atualização de e-mail se for o mesmo já cadastrado', async () => {
      const person = makePerson();
      repo.findOne.mockResolvedValue(person);
      repo.save.mockResolvedValue(person);

      // Mesmo e-mail → não deve checar conflito
      const result = await service.update('person-uuid-1', {
        email: 'joao@example.com',
      });

      // findOne chamado apenas 1 vez (pelo id), não pelo e-mail
      expect(repo.findOne).toHaveBeenCalledTimes(1);
      expect(result).toEqual(person);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('deve remover a Person quando o id existe', async () => {
      const person = makePerson();
      repo.findOne.mockResolvedValue(person);
      repo.remove.mockResolvedValue(person);

      await expect(service.remove('person-uuid-1')).resolves.toBeUndefined();
      expect(repo.remove).toHaveBeenCalledWith(person);
    });

    it('deve lançar NotFoundException quando o id não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });
});
