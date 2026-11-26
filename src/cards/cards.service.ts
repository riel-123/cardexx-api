import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CardsService {
  constructor(private prisma: PrismaService) {}

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
