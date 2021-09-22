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
export type InputResolver<T extends PlainObject> = (
	parent: any,
	value: T,
	context?: any,
	info?: any
) => T | Promise<T>;

/** Input resolver */
export type InputResolverFx<T, P> = (
	parent: T,
	value: P | any,
	context?: any,
	info?: any
) => P | Promise<P>;
