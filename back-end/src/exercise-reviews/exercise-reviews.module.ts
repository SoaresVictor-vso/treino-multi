import { Module } from '@nestjs/common';
import { ExerciseReviewsController } from './exercise-reviews.controller';
import { ExerciseReviewsService } from './exercise-reviews.service';
import { ExerciseReviewsProvider } from './exercise-reviews.provider';
import { AnalysisModule } from '../athlete/analysis/analysis.module';

@Module({
	imports: [AnalysisModule],
	controllers: [ExerciseReviewsController],
	providers: [ExerciseReviewsService, ExerciseReviewsProvider],
})
export class ExerciseReviewsModule {}
