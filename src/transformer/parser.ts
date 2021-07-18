import { ImportTokens, ModelBaseNode, ModelKind, ModelNode, ModelRoot, ObjectField, ModelObjectNode, ModelRefNode } from "@src/schema/model";
import ts from "typescript";
import Glob from 'glob';
import { PACKAGE_NAME } from "@src/config";
import { Visitor } from "@src/utils/utils";

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

	//* nameless entities
	const namelessEntities: NamelessEntity[]= [];

	//* Step 1: parse AST
	const visitor= new Visitor<ts.Node>();
	var i:number, len: number, srcFiles= program.getSourceFiles(), srcFile: ts.SourceFile;
	for(i=0, len=srcFiles.length; i<len; ++i){
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
		// Push to iterator
		visitor.push(srcFile.getChildren(), undefined, false, srcFile.getText(), importTokens, undefined);
	}
	_parseNode(visitor, namelessEntities, typeChecker, root);

	//* Resolve nameless nodes
	const namelessMap:Map<string, number>= new Map();
	for(i=0, len=namelessEntities.length; i<len; ++i){
		let item= namelessEntities[i];
		let itemName= item.name??'Entity';
		let itemI;
		let tmpn= itemName;
		while(mapEntities[itemName]){
			if(namelessMap.has(tmpn)) itemI= namelessMap.get(tmpn);
			else{
				itemI= 1;
				namelessMap.set(tmpn, itemI);
			}
			itemName= `${tmpn}_${i}`;
		}
		item.node.name= itemName;
		mapEntities[itemName]= item.node;
		item.ref.name= itemName; 
	}
	
	// TODO
	// const typeChecker= program.getTypeChecker();
	return root;
}

/** Walking queue (recursitivity alternative) */
interface seekingQueueItem{
	node: ts.Node,
	/** Parent descriptor */
	parentDescriptor: ModelNode|undefined
	/** Does this class methods are for input or output */
	isInput: boolean
}

