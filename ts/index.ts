import type {
  TwoslashShikiReturn,
  createTransformerFactory,
} from "@shikijs/twoslash";

type ShikiTransformer = Pick<
  ReturnType<ReturnType<typeof createTransformerFactory>>,
  "preprocess"
>;
type ShikiPreprocessMethod = NonNullable<ShikiTransformer["preprocess"]>;
type ShikiTransformerContextCommon =
  ThisParameterType<ShikiPreprocessMethod> & {
    meta: { twoslash?: TwoslashShikiReturn };
  };

export function twoslashBugWorkaround<T extends ShikiTransformer>(
  transformer: T,
): T {
  applyWorkaround(transformer);
  return transformer;
}

function applyWorkaround(transformer: ShikiTransformer): void {
  if (!transformer.preprocess) {
    return;
  }
  transformer.preprocess = getPreprocessMethod(transformer.preprocess);
}

function getPreprocessMethod(
  original: ShikiPreprocessMethod,
): ShikiPreprocessMethod {
  return function preprocessWrapper(
    this: ShikiTransformerContextCommon,
    code,
    options,
  ) {
    let result = original.call(this, code, options);
    if (!result) {
      return result;
    }
    if (!this.meta.twoslash) {
      return result;
    }
    // When the last line ends with `// @log:` in the given code,
    // a trailing newline is created. This code removes that.
    result = removeTrailingNewline(result);
    const maxLine = getMaxLine(result);
    adjustTagNodes(this.meta.twoslash.nodes, maxLine);
    return result;
  };
}

function removeTrailingNewline(code: string): string {
  return code.replace(/\n+$/, "");
}

function getMaxLine(code: string): number {
  return code.split("\n").length - 1; // Subtract 1 to get the last line index
}

function adjustTagNodes(
  nodes: NonNullable<
    ShikiTransformerContextCommon["meta"]["twoslash"]
  >["nodes"],
  maxLine: number,
): void {
  for (const node of nodes) {
    if (node.type === "tag") {
      node.line = Math.min(
        // Twoslash adopts the line where the tag is written as the line number,
        // but Shiki assumes that the line number returned by Twoslash points to the next line.
        // So, we need to subtract to resolve this discrepancy.
        node.line - 1,
        // Twoslash has a bug where it overestimates the line number of tags written on the last line of code.
        // So, we set an upper limit to prevent it from exceeding the actual number of lines in the code.
        maxLine,
      );
    }
  }
}
