import type { GraphQLSchema } from 'graphql';

// const DEFINE_SCALAR_NAME_REGEX= /^\w{,50}$/;

/** Model compiler */
export class Model {
	// private AST: ModelRoot
	constructor(ast: any) {
		throw new Error('Unexpected use case!');
	}

	/** Compile files into Model */
	static scan(...globFilesPath: string[]): Model {
		throw new Error('Unexpected call. You forgot to run the compiler!');
	}

	/** Convert Model into graphql */
	static scanGraphQL(...globFilesPath: string[]): GraphQLSchema {
		throw new Error('Unexpected call. You forgot to run the compiler!');
	}
}

/** Model validator */
export function validate<T>(data: any): ValidateReturn<T> {
	// throw new Error('Unexpected call. You forgot to run the compiler!');
	//FIXME implements this logic
	return {
		data: data as T,
		warns: [],
		errors: []
	}
}

/** Validate return schema */
export interface ValidateReturn<T> {// TODO list warnings
	data: T,
	warns: any[],
	errors: any[]
}
