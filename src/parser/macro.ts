import ts from "typescript";

/** Extract parameters */
type MacroParams<T extends (...args: any) => any> = T extends (
	node: MacroAnnotationNode,
	utils: MacroUtils,
	...args: infer P
) => any ? P : never;

/** Create property annotation macro */
export function AnnotationMacro<T extends MacroAnnotationHandler>(cb: T):
	(...args: MacroParams<T>) => (
		target: any,
		propertyKey?: string,
		descriptor?: PropertyDescriptor
	) => any {
	//* Add annotation handler

	//* Annotation interface 
	return function (...args: MacroParams<T>) {
		throw new Error('Wrong use of Macro Annotation. Did you forget to compile your code using "tt-model-compiler" ?');
	}
}

/** Macro handler */
export type MacroAnnotationHandler = (node: MacroAnnotationNode, utils: MacroUtils, ...args: any) => MacroAnnotationNode;

export type MacroAnnotationNode = ts.ClassDeclaration | ts.MethodDeclaration | ts.PropertyDeclaration;

/** Property info */
export class MacroUtils {
	/** Node */
	node: MacroAnnotationNode;
	/** Program */
	program: ts.Program;
	/** Factory */
	factory: ts.NodeFactory;
	/** Typescript */
	ts: typeof ts;
	/** Printer */
	printer: ts.Printer;
	/** Annotation arguments as string */
	args: string[];
	argv: any[];

	constructor(program: ts.Program, node: MacroAnnotationNode, args: string[], argv: any[]) {
		this.ts = ts;
		this.node = node;
		this.program = program;
		this.factory = ts.factory;
		this.args = args;
		this.argv = argv;
		this.printer = ts.createPrinter({
			omitTrailingSemicolon: false,
			removeComments: true
		});
	}

	/** is Method */
	isMethod(node: ts.Node): node is ts.MethodDeclaration { return ts.isMethodDeclaration(node) }
	/** Is property */
	isProperty(node: ts.Node): node is ts.PropertyDeclaration { return ts.isPropertyDeclaration(node) }
	/** is class */
	isClass(node: ts.Node): node is ts.ClassLikeDeclaration { return ts.isClassLike(node); }


	// /** List method args */
	// listMethodArgs(node: ts.MethodDeclaration): string[] {
	// 	const result: string[] = [];
	// 	const printer = this.printer;
	// 	for (let i = 0, args = node.parameters, len = args.length; i < len; ++i) {
	// 		let arg = args[i];
	// 		result.push(printer.printNode(ts.EmitHint.Unspecified, arg, arg.getSourceFile()))
	// 	}
	// 	return result;
	// }

	/** Has static modifier */
	isStatic(node: ts.Node) {
		return node.modifiers == null ? false : node.modifiers.some(t => t.kind === ts.SyntaxKind.StaticKeyword);
	}

	/** Get property or class name */
	getName(node: ts.ClassLikeDeclaration | ts.PropertyLikeDeclaration | ts.MethodDeclaration | ts.MethodSignature) {
		return node.name == null ? undefined : this.print(node.name);
	}

