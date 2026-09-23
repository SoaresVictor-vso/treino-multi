import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisProvider } from './analysis.provider';
import { AnalysisService } from './analysis.service';

@Module({
	controllers: [AnalysisController],
	providers: [AnalysisProvider, AnalysisService],
	exports: [AnalysisService],
})
export class AnalysisModule {}
