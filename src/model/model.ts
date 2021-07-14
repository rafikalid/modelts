import { ModelKind, ModelNode, RootModel, SimplifiedNode } from "@src/schema/model";
import { deepMerge } from "@src/utils/deep-merge";
import glob from "glob";

// const DEFINE_SCALAR_NAME_REGEX= /^\w{,50}$/;

export interface ModelOptions{
	children:	RootModel['children']
	mapChilds?:	RootModel['mapChilds']
}

/** Model compiler */
export class Model{
	private AST: ModelOptions
	constructor();
	constructor(AST: ModelOptions);
	constructor(ast?: ModelOptions){
		if(!ast){
			// Transformer didn't run
			throw new Error('Expected AST arg. Did you use transformer in your typescript?');
		}
		this.AST= ast;
		// create map
		// var mapChilds= ast.mapChilds= {} as Record<string, ModelNode>;
		// var childs= ast.children;
		// var i, len;
		// for (i = 0, len= childs.length; i < len; i++) {
		// 	const child = childs[i];
		// 	mapChilds[child.name!]= child;
		// }
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

	/** Load Model schema from file */
	static from(globFilesPath: string): Model{
		throw new Error('This method is used as a placeholder only for the compiler. Did you forget to run the compiler?');
	}

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

	/** export Graphql */
	asGraphQL(){
		const ast= this.AST;
	}
}

/** Deep merge */