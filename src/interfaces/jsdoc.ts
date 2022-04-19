import type ts from "typescript";
import { ModelErrorCode, ModelError } from "./error";

/** Annotation method */
export type JsDocAnnotationMethod =
	(utils: JsDocUtils, AnnotationName: string) => JsDocAnnotationMethodResult

export interface JsDocAnnotationMethodResult {
	/** Init root statement, added only once */
	root?: string | ts.Statement | ts.Statement[]
	/** Specific statements for each argument */
	exec: (arg: string, utils: JsDocUtilsMethod) => jsDocAnnotationResult
}

/** Jsdoc format */
export type JsDocInterface<T> = {
	[k in keyof T]: JsDocAnnotationMethod
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
export class JsDocAnnotations implements JsDocInterface<JsDocAnnotations> {
	// /** Parse assertions */
	// assert(utils: JsDocUtils) {
	// 	return {
	// 		exec(arg: string) {
	// 			return {};
	// 		}
	// 	};
	// }

	// /** Parse default input value */
	// default(utils: JsDocUtils): JsDocAnnotationMethodResult {
	// 	return {
	// 		exec(arg: string) {
	// 			return {};
	// 		}
	// 	};
	// }
	// /** Parse default output value */
	// defaultOutput(utils: JsDocUtils): JsDocAnnotationMethodResult {
	// 	return {
	// 		exec(arg: string) {
	// 			return {};
	// 		}
	// 	};
	// }
	// /** Clear all fields default value */
	// clearDefault(utils: JsDocUtils): JsDocAnnotationMethodResult {
	// 	return {
	// 		exec(arg: string) {
	// 			return {};
	// 		}
	// 	};
	// }

	// /** Mark an attribute as optional when input */
	// optionalInput(utils: JsDocUtils): JsDocAnnotationMethodResult {
	// 	return {
	// 		exec(arg: string) {
	// 			return {};
	// 		}
	// 	};
	// }

	// /** Mark an attribute as optional when output */
	// optionalOutput(utils: JsDocUtils): JsDocAnnotationMethodResult {
	// 	return {
	// 		exec(arg: string) {
	// 			return {};
	// 		}
	// 	};
	// }
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
	getType: (path?: string) => NodeInfo | undefined
	/** when method: Param type */
	getInput: (path?: string) => NodeInfo | undefined
	/** Parent node type */
	getParent: (path?: string) => NodeInfo | undefined
}

/** Annotation signature */
export type DecoratorSignature = (
	target: any,
	propertyKey?: string,
	descriptor?: PropertyDescriptor
) => any;

/** Create decorator */
export function createDecorator<T extends [...args: any] | void = void>(cb: JsDocAnnotationMethod): DecoratorType<T> {
	throw new ModelError(ModelErrorCode.NOT_COMPILED);
}

/** Decorator type */
export type DecoratorType<T> = T extends [...args: any] ? ((...args: T) => DecoratorSignature) : DecoratorSignature

/**
 * pre-validate entity annotation
 */
export function beforeValidate(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) { throw new ModelError(ModelErrorCode.NOT_COMPILED); }
/**
 * Post-validate entity annotation
 */
export function afterValidate(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) { throw new ModelError(ModelErrorCode.NOT_COMPILED); }
/**
 * pre-resolve entity annotation
 */
export function beforeResolve(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) { throw new ModelError(ModelErrorCode.NOT_COMPILED); }
/**
 * pre-resolve entity annotation
 */
export function afterResolve(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) { throw new ModelError(ModelErrorCode.NOT_COMPILED); }

// /** Generate default value for a field */
// export function defaultValue(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) { throw new ModelError(ModelErrorCode.NOT_COMPILED); }

/** Generate  */

/** Convert input/output data */
export function convert(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) { throw new ModelError(ModelErrorCode.NOT_COMPILED); }

/** Ignore this element */
export function ignore(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) { throw new ModelError(ModelErrorCode.NOT_COMPILED); }

/** 
 * Node info
 */
export interface NodeInfo {
	/** Used selector */
	selector: string,
	/** Node name */
	name: string,
	/** Node type name */
	type: string
}