type TokenType = "number" | "operator" | "paren" | "name" | "comma";

type Token = {
  type: TokenType;
  value: string;
};

const OPERATORS: Record<string, { precedence: number; rightAssoc: boolean }> = {
  "+": { precedence: 1, rightAssoc: false },
  "-": { precedence: 1, rightAssoc: false },
  "*": { precedence: 2, rightAssoc: false },
  "/": { precedence: 2, rightAssoc: false },
  "%": { precedence: 2, rightAssoc: false },
  "^": { precedence: 3, rightAssoc: true },
};

const FUNCTIONS: Record<string, (value: number) => number> = {
  sqrt: (v) => Math.sqrt(v),
  abs: (v) => Math.abs(v),
  sin: (v) => Math.sin(v),
  cos: (v) => Math.cos(v),
  tan: (v) => Math.tan(v),
  ln: (v) => Math.log(v),
  log: (v) => Math.log10(v),
  floor: (v) => Math.floor(v),
  ceil: (v) => Math.ceil(v),
  round: (v) => Math.round(v),
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const c = input[i];

    if (/\s/.test(c)) {
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(c)) {
      const start = i;
      let dotCount = 0;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        if (input[i] === ".") dotCount += 1;
        i += 1;
      }
      const raw = input.slice(start, i);
      if (dotCount > 1 || raw === ".") {
        throw new Error("Invalid number");
      }
      tokens.push({ type: "number", value: raw });
      continue;
    }

    if (/[a-zA-Z]/.test(c)) {
      const start = i;
      while (i < input.length && /[a-zA-Z]/.test(input[i])) {
        i += 1;
      }
      tokens.push({ type: "name", value: input.slice(start, i).toLowerCase() });
      continue;
    }

    if (c === "(" || c === ")") {
      tokens.push({ type: "paren", value: c });
      i += 1;
      continue;
    }

    if (c === "{" || c === "}") {
      tokens.push({ type: "paren", value: c === "{" ? "(" : ")" });
      i += 1;
      continue;
    }

    if (c === ",") {
      tokens.push({ type: "comma", value: c });
      i += 1;
      continue;
    }

    if (OPERATORS[c]) {
      tokens.push({ type: "operator", value: c });
      i += 1;
      continue;
    }

    throw new Error("Unexpected token");
  }

  return tokens;
}

function normalizeUnary(tokens: Token[]): Token[] {
  const normalized: Token[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const prev = normalized[normalized.length - 1];

    if (
      token.type === "operator" &&
      token.value === "-" &&
      (!prev ||
        (prev.type === "operator" && prev.value !== ")") ||
        (prev.type === "paren" && prev.value === "(") ||
        prev.type === "comma")
    ) {
      normalized.push({ type: "number", value: "0" });
      normalized.push(token);
      continue;
    }

    normalized.push(token);
  }

  return normalized;
}

function preprocessExpression(input: string): string {
  return input
    .replace(/[\u2212]/g, "-")
    .replace(/[\u00D7]/g, "*")
    .replace(/[\u00F7]/g, "/")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .trim();
}

function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const stack: Token[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.type === "number") {
      output.push(token);
      continue;
    }

    if (token.type === "name") {
      const next = tokens[i + 1];
      if (next && next.type === "paren" && next.value === "(") {
        stack.push(token);
      } else if (Object.prototype.hasOwnProperty.call(CONSTANTS, token.value)) {
        output.push({ type: "number", value: String(CONSTANTS[token.value]) });
      } else {
        throw new Error("Unknown identifier");
      }
      continue;
    }

    if (token.type === "comma") {
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.type === "paren" && top.value === "(") break;
        output.push(stack.pop()!);
      }
      if (stack.length === 0) {
        throw new Error("Invalid function arguments");
      }
      continue;
    }

    if (token.type === "operator") {
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.type !== "operator") break;

        const currOp = OPERATORS[token.value];
        const topOp = OPERATORS[top.value];
        const shouldPop = currOp.rightAssoc
          ? currOp.precedence < topOp.precedence
          : currOp.precedence <= topOp.precedence;

        if (!shouldPop) break;
        output.push(stack.pop()!);
      }
      stack.push(token);
      continue;
    }

    if (token.type === "paren" && token.value === "(") {
      stack.push(token);
      continue;
    }

    if (token.type === "paren" && token.value === ")") {
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.type === "paren" && top.value === "(") break;
        output.push(stack.pop()!);
      }

      if (stack.length === 0) {
        throw new Error("Mismatched parentheses");
      }

      stack.pop();

      const maybeFn = stack[stack.length - 1];
      if (maybeFn && maybeFn.type === "name") {
        output.push(stack.pop()!);
      }
    }
  }

  while (stack.length > 0) {
    const token = stack.pop()!;
    if (token.type === "paren") {
      throw new Error("Mismatched parentheses");
    }
    output.push(token);
  }

  return output;
}

function evalRpn(tokens: Token[]): number {
  const stack: number[] = [];

  for (const token of tokens) {
    if (token.type === "number") {
      stack.push(Number(token.value));
      continue;
    }

    if (token.type === "operator") {
      if (stack.length < 2) {
        throw new Error("Invalid expression");
      }
      const b = stack.pop()!;
      const a = stack.pop()!;

      if (token.value === "+") stack.push(a + b);
      else if (token.value === "-") stack.push(a - b);
      else if (token.value === "*") stack.push(a * b);
      else if (token.value === "/") {
        if (b === 0) throw new Error("Division by zero");
        stack.push(a / b);
      } else if (token.value === "%") {
        if (b === 0) throw new Error("Division by zero");
        stack.push(a % b);
      } else if (token.value === "^") stack.push(Math.pow(a, b));
      continue;
    }

    if (token.type === "name") {
      const fn = FUNCTIONS[token.value];
      if (!fn || stack.length < 1) {
        throw new Error("Unknown function");
      }
      const v = stack.pop()!;
      stack.push(fn(v));
    }
  }

  if (stack.length !== 1) {
    throw new Error("Invalid expression");
  }

  return stack[0];
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 1e12) / 1e12;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toString();
}

export function evaluateMathExpression(input: string): { ok: true; result: string } | { ok: false } {
  try {
    const trimmed = preprocessExpression(input);
    if (!trimmed) return { ok: false };

    const rawTokens = tokenize(trimmed);
    if (rawTokens.length === 0) return { ok: false };

    const hasOperator = rawTokens.some((t) => t.type === "operator");
    const hasFunctionCall = rawTokens.some(
      (t, i) =>
        t.type === "name" &&
        Boolean(FUNCTIONS[t.value]) &&
        rawTokens[i + 1]?.type === "paren" &&
        rawTokens[i + 1]?.value === "(",
    );
    if (!hasOperator && !hasFunctionCall) return { ok: false };

    const normalized = normalizeUnary(rawTokens);
    const rpn = toRpn(normalized);
    const value = evalRpn(rpn);
    const result = formatNumber(value);

    if (!result) return { ok: false };
    return { ok: true, result };
  } catch {
    return { ok: false };
  }
}