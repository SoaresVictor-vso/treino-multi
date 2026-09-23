import { Module } from '@nestjs/common';
import { ExerciseReviewsController } from './exercise-reviews.controller';
import { ExerciseReviewsService } from './exercise-reviews.service';
import { AnalysisModule } from '../athlete/analysis/analysis.module';

@Module({
	imports: [AnalysisModule],
	controllers: [ExerciseReviewsController],
	providers: [ExerciseReviewsService],
})
export class ExerciseReviewsModule {}
