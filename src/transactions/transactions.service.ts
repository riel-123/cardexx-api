import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  create(data: any) {
    return this.prisma.transaction.create({
      data: {
        type: data.type || 'SALE',
        tcg: data.tcg || 'POKEMON',
        date: data.date || new Date().toISOString().slice(0, 10),
        summary: data.summary || '',
        revenue: Number(data.revenue) || 0,
        costBasis: Number(data.costBasis) || 0,
        netProfit: Number(data.netProfit) || 0,
        notes: data.notes || ''
      }
    });
  }
}