import { Module } from '@nestjs/common';
import { ImportController } from '../imports/import.controller';
import { ImportService } from '../imports/import.service';
import { MediaModule } from '../media/media.module';
import { ProductMediaService } from './product-media.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [MediaModule],
  // ImportController trước để /products/import/* không bị ':id' bắt nhầm
  controllers: [ImportController, ProductsController],
  providers: [ProductsService, ProductMediaService, ImportService],
  exports: [ProductsService],
})
export class ProductsModule {}
