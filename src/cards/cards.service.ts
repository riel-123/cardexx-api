import { randomUUID } from 'node:crypto';
import { Injectable, BadRequestException, ServiceUnavailableException, BadGatewayException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CardsService {
  constructor(private prisma: PrismaService) {}

  async uploadImage(image: unknown) {
    const base = process.env.SUPABASE_URL?.replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!base || !key) throw new ServiceUnavailableException('Storage belum dikonfigurasi');
    if (typeof image !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) throw new BadRequestException('Foto harus JPEG');
    const bytes = Buffer.from(image.split(',')[1], 'base64');
    if (bytes.length < 4 || bytes.length > 600 * 1024 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length-2] !== 255 || bytes[bytes.length-1] !== 217) throw new BadRequestException('Foto tidak valid atau lebih dari 600 KB');
    const path = `card-images/${randomUUID()}.jpg`;
    let response: Response;
    try {
      response = await fetch(`${base}/storage/v1/object/${path}`, {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'false', 'Cache-Control': 'max-age=31536000' }, body: new Uint8Array(bytes), signal: AbortSignal.timeout(15000)
      });
    } catch { throw new BadGatewayException('Storage tidak dapat dihubungi'); }
    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      let detail = 'Unknown storage error';
      try {
        const parsed = JSON.parse(raw);
        detail = String(parsed.message || parsed.error || parsed.code || detail);
      } catch { /* Do not log raw HTML or credentials. */ }
      console.error('[CARDEXX Storage]', response.status, detail.split(key).join('[REDACTED]').slice(0, 300));
      throw new BadGatewayException(`Storage upload gagal (${response.status})`);
    }
    return { url: `${base}/storage/v1/object/public/${path}` };
  }

  findAll() {
    return this.prisma.card.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  create(data: any) {
    return this.prisma.card.create({
      data: {
        tcg: data.tcg || 'POKEMON',
        name: data.name,
        setName: data.setName || '',
        number: data.number || '-',
        language: data.language || 'JP',
        category: data.category || 'Single Card',
        gradingCompany: data.gradingCompany || 'Raw',
        grade: data.grade || 'Raw NM/M',
        storageLocation: data.storageLocation || 'Binder 1 - High End',
        buyPrice: Number(data.buyPrice) || 0,
        targetPrice: Number(data.targetPrice) || 0,
        soldPrice: data.soldPrice !== undefined ? Number(data.soldPrice) : null,
        status: data.status || 'IN_STOCK',
        imageUrl: data.imageUrl || ''
      }
    });
  }

  update(id: string, data: any) {
    return this.prisma.card.update({
      where: { id },
      data
    });
  }

  remove(id: string) {
    return this.prisma.card.delete({
      where: { id }
    });
  }
}
