/** Clone type */
export type CloneType<T> = Pick<T, keyof T>;

/** Scalar define options */
export type JsonTypes = string | number | boolean; // |null|undefined

/** Create new Scalar */
export interface Scalar<T> {
	/** Parse value */
	parse?: (value: JsonTypes) => T;
	/** Stringify value */
	serialize?: (value: T) => JsonTypes | undefined | null;
	/** Load from Database */
	fromDB?: (value: any) => T;
	/** Save into database */
	toDB?: (value: T) => any;
	/** Mock */
	mock?: (parent: any) => T | undefined;
}

/**
 * Basic Scalar
 * @internal
 */
export interface ModelBasicScalar<T> extends Scalar<T> {
	/** Explicit scalar description */
	description: string
}

/** Resolve union type */
export type UnionResolver<T> = (value: T, context?: any, info?: any) => number;

/**
 * Exec action on entity before validation
 */
export type PreValidate<T> = Validator<any, T>;
/**
 * Exec action on entity after validation
 * Convert received data
 */
export type PostValidate<T> = Validator<any, T>;
/**
 * Wrap validation logic (before and after)
 */
export type WrapValidation<T> = (parent: any, value: T, context: any, info: any, next: WrapperCallBack) => T | undefined | Promise<T | undefined>;
/**
 * Execute action before resolver
 */
export type PreResolve<T> = PrePostResolver<T>;
/**
 * Execute action before resolver
 */
export type PostResolve<T> = PrePostResolver<T>;

/**
 * Wrap resolver of an Entity
 */
export type WrapResolver<T> = (value: T, args: any, context: any, info: any, next: WrapperCallBack) => T | undefined | Promise<T | undefined>;

/** Wrappers callback */
export type WrapperCallBack = () => void;

/**
 * Convert Input Entity
 */
export type ConvertInput<T> = Resolver<any, any, T | undefined>;
/**
 * Convert Output Entity
 */
export type ConvertOutput<T> = Resolver<any, T | undefined, any>;

/** Output wrapper @deprecated */
export type OutputWrapper<P, T> = (
	parent: P,
	args: any,
	context: any,
	info: any,
	next: () => void
) => Maybe<T>;

/** Model output resolvers */
export type ResolversOf<T> = {
	[P in keyof T]?: Resolver<T, any, any>
}

/** Model input config */
export type ValidatorsOf<T> = {
	[P in keyof T]?: Validator<T, T[P]>;
}

/** Input resolver method signature */
export type Validator<ParentType, T> = (
	parent: ParentType,
	value: T,
	context?: any,
	info?: any
) => T | undefined | Promise<T | undefined>;

/** Output resolver method signature */
export type Resolver<ParentType, InputArg, OutputType> = (
	parent: ParentType,
	args: InputArg,
	context?: any,
	info?: any
) => OutputType extends undefined | null ? OutputType | void : OutputType;

/** Resolver Pre and Post */
export type PrePostResolver<T> = (
	value: T,
	args?: any,
	context?: any,
	info?: any
) => T | undefined | Promise<T | undefined>;

/** Maybe return value or null or undefined */
export type Maybe<T> = T | null | undefined | Promise<T | null | undefined>;

/** Maybe return value or null or undefined */
export type MaybeAsync<T> = Promise<T | null | undefined>;


/** Root config */
export interface RootConfig {
	before?: Resolver<any, any, any>
	after?: Resolver<any, any, any>
	wrap?: OutputWrapper<any, any>
}