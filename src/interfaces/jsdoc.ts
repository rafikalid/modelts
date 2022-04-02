import type ts from "typescript";
import { Node } from "..";
import { ModelErrorCode, ModelError } from "./error";

/** Annotation method */
export type JsDocAnnotationMethod =
	(utils: JsDocUtils) => JsDocAnnotationMethodResult

export interface JsDocAnnotationMethodResult {
	/** Init root statement, added only once */
	root?: string | ts.Statement | ts.Statement[]
	/** Specific statements for each argument */
	exec: (arg: string, utils?: JsDocUtils) => jsDocAnnotationResult
}

/** Jsdoc format */
export interface JsDocInterface {
	[k: string]: JsDocAnnotationMethod
}

/** JsDoc annotation result */
export interface jsDocAnnotationResult {
	/** Additional imports or any root statement */
	root?: string | ts.Statement | ts.Statement[],
	/** Insert code before execution */
	before?: string | ts.Statement | ts.Statement[]
	/** Insert code after execution */
	after?: string | ts.Statement | ts.Statement[]
}

/** JsDoc annotations */
export class JsDocAnnotations implements JsDocInterface {
	[P: string]: JsDocAnnotationMethod;

	/** Parse assertions */
	assert(utils: JsDocUtils) {
		return {
			exec(arg: string) {
				return {};
			}
		};
	}

	/** Pase default value */
	default(utils: JsDocUtils): JsDocAnnotationMethodResult {
		return {
			exec(arg: string) {
				return {};
			}
		};
	}
}

/** utils */
export interface JsDocUtils {
	/** Create unique identifier */
	uniqueName: (name: string) => ts.Identifier
	/** Concat code with identifiers */
	code: (str: TemplateStringsArray, ...args: any[]) => ts.Statement
	/** Current class element type or method return type */
	type: Node
	/** when method: Param type */
	param: Node | undefined
	/** Parent node type */
	parent: Node | undefined
	/** Check if a path exists inside types */
	pathExists: (type: Node, path: string) => boolean
}

/** Create decorator */
export function createDecorator<T extends (...args: any[]) => any>(cb: JsDocAnnotationMethod):
	(...args: Parameters<T>) => (
		target: any,
		propertyKey?: string,
		descriptor?: PropertyDescriptor
	) => any {
	throw new ModelError(ModelErrorCode.NOT_COMPILED, 'Please compile code');
}