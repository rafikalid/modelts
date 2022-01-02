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
	annotationArgs: string[];

	constructor(program: ts.Program, node: MacroAnnotationNode, annotationArgs: string[]) {
		this.ts = ts;
		this.node = node;
		this.program = program;
		this.annotationArgs = annotationArgs;
		this.factory = ts.factory;
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


	/** List method args */
	listMethodArgs(node: ts.MethodDeclaration): string[] {
		const result: string[] = [];
		const printer = this.printer;
		for (let i = 0, args = node.parameters, len = args.length; i < len; ++i) {
			let arg = args[i];
			result.push(printer.printNode(ts.EmitHint.Unspecified, arg, arg.getSourceFile()))
		}
		return result;
	}

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

	/** Update method body */
	setMethodBody(node: ts.MethodDeclaration, body: ts.Statement[]) {
		const factory = this.factory;
		return factory.updateMethodDeclaration(
			node, node.decorators, node.modifiers, node.asteriskToken, node.name, node.questionToken,
			node.typeParameters, node.parameters, node.type, factory.createBlock(body));
	}
}
