import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async commit(body: any) {
    const { outgoing, incoming, transaction } = body || {};
    if (!Array.isArray(outgoing) || !Array.isArray(incoming) || !transaction || !['SALE','TRADE_IN','PURCHASE'].includes(transaction.type) || (!outgoing.length && !incoming.length)) throw new BadRequestException('Invalid transaction');
    if (transaction.type === 'SALE' && (outgoing.length !== 1 || incoming.length)) throw new BadRequestException('Invalid sale');
    if (transaction.type === 'PURCHASE' && (outgoing.length || incoming.length !== 1)) throw new BadRequestException('Invalid purchase');
    return this.prisma.$transaction(async (db) => {
      const updated = [];
      const created = [];
      for (const item of outgoing) {
        if (typeof item.id !== 'string' || !Number.isSafeInteger(item.soldPrice) || item.soldPrice < 0) throw new BadRequestException('Invalid outgoing card');
        const result = await db.card.updateMany({where:{id:item.id,status:'IN_STOCK'},data:{status:'SOLD',soldPrice:item.soldPrice}});
        if (result.count !== 1) throw new ConflictException('Card no longer in stock');
        updated.push(await db.card.findUniqueOrThrow({where:{id:item.id}}));
      }
      for (const card of incoming) {
        const {tcg,name,setName,number,language,category,gradingCompany,grade,storageLocation,buyPrice,targetPrice,imageUrl} = card;
        if (!name?.trim() || !Number.isSafeInteger(buyPrice) || buyPrice < 0 || !Number.isSafeInteger(targetPrice) || targetPrice < 0) throw new BadRequestException('Invalid incoming card');
        created.push(await db.card.create({data:{tcg,name,setName,number,language,category,gradingCompany,grade,storageLocation,buyPrice,targetPrice,imageUrl,status:'IN_STOCK'}}));
      }
      const {type,tcg,date,summary,revenue,costBasis,netProfit,notes} = transaction;
      if (![revenue,costBasis,netProfit].every(Number.isSafeInteger) || (type === 'PURCHASE' ? (revenue !== 0 || netProfit !== 0 || costBasis !== created[0]?.buyPrice) : revenue-costBasis !== netProfit)) throw new BadRequestException('Invalid amounts');
      const saved = await db.transaction.create({data:{type,tcg,date,summary,revenue,costBasis,netProfit,notes}});
      return {updated,created,transaction:saved};
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