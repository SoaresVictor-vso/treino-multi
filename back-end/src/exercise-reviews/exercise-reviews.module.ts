import { Module } from '@nestjs/common';
import { ExerciseReviewsController } from './exercise-reviews.controller';
import { ExerciseReviewsService } from './exercise-reviews.service';

@Module({ controllers: [ExerciseReviewsController], providers: [ExerciseReviewsService] })
export class ExerciseReviewsModule {}
