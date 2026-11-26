import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}
  findAll() { return this.prisma.transaction.findMany({orderBy:{createdAt:'desc'}}); }
  async commit(body: any) {
    const {outgoing,incoming,transaction} = body || {};
    const type=transaction?.type;
    if (!Array.isArray(outgoing)||!Array.isArray(incoming)||!['SALE','TRADE_IN','PURCHASE'].includes(type)) throw new BadRequestException('Invalid transaction');
    if ((type==='SALE'&&(outgoing.length!==1||incoming.length))||(type==='PURCHASE'&&(outgoing.length||incoming.length!==1))||(type==='TRADE_IN'&&(!outgoing.length||!incoming.length))) throw new BadRequestException('Invalid card count');
    const money=(v:any)=>Number.isSafeInteger(v)&&v>=0&&v<=2147483647;
    if(outgoing.some(x=>!x||typeof x.id!=='string'||!money(x.soldPrice)||x.soldPrice===0)||new Set(outgoing.map(x=>x.id)).size!==outgoing.length||incoming.some(x=>!x||typeof x.name!=='string'||!x.name.trim()||!money(x.buyPrice)||!money(x.targetPrice)||(type==='TRADE_IN'&&(x.buyPrice===0||x.targetPrice===0)))) throw new BadRequestException('Invalid card data');
    return this.prisma.$transaction(async db=>{
      const originals=[];
      for(const item of outgoing){const card=await db.card.findUnique({where:{id:item.id}});if(!card||card.status!=='IN_STOCK')throw new ConflictException('Card no longer in stock');originals.push(card);}
      const outCost=originals.reduce((n,c)=>n+c.buyPrice,0), outDeal=outgoing.reduce((n,x)=>n+x.soldPrice,0), inDeal=incoming.reduce((n,x)=>n+x.buyPrice,0);
      const revenue=type==='PURCHASE'?0:outDeal, costBasis=type==='PURCHASE'?inDeal:outCost, netProfit=type==='PURCHASE'?0:revenue-costBasis, cashDelta=type==='TRADE_IN'?outDeal-inDeal:null;
      if(!money(revenue)||!money(costBasis)||!money(inDeal))throw new BadRequestException('Total too large');
      // Reject stale clients instead of misrecording their former trade calculation.
      if(transaction.revenue!==revenue||transaction.costBasis!==costBasis||transaction.netProfit!==netProfit)throw new BadRequestException('Nilai transaksi berubah. Refresh aplikasi dan periksa harga deal.');
      const saved=await db.transaction.create({data:{type,tcg:transaction.tcg,date:transaction.date,summary:transaction.summary,revenue,costBasis,netProfit,cashDelta,notes:transaction.notes}});
      const updated=[],created=[];
      for(const item of outgoing){const original=originals.find(c=>c.id===item.id);const result=await db.card.updateMany({where:{id:item.id,status:'IN_STOCK',buyPrice:original.buyPrice},data:{status:type==='TRADE_IN'?'TRADED':'SOLD',soldPrice:item.soldPrice,disposalTransactionId:saved.id}});if(result.count!==1)throw new ConflictException('Card changed');updated.push(await db.card.findUniqueOrThrow({where:{id:item.id}}));}
      for(const card of incoming){const {tcg,name,setName,number,language,category,gradingCompany,grade,storageLocation,buyPrice,targetPrice,imageUrl}=card;created.push(await db.card.create({data:{tcg,name,setName,number,language,category,gradingCompany,grade,storageLocation,buyPrice,targetPrice,imageUrl,status:'IN_STOCK',acquisitionSource:type,acquisitionTransactionId:saved.id}}));}
      return {updated,created,transaction:saved};
    });
  }
  create(data:any){return this.prisma.transaction.create({data:{type:data.type||'SALE',tcg:data.tcg||'POKEMON',date:data.date||new Date().toISOString().slice(0,10),summary:data.summary||'',revenue:Number(data.revenue)||0,costBasis:Number(data.costBasis)||0,netProfit:Number(data.netProfit)||0,notes:data.notes||''}});}
}
