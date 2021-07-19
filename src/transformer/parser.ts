import { ImportTokens, ModelBaseNode, ModelKind, ModelNode, ModelRoot, ObjectField, ModelObjectNode, ModelRefNode, ModelPromiseNode, ModelNodeWithChilds } from "@src/schema/model";
import ts from "typescript";
import Glob from 'glob';
import { PACKAGE_NAME } from "@src/config";
import { Visitor } from "@src/utils/utils";
import { resolve } from "path";
import { DEFAULT_SCALARS } from "@src/schema/types";
import { AssertOptions } from "@src/model/decorators";

/** Parse Model from files */
export function ParseModelFrom(pathPattern:string, compilerOptions: ts.CompilerOptions): ModelRoot{
	/** Root node */
	const root: ModelRoot= {
		kind: ModelKind.ROOT,
		name: undefined,
		jsDoc: undefined,
		children: [],
		mapChilds: {}
	}
	const mapEntities= root.mapChilds;
	const result: ModelRoot= root;
	//* Load files using glob
	const files= Glob.sync(pathPattern);
	if (files.length === 0){
		console.warn(`No file found for pattern: ${pathPattern}`);
		return result;
	}
	//* Create compiler host
	const pHost= ts.createCompilerHost(compilerOptions, true); 
	//* Create program
	const program= ts.createProgram(files, compilerOptions, pHost);
	const typeChecker= program.getTypeChecker();

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
		visitor.push(srcFile.getChildren(), undefined, false, resolve(srcFile.fileName), importTokens, undefined);
	}
	_parseNode(visitor, typeChecker, root);
	
	// TODO
	// const typeChecker= program.getTypeChecker();
	return result;
}

