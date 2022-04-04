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
	exec: (arg: string, utils: JsDocUtilsMethod) => jsDocAnnotationResult
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
}

export interface JsDocUtilsMethod extends JsDocUtils {
	/** Current class element type or method return type */
	getType: (path?: string) => Node | undefined
	/** when method: Param type */
	getInput: (path?: string) => Node | undefined
	/** Parent node type */
	getParent: (path?: string) => Node | undefined
}

/** Annotation signature */
export type DecoratorSignature = (
	target: any,
	propertyKey?: string,
	descriptor?: PropertyDescriptor
) => any;

/** Create decorator */
export function createDecorator<T extends ((...args: any[]) => any) | void = void>(cb: JsDocAnnotationMethod):
	T extends ((...args: any[]) => any) ? ((...args: Parameters<T>) => DecoratorSignature) : DecoratorSignature {
	throw new ModelError(ModelErrorCode.NOT_COMPILED, 'Please compile code');
}

/**
 * pre-validate entity annotation
 */
export function beforeValidate(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) { throw new ModelError(ModelErrorCode.NOT_COMPILED, 'Please compile code'); }
/**
 * Post-validate entity annotation
 */
export function afterValidate(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) { throw new ModelError(ModelErrorCode.NOT_COMPILED, 'Please compile code'); }
/**
 * pre-resolve entity annotation
 */
export function beforeResolve(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) { throw new ModelError(ModelErrorCode.NOT_COMPILED, 'Please compile code'); }
/**
 * pre-resolve entity annotation
 */
export function afterResolve(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) { throw new ModelError(ModelErrorCode.NOT_COMPILED, 'Please compile code'); }