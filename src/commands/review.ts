import { runReview } from '../interactor';

interface ReviewOptions {
  config: string;
}

export default function review(options: ReviewOptions): void {
  runReview(options);
}
