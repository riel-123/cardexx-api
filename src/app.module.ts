import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CardsModule } from './cards/cards.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [PrismaModule, CardsModule, TransactionsModule]
})
export class AppModule {}
