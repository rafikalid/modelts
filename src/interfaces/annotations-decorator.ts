import { ModelError, ModelErrorCode } from "./error";
import { JsDocAnnotationMethod } from "./jsdoc";

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
