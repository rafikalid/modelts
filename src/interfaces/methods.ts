
/** Basic schema */
export interface GqlSchema {
	query: Record<string, any>
	mutation: Record<string, any>
	inscription: Record<string, any>
}


/** Info */
export interface ModelInfo {
	/** Type name */
	parentTypeName: string
	/** Real type name (where this field is inherited) */
	parentRootTypeName: string
	/** Parent document */
	parent: any
}

/** Return value as promise or undefined */
export type Maybe<T> = T | null | undefined | Promise<T | null | undefined>;
export type MaybePromise<T> = Promise<T | null | undefined>;

/** Resolvers */
export type ResolversOf<T> = TupleForEachType<T>;

/** Validators */
export type ValidatorsOf<T> = TupleForEachType<T>;

/**
 * Split tuple and create validators or resolvers
 */
type TupleForEachType<T> = T extends [] ? {} :
	T extends [infer F, ...infer R] ? {
		[P in keyof F]?: (...args: any[]) => Maybe<F[P]> | any
	} & TupleForEachType<R> : {
		[P in keyof T]?: (...args: any[]) => Maybe<T[P]> | any
	}

/** Resolve union type name */
export interface Union<T> {
	resolve: (value: T, context?: any, info?: any) => string
}


/** Extract partial fields that are not null */
export function partial<T extends object>(data: object): Partial<T> {
	//FIXME implement this logic
	const result: Partial<T> = {};
	for (let k in data) {
		if (data.hasOwnProperty(k) && data[k as keyof typeof data] != null) {
			result[k as keyof Partial<T>] = data[k as keyof typeof data];
		}
	}
	return result;
}

//**************** */
let c: [string, number, boolean];

function arg(...t: typeof c) {

}