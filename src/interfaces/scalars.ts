import { ModelError, ModelErrorCode } from "@interfaces/error";

/** JSON types */
export type JSONTypes = boolean | string | number;

/** clone type */
export type ExtendsType<T> = T & {};

/** Create new Scalar */
export interface ScalarOptions<T> {
	/** Parse from JSON, could be undefined */
	parse?: (value: JSONTypes, parent?: any, context?: any, info?: any) => T | undefined
	/** Default value when parsing */
	default?: (parent?: any, context?: any, info?: any) => T
	/** Serialize data */
	serialize?: (value: T, parent?: any, context?: any, info?: any) => JSONTypes | undefined
	/** convert data received from DB or any trusted source, could be undefined */
	fromDB?: (value: any, parent?: any, context?: any, info?: any) => T | undefined
	/** Convert data to be saved to DB or sent to trusted resource */
	toDB?: (value: T, parent?: any, context?: any, info?: any) => any
	/** Mock this value */
	mock?: (parent?: any, context?: any, info?: any) => T | undefined
	/**
	 * Parse "@assert" jsDoc annotation arguments into executable JS
	 */
	assertJsDocParser?: (value: string) => string | undefined // TODO add documentation
	/**
	 * Parse "@default" jsDoc annotation ito value
	 */
	defaultJsDocParser?: (value: string) => T | undefined
}
