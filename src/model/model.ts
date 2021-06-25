import type { RootModel } from "@src/schema/model";

/** Model compiler */
export class Model{
	constructor();
	constructor(AST:RootModel);
	constructor(ast?:any){
		if(!ast){
			// Transformer didn't run
			throw new Error('Expected AST arg. Did you use transformer in your typescript?');
		}
	}
}