/** Clone type */
export type CloneType<T> = Pick<T, keyof T>;

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

/** Object converter */
export interface Converter<T> {
	input?: (value: any) => T
	output?: (value: T) => any
}

/**
 * Basic Scalar
 * @internal
 */
export interface ModelBasicScalar<T> extends ModelScalar<T> {
	/** Explicit scalar description */
	description: string
}

/** Unions */
export interface UNION<Types> {
	// Return the index of target type
	resolveType: (value: Types, context?: any, info?: any) => number;
}

/** Model resolver config */
export interface ResolverConfig<T> {
	/** Output resolvers */
	outputFields?: ResolverOutputConfig<T>,
	/** Input resolvers */
	inputFields?: ResolverInputConfig<T>
	/** Exec operation before input validation */
	beforeInput?: ResolverInputMethod<T, T>
	/** Exec after input */
	afterInput?: ResolverInputMethod<T, T>
	/** Exec Operation before and after input validation */
	wrapInput?: InputWrapper<T, T>
	/** Exec Operation before and after output */
	wrapOutput?: OutputWrapper<T, T>
	/** Exec operations before output */
	beforeOutput?: ResolverOutputMethod<T, T>
	/** Exec operations after output */
	afterOutput?: ResolverOutputMethod<T, T>
}

/** Input wrapper */
export type InputWrapper<P, T> = (
	parent: P,
	value: T | any,
	context: any,
	info: any,
	next: () => void
) => T | Promise<T>;


/** Output wrapper */
export type OutputWrapper<P, T> = (
	parent: P,
	args: any,
	context: any,
	info: any,
	next: () => void
) => T extends undefined ? T | void : T;

/** Model output resolvers */
export type ResolverOutputConfig<T> = {
	[P in keyof T]?: ResolverOutputMethod<T, any>
}

/** Model input config */
export type ResolverInputConfig<T> = {
	[P in keyof T]?: ResolverInputMethod<T, T[P]>;
}

/** Input resolver method signature */
export type ResolverInputMethod<P, T> = (
	parent: P,
	value: T | any,
	context?: any,
	info?: any
) => T | Promise<T>;

/** Output resolver method signature */
export type ResolverOutputMethod<P, T> = (
	parent: P,
	args: any,
	context?: any,
	info?: any
) => T extends undefined ? T | void : T;

/** Maybe return value or null or undefined */
export type Maybe<T> = T | null | undefined | Promise<T | null | undefined>;

/** Maybe return value or null or undefined */
export type MaybeAsync<T> = Promise<T | null | undefined>;



/** Root config */
export interface RootConfig {
	before?: ResolverOutputMethod<any, any>
	after?: ResolverOutputMethod<any, any>
	wrap?: OutputWrapper<any, any>
}