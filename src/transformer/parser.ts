import { ModelKind, RootModel } from "@src/schema/model";
import ts from "typescript";

/** Parse Model from files */
export function ParseModelFrom(pathPattern:string, compilerOptions: ts.CompilerOptions): RootModel{
	const root: RootModel= {
		kind: ModelKind.ROOT,
		name: undefined,
		jsDoc: undefined,
		directives: undefined,
		children: [],
		mapChilds: {}
	}
	// const typeChecker= program.getTypeChecker();
	return root;
}