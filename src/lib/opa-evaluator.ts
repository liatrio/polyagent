import { readFile, mkdtemp, rm, writeFile } from 'fs/promises';
import { resolve, relative, isAbsolute, join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { loadPolicy as loadOpaPolicy } from '@open-policy-agent/opa-wasm';
import * as tar from 'tar';
import type {
  EvaluationResult,
  EvaluationResultWithTrace,
  EvaluationTrace,
  ExecutionPathEntry,
  OpaError,
  EvaluateOptions,
  LoadPolicyOptions,
  OpaErrorCode,
  RuleTrace,
  TraceLevel,
  TraceOptions,
} from '../types/opa.js';

const execFileAsync = promisify(execFile);

/** default rule name for evaluation */
const DEFAULT_RULE_NAME = 'allow';

/** default compilation timeout in milliseconds */
const DEFAULT_OPA_BUILD_TIMEOUT_MS = 30000;

/** default eval timeout in milliseconds */
const DEFAULT_OPA_EVAL_TIMEOUT_MS = 10000;

/** max memory per wasm instance in bytes (50MB) */
const MAX_WASM_MEMORY_BYTES = 50 * 1024 * 1024;

/** default max trace size in bytes (1MB) - AC-2.2.10 */
const DEFAULT_MAX_TRACE_SIZE_BYTES = 1024 * 1024;

/** WASM memory page size in bytes (64KB per WebAssembly spec) */
const WASM_PAGE_SIZE_BYTES = 65536;

/** Minimum supported OPA CLI version */
const MIN_OPA_VERSION = '0.45.0';

/**
 * Heap estimate multiplier for WASM memory calculation.
 * WASM runtime typically allocates 2-4x the binary size for heap.
 * Using 3x as conservative middle-ground estimate.
 */
const HEAP_ESTIMATE_MULTIPLIER = 3;

/**
 * Configuration options for OPA Evaluator timeouts.
 * Can be set via environment variables or programmatically.
 */
interface OpaEvaluatorConfig {
  buildTimeoutMs: number;
  evalTimeoutMs: number;
}

const getConfig = (): OpaEvaluatorConfig => ({
  buildTimeoutMs:
    parseInt(process.env.OPA_BUILD_TIMEOUT_MS || '', 10) || DEFAULT_OPA_BUILD_TIMEOUT_MS,
  evalTimeoutMs: parseInt(process.env.OPA_EVAL_TIMEOUT_MS || '', 10) || DEFAULT_OPA_EVAL_TIMEOUT_MS,
});

/**
 * Unified error type for OPA CLI and file system errors.
 */
interface OpaCliError extends Error {
  stderr?: string;
  code?: string;
}

/**
 * Cached WASM policy instance.
 */
interface CachedPolicy {
  policy: Awaited<ReturnType<typeof loadOpaPolicy>>;
  packageNames: string[];
  ruleNames: string[];
  lastAccessed: number;
  policyPath: string;
  /** WASM binary size in bytes */
  wasmBinarySize: number;
  /** estimated runtime memory in bytes (binary + heap estimate) */
  estimatedMemoryBytes: number;
}

/**
 * Creates an OPA error with the given code and message.
 */
const createOpaError = (
  code: OpaErrorCode,
  message: string,
  options?: Partial<Omit<OpaError, 'code' | 'message'>>,
): OpaError => ({
  code,
  message,
  ...options,
});

/**
 * OPA Evaluator service for loading and evaluating Rego policies using WASM.
 * Uses OPA CLI for compilation and opa-wasm SDK for execution.
 * Implements singleton pattern with WASM instance caching.
 */
class OpaEvaluatorSingleton {
  private static instance: OpaEvaluatorSingleton;
  private cache: Map<string, CachedPolicy> = new Map();
  /** cache for source line mappings to avoid re-parsing rego files (AC-2.2.7) */
  private sourceLineCache: Map<string, Map<string, number>> = new Map();
  /** cached OPA version check result */
  private opaVersionChecked = false;

  private constructor() {}

  /**
   * Checks if OPA CLI is available and meets minimum version requirement.
   * Logs warning if version is below minimum but doesn't block execution.
   */
  private async checkOpaVersion(): Promise<void> {
    if (this.opaVersionChecked) return;

    try {
      const { stdout } = await execFileAsync('opa', ['version'], { timeout: 5000 });
      const versionMatch = stdout.match(/Version:\s*(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        const version = versionMatch[1];
        if (this.compareVersions(version, MIN_OPA_VERSION) < 0) {
          console.warn(
            `[OpaEvaluator] OPA version ${version} is below minimum ${MIN_OPA_VERSION}. Some features may not work correctly.`,
          );
        }
      }
    } catch {
      // OPA not installed or version check failed - will be caught later during compilation
    }
    this.opaVersionChecked = true;
  }

  /**
   * Compares two semantic version strings.
   * Returns negative if a < b, positive if a > b, zero if equal.
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const diff = (partsA[i] || 0) - (partsB[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  public static getInstance(): OpaEvaluatorSingleton {
    if (!OpaEvaluatorSingleton.instance) {
      OpaEvaluatorSingleton.instance = new OpaEvaluatorSingleton();
    }
    return OpaEvaluatorSingleton.instance;
  }

  /**
   * Validates that the policy path is within the allowed base path.
   * Prevents directory traversal attacks.
   */
  private validatePath(policyPath: string, basePath?: string): void {
    if (!basePath) return;

    const resolvedPolicy = resolve(policyPath);
    const resolvedBase = resolve(basePath);
    const relativePath = relative(resolvedBase, resolvedPolicy);

    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw createOpaError(
        'PATH_SECURITY_ERROR',
        `Path "${policyPath}" is outside the allowed base path "${basePath}"`,
        { suggestions: ['Ensure the policy file is within the project directory'] },
      );
    }
  }

  /**
   * Extracts package names from Rego source code.
   */
  private extractPackageNames(regoContent: string): string[] {
    const packageRegex = /^package\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gm;
    const packages: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = packageRegex.exec(regoContent)) !== null) {
      packages.push(match[1]);
    }

    return packages;
  }

  /**
   * Extracts rule names from Rego source code.
   */
  private extractRuleNames(regoContent: string): string[] {
    // match rule definitions: "rulename if {", "rulename {", "rulename = ", "default rulename"
    const ruleRegex = /^(?:default\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:if\s*\{|\{|:?=|\[)/gm;
    const rules = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = ruleRegex.exec(regoContent)) !== null) {
      const ruleName = match[1];
      // filter out keywords
      if (
        ![
          'package',
          'import',
          'as',
          'default',
          'else',
          'some',
          'every',
          'in',
          'contains',
          'if',
          'with',
          'not',
        ].includes(ruleName)
      ) {
        rules.add(ruleName);
      }
    }

    return Array.from(rules);
  }

  /**
   * Parses OPA CLI errors to extract line/column information.
   */
  private parseOpaError(stderr: string): Partial<OpaError> {
    // opa error format: "file.rego:5:10: rego_parse_error: ..."
    const locationMatch = stderr.match(/:(\d+):(\d+):/);
    const lineMatch = stderr.match(/line\s+(\d+)/i);
    const colMatch = stderr.match(/col(?:umn)?\s+(\d+)/i);

    return {
      line: locationMatch
        ? parseInt(locationMatch[1], 10)
        : lineMatch
          ? parseInt(lineMatch[1], 10)
          : undefined,
      column: locationMatch
        ? parseInt(locationMatch[2], 10)
        : colMatch
          ? parseInt(colMatch[1], 10)
          : undefined,
    };
  }

  /**
   * Compiles a Rego policy to WASM using OPA CLI.
   * Returns the compiled WASM binary.
   */
  private async compileToWasm(
    policyPath: string,
    packageNames: string[],
    ruleNames: string[],
  ): Promise<Buffer> {
    const tmpDir = await mkdtemp(join(tmpdir(), 'opa-wasm-'));
    const bundlePath = join(tmpDir, 'bundle.tar.gz');

    try {
      // build entrypoints for all package/rule combinations
      const entrypoints: string[] = [];
      for (const pkg of packageNames) {
        for (const rule of ruleNames) {
          entrypoints.push(`${pkg}/${rule}`);
        }
      }

      // if no entrypoints found, use package name with default rule
      if (entrypoints.length === 0 && packageNames.length > 0) {
        entrypoints.push(`${packageNames[0]}/${DEFAULT_RULE_NAME}`);
      }

      // compile using opa build
      const args = [
        'build',
        '-t',
        'wasm',
        '-o',
        bundlePath,
        ...entrypoints.flatMap((e) => ['-e', e]),
        policyPath,
      ];

      await execFileAsync('opa', args, { timeout: getConfig().buildTimeoutMs });

      // extract policy.wasm from the bundle
      const wasmBuffer = await this.extractWasmFromBundle(bundlePath, tmpDir);
      return wasmBuffer;
    } finally {
      // cleanup temp directory
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Extracts policy.wasm from an OPA bundle tarball.
   */
  private async extractWasmFromBundle(bundlePath: string, tmpDir: string): Promise<Buffer> {
    await tar.extract({
      file: bundlePath,
      cwd: tmpDir,
      filter: (path: string) => path === '/policy.wasm' || path === 'policy.wasm',
    });

    const wasmPath = join(tmpDir, 'policy.wasm');
    return readFile(wasmPath);
  }

  /**
   * Loads a Rego policy file and compiles it to WASM.
   * Caches the compiled policy for reuse.
   */
  async loadPolicy(options: LoadPolicyOptions): Promise<void> {
    const { policyPath, basePath } = options;
    const resolvedPath = resolve(policyPath);

    // check OPA version on first use
    await this.checkOpaVersion();

    // security: validate path is within allowed scope
    this.validatePath(policyPath, basePath);

    // check cache first - use get() to avoid race condition between has() and get()
    const existingCached = this.cache.get(resolvedPath);
    if (existingCached) {
      existingCached.lastAccessed = Date.now();
      return;
    }

    // read the rego file
    let regoContent: string;
    try {
      regoContent = await readFile(resolvedPath, 'utf-8');
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        throw createOpaError('FILE_NOT_FOUND', `Policy file not found: ${policyPath}`, {
          suggestions: ['Check that the file path is correct', 'Ensure the file exists'],
        });
      }
      throw createOpaError('FILE_NOT_FOUND', `Failed to read policy file: ${error.message}`);
    }

    // extract package and rule names for compilation and validation
    const packageNames = this.extractPackageNames(regoContent);
    const ruleNames = this.extractRuleNames(regoContent);

    if (packageNames.length === 0) {
      throw createOpaError('SYNTAX_ERROR', 'No package declaration found in policy file', {
        suggestions: ['Add a package declaration, e.g., "package authz"'],
      });
    }

    // compile to wasm using opa cli
    let wasmBuffer: Buffer;
    try {
      wasmBuffer = await this.compileToWasm(resolvedPath, packageNames, ruleNames);
    } catch (err) {
      const error = err as OpaCliError;

      // check if opa cli is not installed
      if (error.code === 'ENOENT') {
        throw createOpaError(
          'COMPILATION_ERROR',
          'OPA CLI not found. Install OPA to compile policies.',
          {
            suggestions: [
              'Install OPA: brew install opa (macOS) or download from openpolicyagent.org',
            ],
          },
        );
      }

      const stderr = error.stderr || error.message;
      const syntaxInfo = this.parseOpaError(stderr);

      if (
        stderr.includes('parse') ||
        stderr.includes('syntax') ||
        stderr.includes('rego_parse_error')
      ) {
        throw createOpaError('SYNTAX_ERROR', `Policy syntax error: ${stderr}`, {
          ...syntaxInfo,
          suggestions: ['Check the Rego syntax', 'Ensure braces and quotes are properly matched'],
        });
      }

      throw createOpaError('COMPILATION_ERROR', `Failed to compile policy: ${stderr}`, {
        ...syntaxInfo,
        suggestions: ['Check policy for unsupported OPA features in WASM'],
      });
    }

    // load the compiled wasm
    try {
      const policy = await loadOpaPolicy(wasmBuffer);

      // AC-2.1.9: Track memory usage
      // WASM binary size + estimated heap (typically 2-4x binary for simple policies)
      // Also account for initial memory pages allocated by WASM runtime
      const wasmBinarySize = wasmBuffer.length;
      const initialMemoryPages = 16; // typical default, ~1MB
      const estimatedMemoryBytes =
        wasmBinarySize +
        initialMemoryPages * WASM_PAGE_SIZE_BYTES +
        wasmBinarySize * HEAP_ESTIMATE_MULTIPLIER;

      // warn if estimated memory exceeds threshold (AC-2.1.9)
      if (estimatedMemoryBytes > MAX_WASM_MEMORY_BYTES) {
        console.warn(
          `[OpaEvaluator] Policy ${policyPath} estimated memory (${(estimatedMemoryBytes / 1024 / 1024).toFixed(2)}MB) exceeds 50MB threshold`,
        );
      }

      this.cache.set(resolvedPath, {
        policy,
        packageNames,
        ruleNames,
        lastAccessed: Date.now(),
        policyPath: resolvedPath,
        wasmBinarySize,
        estimatedMemoryBytes,
      });
    } catch (err) {
      const error = err as Error;
      throw createOpaError('WASM_ERROR', `Failed to load compiled WASM: ${error.message}`);
    }
  }

  /**
   * Evaluates a loaded policy with the given input data.
   */
  async evaluate(options: EvaluateOptions): Promise<EvaluationResult> {
    const { input, packageName, ruleName = DEFAULT_RULE_NAME } = options;

    // find the cached policy that matches the package name
    const cachedEntry = this.findCachedPolicy(packageName);

    if (!cachedEntry) {
      const availablePackages = this.getAvailablePackages();
      throw createOpaError(
        'INVALID_PACKAGE',
        `Package "${packageName}" not found in loaded policies`,
        {
          suggestions:
            availablePackages.length > 0
              ? [`Available packages: ${availablePackages.join(', ')}`]
              : ['Load a policy first using loadPolicy()'],
        },
      );
    }

    // validate rule name exists
    if (!cachedEntry.ruleNames.includes(ruleName)) {
      throw createOpaError(
        'INVALID_RULE',
        `Rule "${ruleName}" not found in package "${packageName}"`,
        { suggestions: [`Available rules: ${cachedEntry.ruleNames.join(', ')}`] },
      );
    }

    const { policy } = cachedEntry;
    const startTime = performance.now();

    try {
      // set external data (empty for now, can be extended)
      policy.setData({});

      // evaluate the policy with entrypoint
      const entrypoint = packageName ? `${packageName}/${ruleName}` : ruleName;
      const resultSet = policy.evaluate(input, entrypoint);

      const executionTimeMs = performance.now() - startTime;

      // parse result - OPA returns array of result objects
      const result = resultSet?.[0]?.result;
      // allowed is true only if result is explicitly boolean true
      // other truthy values (objects, arrays) are returned as result but don't imply "allowed"
      const allowed = result === true;

      return {
        allowed,
        result,
        packageName: packageName ?? 'default',
        ruleName,
        executionTimeMs,
      };
    } catch (err) {
      const error = err as Error;

      if (error.message.includes('entrypoint')) {
        throw createOpaError(
          'INVALID_RULE',
          `Rule "${ruleName}" not found in package "${packageName}"`,
          { suggestions: [`Available rules: ${cachedEntry.ruleNames.join(', ')}`] },
        );
      }

      throw createOpaError('EVALUATION_ERROR', `Policy evaluation failed: ${error.message}`);
    }
  }

  /**
   * Evaluates a loaded policy with trace capture using OPA CLI.
   * AC-2.2.1-2.2.10: Captures complete evaluation trace for debugging.
   */
  async evaluateWithTrace(
    options: EvaluateOptions,
    traceOptions: TraceOptions = {},
  ): Promise<EvaluationResultWithTrace> {
    const { input, packageName, ruleName = DEFAULT_RULE_NAME } = options;
    const { level = 'full', maxSizeBytes = DEFAULT_MAX_TRACE_SIZE_BYTES } = traceOptions;

    // find the cached policy that matches the package name
    const cachedEntry = this.findCachedPolicy(packageName);

    if (!cachedEntry) {
      const availablePackages = this.getAvailablePackages();
      throw createOpaError(
        'INVALID_PACKAGE',
        `Package "${packageName}" not found in loaded policies`,
        {
          suggestions:
            availablePackages.length > 0
              ? [`Available packages: ${availablePackages.join(', ')}`]
              : ['Load a policy first using loadPolicy()'],
        },
      );
    }

    // validate rule name exists
    if (!cachedEntry.ruleNames.includes(ruleName)) {
      throw createOpaError(
        'INVALID_RULE',
        `Rule "${ruleName}" not found in package "${packageName}"`,
        { suggestions: [`Available rules: ${cachedEntry.ruleNames.join(', ')}`] },
      );
    }

    const startTime = performance.now();
    const entrypoint = packageName ? `data.${packageName}.${ruleName}` : `data.${ruleName}`;

    // create temp dir for input file
    const tmpDir = await mkdtemp(join(tmpdir(), 'opa-trace-'));
    const inputPath = join(tmpDir, 'input.json');

    try {
      // write input to temp file
      await writeFile(inputPath, JSON.stringify(input), 'utf-8');

      // use OPA CLI eval with explain for trace capture
      const args = [
        'eval',
        '--data',
        cachedEntry.policyPath,
        '--input',
        inputPath,
        '--format',
        'json',
        '--explain',
        level === 'full' ? 'full' : 'notes',
        entrypoint,
      ];

      // use large buffer for OPA output - truncation happens after parsing
      const opaMaxBuffer = Math.max(maxSizeBytes * 2, 5 * 1024 * 1024); // at least 5MB
      const { stdout } = await execFileAsync('opa', args, {
        timeout: getConfig().evalTimeoutMs,
        maxBuffer: opaMaxBuffer,
      });

      const executionTimeMs = performance.now() - startTime;
      const evalResult = JSON.parse(stdout);

      // parse trace from OPA output - AC-2.2.7: use source line mappings for accurate line numbers
      // getSourceLineMappings returns empty Map on failure, which is safe - OPA trace line numbers used as fallback
      const sourceLineMappings = await this.getSourceLineMappings(cachedEntry.policyPath);
      const trace = this.parseOpaTrace(evalResult, level, maxSizeBytes, sourceLineMappings);

      // extract result value
      const resultValue = evalResult.result?.[0]?.expressions?.[0]?.value;
      const allowed = resultValue === true;

      return {
        allowed,
        result: resultValue,
        packageName: packageName ?? 'default',
        ruleName,
        executionTimeMs,
        trace: {
          ...trace,
          finalDecision: allowed,
        },
      };
    } catch (err) {
      const error = err as OpaCliError;

      if (error.code === 'ENOENT') {
        throw createOpaError(
          'COMPILATION_ERROR',
          'OPA CLI not found. Install OPA to use trace evaluation.',
          {
            suggestions: [
              'Install OPA: brew install opa (macOS) or download from openpolicyagent.org',
            ],
          },
        );
      }

      throw createOpaError(
        'EVALUATION_ERROR',
        `Policy evaluation with trace failed: ${error.message}`,
      );
    } finally {
      // cleanup temp directory
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Builds and caches source line mappings for a policy file.
   * Maps rule names to their line numbers in the source file.
   * AC-2.2.7: Rule names are mapped to source line numbers.
   */
  private async getSourceLineMappings(policyPath: string): Promise<Map<string, number>> {
    // check cache first
    if (this.sourceLineCache.has(policyPath)) {
      return this.sourceLineCache.get(policyPath)!;
    }

    // build mappings from source file
    const mappings = new Map<string, number>();
    try {
      const content = await readFile(policyPath, 'utf-8');
      const lines = content.split('\n');

      // match rule definitions with line numbers
      const ruleRegex = /^(?:default\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:if\s*\{|\{|:?=|\[)/;

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(ruleRegex);
        if (match) {
          const ruleName = match[1];
          if (
            ![
              'package',
              'import',
              'as',
              'default',
              'else',
              'some',
              'every',
              'in',
              'contains',
              'if',
              'with',
              'not',
            ].includes(ruleName)
          ) {
            mappings.set(ruleName, i + 1); // 1-indexed line numbers
          }
        }
      }
    } catch (err) {
      // log warning but don't fail - source line mappings are optional enhancement
      console.warn(
        `[OpaEvaluator] Failed to read source file for line mappings: ${policyPath}`,
        err,
      );
    }

    // cache for future use
    this.sourceLineCache.set(policyPath, mappings);
    return mappings;
  }

  /**
   * Parses OPA CLI trace output into EvaluationTrace structure.
   * AC-2.2.1-2.2.8: Extracts rules, variables, execution path.
   * AC-2.2.7: Uses source line mappings for accurate rule-to-line mapping.
   * Note: OPA uses capitalized keys (Op, Node, Location, Locals)
   */
  private parseOpaTrace(
    evalResult: Record<string, unknown>,
    level: TraceLevel,
    maxSizeBytes: number,
    sourceLineMappings: Map<string, number>,
  ): Omit<EvaluationTrace, 'finalDecision'> {
    const rulesEvaluated: RuleTrace[] = [];
    const executionPath: ExecutionPathEntry[] = [];
    const variableBindings: Record<string, unknown> = {};

    // parse explanation trace if available
    const explanation = evalResult.explanation as Array<Record<string, unknown>> | undefined;

    if (explanation && Array.isArray(explanation)) {
      const seenRules = new Set<string>();

      for (const event of explanation) {
        // OPA uses capitalized keys
        const op = event.Op as string | undefined;
        const location = event.Location as
          | { file?: string; row?: number; col?: number }
          | undefined;
        const node = event.Node as
          | Record<string, unknown>
          | Array<Record<string, unknown>>
          | undefined;
        const locals = event.Locals as Array<{ key: unknown; value: unknown }> | undefined;

        // extract rule evaluations (AC-2.2.1, AC-2.2.2)
        if ((op === 'Eval' || op === 'Enter') && location?.row) {
          const ruleName = this.extractRuleName(node);
          if (ruleName && !seenRules.has(`${ruleName}:${location.row}`)) {
            seenRules.add(`${ruleName}:${location.row}`);

            // determine result from event context
            const result = this.determineRuleResult(event, explanation);

            // AC-2.2.7: Use source line mappings for accurate line numbers
            // Fallback to OPA trace location if rule not found in source mappings
            const sourceLineNumber = sourceLineMappings.get(ruleName) ?? location.row;

            rulesEvaluated.push({
              name: ruleName,
              line: sourceLineNumber,
              column: location.col,
              result,
            });

            // add to execution path (AC-2.2.5)
            executionPath.push({
              rule: ruleName,
              fired: result === 'true',
              line: sourceLineNumber,
            });
          }
        }

        // extract variable bindings (AC-2.2.3)
        if (locals && Array.isArray(locals)) {
          for (const local of locals) {
            if (local.key && typeof local.key === 'object') {
              const keyObj = local.key as { value?: string };
              if (keyObj.value) {
                variableBindings[keyObj.value] = local.value;
              }
            }
          }
        }
      }
    }

    // calculate trace size
    const traceData = { rulesEvaluated, executionPath, variableBindings };
    const traceJson = JSON.stringify(traceData);
    let sizeBytes = Buffer.byteLength(traceJson, 'utf-8');
    let truncated = false;

    // truncate if over max size (AC-2.2.10)
    if (sizeBytes > maxSizeBytes) {
      truncated = true;
      // keep first half of rules and path entries
      const halfLength = Math.floor(rulesEvaluated.length / 2);
      rulesEvaluated.splice(halfLength);
      executionPath.splice(halfLength);
      sizeBytes = Buffer.byteLength(
        JSON.stringify({ rulesEvaluated, executionPath, variableBindings }),
        'utf-8',
      );
    }

    return {
      rulesEvaluated,
      variableBindings,
      executionPath,
      traceLevel: level,
      truncated,
      sizeBytes,
    };
  }

  /**
   * Extracts rule name from OPA trace node.
   * Handles both single node objects and arrays of nodes.
   */
  private extractRuleName(
    node: Record<string, unknown> | Array<Record<string, unknown>> | undefined,
  ): string | undefined {
    if (!node) return undefined;

    // handle array of nodes (Enter events)
    const nodeObj = Array.isArray(node) ? node[0] : node;
    if (!nodeObj) return undefined;

    // check for expression with terms - extract rule/package names
    const terms = nodeObj.terms as Array<Record<string, unknown>> | undefined;
    if (terms && Array.isArray(terms)) {
      // look for ref terms that contain rule path like data.authz.allow
      for (const term of terms) {
        if (term.type === 'ref') {
          const values = term.value as Array<{ type?: string; value?: string }> | undefined;
          if (values && Array.isArray(values)) {
            // extract the last meaningful name (rule name)
            const stringValues = values
              .filter((v) => v.type === 'string')
              .map((v) => v.value)
              .filter(Boolean);
            if (stringValues.length > 0) {
              return stringValues[stringValues.length - 1];
            }
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Determines rule result from trace event by looking at subsequent events.
   */
  private determineRuleResult(
    event: Record<string, unknown>,
    explanation: Array<Record<string, unknown>>,
  ): 'true' | 'false' | 'undefined' {
    const queryId = event.QueryID as number | undefined;

    // look for Exit or Fail events with same QueryID to determine outcome
    if (queryId !== undefined) {
      for (const e of explanation) {
        if (e.QueryID === queryId) {
          const eOp = e.Op as string | undefined;
          if (eOp === 'Exit') return 'true';
          if (eOp === 'Fail') return 'false';
        }
      }
    }

    // no definitive result found - evaluation outcome unknown
    return 'undefined';
  }

  /**
   * Finds a cached policy that contains the given package name.
   */
  private findCachedPolicy(packageName?: string): CachedPolicy | undefined {
    // handle empty cache
    if (this.cache.size === 0) {
      return undefined;
    }

    if (!packageName) {
      // return first cached policy if no package specified
      const firstEntry = this.cache.values().next();
      return firstEntry.done ? undefined : firstEntry.value;
    }

    for (const cached of this.cache.values()) {
      if (cached.packageNames.includes(packageName)) {
        cached.lastAccessed = Date.now();
        return cached;
      }
    }

    return undefined;
  }

  /**
   * Returns all available package names from loaded policies.
   */
  private getAvailablePackages(): string[] {
    const packages: string[] = [];
    for (const cached of this.cache.values()) {
      packages.push(...cached.packageNames);
    }
    return packages;
  }

  /**
   * Returns the number of cached policies.
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Returns total estimated memory usage of all cached WASM instances in bytes.
   * AC-2.1.9: Memory footprint tracking for < 50MB per instance validation.
   */
  getTotalMemoryUsage(): number {
    let total = 0;
    for (const cached of this.cache.values()) {
      total += cached.estimatedMemoryBytes;
    }
    return total;
  }

  /**
   * Clears all cached WASM instances and source line mappings.
   */
  clearCache(): void {
    this.cache.clear();
    this.sourceLineCache.clear();
  }

  /**
   * Disposes all WASM instances and clears cache.
   */
  dispose(): void {
    this.clearCache();
  }
}

export const OpaEvaluator = OpaEvaluatorSingleton.getInstance();
export type { OpaEvaluatorSingleton };