/** Parse each node */
function _parseNode(visitor:Visitor<ts.Node>, typeChecker: ts.TypeChecker, root: ModelRoot){
	const it= visitor.it();
	var currentNode: ModelNode, nodeName: string;
	var meta: GetNodeMatadataReturn;
	var nodeType: ts.Type;
	var nodeSymbol: ts.Symbol | undefined;
	var {children: entities, mapChilds: mapEntities}= root;
	var fieldName: string;
	var ref: ModelRefNode|ModelPromiseNode;
	var pkind: ModelKind;
	const namelessEntities: NamelessEntity[]= [];
	const referenceMap: Map<string, ts.TypeReferenceNode>= new Map();
	// Go though nodes
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
					required:	!(node as ts.PropertySignature).questionToken,
					children:	[],
					asserts:	[],
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
				let parentNameNode= (node.parent as ts.ClassDeclaration).name;
				if(!parentNameNode) throw new Error(`Expected parent Node at ${fileName} ${node.getText()}`);
				let parentName= parentNameNode.getText();
				if(isInput){
					inputResolver= {
						fileName:	node.getSourceFile().fileName,
						className:	parentName,
						isStatic:	node.modifiers?.some(n=> n.kind===ts.SyntaxKind.StaticKeyword) ?? false,
						name:		fieldName
					};
					// inputResolver= `${parentDescriptor.oName??parentDescriptor.name}.prototype.${fieldName}`;
				} else {
					resolverMethod= {
						kind:		ModelKind.METHOD,
						name:		fieldName,
						jsDoc:		meta.jsDoc,
						// method:		node as ts.MethodDeclaration,
						method:		{
							fileName:	node.getSourceFile().fileName,
							className:	parentName,
							isStatic:	node.modifiers?.some(n=> n.kind===ts.SyntaxKind.StaticKeyword) ?? false,
							name:		fieldName
						},
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
					required:	!(node as ts.MethodDeclaration).questionToken,
					children:	[],
					asserts:	meta.asserts,
					resolver:	resolverMethod,
					input:		inputResolver
				};
				// Add to parent
				pDesc.children.push(pDesc.mapChilds[fieldName!] = currentNode);
				// Go through childs
				visitor.push(node.getChildren(), resolverMethod || currentNode, isInput, fileName, importTokens, generics);
				// Go through arg param
				if(!isInput){
					let params = (node as ts.MethodDeclaration).parameters;
					if (params && params[1])
						visitor.push(params[1], resolverMethod, isInput, fileName, importTokens, generics);
				}
				break;
			case ts.SyntaxKind.Parameter:
				// Method parameter
				if(pDesc==null || pDesc.kind!==ModelKind.METHOD)
					throw new Error(`Expected parent as method. Got ${pDesc?ModelKind[pDesc.kind]: 'nothing'} at ${fileName}::${node.getText()}`);
				currentNode = {
					kind: ModelKind.PARAM,
					name: (node as ts.ParameterDeclaration).name.getText(),
					jsDoc: undefined,
					children: []
				};
				pDesc.children[1] = currentNode;
				// Parse param type
				visitor.push((node as ts.ParameterDeclaration).type, currentNode, isInput, fileName, importTokens, generics);
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
			case ts.SyntaxKind.EnumMember:
				//* Enum member
				if(!pDesc || pDesc.kind!==ModelKind.ENUM)
					throw new Error(`Expected Enum as parent. Got ${pDesc?ModelKind[pDesc.kind]: 'nothing'}`);
				meta= _getNodeMetadata(node, nodeSymbol, typeChecker, importTokens);
				fieldName= (node as ts.EnumMember).name.getText();
				currentNode = {
					kind:		ModelKind.ENUM_MEMBER,
					name:		fieldName,
					jsDoc:		meta.jsDoc,
					required:	true,
					value:		typeChecker.getConstantValue(node as ts.EnumMember)
					// value:		(node as ts.EnumMember).initializer?.getText()
				};
				pDesc.children.push(pDesc.mapChilds[fieldName]=currentNode);
				break;
			case ts.SyntaxKind.TypeAliasDeclaration:
				console.log('----------------------------------------->> TYPE: ', node.getText());
				break;
			case ts.SyntaxKind.VariableStatement:
				//* Scalars
				//  Skip entities without "Export" keyword
				if (node.getFirstToken()?.kind !== ts.SyntaxKind.ExportKeyword) continue;
				meta= _getNodeMetadata(node, nodeSymbol,typeChecker, importTokens);
				if(meta.ignore) continue;
				(node as ts.VariableStatement).declarationList.declarations.forEach(function(n){
					var type= n.type;
					var nodeName= n.name.getText();
					if(type && ts.isTypeReferenceNode(type) && type.typeArguments?.length===1){
						let typeArg= type.typeArguments[0];
						fieldName= typeArg.getText();
						switch(type.typeName.getText()){
							case importTokens.ModelScalar:
								//* Scalar
								if(!ts.isTypeReferenceNode(typeArg))
									throw new Error(`Enexpected scalar name: "${fieldName}" at ${fileName}::${typeArg.getStart()}`);
								if(mapEntities[fieldName])
									throw new Error(`Already defined entity ${fieldName} at ${fileName}: ${typeArg.getStart()}`);
								entities.push(mapEntities[fieldName]={
									kind:		ModelKind.SCALAR,
									name:		fieldName,
									jsDoc:		meta.jsDoc,
									parser:		{
										fileName:	node.getSourceFile().fileName,
										className:	nodeName,
										isStatic:	true,
										name:		undefined
									}
								});
								break;
							case importTokens.UNION:
								//* Union
								if(!ts.isTypeReferenceNode(typeArg))
									throw new Error(`Enexpected UNION name: "${fieldName}" at ${fileName}::${typeArg.getStart()}`);
								if(mapEntities[fieldName])
									throw new Error(`Already defined entity ${fieldName} at ${fileName}: ${typeArg.getStart()}`);
								entities.push(mapEntities[fieldName]={
									kind:		ModelKind.UNION,
									name:		fieldName,
									jsDoc:		meta.jsDoc,
									parser:		{
										fileName:	node.getSourceFile().fileName,
										className:	nodeName,
										isStatic:	true,
										name:		undefined
									}
								});
								break;
						}
					}
				});
				//TODO
				break;
			case ts.SyntaxKind.TypeLiteral:
				//* Type literal are equivalent to nameless classes
				if(!pDesc || pDesc.kind!== ModelKind.FIELD) continue;
				currentNode={
					name:		undefined,
					kind:		ModelKind.PLAIN_OBJECT,
					jsDoc:		undefined,
					children:	[],
					mapChilds:	{},
					isClass:	false
				};
				ref={
					kind: ModelKind.REF,
					name: undefined,
					jsDoc: undefined
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
				break;
			case ts.SyntaxKind.UnionType:
				{
					let tp:ts.TypeNode|undefined= undefined;
					(node as ts.UnionTypeNode).types.forEach(n=>{
						if(n.kind===ts.SyntaxKind.UndefinedKeyword)
							(pDesc as ObjectField).required= false;
						else if(tp)
							throw new Error(`Please give a name to the union "${node.getText()}".`)
						else
							tp= n;
					});
					if(tp) visitor.push(tp, pDesc, isInput, fileName, importTokens, generics);
				}
				break;
			case ts.SyntaxKind.TypeOperator:
				visitor.push((node as ts.TypeOperatorNode).type, pDesc, isInput, fileName, importTokens, generics);
				break;
			case ts.SyntaxKind.TypeReference:
				//* Type reference
				if(!pDesc) continue;
				pkind= pDesc.kind;
				if(pkind!==ModelKind.FIELD && pkind!==ModelKind.LIST && pkind!==ModelKind.METHOD && pkind!==ModelKind.PARAM){
					console.warn(`>> Escaped ${ts.SyntaxKind[node.kind]} at ${node.getStart()}`);
					continue;
				}
				if(nodeSymbol && nodeSymbol.name === 'Promise'){
					ref={
						kind: ModelKind.PROMISE,
						name: undefined,
						jsDoc: undefined,
						children: []
					};
					visitor.push((node as ts.TypeReferenceNode).typeArguments!, ref, isInput, fileName, importTokens, generics);
				} else {
					fieldName= node.getText();
					if(!mapEntities[fieldName] && !referenceMap.has(fieldName)){
						referenceMap.set(fieldName, node as ts.TypeReferenceNode);
					}
				}

				//TODO
				// typeChecker.isImplementationOfOverload(node as ts.TypeReferenceNode)
				// if(fileName === 'Promise'){
				// } else if(nodeSymbol) {
				// 	// Resolve name
				// 	(node as ts.TypeReferenceNode).typeArguments?.forEach
				// 	// ref
				// 	ref={
				// 		kind:		ModelKind.REF,
				// 		name:		fieldName,
				// 		jsDoc:		undefined,
				// 		directives:	undefined
				// 	};

				// 	if ((node as ts.TypeReferenceNode).typeArguments?.length && !mapEntities[fieldName]){} else {

				// 	}
				// }
				
				// pDesc.children[0] = resolveReference(node as ts.TypeReferenceNode, isInput, generics);
				break;
			case ts.SyntaxKind.StringKeyword:
			case ts.SyntaxKind.BooleanKeyword:
			case ts.SyntaxKind.NumberKeyword:
			case ts.SyntaxKind.SymbolKeyword:
			case ts.SyntaxKind.BigIntKeyword:
				// Predefined scalars
				if(pDesc){
					pkind= pDesc.kind;
					if(pkind!==ModelKind.FIELD && pkind!==ModelKind.LIST && pkind!==ModelKind.METHOD && pkind!==ModelKind.PARAM){
						console.warn(`>> Escaped ${ts.SyntaxKind[node.kind]} at ${node.getStart()}`);
						continue;
					}
					currentNode={
						kind: ModelKind.REF,
						name: node.getText(),
						jsDoc: undefined
					};
					(pDesc as ObjectField).children[0] = currentNode;
				}
				break;
			case ts.SyntaxKind.ArrayType:
				if(pDesc==null) continue;
				pkind= pDesc.kind;
				if(pkind!==ModelKind.FIELD && pkind!==ModelKind.LIST && pkind!==ModelKind.METHOD && pkind!==ModelKind.PARAM){
					console.warn(`>> Escaped ${ts.SyntaxKind[node.kind]} at ${node.getStart()}`);
					continue;
				}
				currentNode = {
					kind:	ModelKind.LIST,
					name:	undefined,
					jsDoc:	undefined,
					children: []
				};
				(pDesc as ModelNodeWithChilds).children[0] = currentNode;
				// Go through childs
				visitor.push((node as ts.ArrayTypeNode).elementType, currentNode, isInput, fileName, importTokens, generics);
				break;
			case ts.SyntaxKind.TupleType:
				// Type type
				throw new Error(`Tuples are insupported, did you mean Array of type? at ${fileName}::${node.getText()}`);
				break;
		}
	}

	//* Add default scalars
	var i: number, len: number;
	for(i=0, len=  DEFAULT_SCALARS.length; i<len; ++i){
		fieldName= DEFAULT_SCALARS[i];
		if(!mapEntities.hasOwnProperty(fieldName)){
			entities.push(mapEntities[fieldName]= {
				kind: ModelKind.BASIC_SCALAR,
				name: fieldName,
				jsDoc: undefined
			});
		}
	}

	//* Resolve references
	referenceMap.forEach(function(node, nodeName){
		// if((node as ts.TypeReferenceNode).typeArguments){}
		// fieldName= nodeSymbol.name;
		console.log('Resolve reference >>', node.getText());
		if(!mapEntities.hasOwnProperty(nodeName)) {
			console.log('----------- define ------------')
			var nodeType= typeChecker.getTypeFromTypeNode(node);
			nodeType.getProperties().forEach(function(p){
				var t= typeChecker.getTypeOfSymbolAtLocation(p, p.valueDeclaration!);
				//FIXME here -------------------------
				// (p.declarations as ts.TypeReferenceNode).typeName.getText();
				console.log('---', p.name)
				console.log('::',typeChecker.typeToString(t))
			});
		}
	});
	
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
}

