import { z } from 'zod';
import { resolve, isAbsolute } from 'path';
import { OpaEvaluator } from '../lib/opa-evaluator.js';
import type { OpaError, RuleTrace } from '../types/opa.js';

/**
 * Validates that policyPath is safe (absolute path, no traversal).
 * Returns normalized absolute path or throws validation error.
 */
function validatePolicyPath(policyPath: string): string {
  // Resolve to absolute path
  const absolutePath = isAbsolute(policyPath) ? policyPath : resolve(process.cwd(), policyPath);

  // Check for path traversal attempts
  if (policyPath.includes('..')) {
    throw {
      code: 'PATH_SECURITY_ERROR',
      message: 'Path traversal not allowed in policyPath',
      suggestions: ['Use absolute paths or paths relative to current directory without ".."'],
    } as OpaError;
  }

  // Validate file extension
  if (!absolutePath.endsWith('.rego')) {
    throw {
      code: 'INVALID_INPUT',
      message: 'policyPath must point to a .rego file',
      suggestions: ['Ensure the file has a .rego extension'],
    } as OpaError;
  }

  return absolutePath;
}

/**
 * Input schema for the explain_policy_decision tool.
 * AC-2.3.2: Accepts policyPath (required), inputData (required), packageName (optional), ruleName (optional)
 */
const ExplainPolicyInput = z.object({
  /** Path to the Rego policy file */
  policyPath: z.string().describe('Path to the Rego policy file (.rego)'),
  /** JSON string containing input data for policy evaluation */
  inputData: z.string().describe('JSON string containing input data for policy evaluation'),
  /** Optional: Package name to target (auto-detected if not provided) */
  packageName: z
    .string()
    .optional()
    .describe('Package name to target (auto-detected if not provided)'),
  /** Optional: Rule name to evaluate (defaults to "allow" if not provided) */
  ruleName: z
    .string()
    .optional()
    .describe('Rule name to evaluate (defaults to "allow" if not provided)'),
});

/**
 * Trace entry in the output schema.
 */
const TraceEntry = z.object({
  rule: z.string(),
  line: z.number().optional(),
  result: z.enum(['true', 'false', 'undefined']).optional(),
});

/**
 * Error object in the output schema.
 */
const ErrorOutput = z.object({
  code: z.string(),
  message: z.string(),
  line: z.number().optional(),
  column: z.number().optional(),
  suggestions: z.array(z.string()).optional(),
});

/**
 * Output schema for the explain_policy_decision tool.
 * AC-2.3.7: Includes result, trace[], and optional error
 */
const ExplainPolicyOutput = z.object({
  /** The evaluation result (boolean, object, or null on error) */
  result: z.unknown().nullable(),
  /** Array of trace entries showing rule evaluation */
  trace: z.array(TraceEntry),
  /** Optional error information */
  error: ErrorOutput.optional(),
});

/**
 * Schema for the `explain_policy_decision` tool.
 * AC-2.3.1: Tool is registered with name `explain_policy_decision`
 */
export const ExplainPolicyToolSchema = {
  name: 'explain_policy_decision',
  description:
    'Evaluate a Rego policy with input data and return a detailed trace of the evaluation. ' +
    'Use this to debug policy decisions, understand why a policy allowed or denied a request, ' +
    'and see which rules fired during evaluation.',
  input: ExplainPolicyInput,
  output: ExplainPolicyOutput,
};

export type ExplainPolicyInputType = z.infer<typeof ExplainPolicyInput>;
export type ExplainPolicyOutputType = z.infer<typeof ExplainPolicyOutput>;

/**
 * Converts OpaError to output error format.
 */
const formatError = (error: OpaError): ExplainPolicyOutputType['error'] => ({
  code: error.code,
  message: error.message,
  line: error.line,
  column: error.column,
  suggestions: error.suggestions,
});

/**
 * Converts RuleTrace to output trace format.
 */
const formatTrace = (rules: RuleTrace[]): ExplainPolicyOutputType['trace'] =>
  rules.map((r) => ({
    rule: r.name,
    line: r.line,
    result: r.result,
  }));

/**
 * Executes the explain_policy_decision tool.
 * AC-2.3.3: Loads policy file from policyPath
 * AC-2.3.4: Parses inputData as JSON
 * AC-2.3.5: Targets specific package/rule when provided, auto-detects otherwise
 * AC-2.3.6: Executes evaluation via OPA WASM and captures trace
 * AC-2.3.7: Returns result, trace[], and optional error
 */
export async function executeExplainPolicy(
  input: ExplainPolicyInputType,
): Promise<ExplainPolicyOutputType> {
  const { policyPath, inputData, packageName, ruleName } = input;

  // Validate and normalize policyPath (security check)
  let validatedPath: string;
  try {
    validatedPath = validatePolicyPath(policyPath);
  } catch (err) {
    const pathError = err as OpaError;
    return {
      result: null,
      trace: [],
      error: {
        code: pathError.code,
        message: pathError.message,
        suggestions: pathError.suggestions,
      },
    };
  }

  // AC-2.3.4: Parse inputData as JSON
  let parsedInput: Record<string, unknown>;
  try {
    parsedInput = JSON.parse(inputData);
  } catch (parseError) {
    // AC-2.3.9: Invalid JSON returns descriptive error
    return {
      result: null,
      trace: [],
      error: {
        code: 'INVALID_INPUT',
        message: `Invalid JSON in inputData: ${(parseError as Error).message}`,
        suggestions: [
          'Ensure inputData is valid JSON',
          'Check for missing quotes, brackets, or commas',
        ],
      },
    };
  }

  try {
    // AC-2.3.3: Load policy file from policyPath (using validated path)
    await OpaEvaluator.loadPolicy({ policyPath: validatedPath });

    // AC-2.3.5 & AC-2.3.6: Execute evaluation with trace
    const evalResult = await OpaEvaluator.evaluateWithTrace(
      {
        input: parsedInput,
        packageName,
        ruleName,
      },
      { level: 'full' },
    );

    // AC-2.3.7: Return result, trace[], and optional error
    return {
      result: evalResult.result,
      trace: formatTrace(evalResult.trace.rulesEvaluated),
    };
  } catch (err) {
    // Handle OPA errors with proper formatting
    const opaError = err as OpaError;
    if (opaError.code) {
      return {
        result: null,
        trace: [],
        error: formatError(opaError),
      };
    }

    // Generic error fallback
    return {
      result: null,
      trace: [],
      error: {
        code: 'EVALUATION_ERROR',
        message: (err as Error).message,
      },
    };
  }
}
