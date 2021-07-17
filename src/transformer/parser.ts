import { ImportTokens, ModelBaseNode, ModelKind, ModelRoot } from "@src/schema/model";
import ts from "typescript";
import Glob from 'glob';
import { PACKAGE_NAME } from "@src/config";

/** Parse Model from files */
export function ParseModelFrom(pathPattern:string, compilerOptions: ts.CompilerOptions): ModelRoot{
	/** Root node */
	const root: ModelRoot= {
		kind: ModelKind.ROOT,
		name: undefined,
		jsDoc: undefined,
		directives: undefined,
		children: [],
		mapChilds: {}
	}
	//* Load files using glob
	const files= Glob.sync(pathPattern);
	if (files.length === 0){
		console.warn(`No file found for pattern: ${pathPattern}`);
		return root;
	}
	//* Create compiler host
	const pHost= ts.createCompilerHost(compilerOptions, true); 
	//* Create program
	const program= ts.createProgram(files, compilerOptions, pHost);
	const typeChecker= program.getTypeChecker();

	//* Step 1: parse AST
	var i, len, srcFiles= program.getSourceFiles(), srcFile: ts.SourceFile;
	for(i=0, len=srcFiles.length; i<len; ++i){
		//* Each file in the program
		srcFile= srcFiles[i];
		if(srcFile.isDeclarationFile) continue;
		//* Import tockens
		const importTokens: ImportTokens={
			tsModel:			undefined,
			Model:				undefined,
			ModelScalar:		undefined,
			UNION:				undefined,
			ignore:				undefined,
			assert:				undefined,
			ResolversOf:		undefined,
			InputResolversOf:	undefined
		};
		//* Go through main childs
		let j, jlen, entities= srcFile.getChildren(), entity: ts.Node;
		rtLoop: for(j=0, jlen= entities.length; j<jlen; ++j){
			entity= entities[j];
			let entityType = typeChecker.getTypeAtLocation(entity);
			let entitySymbol = entityType.getSymbol();
			//* Parse Entity
			switch(entity.kind){
				case ts.SyntaxKind.ImportDeclaration:
					//* Import declarations
					if ((entity as ts.ImportDeclaration).moduleSpecifier.getText() === PACKAGE_NAME) {
						(entity as ts.ImportDeclaration).importClause?.namedBindings?.forEachChild(n=>{
							if(ts.isImportSpecifier(n) && n.propertyName){
								console.log('--- get token for', n.name.getText());
								let key= n.propertyName.getText();
								if(importTokens.hasOwnProperty(key))
									importTokens[key as keyof ImportTokens] = n.name.getText();
							}
						});
					}
					break;
				case ts.SyntaxKind.InterfaceDeclaration:
				case ts.SyntaxKind.ClassDeclaration:
					//* Class or Interface entity
					//  Skip entities without "Export" keyword
					if (entity.getFirstToken()?.kind !== ts.SyntaxKind.ExportKeyword) continue rtLoop;
					console.log('--- compile interface', (entity as ts.InterfaceDeclaration).name.getText());
					// TODO parse fields
					break;
				case ts.SyntaxKind.EnumDeclaration:
					//* Enumeration
					//  Skip entities without "Export" keyword
					if (entity.getFirstToken()?.kind !== ts.SyntaxKind.ExportKeyword) continue rtLoop;
					console.log('--- compile Enum', (entity as ts.EnumDeclaration).name.getText());
					// TODO enum
					break;
				case ts.SyntaxKind.VariableStatement:
					//* Scalars
					//  Skip entities without "Export" keyword
					if (entity.getFirstToken()?.kind !== ts.SyntaxKind.ExportKeyword) continue rtLoop;
					console.log('--- compile Scalar');
					//TODO
					break;
			}
		}

	}
	
	// TODO
	// const typeChecker= program.getTypeChecker();
	return root;
}


/** Get field or entity informations */
function _getNodeMetadata(node: ts.Node, nodeSymbol: ts.Symbol | undefined, typeChecker: ts.TypeChecker){
	const result: GetNodeMatadataReturn= {
		ignore:		false,
		tsModel:	false,
		directives: undefined,
		jsDoc:		undefined
	}
	var a: any;
	// Ignore field if has "private" or "protected" keywords
	if(node.modifiers?.some(({kind})=> kind===ts.SyntaxKind.PrivateKeyword || kind===ts.SyntaxKind.ProtectedKeyword))
		return result;
	// Load jsDoc tags
	if(nodeSymbol){
		let jsDoc= (a= nodeSymbol.getDocumentationComment(typeChecker)) ? (a as ts.SymbolDisplayPart[]).map(e=> e.text) : [];
		let jsDocTags;

	}
	
	return result;
}
interface GetNodeMatadataReturn{
	ignore: boolean
	tsModel: boolean
	directives: ModelBaseNode['directives'],
	jsDoc:	string|undefined
}