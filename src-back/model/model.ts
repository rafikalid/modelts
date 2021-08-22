import { toGraphql } from "@src/graphql";
import { ModelNode, ModelRoot } from "@src/schema/model";
import { GraphQLSchema } from "graphql";

// const DEFINE_SCALAR_NAME_REGEX= /^\w{,50}$/;

/** Model compiler */
export class Model{
	private AST: ModelRoot
	constructor(ast: ModelRoot){
		if(!ast){
			// Transformer didn't run
			throw new Error('Expected AST arg. Did you use transformer in your typescript?');
		}
		this.AST= ast;
		// create map
		ast.mapChilds= {};
		var mapChilds= ast.mapChilds;
		var childs= ast.children, child: ModelNode;
		var i, len;
		for (i = 0, len= childs.length; i < len; i++) {
			child = childs[i];
			mapChilds[child.name!]= child;
		}
	}
	/** Compile files into Model */
	static from(globFilesPath: string): Model{
		throw new Error('Enexpected call. You forgot to run the compiler!');
	}

	/**
	 * Convert Model into graphql
	 */
	static toGraphQL(globFilesPath: string): GraphQLSchema{
		throw new Error('Enexpected call. You forgot to run the compiler!');
		// return toGraphql(this.AST);
	}

	// /** Define new scalar */
	// defineScalar<T>(name: string, options: ScalarDefineOptions<T>){
	// 	// Checks
		// if(!DEFINE_SCALAR_NAME_REGEX.test(name))
		// 	throw new Error(`Illegal scalar name: ${name}. Expected to match: ${DEFINE_SCALAR_NAME_REGEX}`);
	// 	var ast= this.AST;
	// 	if(ast.mapChilds[name])
	// 		throw new Error(`Already defined entity: ${name}`);
	// 	var scalar: ModelScalar<T>= {
	// 		kind:	ModelKind.SCALAR,
	// 		name:	name,
	// 		jsDoc:	undefined,
	// 		parse:	options.parse,
	// 		serialize: options.serialize
	// 	}
	// 	ast.children.push(ast.mapChilds[name]= scalar);
	// }


	// /** Create schema from files @deprecated */
	// static async loadFromFiles(pathPattern:string){
	// 	// Load files
	// 	const files: string[]= await new Promise(function(res, rej){
	// 		glob(pathPattern, function(er, files){
	// 			if(er) rej(er)
	// 			else res(files);
	// 		});
	// 	});
	// 	// load data
	// 	const root: SimplifiedNode= {
	// 		kind:	ModelKind.ROOT,
	// 		name:	undefined,
	// 		children: []
	// 	};
	// 	var i, len, node: RootModel, oNode: ModelNode;
	// 	for(i=0, len= files.length; i<len; ++i){
	// 		if((node= (await import(files[i])).model) && (node instanceof Model)){
	// 			deepMerge(root, node.AST as SimplifiedNode);
	// 		}
	// 	}
	// 	// Return node
	// 	return new Model(root);
	// }

}

/** Deep merge */