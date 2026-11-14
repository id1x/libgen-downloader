// Regression: a resolution stage that throws must degrade to "no proposals"
// instead of rejecting the whole resolution. The cross-encoder ranker stage
// loads its model lazily; any failure there used to escape the resolver and,
// through the unchecked search paths, kill the app.
import { describe, expect, it } from "bun:test";
import { parseHTML } from "linkedom";
import { ResolutionStage } from "../src/api/resolution/resolution-stage";
import { SelectorResolver } from "../src/api/resolution/selector-resolver";
import { CandidateValidator } from "../src/api/resolution/validators/candidate-validator";
import { MemorySelectorStore } from "./support/memory-selector-store";
import type {
  ResolutionRequest,
  ResolutionStageName,
  ValidationResult,
} from "../src/api/resolution/types";

class ProposedStage extends ResolutionStage {
  readonly name: ResolutionStageName;

  constructor(
    name: ResolutionStageName,
    private readonly elements: () => Promise<Element[]>
  ) {
    super();
    this.name = name;
  }

  async propose(): Promise<Element[]> {
    return this.elements();
  }
}

class ThrowingStage extends ResolutionStage {
  readonly name = "ranked" as const;

  async propose(): Promise<Element[]> {
    throw new Error("stage exploded");
  }
}

const document = parseHTML(
  "<html><body><table id='target'><tr><td>row</td></tr></table></body></html>"
).document;

const request: ResolutionRequest = {
  task: "results-table",
  scopeKey: "libgen.example",
  document,
  pageUrl: "https://libgen.example/index.php?req=test",
  intent: "The table listing the book search results.",
  signal: new AbortController().signal,
};

const acceptingValidator = new (class extends CandidateValidator<Element> {
  async validate(element: Element): Promise<ValidationResult<Element>> {
    if (element.id === "target") {
      return { valid: true, payload: element };
    }
    return this.invalid("not the results table");
  }
})();

const store = new MemorySelectorStore();

describe("SelectorResolver stage failures", () => {
  it("keeps resolving with later stages when a stage throws", async () => {
    const table = document.querySelector("#target")!;
    const resolver = new SelectorResolver(
      [new ThrowingStage(), new ProposedStage("ranked", async () => [table])],
      acceptingValidator,
      store
    );

    const outcome = await resolver.resolve(request);

    expect(outcome.resolved).toBe(true);
    if (outcome.resolved) {
      expect(outcome.resolution.element).toBe(table);
      expect(outcome.attempts[0].failures).toEqual(["stage exploded"]);
    }
  });

  it("returns an unresolved outcome instead of rejecting when every stage throws", async () => {
    const resolver = new SelectorResolver(
      [new ThrowingStage(), new ThrowingStage()],
      acceptingValidator,
      store
    );

    const outcome = await resolver.resolve(request);

    expect(outcome).toMatchObject({ resolved: false, failureKind: "not-available" });
    expect(outcome.attempts.map((attempt) => attempt.failures)).toEqual([
      ["stage exploded"],
      ["stage exploded"],
    ]);
  });

  it("treats a throwing validator as a failed candidate", async () => {
    const table = document.querySelector("#target")!;
    const throwingValidator = new (class extends CandidateValidator<Element> {
      async validate(): Promise<ValidationResult<Element>> {
        throw new Error("validator exploded");
      }
    })();
    const resolver = new SelectorResolver(
      [new ProposedStage("ranked", async () => [table])],
      throwingValidator,
      store
    );

    const outcome = await resolver.resolve(request);

    expect(outcome).toMatchObject({ resolved: false, failureKind: "not-available" });
    expect(outcome.attempts[0].failures).toEqual(["validator exploded"]);
  });
});
