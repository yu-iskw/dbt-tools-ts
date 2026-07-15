import type { LoadedArtifactWorkspace } from '../artifact-workspace/types.js';
import type * as z from 'zod/v4';

export type UseCaseReadMode = 'snapshot';

export interface UseCase<In, Out> {
  readonly name: string;
  readonly title: string;
  readonly input: z.ZodType<In>;
  readonly output: z.ZodType<Out>;
  readonly read: UseCaseReadMode;
  run(snapshot: LoadedArtifactWorkspace, input: In): Out;
}
