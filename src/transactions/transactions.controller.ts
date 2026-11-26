import { Body, Controller, Get, Post } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  findAll() {
    return this.transactionsService.findAll();
  }

  @Post('commit')
  commit(@Body() body: any) {
    return this.transactionsService.commit(body);
  }

  @Post()
  create(@Body() body: any) {
    return this.transactionsService.create(body);
  }
}
