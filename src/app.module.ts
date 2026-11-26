import { MasterDataController } from './master-data/master-data.controller';
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CardsModule } from './cards/cards.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [PrismaModule, CardsModule, TransactionsModule],
  controllers: [MasterDataController]
})
export class AppModule {}
