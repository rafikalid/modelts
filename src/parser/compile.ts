import ts from "typescript";
// import {readFileSync} from 'fs';
import {join, dirname, relative} from "path";
import { parse as ParseModelFrom } from "./parser";
import { PACKAGE_NAME } from "@src/config";
import { printTree } from "@src/utils/console-print";

// import { compileGraphQL } from "@src/graphql/compiler";


/** Compile each file */
export function generateModel(filePath: string, fileContent: string, compilerOptions: ts.CompilerOptions, pretty:boolean):string|undefined{
	const factory= ts.factory;
	//* Load source file
	const srcFile= ts.createSourceFile(filePath, fileContent, compilerOptions.target ?? ts.ScriptTarget.Latest, true);
	//* check for files with "Model.from('glob-path')"
	const mappedFiles= mapFilesWithModel(srcFile);

	if(!mappedFiles.patterns.size)
		return;
	
	//* Resolve Model for each pattern
	const ModelMap: Map<string, ts.ObjectLiteralExpression>= new Map();
	const ModelRoots: Map<string, Map<string, Node>>= new Map();
	const importsMapper: Map<string, Map<string, ts.Identifier>>= new Map();
	const relativeDirname= relative(process.cwd(), dirname(filePath));
	mappedFiles.patterns.forEach(function(p){
		console.log('COMPILE PATTERN>>', p);
		const pArr= p.slice(1, p.length-1).split(',').map(e=> join(relativeDirname, e.trim()) );
		var root= ParseModelFrom(pArr, compilerOptions);
		console.log("===ROOT===\n", printTree(root, '  '));
		// Create graphql object
		console.log('INSERT DATA>>')
		
		// Serialize AST
		// TODO
		// ModelMap.set(p, serializeAST(root, ts.factory, importsMapper, pretty));
		// ModelRoots.set(p, root);
	});


}

/** filterFilesWithModel response */
interface FilterFilesWithModelResp{
	/** Absolute Glob pattern inside: "Model.from(pattern)" */
	patterns: Set<string>
	/** Selected files (has "model.from") */
	file: ts.SourceFile
	ModelVarName: Set<string>
}
/** Filter files to get those with "Model.from('glob-path')" */
function mapFilesWithModel(srcFile: ts.SourceFile): FilterFilesWithModelResp{
	const foundGlobPatterns:Set<string>= new Set();
	const ModelVarName:Set<string>= new Set();
	//* Parse each file
	const fileName= srcFile.fileName;
	const queue:ts.Node[]= [srcFile];
	var node, j=0;
	while(j<queue.length){
		node= queue[j++];
		if(ts.isImportDeclaration(node) && node.moduleSpecifier.getText() === PACKAGE_NAME){
			// Load names used for "Model"
			node.importClause?.namedBindings?.forEachChild(function(n){
				if(ts.isImportSpecifier(n) && (n.propertyName ?? n.name).getText() === 'Model'){
					ModelVarName.add(n.name.getText());
				}
			});
		} else if(ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ModelVarName.has(node.expression.getFirstToken()!.getText())){
			let arg;
			let methodName= node.expression.name.getText();
			if(methodName==='from' || methodName==='toGraphQL'){
				if(node.arguments.length===1 && (arg= node.arguments[0]) && ts.isStringLiteral(arg)){
					foundGlobPatterns.add(arg.getText());
				} else {
					throw new Error(`Expect static string as argument to "Model::from" at ${fileName}:${node.getStart()}. Code: ${node.getText()}`);
				}
			}
		} else if(node.getChildCount()){
			queue.push(...node.getChildren());
		}
	}
	// found
	return {
		patterns:	foundGlobPatterns,
		file: 		srcFile,
		ModelVarName: ModelVarName
	};
}

/** Relative path */
function _relative(from: string, to: string){
	var p= relative(from, to);
	p= p.replace(/\\/g, '/');
	var c= p.charAt(0);
	if(c!=='.' && c!=='/') p= './'+p;
	return p;
}