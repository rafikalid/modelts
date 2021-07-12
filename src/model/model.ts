import { ModelKind, ModelNode, RootModel } from "@src/schema/model";
import { glob } from "glob";

const DEFINE_SCALAR_NAME_REGEX= /^\w{,50}$/;

/** Model compiler */
export class Model{
	private AST:RootModel
	constructor();
	constructor(AST:RootModel);
	constructor(ast?:RootModel){
		if(!ast){
			// Transformer didn't run
			throw new Error('Expected AST arg. Did you use transformer in your typescript?');
		}
		this.AST= ast;
		// create map
		var mapChilds= ast.mapChilds= {} as Record<string, ModelNode>;
		var childs= ast.children;
		var i, len;
		for (i = 0, len= childs.length; i < len; i++) {
			const child = childs[i];
			mapChilds[child.name!]= child;
		}
	}

	// /** Define new scalar */
	// defineScalar<T>(name: string, options: ScalarDefineOptions<T>){
	// 	// Checks
	// 	if(!DEFINE_SCALAR_NAME_REGEX.test(name))
	// 		throw new Error(`Illegal scalar name: ${name}. Expected to match: ${DEFINE_SCALAR_NAME_REGEX}`);
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

	/** Create schema from files */
	static async loadFromFiles(pathPattern:string){
		// Load files
		const files: string[]= await new Promise(function(res, rej){
			glob(pathPattern, function(er, files){
				if(er) rej(er)
				else res(files);
			});
		});
		// load data
		const children=[];
		const mapChilds= {};
		// const root: RootModel= {
		// 	kind: ModelKind.ROOT,
		// 	name: undefined,
		// 	jsDoc: undefined,
		// 	directives: undefined,
		// 	children: [],
		// 	mapChilds: {}
		// };
		var i, len, node;
		for(i=0, len= files.length; i<len; ++i){
			if(node= (await import(files[i])).model){
				//---- here
			}
		}
	}
}