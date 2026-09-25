import { Module } from '@nestjs/common';
import { AnalysisProvider } from './analysis.provider';
import { AnalysisService } from './analysis.service';

@Module({
	controllers: [],
	providers: [AnalysisProvider, AnalysisService],
	exports: [AnalysisService],
})
export class AnalysisModule {}
