
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
	outputFields?: ResolverOutputConfig<T>,
	/** Input resolvers */
	inputFields?: ResolverInputConfig<T>
	/** Exec Operation before output, not available for Graphql */
	outputBefore?: ResolverOutputMethod<T, T>
	/** Exec Operation before output, not available for Graphql */
	outputAfter?: ResolverOutputMethod<T, T>
	/** Exec Before input */
	inputBefore?: ResolverInputMethod<T, T>
	/** Exec After input */
	inputAfter?: ResolverInputMethod<T, T>
}


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