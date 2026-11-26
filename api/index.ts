import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
   import { AppModule } from '../src/app.module';

   let cachedServer: any;

   export default async function handler(req: any, res: any) {
     if (!cachedServer) {
       const app = await NestFactory.create<NestExpressApplication>(AppModule);
       app.useBodyParser('json', { limit: '1mb' });
       app.enableCors({ origin: true });
       await app.init();
       cachedServer = app.getHttpAdapter().getInstance();
     }
     return cachedServer(req, res);
   }