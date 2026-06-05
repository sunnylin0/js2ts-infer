import { runGeneration } from '../code-generator';

interface GenerateOptions {
  config: string;
  dryRun?: boolean;
  force?: boolean;
  inDir?: string;
  outDir?: string;
}

export default async function generate(options: GenerateOptions): Promise<void> {
  await runGeneration(options);
}