/** Parse each node */
function _parseNode(visitor:Visitor<ts.Node>, namelessEntities: NamelessEntity[], typeChecker: ts.TypeChecker, root: ModelRoot){
	const it= visitor.it();
	var currentNode: ModelNode, nodeName: string;
	var meta: GetNodeMatadataReturn;
	var nodeType: ts.Type;
	var nodeSymbol: ts.Symbol | undefined;
	var {children: entities, mapChilds: mapEntities}= root;
	var fieldName: string;
	while(true){
		var item= it.next();
		if(item.done) break; 
		var {node, parentDescriptor: pDesc, isInput, fileName, importTokens, generics}= item.value;
		nodeType = typeChecker.getTypeAtLocation(node);
		nodeSymbol = nodeType.getSymbol();
		switch(node.kind){
			case ts.SyntaxKind.SyntaxList:
				visitor.push(node.getChildren(), pDesc, isInput, fileName, importTokens, generics);
				break;
			case ts.SyntaxKind.ImportDeclaration:
				//* Import declarations
				if ((node as ts.ImportDeclaration).moduleSpecifier.getText() === PACKAGE_NAME) {
					(node as ts.ImportDeclaration).importClause?.namedBindings?.forEachChild(n=>{
						if(ts.isImportSpecifier(n)){
							let key= (n.propertyName??n.name).getText();
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
				if (node.getFirstToken()?.kind !== ts.SyntaxKind.ExportKeyword) continue;
				meta= _getNodeMetadata(node, nodeSymbol, typeChecker, importTokens);
				// Get entity name
				nodeName= (node as any).name?.getText();
				let hasResolvers = false;
				if (ts.isClassDeclaration(node) && node.heritageClauses){
					hasResolvers= node.heritageClauses.some(
						n=>n.types.some(function(t){
							var txt= t.expression.getText();
							if(txt===importTokens.ResolversOf){
								isInput= false;
								nodeName= t.typeArguments![0].getText();
								return true;
							} else if(txt=== importTokens.InputResolversOf){
								isInput= true;
								nodeName= t.typeArguments![0].getText();
								return true;
							}
						})
					);
				}
				// if ignore
				if(meta.ignore || !(hasResolvers || pDesc || meta.tsModel)) continue;
				// get entity
				if(nodeName && (currentNode= mapEntities[nodeName])){
					if(currentNode.kind!==ModelKind.PLAIN_OBJECT)
						throw new Error(`Enexpected PLAIN_OBJECT as ${ModelKind[currentNode.kind]} at ${fileName}`);
				}else{
					currentNode= {
						name:		nodeName,
						kind:		ModelKind.PLAIN_OBJECT,
						jsDoc:		meta.jsDoc,
						directives:	meta.directives,
						children:	[],
						mapChilds:	{},
						isClass:	nodeType.isClass()
					};
					if(nodeName){
						mapEntities[nodeName]= currentNode;
						entities.push(currentNode);
					}
				}
				// Go through fields
				nodeType.getProperties().forEach(function({valueDeclaration}){
					if(valueDeclaration)
						visitor.push(valueDeclaration, currentNode, isInput, fileName, importTokens, generics);
				});
				break;
			case ts.SyntaxKind.PropertyDeclaration:
			case ts.SyntaxKind.PropertySignature:
				//* Property declaration
				if(!pDesc) continue;
				meta= _getNodeMetadata(node, nodeSymbol,typeChecker, importTokens);
				if(meta.ignore) continue;
				if (pDesc.kind !== ModelKind.PLAIN_OBJECT)
					throw new Error(`Expected parent as Plain object. Got ${ModelKind[pDesc.kind]} at ${fileName}::${node.getText()}`);
				// Current node
				fieldName= (node as ts.PropertySignature).name.getText();
				if(pDesc.mapChilds[fieldName])
					throw new Error(`Duplicate field ${fieldName} at ${fileName}::${node.getText()}`);
				currentNode = {
					kind:		ModelKind.FIELD,
					name:		fieldName,
					jsDoc:		meta.jsDoc,
					directives:	meta.directives,
					required:	!(node as ts.PropertySignature).questionToken,
					children:	[],
					resolver:	undefined,
					input:		undefined
				};
				// Push to parent
				pDesc.children.push(pDesc.mapChilds[fieldName]= currentNode);
				// Go through childs
				visitor.push(node.getChildren(), currentNode, isInput, fileName, importTokens, generics);
				break;
			case ts.SyntaxKind.MethodDeclaration:
				//* Method declaration
				if(!pDesc) continue;
				if(!nodeSymbol) throw new Error(`Expected method symbol at ${fileName}::${node.getText()}`);
				meta= _getNodeMetadata(node, nodeSymbol,typeChecker, importTokens);
				if(meta.ignore) continue;
				if (pDesc.kind !== ModelKind.PLAIN_OBJECT)
					throw new Error(`Expected parent as Plain object. Got ${ModelKind[pDesc.kind]} at ${fileName}::${node.getText()}`);
				// Current node
				fieldName= (node as ts.MethodDeclaration).name.getText();
				if(pDesc.mapChilds[fieldName])
					throw new Error(`Duplicate field ${fieldName} at ${fileName}::${node.getText()}`);
				// resolver
				let resolverMethod: ObjectField['resolver']= undefined;
				let inputResolver: ObjectField['input']= undefined;
				if(isInput){
					inputResolver= typeChecker.getFullyQualifiedName(nodeSymbol);
					// inputResolver= `${parentDescriptor.oName??parentDescriptor.name}.prototype.${fieldName}`;
				} else {
					resolverMethod= {
						kind:		ModelKind.METHOD,
						name:		fieldName,
						jsDoc:		meta.jsDoc,
						directives:	meta.directives,
						// method:		node as ts.MethodDeclaration,
						method:		typeChecker.getFullyQualifiedName(nodeSymbol),
						// method: `${parentDescriptor.oName??parentDescriptor.name}.prototype.${fieldName}`,
						/** [ResultType, ParamType] */
						children:	[undefined, undefined],
					};
				}
				// Current node
				currentNode = {
					kind:		ModelKind.FIELD,
					name:		fieldName,
					jsDoc:		meta.jsDoc,
					directives:	meta.directives,
					required:	!(node as ts.MethodDeclaration).questionToken,
					children:	[],
					resolver:	resolverMethod,
					input:		inputResolver
				};
				// Add to parent
				pDesc.children.push(pDesc.mapChilds[fieldName!] = currentNode);
				// Go through childs
				visitor.push(node.getChildren(), currentNode, isInput, fileName, importTokens, generics);
				// Go through arg param
				if(!isInput){
					let params = (node as ts.MethodDeclaration).parameters;
					if (params && params[1])
						visitor.push(params[1], resolverMethod, isInput, fileName, importTokens, generics);
				}
				break;
			case ts.SyntaxKind.EnumDeclaration:
				//* Enumeration
				//  Skip entities without "Export" keyword
				if (node.getFirstToken()?.kind !== ts.SyntaxKind.ExportKeyword) continue;
				meta= _getNodeMetadata(node, nodeSymbol, typeChecker, importTokens);
				if(meta.ignore || !(pDesc || meta.tsModel)) continue;
				nodeName= (node as ts.EnumDeclaration).name.getText();
				// get entity
				if(nodeName && (currentNode= mapEntities[nodeName])){
					if(currentNode.kind!==ModelKind.ENUM)
						throw new Error(`Enexpected ENUM as ${ModelKind[currentNode.kind]} at ${fileName}`);
				} else {
					currentNode= {
						name:		nodeName,
						kind:		ModelKind.ENUM,
						jsDoc:		meta.jsDoc,
						directives:	meta.directives,
						children:	[],
						mapChilds:	{}
					};
					if(nodeName){
						mapEntities[nodeName]= currentNode;
						entities.push(currentNode);
					}
				}
				// Go through fields
				visitor.push(node.getChildren(), currentNode, isInput, fileName, importTokens, generics);
				break;
			case ts.SyntaxKind.VariableStatement:
				//* Scalars
				//  Skip entities without "Export" keyword
				if (node.getFirstToken()?.kind !== ts.SyntaxKind.ExportKeyword) continue;
				console.log('--- compile Scalar');
				//TODO
				break;
			case ts.SyntaxKind.TypeLiteral:
				//* Type literal are equivalent to nameless classes
				if(!pDesc || pDesc.kind!== ModelKind.FIELD) continue;
				currentNode={
					name:		undefined,
					kind:		ModelKind.PLAIN_OBJECT,
					jsDoc:		undefined,
					directives:	undefined,
					children:	[],
					mapChilds:	{},
					isClass:	false
				};
				let ref: ModelRefNode={
					kind: ModelKind.REF,
					name: undefined,
					jsDoc: undefined,
					directives: undefined
				};
				namelessEntities.push({
					name:	pDesc.name,
					node:	currentNode,
					ref:	ref
				});
				pDesc.children.push(ref);
				// Go through fields
				nodeType.getProperties().forEach(function({valueDeclaration}){
					if(valueDeclaration)
						visitor.push(valueDeclaration, currentNode, isInput, fileName, importTokens, generics);
				});
		}
	}
}

/** Get field or entity informations */
function _getNodeMetadata(node: ts.Node, nodeSymbol: ts.Symbol | undefined, typeChecker: ts.TypeChecker, importTokens: ImportTokens){
	const result: GetNodeMatadataReturn= {
		ignore:		false,
		tsModel:	false,
		directives: undefined,
		jsDoc:		undefined
	}
	var a: any;
	var i, len;
	// Ignore field if has "private" or "protected" keywords
	if(node.modifiers?.some(({kind})=> kind===ts.SyntaxKind.PrivateKeyword || kind===ts.SyntaxKind.ProtectedKeyword))
		return result;
	// Load jsDoc tags
	var directives= [];
	var jsDoc: string[]= [];
	if(nodeSymbol){
		jsDoc= (a= nodeSymbol.getDocumentationComment(typeChecker)) ? (a as ts.SymbolDisplayPart[]).map(e=> e.text) : [];
		let jsDocTags= nodeSymbol.getJsDocTags();
		if(jsDocTags){
			for(i=0, len= jsDocTags.length; i<len; ++i){
				let tag= jsDocTags[i];
				let tagName= tag.name;
				if(tagName==null) continue;
				switch(tagName){
					case importTokens.assert:
						// FIXME check using multiple lines for jsdoc tag
						directives.push(tag.text? `${tagName}(${tag.text.map(e=> e.text).join(', ')})` : tagName);
						break;
					case importTokens.tsModel:
						result.tsModel= true;
						break;
					case importTokens.ignore:
						result.ignore= true;
						break;
				}
			}
		}
	} else {
		jsDoc= [];
	}
	// load decorators
	if(node.decorators){
		let decos= node.decorators;
		for(i=0, len= decos.length; i<len; ++i){
			let expression= decos[i].expression;
			console.log('---- deco: ', ts.SyntaxKind[expression.kind], '::', expression.getText());
		}
	}
	if(directives.length){
		result.directives= directives;
		jsDoc.push(...directives.map(n=> `@${n}`));
	}
	result.jsDoc= jsDoc.join("\n");
	console.log('-----', result.jsDoc)
	return result;
}
interface GetNodeMatadataReturn{
	ignore: boolean
	tsModel: boolean
	directives: ModelBaseNode['directives'],
	jsDoc:	string|undefined
}

/** Nameless entities */
interface NamelessEntity{
	name:	string|undefined
	node:	ModelObjectNode
	ref:	ModelRefNode
};