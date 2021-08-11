import ts from "typescript";
// import {readFileSync} from 'fs';
import {join, dirname, relative} from "path";
import { ParseModelFrom } from "./parser";
import { serializeAST } from "./serialize-ast";
import { PACKAGE_NAME } from "@src/config";
import { ModelRoot } from "@src/schema/model";
import { compileGraphQL } from "@src/graphql/compiler";

/** Load files and generate Model */
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
	const ModelRoots: Map<string, ModelRoot>= new Map();
	const importsMapper: Map<string, Map<string, ts.Identifier>>= new Map();
	mappedFiles.patterns.forEach(function(p){
		var root= ParseModelFrom(join(relative(process.cwd(), dirname(filePath)), p.slice(1, p.length-1)), compilerOptions);
		// Serialize AST
		ModelMap.set(p, serializeAST(root, ts.factory, importsMapper, pretty));
		ModelRoots.set(p, root);
	});

	//* Insert in target file
	var {file, ModelVarName}= mappedFiles;
	//* Add imports
	var importDeclarations: ts.Statement[]= [];
	const fileName= file.fileName;
	const fileDir= dirname(fileName)
	importsMapper.forEach(function(mp, key){
		// create import specifiers
		var specifiers: ts.ImportSpecifier[]= [];
		mp.forEach((identifier, className)=>{
			specifiers.push(factory.createImportSpecifier(
				factory.createIdentifier(className),
				identifier
			));
		});
		// Create import declaration
		importDeclarations.push(
			factory.createImportDeclaration(
				undefined,
				undefined,
				factory.createImportClause( false, undefined, factory.createNamedImports(specifiers)),
				factory.createStringLiteral(_relative(fileDir, key).replace(/\.ts$/i, ''))
			)
		);
	});
	//* Inject
	file= ts.transform(file, [function(ctx:ts.TransformationContext): ts.Transformer<ts.Node>{
		return _createModelInjectTransformer(ctx, file, ModelVarName, importDeclarations);
	}], compilerOptions).transformed[0] as ts.SourceFile;
	//* Inject imports
	
	if(importDeclarations.length){
		file= factory.updateSourceFile(
			file,
			importDeclarations.concat(file.statements),
			false,
			file.referencedFiles,
			file.typeReferenceDirectives,
			file.hasNoDefaultLib,
			file.libReferenceDirectives
		);
	}
	//* return content
	return ts.createPrinter().printFile(file);

	/** Inject model */
	function _createModelInjectTransformer(ctx:ts.TransformationContext, sf: ts.SourceFile, ModelVarName: Set<string>, importDeclarations: ts.Statement[]): ts.Transformer<ts.Node>{
		const factory= ctx.factory;
		function _visitor(node:ts.Node):ts.Node{
			if(
				ts.isCallExpression(node)
				&& ts.isPropertyAccessExpression(node.expression)
				&& ModelVarName.has(node.expression.getFirstToken()!.getText())
				&& node.arguments.length === 1
			){
				let arg= node.arguments[0].getText();
				switch(node.expression.name.getText()){
					case 'from':
						node= factory.createNewExpression(
							factory.createIdentifier(node.expression.getFirstToken()!.getText()),
							undefined,
							[ModelMap.get(arg)!]
						);
						break;
					case 'toGraphQL':
						//ModelRoots
						let re= compileGraphQL(factory, ModelRoots.get(arg)!, pretty);
						node= re.node;
						importDeclarations.push(...re.imports);
						break;
				}
			} else {
				node= ts.visitEachChild(node, _visitor, ctx);
			}
			return node;
		}
		return _visitor;
	}
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
