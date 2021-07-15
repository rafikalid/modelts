import { ModelKind, ModelRoot } from "@src/schema/model";
import ts from "typescript";

/** Parse Model from files */
export function ParseModelFrom(pathPattern:string, compilerOptions: ts.CompilerOptions): ModelRoot{
	const root: ModelRoot= {
		kind: ModelKind.ROOT,
		name: undefined,
		jsDoc: undefined,
		directives: undefined,
		children: [],
		mapChilds: {}
	}
	// TODO
	// const typeChecker= program.getTypeChecker();
	return root;
}