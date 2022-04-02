import { ModelError, ModelErrorCode, JsDocAnnotations } from '@src';

/** Create graphql schema */
export function gqlSchema<S extends GqlSchema, A extends JsDocAnnotations = JsDocAnnotations, Context = any>() {
	throw new ModelError(ModelErrorCode.NOT_COMPILED, 'Please compile your code');
}

/** Basic schema */
export interface GqlSchema {
	query: Record<string, any>
	mutation: Record<string, any>
	inscription: Record<string, any>
}


/** Info */
export interface ModelInfo {

}

/** Return value as promise or undefined */
export type Maybe<T> = T | null | undefined | Promise<T | null | undefined>;
export type MaybePromise<T> = Promise<T | null | undefined>;