/**
 * Évaluateur arithmétique déterministe (pas d'eval : interdit dans le runtime serveur).
 * Supporte + - * / % ( ) et les puissances via ^.
 */
type Token = string | number;

function tokenize(expression: string): Token[] {
  const cleaned = expression.replace(/\s+/g, "").replace(/,/g, ".");
  if (!/^[0-9.+\-*/%^()]+$/.test(cleaned)) throw new Error("Expression non calculable");
  const tokens: Token[] = [];
  let index = 0;
  while (index < cleaned.length) {
    const char = cleaned[index]!;
    if (/[0-9.]/.test(char)) {
      let number = "";
      while (index < cleaned.length && /[0-9.]/.test(cleaned[index]!)) number += cleaned[index++]!;
      const value = Number(number);
      if (!Number.isFinite(value)) throw new Error("Nombre invalide");
      tokens.push(value);
      continue;
    }
    tokens.push(char);
    index += 1;
  }
  return tokens;
}

const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };

function apply(operator: string, left: number, right: number): number {
  switch (operator) {
    case "+": return left + right;
    case "-": return left - right;
    case "*": return left * right;
    case "/": return right === 0 ? NaN : left / right;
    case "%": return right === 0 ? NaN : left % right;
    case "^": return left ** right;
    default: throw new Error("Opérateur inconnu");
  }
}

export function evaluateExpression(expression: string): number {
  const tokens = tokenize(expression);
  const values: number[] = [];
  const operators: string[] = [];

  const reduce = () => {
    const operator = operators.pop();
    const right = values.pop();
    const left = values.pop();
    if (operator === undefined || right === undefined || left === undefined) throw new Error("Expression incomplète");
    values.push(apply(operator, left, right));
  };

  let previous: Token | null = null;
  for (const token of tokens) {
    if (typeof token === "number") {
      values.push(token);
    } else if (token === "(") {
      operators.push(token);
    } else if (token === ")") {
      while (operators.length && operators[operators.length - 1] !== "(") reduce();
      if (operators.pop() !== "(") throw new Error("Parenthèses déséquilibrées");
    } else {
      // Gestion du signe unaire
      if ((token === "-" || token === "+") && (previous === null || previous === "(" || (typeof previous === "string" && previous in PRECEDENCE))) {
        values.push(0);
      }
      while (operators.length && operators[operators.length - 1] !== "(" && PRECEDENCE[operators[operators.length - 1]!]! >= PRECEDENCE[token]!) reduce();
      operators.push(token);
    }
    previous = token;
  }
  while (operators.length) reduce();
  const result = values.pop();
  if (result === undefined || values.length > 0 || !Number.isFinite(result)) throw new Error("Calcul impossible");
  return result;
}
