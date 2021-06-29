import { ModelNode, RootModel } from "@src/schema/model";

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
}