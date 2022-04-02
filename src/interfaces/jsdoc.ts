import type ts from "typescript";
import { ModelErrorCode, ModelError } from "./error";

/** Annotation method */
export type JsDocAnnotationMethod = (arg: string, utils: JsDocUtils) => jsDocAnnotationResult;

/** Jsdoc format */
export interface JsDocInterface {
	[k: string]: JsDocAnnotationMethod
}

/** JsDoc annotation result */
export interface jsDocAnnotationResult {
	/** Additional imports */
	imports?: {
		name?: string | ts.Identifier
		namedImports?: (string | ts.Identifier | ts.ImportSpecifier)[]
		lib: string
	}[],
	/** Insert code before execution */
	before?: string | ts.Statement | ts.Statement[]
	/** Insert code after execution */
	after?: string | ts.Statement | ts.Statement[]
}

/** JsDoc annotations */
export class JsDocAnnotations implements JsDocInterface {
	[k: string]: JsDocAnnotationMethod;

	/** Parse assertions */
	assert(arg: string) {
		return {};
	}

	/** Pase default value */
	default(arg: string) {
		return {};
	}
}

/** utils */
export interface JsDocUtils {
	/** Create unique identifier */
	uniqueName: (name: string) => ts.Identifier
	/** Create named import */
	namedImport: (propertyName: string | ts.Identifier, name: string | ts.Identifier) => ts.ImportSpecifier
	/** Concat code with identifiers */
	code: (str: TemplateStringsArray, ...args: any[]) => ts.Statement
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