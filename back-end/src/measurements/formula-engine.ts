/** A deliberately small expression language for database-backed measurements. */
type Token = {
	type: 'number' | 'identifier' | 'operator' | 'punctuation' | 'eof';
	value: string;
};
type Expression =
	| { kind: 'number'; value: number }
	| { kind: 'identifier'; name: string }
	| { kind: 'member'; object: Expression; property: string }
	| { kind: 'unary'; operator: string; operand: Expression }
	| { kind: 'binary'; operator: string; left: Expression; right: Expression };
type Statement =
	| { target: Expression; value: Expression }
	| { expression: Expression };

const operators = [
	'===',
	'!==',
	'>=',
	'<=',
	'==',
	'!=',
	'+',
	'-',
	'*',
	'/',
	'%',
	'>',
	'<',
	'=',
];
const precedence: Record<string, number> = {
	'==': 1,
	'!=': 1,
	'===': 1,
	'!==': 1,
	'>': 2,
	'<': 2,
	'>=': 2,
	'<=': 2,
	'+': 3,
	'-': 3,
	'*': 4,
	'/': 4,
	'%': 4,
};

function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let index = 0;
	while (index < source.length) {
		const rest = source.slice(index);
		if (/^\s/.test(rest)) {
			index++;
			continue;
		}
		const number = rest.match(/^(?:\d+\.?\d*|\.\d+)/);
		if (number) {
			tokens.push({ type: 'number', value: number[0] });
			index += number[0].length;
			continue;
		}
		const identifier = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
		if (identifier) {
			tokens.push({ type: 'identifier', value: identifier[0] });
			index += identifier[0].length;
			continue;
		}
		const operator = operators.find((item) => rest.startsWith(item));
		if (operator) {
			tokens.push({ type: 'operator', value: operator });
			index += operator.length;
			continue;
		}
		if ('().;'.includes(rest[0])) {
			tokens.push({ type: 'punctuation', value: rest[0] });
			index++;
			continue;
		}
		throw new Error(`Token não permitido na fórmula: ${rest[0]}`);
	}
	tokens.push({ type: 'eof', value: '' });
	return tokens;
}

class Parser {
	private index = 0;
	constructor(private readonly tokens: Token[]) {}
	private current() {
		return this.tokens[this.index];
	}
	private take(value?: string) {
		const token = this.current();
		if (value && token.value !== value)
			throw new Error(`Esperado '${value}' na fórmula.`);
		this.index++;
		return token;
	}
	parseProgram(): Statement[] {
		const result: Statement[] = [];
		while (this.current().type !== 'eof') {
			const expression = this.parseExpression();
			if (this.current().value === '=') {
				if (
					expression.kind !== 'member' ||
					expression.object.kind !== 'identifier' ||
					expression.object.name !== 'curr'
				)
					throw new Error('Atribuições só são permitidas em propriedades de curr.');
				this.take('=');
				result.push({ target: expression, value: this.parseExpression() });
			} else result.push({ expression });
			if (this.current().value === ';') this.take(';');
			else if (this.current().type !== 'eof')
				throw new Error('Separe instruções com ponto e vírgula.');
		}
		return result;
	}
	private parseExpression(min = 0): Expression {
		let left = this.parseUnary();
		while (
			this.current().type === 'operator' &&
			this.current().value !== '=' &&
			(precedence[this.current().value] ?? -1) >= min
		) {
			const operator = this.take().value;
			const right = this.parseExpression((precedence[operator] ?? 0) + 1);
			left = { kind: 'binary', operator, left, right };
		}
		return left;
	}
	private parseUnary(): Expression {
		if (['+', '-'].includes(this.current().value))
			return {
				kind: 'unary',
				operator: this.take().value,
				operand: this.parseUnary(),
			};
		let expression: Expression;
		const token = this.current();
		if (token.type === 'number') {
			this.take();
			expression = { kind: 'number', value: Number(token.value) };
		} else if (token.type === 'identifier') {
			this.take();
			expression = { kind: 'identifier', name: token.value };
		} else if (token.value === '(') {
			this.take('(');
			expression = this.parseExpression();
			this.take(')');
		} else throw new Error('Expressão inválida na fórmula.');
		while (this.current().value === '.') {
			this.take('.');
			const property = this.take();
			if (property.type !== 'identifier') throw new Error('Propriedade inválida.');
			expression = {
				kind: 'member',
				object: expression,
				property: property.value,
			};
		}
		return expression;
	}
}

export type FormulaContext = Record<
	string,
	number | boolean | null | undefined
