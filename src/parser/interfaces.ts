
/** Scalar define options */
export type JsonTypes = string | number | boolean; // |null|undefined

/** Create new Scalar */
export interface ModelScalar<T> {
	/** Parse value */
	parse?: (value: JsonTypes) => T;
	/** Stringify value */
	serialize?: (value: T) => JsonTypes | undefined | null;
	/** Load from Database */
	fromDB?: (value: any) => T;
	/** Save into database */
	toDB?: (value: T) => any;
}

/** Unions */
export interface UNION<Types> {
	// Return the index of target type
	resolveType: (value: Types, context?: any, info?: any) => number;
}

/** Model resolver config */
export interface ResolverConfig<T> {
	/** Output resolvers */
	output: 
}


/** Model output resolvers */
export interface ResolverOutputConfig<T> { }

/** Mode input config */
export interface ResolverInputConfig<T> { }

// Define Object model
export const ServiceConfig: ResolverConfig<Service> = {
	output: new class {

	},
	beforeInput: function () { },
	input: new class {

	},
	afterInput: function () { }
}





















import { PlainObject } from '..';

/** Resolver signature */
export type Resolver<Tparent, Tresult> = (
	parent: Tparent,
	args: any,
	context?: any,
	info?: any
) => Tresult extends undefined ? Tresult | void : Tresult;

/** Convert Model to optional resolvers signature */
export type ResolversOf<T> = {
	[P in keyof T]?: Resolver<T, any>;
};

/** Add input controller to a model */
export type InputResolversOf<T> = {
	[P in keyof T]?: InputResolverFx<T, T[P]>;
};

/** Resolve input object */
export interface InputResolver<T> {
	/** Process before */
	before: InputResolverFx<T, T>

	/** Process After */
	after: InputResolverFx<T, T>
}

/** Input resolver */
export type InputResolverFx<T, P> = (
	parent: T,
	value: P | any,
	context?: any,
	info?: any
) => P | Promise<P>;
