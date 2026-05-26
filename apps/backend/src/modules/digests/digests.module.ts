import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Digest } from './digest.entity';
import { DigestsService } from './digests.service';
import { DigestsController } from './digests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Digest])],
  controllers: [DigestsController],
  providers: [DigestsService],
  exports: [DigestsService],
})
export class DigestsModule {}
