import type { GraphQLSchema } from "graphql";

// const DEFINE_SCALAR_NAME_REGEX= /^\w{,50}$/;

/** Model compiler */
export class Model{
	// private AST: ModelRoot
	constructor(ast: any){
		throw new Error('Enexpected use case!')
	}

	/** Compile files into Model */
	static from(globFilesPath: string): Model{
		throw new Error('Enexpected call. You forgot to run the compiler!');
	}

	/** Convert Model into graphql */
	static toGraphQL(globFilesPath: string): GraphQLSchema{
		throw new Error('Enexpected call. You forgot to run the compiler!');
	}
}