import type { FailureKind } from "../availability/types";
import type { ResolutionStage } from "./resolution-stage";
import type { SelectorStore } from "./store/selector-store";
import type {
  ResolutionAttempt,
  ResolutionOutcome,
  ResolutionRequest,
  ResolutionStageName,
  ValidationResult,
} from "./types";
import { pathFrom } from "./utils/dom-path";
import type { CandidateValidator } from "./validators/candidate-validator";

const failureMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
};

export class SelectorResolver<TPayload> {
  constructor(
    private readonly stages: ResolutionStage[],
    private readonly validator: CandidateValidator<TPayload>,
    private readonly store: SelectorStore
  ) {}

  async resolve(request: ResolutionRequest): Promise<ResolutionOutcome<TPayload>> {
    const attempts: ResolutionAttempt[] = [];
    const checked = new Set<Element>();
    let failureKind: FailureKind = "not-available";

    for (const stage of this.stages) {
      const attempt: ResolutionAttempt = {
        stage: stage.name,
        proposals: 0,
        failures: [],
      };
      attempts.push(attempt);

      // A stage that throws (the cross-encoder ranker loads its model here,
      // for example) contributes no proposals; later stages still run. A
      // resolution failure must degrade, never reject.
      let proposed: Element[] = [];
      try {
        proposed = await stage.propose(request);
      } catch (error: unknown) {
        attempt.failures.push(failureMessage(error));
      }

      const proposals = proposed.filter((element) => !checked.has(element));
      attempt.proposals = proposals.length;

      for (const element of proposals) {
        checked.add(element);
        let validation: ValidationResult<TPayload>;
        try {
          validation = await this.validator.validate(element, request);
        } catch (error: unknown) {
          attempt.failures.push(failureMessage(error));
          continue;
        }
        if (validation.valid) {
          await this.remember(stage.name, element, request);
          return {
            resolved: true,
            resolution: { element, payload: validation.payload, stage: stage.name },
            attempts,
          };
        }
        attempt.failures.push(validation.reason);
        if (validation.kind !== "not-available") {
          failureKind = validation.kind;
          if (!stage.speculative) {
            return { resolved: false, attempts, failureKind };
          }
        }
      }

      if (stage.name === "learned" && proposals.length > 0) {
        await this.store.delete(request.scopeKey, request.task);
      }
    }

    return { resolved: false, attempts, failureKind };
  }

  async release(): Promise<void> {
    await Promise.all(this.stages.map((stage) => stage.release()));
  }

  private async remember(
    stageName: ResolutionStageName,
    element: Element,
    request: ResolutionRequest
  ): Promise<void> {
    if (stageName !== "ranked") {
      return;
    }
    await this.store.set(request.scopeKey, request.task, {
      path: pathFrom(request.document.documentElement, element),
      learnedAt: new Date().toISOString(),
    });
  }
}