>;
export type ZeroState = Record<string, number>;
export function createZeroState(): ZeroState {
	return new Proxy(Object.create(null), {
		get: (target, key) =>
			typeof key === 'string' ? (target[key] ?? 0) : undefined,
	}) as ZeroState;
}
function finite(value: unknown): number {
	const result = Number(value);
	if (!Number.isFinite(result))
		throw new Error('A fórmula produziu um valor não numérico.');
	return result;
}
function evaluate(
	expression: Expression,
	curr: ZeroState,
	context: FormulaContext,
): number {
	if (expression.kind === 'number') return expression.value;
	if (expression.kind === 'identifier') {
		if (expression.name === 'curr')
			throw new Error('curr deve acessar uma propriedade.');
		if (!(expression.name in context))
			throw new Error(`Campo não autorizado: ${expression.name}`);
		return finite(context[expression.name]);
	}
	if (expression.kind === 'member') {
		if (
			expression.object.kind !== 'identifier' ||
			expression.object.name !== 'curr' ||
			['__proto__', 'prototype', 'constructor'].includes(expression.property)
		)
			throw new Error('Acesso a propriedade não autorizado.');
		return finite(curr[expression.property]);
	}
	if (expression.kind === 'unary')
		return expression.operator === '-'
			? -evaluate(expression.operand, curr, context)
			: evaluate(expression.operand, curr, context);
	const left = evaluate(expression.left, curr, context);
	const right = evaluate(expression.right, curr, context);
	switch (expression.operator) {
		case '+':
			return left + right;
		case '-':
			return left - right;
		case '*':
			return left * right;
		case '/':
			return right === 0 ? 0 : left / right;
		case '%':
			return right === 0 ? 0 : left % right;
		case '>':
			return Number(left > right);
		case '<':
			return Number(left < right);
		case '>=':
			return Number(left >= right);
		case '<=':
			return Number(left <= right);
		case '==':
		case '===':
			return Number(left === right);
		case '!=':
		case '!==':
			return Number(left !== right);
		default:
			throw new Error('Operador não autorizado.');
	}
}
export function parseFormula(formula: string): Statement[] {
	if (!formula.trim()) throw new Error('A fórmula não pode estar vazia.');
	return new Parser(tokenize(formula)).parseProgram();
}
export function formulaFields(formula: string): string[] {
	const fields = new Set<string>();
	const walk = (node: Expression): void => {
		if (node.kind === 'identifier' && node.name !== 'curr') fields.add(node.name);
		else if (node.kind === 'member') walk(node.object);
		else if (node.kind === 'unary') walk(node.operand);
		else if (node.kind === 'binary') {
			walk(node.left);
			walk(node.right);
		}
	};
	for (const statement of parseFormula(formula))
		walk('value' in statement ? statement.value : statement.expression);
	return [...fields];
}
export function validateFormula(
	formula: string,
	allowedFields: Iterable<string>,
	allowAssignments: boolean,
): void {
	const program = parseFormula(formula);
	const allowed = new Set(allowedFields);
	const walk = (node: Expression) => {
		if (
			node.kind === 'identifier' &&
			node.name !== 'curr' &&
			!allowed.has(node.name)
		)
			throw new Error(`Campo não permitido: ${node.name}`);
		if (node.kind === 'member') {
			if (
				node.object.kind !== 'identifier' ||
				node.object.name !== 'curr' ||
				['__proto__', 'prototype', 'constructor'].includes(node.property)
			)
				throw new Error('Acesso a propriedade não autorizado.');
			walk(node.object);
		}
		if (node.kind === 'unary') walk(node.operand);
		if (node.kind === 'binary') {
			walk(node.left);
			walk(node.right);
		}
	};
	for (const statement of program) {
		if ('target' in statement && !allowAssignments)
			throw new Error('valueFormula não pode fazer atribuições.');
		if ('target' in statement) walk(statement.target);
		walk('value' in statement ? statement.value : statement.expression);
	}
}
export function executeFormula(
	formula: string,
	curr: ZeroState,
	context: FormulaContext,
): void {
	for (const statement of parseFormula(formula)) {
		if (!('target' in statement)) {
			evaluate(statement.expression, curr, context);
			continue;
		}
		if (statement.target.kind !== 'member')
			throw new Error('Destino de atribuição inválido.');
		curr[statement.target.property] = finite(
			evaluate(statement.value, curr, context),
		);
	}
}
export function evaluateValueFormula(formula: string, curr: ZeroState): number {
	const program = parseFormula(formula);
	if (program.length !== 1 || 'target' in program[0])
		throw new Error('valueFormula deve conter uma única expressão.');
	return finite(evaluate(program[0].expression, curr, {}));
}
