import { runGeneration } from '../code-generator';

interface GenerateOptions {
  config: string;
  dryRun?: boolean;
  force?: boolean;
}

export default function generate(options: GenerateOptions): void {
  runGeneration(options);
}
