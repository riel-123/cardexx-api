import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('master-data')
export class MasterDataController {
  constructor(private readonly prisma: PrismaService) {}

  private table(kind: string) {
    if (kind === 'storage') return Prisma.raw('public."StorageLocation"');
    if (kind === 'categories') return Prisma.raw('public."Category"');
    throw new BadRequestException('Jenis master data tidak valid');
  }
  private name(value: unknown) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 120)
      throw new BadRequestException('Nama wajib diisi (maksimal 120 karakter)');
    return value.trim();
  }
  @Get()
  async list() {
    const [categories, storage] = await Promise.all([
      this.prisma.$queryRaw<{name: string}[]>(Prisma.sql`SELECT name FROM public."Category" WHERE archived = false ORDER BY name ASC`),
      this.prisma.$queryRaw<{name: string}[]>(Prisma.sql`SELECT name FROM public."StorageLocation" WHERE archived = false ORDER BY name ASC`)
    ]);
    return { categories: categories.map(x => x.name), storageLocations: storage.map(x => x.name) };
  }
  @Post(':kind')
  async add(@Param('kind') kind: string, @Body() body: { name?: unknown }) {
    const table = this.table(kind);
    const name = this.name(body?.name);
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw(Prisma.sql`LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE`);
      const existing = await tx.$queryRaw<{name: string; archived: boolean}[]>(Prisma.sql`SELECT name, archived FROM ${table} WHERE lower(name)=lower(${name}) ORDER BY archived ASC, name ASC LIMIT 1`);
      const resolved = existing[0]?.name || name;
      await tx.$executeRaw(Prisma.sql`INSERT INTO ${table} (name, archived) VALUES (${resolved}, false) ON CONFLICT (name) DO UPDATE SET archived=false`);
      return { name: resolved };
    });
  }
  @Delete(':kind/:name')
  async archive(@Param('kind') kind: string, @Param('name') rawName: string) {
    const table = this.table(kind);
    const name = this.name(rawName);
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw(Prisma.sql`LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE`);
      const rows = await tx.$queryRaw<{name: string}[]>(Prisma.sql`SELECT name FROM ${table} WHERE name=${name} AND NOT archived FOR UPDATE`);
      if (!rows.length) return { name, archived: true };
      const active = await tx.card.count({ where: { status: 'IN_STOCK', ...(kind === 'storage' ? { storageLocation: name } : { category: name }) } });
      if (active) throw new ConflictException('Masih ada kartu aktif. Pindahkan kartu terlebih dahulu.');
      const count = await tx.$queryRaw<{total: bigint}[]>(Prisma.sql`SELECT count(*) AS total FROM ${table} WHERE NOT archived`);
      if (Number(count[0].total) <= 1) throw new ConflictException('Minimal harus tersisa satu pilihan aktif.');
      await tx.$executeRaw(Prisma.sql`UPDATE ${table} SET archived=true WHERE name=${name}`);
      return { name, archived: true };
    });
  }
}
