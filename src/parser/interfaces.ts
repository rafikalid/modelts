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
	fromDB?: (value: unknown) => T;
	/** Save into database */
	toDB?: (value: T) => unknown;
	/** Mock */
	mock?: (parent: unknown) => T | undefined;
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
export type UnionResolver<T> = (value: T, context?: unknown, info?: unknown) => number;

/**
 * Exec action on entity before validation
 */
export type PreValidate<T> = Validator<unknown, T>;
/**
 * Exec action on entity after validation
 * Convert received data
 */
export type PostValidate<T> = Validator<unknown, T>;
/**
 * Wrap validation logic (before and after)
 */
export type WrapValidation<T> = (parent: unknown, value: T, context: unknown, info: unknown, next: WrapperCallBack) => T | undefined | Promise<T | undefined>;
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
export type WrapResolver<T> = (value: T, args: unknown, context: unknown, info: unknown, next: WrapperCallBack) => T | undefined | Promise<T | undefined>;

/** Wrappers callback */
export type WrapperCallBack = () => void;

/**
 * Convert Input Entity
 */
export type ConvertInput<T> = Resolver<unknown, unknown, T | undefined>;
/**
 * Convert Output Entity
 */
export type ConvertOutput<T> = Resolver<unknown, T | undefined, unknown>;

/** Output wrapper @deprecated */
export type OutputWrapper<P, T> = (
	parent: P,
	args: unknown,
	context: unknown,
	info: unknown,
	next: () => void
) => Maybe<T>;

/** Model output resolvers */
export type ResolversOf<T> = {
	[P in keyof T]?: Resolver<T, unknown, unknown>
}

/** Model input config */
export type ValidatorsOf<T> = {
	[P in keyof T]?: Validator<T, T[P]>;
}

/** Input resolver method signature */
export type Validator<ParentType, T> = (
	parent: ParentType,
	value: T,
	context?: unknown,
	info?: unknown
) => T | undefined | Promise<T | undefined>;

/** Output resolver method signature */
export type Resolver<ParentType, InputArg, OutputType> = (
	parent: ParentType,
	args: InputArg,
	context?: unknown,
	info?: unknown
) => OutputType extends undefined | null ? OutputType | void : OutputType;

/** Resolver Pre and Post */
export type PrePostResolver<T> = (
	value: T,
	args?: unknown,
	context?: unknown,
	info?: unknown
) => T | undefined | Promise<T | undefined>;

/** Maybe return value or null or undefined */
export type Maybe<T> = T | null | undefined | Promise<T | null | undefined>;

/** Maybe return value or null or undefined */
export type MaybeAsync<T> = Promise<T | null | undefined>;


/** Root config */
export interface RootConfig {
	before?: Resolver<unknown, unknown, unknown>
	after?: Resolver<unknown, unknown, unknown>
	wrap?: OutputWrapper<unknown, unknown>
}