/** Get field or entity informations */
function _getNodeMetadata(node: ts.Node, nodeSymbol: ts.Symbol | undefined, typeChecker: ts.TypeChecker, importTokens: ImportTokens){
	const result: GetNodeMatadataReturn= {
		ignore:		false,
		tsModel:	false,
		jsDoc:		undefined,
		asserts:	undefined
	}
	var a: any;
	var i, len;
	// Ignore field if has "private" or "protected" keywords
	if(node.modifiers?.some(({kind})=>
		kind===ts.SyntaxKind.PrivateKeyword
		|| kind===ts.SyntaxKind.ProtectedKeyword
		|| kind===ts.SyntaxKind.AbstractKeyword
	))
		return result;
	// Load jsDoc tags
	var directives= [];
	var jsDoc: string[]= [];
	var assertTxt: string;
	const asserts: string[]= [];
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
						if(tag.text){
							assertTxt= tag.text.map(e=> e.text).join(', ');
							directives.push(tag.text? `${tagName}(${assertTxt})` : tagName);
							asserts.push(`[${assertTxt}]`);
						}
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
		let decoExp: ts.CallExpression;
		for(i=0, len= decos.length; i<len; ++i){
			decoExp= decos[i].expression as ts.CallExpression;
			directives.push(decoExp.getText());
			if(decoExp.expression.getText()===importTokens.assert){
				asserts.push(`[${decoExp.arguments.map(a=> a.getText()).join(',')}]`)
			}
		}
	}
	if(directives.length){
		jsDoc.push(...directives.map(n=> `@${n}`));
	}
	result.jsDoc= jsDoc.join("\n");
	// Compile asserts
	if(asserts.length){
		let assertObj= result.asserts= {};
		try{
			Object.assign(assertObj, ...asserts.map(e=> JSON.parse(e)[0]));
		}catch(err){
			throw new Error(`Fail to parse assert arguments at ${node.getSourceFile().fileName}\n${asserts.join("\n")}\n${err?.stack}`);
		}
	}
	// Return
	return result;
}
interface GetNodeMatadataReturn{
	ignore: boolean
	tsModel: boolean
	jsDoc:	string|undefined
	asserts: AssertOptions|undefined
}

/** Nameless entities */
interface NamelessEntity{
	name:	string|undefined
	node:	ModelObjectNode
	ref:	ModelRefNode
};

