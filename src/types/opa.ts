/**
 * OPA Evaluator types for policy evaluation results and errors.
 */

/**
 * Result of a policy evaluation.
 */
export interface EvaluationResult {
  /** whether the policy allowed the request */
  allowed: boolean;
  /** the raw result from OPA evaluation (can be boolean, object, or array) */
  result: unknown;
  /** the package name that was evaluated */
  packageName: string;
  /** the rule name that was evaluated */
  ruleName: string;
  /** evaluation execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Error details from OPA evaluation.
 */
export interface OpaError {
  /** error code for categorization */
  code: OpaErrorCode;
  /** human-readable error message */
  message: string;
  /** line number where error occurred (for syntax errors) */
  line?: number;
  /** column number where error occurred */
  column?: number;
  /** suggestions for fixing the error */
  suggestions?: string[];
}

/**
 * OPA error codes.
 */
export type OpaErrorCode =
  | 'FILE_NOT_FOUND'
  | 'SYNTAX_ERROR'
  | 'COMPILATION_ERROR'
  | 'EVALUATION_ERROR'
  | 'INVALID_INPUT'
  | 'INVALID_PACKAGE'
  | 'INVALID_RULE'
  | 'PATH_SECURITY_ERROR'
  | 'WASM_ERROR';

/**
 * Options for policy evaluation.
 */
export interface EvaluateOptions {
  /** JSON input data for policy evaluation */
  input: Record<string, unknown>;
  /** package name to evaluate (e.g., "authz") */
  packageName?: string;
  /** rule name to evaluate (e.g., "allow") */
  ruleName?: string;
}

/**
 * Options for loading a policy.
 */
export interface LoadPolicyOptions {
  /** path to the .rego file */
  policyPath: string;
  /** base path for security validation */
  basePath?: string;
}

/**
 * Trace level for evaluation trace capture.
 */
export type TraceLevel = 'summary' | 'full';

/**
 * Options for trace capture during evaluation.
 */
export interface TraceOptions {
  /** trace detail level - summary for overview, full for complete trace */
  level?: TraceLevel;
  /** max trace size in bytes before truncation (default: 1MB) */
  maxSizeBytes?: number;
}

/**
 * Individual rule evaluation entry in trace.
 * AC-2.2.2: Captures name, line number, evaluation result.
 */
export interface RuleTrace {
  /** rule name */
  name: string;
  /** line number in source rego file */
  line: number;
  /** column number in source rego file */
  column?: number;
  /** evaluation result: true, false, or undefined */
  result: 'true' | 'false' | 'undefined';
  /** duration of this rule evaluation in microseconds */
  durationUs?: number;
}

/**
 * Execution path entry showing rule firing status.
 * AC-2.2.5: Shows which rules were skipped and which fired.
 */
export interface ExecutionPathEntry {
  /** rule or expression that was evaluated */
  rule: string;
  /** whether this rule fired (contributed to result) */
  fired: boolean;
  /** line number in source */
  line?: number;
  /** parent rule if this is a sub-expression */
  parent?: string;
}

/**
 * Complete evaluation trace for debugging.
 * AC-2.2.6: Matches EvaluationTrace interface for AI consumption.
 */
export interface EvaluationTrace {
  /** list of all rules evaluated during execution (AC-2.2.1) */
  rulesEvaluated: RuleTrace[];
  /** variable bindings captured during evaluation (AC-2.2.3) */
  variableBindings: Record<string, unknown>;
  /** final decision result (AC-2.2.4) */
  finalDecision: boolean | undefined;
  /** execution path showing skipped vs fired rules (AC-2.2.5) */
  executionPath: ExecutionPathEntry[];
  /** trace detail level used */
  traceLevel: TraceLevel;
  /** whether trace was truncated due to size limits */
  truncated: boolean;
  /** trace data size in bytes */
  sizeBytes: number;
}

/**
 * Evaluation result with trace data.
 */
export interface EvaluationResultWithTrace extends EvaluationResult {
  /** detailed trace of the evaluation */
  trace: EvaluationTrace;
}