	/** Print node */
	print(node: ts.Node) { return this.printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile()); }

	//* Factory
	/** Create unique name */
	uniqueName(text: string) { return this.factory.createUniqueName(text); }

	// /** Update method body */
	// setMethodBody(node: ts.MethodDeclaration, body: ts.Statement[]) {
	// 	const factory = this.factory;
	// 	return factory.updateMethodDeclaration(
	// 		node, node.decorators, node.modifiers, node.asteriskToken, node.name, node.questionToken,
	// 		node.typeParameters, node.parameters, node.type, factory.createBlock(body));
	// }

	/** Update method body */
	updateMethodBody(
		node: ts.MethodDeclaration,
		cb?: ((args: any, body: ts.Statement[]) => ts.Statement[]),
		prepend?: ((args: any, body: ts.Statement[]) => ts.Statement[])
	): ts.MethodDeclaration {
		const factory = this.factory;
		var body: ts.Statement[] = [];
		// Normalize args
		let params = node.parameters;
		let targetParams: ts.ParameterDeclaration[] = [];
		let paramVars: ts.Identifier[] = [];
		for (let i = 0, len = params.length; i < len; ++i) {
			let param = params[i];
			if (
				(param.name.kind === ts.SyntaxKind.ObjectBindingPattern) ||
				(param.name.kind === ts.SyntaxKind.ArrayBindingPattern)
			) {
				let objPattern = param.name;
				let pArg = factory.createUniqueName('param');
				param = factory.updateParameterDeclaration(
					param, param.decorators, param.modifiers, param.dotDotDotToken,
					pArg, param.questionToken, param.type, param.initializer);
				body.push(
					factory.createVariableStatement(undefined,
						factory.createVariableDeclarationList(
							[factory.createVariableDeclaration(objPattern, undefined, undefined, pArg)],
							ts.NodeFlags.Const
						)
					)
				);
				paramVars.push(pArg);
			} else {
				paramVars.push(param.name);
			}
			targetParams.push(param);
		}
		// Body
		if (prepend != null) body = prepend(paramVars, body);
		if (node.body?.statements != null) body.push(...node.body?.statements);
		// Exec callback
		if (cb != null) body = cb(paramVars, body);
		// Update node
		node = factory.updateMethodDeclaration(
			node, node.decorators, node.modifiers, node.asteriskToken, node.name,
			node.questionToken, node.typeParameters, targetParams, node.type, factory.createBlock(body));
		return node;
	}

	/** Create if statement */
	if(check: string | ts.Expression, thenStatement: string | ts.Statement, elseStatement?: string | ts.Statement): ts.IfStatement {
		const factory = this.factory;
		// fix check
		if (typeof check === 'string') check = factory.createIdentifier(check);
		if (typeof thenStatement === 'string') thenStatement = factory.createExpressionStatement(factory.createIdentifier(thenStatement));
		if (typeof elseStatement === 'string') elseStatement = factory.createExpressionStatement(factory.createIdentifier(elseStatement));
		// return
		return factory.createIfStatement(check, thenStatement, elseStatement);
	}

	/** objAccess */
	objAccess(expr: string | ts.Expression, ...args: string[]) {
		const factory = this.factory;
		if (typeof expr === 'string') expr = factory.createIdentifier(expr);
		for (let i = 0, len = args.length; i < len; ++i) {
			expr = factory.createPropertyAccessExpression(expr, args[i]);
		}
		return expr;
	}
	/** Binary expression */
	binaryExpression(leftExpr: string | ts.Expression, operator: BinaryExpressionOperator, rightExpr: string | ts.Expression | boolean) {
		const factory = this.factory;
		if (typeof leftExpr === 'string') leftExpr = factory.createIdentifier(leftExpr);
		if (typeof rightExpr === 'string') rightExpr = factory.createIdentifier(rightExpr);
		else if (typeof rightExpr === 'boolean') rightExpr = rightExpr === true ? factory.createTrue() : factory.createFalse();
		let token: ts.BinaryOperator | ts.BinaryOperatorToken;
		switch (operator) {
			case '=': token = factory.createToken(ts.SyntaxKind.EqualsToken); break;
			case '==': token = factory.createToken(ts.SyntaxKind.EqualsEqualsToken); break;
			case '===': token = factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken); break;
			case '&': token = factory.createToken(ts.SyntaxKind.AmpersandToken); break;
			case '|': token = factory.createToken(ts.SyntaxKind.BarToken); break;
			case '!=': token = factory.createToken(ts.SyntaxKind.ExclamationEqualsToken); break;
			case '!==': token = factory.createToken(ts.SyntaxKind.ExclamationEqualsEqualsToken); break;
			default: {
				let t: never = operator;
				throw new Error(`Unexpected operator: ${operator}`);
			}
		}
		return factory.createBinaryExpression(leftExpr, token, rightExpr);
	}
	/** Create and affect value to a var */
	createVar(varname: ts.Identifier, expr: ts.Expression | string) {
		const factory = this.factory;
		if (typeof expr === 'string') expr = factory.createIdentifier(expr);
		return factory.createVariableStatement(undefined,
			factory.createVariableDeclarationList(
				[factory.createVariableDeclaration(
					varname, undefined,
					factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
					expr
				)],
				ts.NodeFlags.None
			)
		)
	}
}


export type BinaryExpressionOperator = '=' | '==' | '===' | '&' | '|' | '!==' | '!=';