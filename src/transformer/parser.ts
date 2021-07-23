import { ModelKind, ModelNode, ModelRoot, ObjectField, ModelObjectNode, ModelRefNode, ModelNodeWithChilds } from "@src/schema/model";
import ts from "typescript";
import Glob from 'glob';
import { Visitor } from "@src/utils/utils";
import { DEFAULT_SCALARS } from "@src/schema/types";
import { AssertOptions } from "@src/model/decorators";
import JSON5 from 'json5';
const {parse: parseJSON}= JSON5;

/** Parse Model from files */
export function ParseModelFrom(pathPattern:string, compilerOptions: ts.CompilerOptions): ModelRoot{
	/** Root node */
	const root: ModelRoot= {
		kind: ModelKind.ROOT,
		name: undefined,
		jsDoc: undefined,
		deprecated: undefined,
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
	const namelessEntities: NamelessEntity[]= [];
	const referenceMap: Map<string, ts.TypeReferenceNode>= new Map();

	//* Step 1: parse AST
	const visitor= new Visitor<ts.Node>();
	const refVisitor= new Visitor<ts.Node>()
	var i:number, len: number, srcFiles= program.getSourceFiles(), srcFile: ts.SourceFile;
	for(i=0, len=srcFiles.length; i<len; ++i){
		srcFile= srcFiles[i];
		if(srcFile.isDeclarationFile) continue;
		// Push to iterator
		visitor.push(srcFile.getChildren(), undefined, false, undefined);
	}
	_parseNode(visitor, refVisitor, typeChecker, root, true, namelessEntities);
	
	//* Add default scalars
	var i: number, len: number, fieldName;
	const entities= root.children;
	for(i=0, len=  DEFAULT_SCALARS.length; i<len; ++i){
		fieldName= DEFAULT_SCALARS[i];
		if(!mapEntities.hasOwnProperty(fieldName)){
			entities.push(mapEntities[fieldName]= {
				kind: ModelKind.BASIC_SCALAR,
				name: fieldName,
				jsDoc: undefined,
				deprecated: undefined
			});
		}
	}

	//* Resolve references
	_parseNode(refVisitor, refVisitor, typeChecker, root, true, namelessEntities);

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
	return result;
}

/** Parse each node */
function _parseNode(
		visitor:Visitor<ts.Node>,
		refVisitor: Visitor<ts.Node>,
		typeChecker: ts.TypeChecker,
		root: ModelRoot,
		exportRequired: boolean,
		namelessEntities: NamelessEntity[]
	){
	const it= visitor.it();
	var currentNode: ModelNode, nodeName: string;
	var meta: GetNodeMatadataReturn;
	var nodeType: ts.Type;
	var {children: entities, mapChilds: mapEntities}= root;
	var fieldName: string;
	var ref: ModelRefNode;
	var pkind: ModelKind;
	// Go though nodes
	while(true){
		var item= it.next();
		if(item.done) break; 
		var {node, parentDescriptor: pDesc, isInput, generics}= item.value;
		var fileName= node.getSourceFile().fileName;
		nodeType = typeChecker.getTypeAtLocation(node);
		switch(node.kind){
			case ts.SyntaxKind.SyntaxList:
				visitor.push(node.getChildren(), pDesc, isInput, generics);
				break;
			case ts.SyntaxKind.InterfaceDeclaration:
			case ts.SyntaxKind.ClassDeclaration:
				//* Class or Interface entity
				//  Skip entities without "Export" keyword
				if(exportRequired && !((node as ts.ClassDeclaration).modifiers?.some(e=> e.kind=== ts.SyntaxKind.ExportKeyword)))
					continue;
				meta= _getNodeMetadata(node, typeChecker);
				// Get entity name
				nodeName= (node as any).name?.getText();
				let hasResolvers = false;
				if (ts.isClassDeclaration(node) && node.heritageClauses){
					hasResolvers= node.heritageClauses.some(
						n=>n.types.some(function(t){
							var s= typeChecker.getSymbolAtLocation(t.expression);
							var txt= s?.name;
							if(txt==='ResolversOf'){
								isInput= false;
								nodeName= t.typeArguments![0].getText();
								return true;
							} else if(txt=== 'InputResolversOf'){
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
						deprecated: meta.deprecated,
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
						visitor.push(valueDeclaration, currentNode, isInput, generics);
				});
				break;
			case ts.SyntaxKind.PropertyDeclaration:
			case ts.SyntaxKind.PropertySignature:
				//* Property declaration
				if(!pDesc) continue;
				(node as ts.PropertySignature)
				meta= _getNodeMetadata(node, typeChecker);
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
					deprecated: meta.deprecated,
					defaultValue: meta.defaultValue,
					asserts:	meta.asserts,
					resolver:	undefined,
					input:		undefined
				};
				// Push to parent
				pDesc.children.push(pDesc.mapChilds[fieldName]= currentNode);
				// Go through childs
				visitor.push(node.getChildren(), currentNode, isInput, generics);
				break;
			case ts.SyntaxKind.MethodDeclaration:
				//* Method declaration
				if(!pDesc) continue;
				meta= _getNodeMetadata(node, typeChecker);
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
						jsDoc:		undefined,
						deprecated: undefined,
						// method:		node as ts.MethodDeclaration,
						method:		{
							fileName:	node.getSourceFile().fileName,
							className:	parentName,
							isStatic:	node.modifiers?.some(n=> n.kind===ts.SyntaxKind.StaticKeyword) ?? false,
							name:		fieldName
						},
						// method: `${parentDescriptor.oName??parentDescriptor.name}.prototype.${fieldName}`,
						/** [ResultType, ParamType] */
						children:	[undefined, undefined]
					};
				}
				// Current node
				currentNode = {
					kind:		ModelKind.FIELD,
					name:		fieldName,
					jsDoc:		meta.jsDoc,
					deprecated: meta.deprecated,
					required:	!(node as ts.MethodDeclaration).questionToken,
					children:	[],
					defaultValue: meta.defaultValue,
					asserts:	meta.asserts,
					resolver:	resolverMethod,
					input:		inputResolver
				};
				// Add to parent
				pDesc.children.push(pDesc.mapChilds[fieldName!] = currentNode);
				// Go through arg param
				if(!isInput){
					let params = (node as ts.MethodDeclaration).parameters;
					if (params && params[1])
						visitor.push(params[1], resolverMethod, isInput, generics);
				}
				// Go through results
				visitor.push((node as ts.MethodDeclaration).type , resolverMethod || currentNode, isInput, generics);
				break;
			case ts.SyntaxKind.Parameter:
				// Method parameter
				if(pDesc==null || pDesc.kind!==ModelKind.METHOD)
					throw new Error(`Expected parent as method. Got ${pDesc?ModelKind[pDesc.kind]: 'nothing'} at ${fileName}::${node.getText()}`);
				currentNode = {
					kind: ModelKind.PARAM,
					name: (node as ts.ParameterDeclaration).name.getText(),
					jsDoc: undefined,
					deprecated: undefined,
					children: []
				};
				pDesc.children[1] = currentNode;
				// Parse param type
				visitor.push((node as ts.ParameterDeclaration).type, currentNode, isInput, generics);
				break;
			case ts.SyntaxKind.EnumDeclaration:
				//* Enumeration
				//  Skip entities without "Export" keyword
				if(exportRequired && !((node as ts.EnumDeclaration).modifiers?.some(e=> e.kind=== ts.SyntaxKind.ExportKeyword)))
					continue;
				meta= _getNodeMetadata(node, typeChecker);
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
						deprecated: meta.deprecated,
						children:	[],
						mapChilds:	{}
					};
					if(nodeName){
						mapEntities[nodeName]= currentNode;
						entities.push(currentNode);
					}
				}
				// Go through fields
				visitor.push(node.getChildren(), currentNode, isInput, generics);
				break;
			case ts.SyntaxKind.EnumMember:
				//* Enum member
				if(!pDesc || pDesc.kind!==ModelKind.ENUM)
					throw new Error(`Expected Enum as parent. Got ${pDesc?ModelKind[pDesc.kind]: 'nothing'}`);
				meta= _getNodeMetadata(node, typeChecker);
				fieldName= (node as ts.EnumMember).name.getText();
				currentNode = {
					kind:		ModelKind.ENUM_MEMBER,
					name:		fieldName,
					jsDoc:		meta.jsDoc,
					deprecated: meta.deprecated,
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
				if(exportRequired && !((node as ts.VariableDeclaration).modifiers?.some(e=> e.kind=== ts.SyntaxKind.ExportKeyword)))
					continue;
				meta= _getNodeMetadata(node, typeChecker);
				if(meta.ignore) continue;
				(node as ts.VariableStatement).declarationList.declarations.forEach(function(n){
					var type= n.type;
					var nodeName= n.name.getText();
					if(type && ts.isTypeReferenceNode(type) && type.typeArguments?.length===1){
						let typeArg= type.typeArguments[0];
						fieldName= typeArg.getText();
						let s= typeChecker.getSymbolAtLocation(type.typeName);
						if(s){
							switch(s.name){
								case 'ModelScalar':
									//* Scalar
									if(!ts.isTypeReferenceNode(typeArg))
										throw new Error(`Enexpected scalar name: "${fieldName}" at ${fileName}::${typeArg.getStart()}`);
									if(mapEntities[fieldName])
										throw new Error(`Already defined entity ${fieldName} at ${fileName}: ${typeArg.getStart()}`);
									entities.push(mapEntities[fieldName]={
										kind:		ModelKind.SCALAR,
										name:		fieldName,
										jsDoc:		meta.jsDoc,
										deprecated: meta.deprecated,
										parser:		{
											fileName:	node.getSourceFile().fileName,
											className:	nodeName,
											isStatic:	true,
											name:		undefined
										}
									});
									break;
								case 'UNION':
									//* Union
									if(!ts.isTypeReferenceNode(typeArg))
										throw new Error(`Enexpected UNION name: "${fieldName}" at ${fileName}::${typeArg.getStart()}`);
									if(mapEntities[fieldName])
										throw new Error(`Already defined entity ${fieldName} at ${fileName}: ${typeArg.getStart()}`);
									currentNode= {
										kind:		ModelKind.UNION,
										name:		fieldName,
										jsDoc:		meta.jsDoc,
										deprecated: meta.deprecated,
										children:	[],
										parser:		{
											fileName:	node.getSourceFile().fileName,
											className:	nodeName,
											isStatic:	true,
											name:		undefined
										}
									};
									entities.push(mapEntities[fieldName]= currentNode);
									// Parse members
									const typeTypeArg= typeChecker.getTypeAtLocation(typeArg);
									typeTypeArg.getBaseTypes()?.forEach(t=>{
										console.log('UNION: ', t.symbol.name);
									});
									break;
							}
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
					deprecated: undefined,
					children:	[],
					mapChilds:	{},
					isClass:	false
				};
				ref={
					kind: ModelKind.REF,
					name: undefined,
					jsDoc: undefined,
					deprecated: undefined
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
						visitor.push(valueDeclaration, currentNode, isInput, generics);
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
					if(tp) visitor.push(tp, pDesc, isInput, generics);
				}
				break;
			case ts.SyntaxKind.TypeOperator:
				visitor.push((node as ts.TypeOperatorNode).type, pDesc, isInput, generics);
				break;
			case ts.SyntaxKind.TypeReference:
				//* Type reference
				if(!pDesc) continue;
				pkind= pDesc.kind;
				if(
					pkind!==ModelKind.FIELD
					&& pkind!==ModelKind.LIST
					&& pkind!==ModelKind.METHOD
					&& pkind!==ModelKind.PARAM
				){
					console.warn(`>> Escaped ${ts.SyntaxKind[node.kind]} from parent ${ModelKind[pkind]}: ${node.parent.getText()} at ${fileName}`);
					continue;
				}
				if(nodeType.getSymbol()?.name === 'Promise'){
					// currentNode={
					// 	kind: ModelKind.PROMISE,
					// 	name: undefined,
					// 	jsDoc: undefined,
					// 	children: []
					// };
					// (pDesc as ObjectField).children.push(currentNode);
					visitor.push((node as ts.TypeReferenceNode).typeArguments!, pDesc, isInput, generics);
				} else if(visitor === refVisitor) {
					// Add reference
					let targetRef= (node as ts.TypeReferenceNode);
					let refName= targetRef.typeName.getText();
					if(generics?.has(refName)){
						targetRef = generics.get(refName)!;
						refName= targetRef.typeName.getText();
						if(targetRef.typeArguments?.length)
							nodeName= `${refName}<${targetRef.typeArguments.map(e=>{
								let t= e.getText();
								return generics?.get(t)?.typeName.getText() ?? t;
							}).join(',')}>`;
						else
							nodeName= refName;
					} else {
						nodeName= targetRef.getText();
					}
					(pDesc as ObjectField).children[0]= {
						kind: ModelKind.REF,
						name: nodeName,
						jsDoc: undefined,
						deprecated: undefined
					};
		
					if(mapEntities[nodeName]==null){
						// TODO add jsDoc resolver
						let refType= typeChecker.getTypeAtLocation(targetRef);
						let properties= refType.getProperties();
						if(!properties.length)
							throw new Error(`Generic type "${targetRef.getText()}" has no fields! at ${node.getSourceFile().fileName}`);
						// node
						currentNode={
							kind: ModelKind.PLAIN_OBJECT,
							name: nodeName,
							jsDoc: undefined,
							deprecated: undefined,
							children: [],
							mapChilds: {},
							isClass: true
						};
						entities.push(mapEntities[nodeName]= currentNode);
						
						// resolve generics
						if((node as ts.TypeReferenceNode).typeArguments?.length){
							generics= new Map(generics!);
							let refType= typeChecker.getTypeAtLocation(targetRef);
							let s= refType.symbol.declarations?.[0]
							if(!s)
								throw new Error(`Fail to find declaration for ${targetRef.getText()} at ${node.getSourceFile().fileName}`);
							let nodeArgs= (node as ts.TypeReferenceNode).typeArguments!;
							let targetArgs= (s as ts.InterfaceDeclaration).typeParameters!
							for(let i=0, len= nodeArgs.length; i<len; ++i){
								let ref= nodeArgs[i] as ts.TypeReferenceNode;
								let tParam= targetArgs[i].name.getText();
								generics.set(tParam, generics?.get(ref.getText())??ref)
							}
						}
						properties.forEach(e=>{
							if(e.valueDeclaration)
								refVisitor.push(e.valueDeclaration, currentNode, false, generics);
						})
					}
				} else {
					refVisitor.push(node, pDesc, isInput, generics);
				}
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
						console.warn(`>> Escaped ${ts.SyntaxKind[node.kind]} from parent ${ModelKind[pkind]}: ${node.parent.getText()} at ${fileName}`);
						continue;
					}
					currentNode={
						kind: ModelKind.REF,
						name: node.getText(),
						jsDoc: undefined,
						deprecated: undefined
					};
					(pDesc as ObjectField).children[0] = currentNode;
				}
				break;
			case ts.SyntaxKind.ArrayType:
				if(pDesc==null) continue;
				pkind= pDesc.kind;
				if(pkind!==ModelKind.FIELD && pkind!==ModelKind.LIST && pkind!==ModelKind.METHOD && pkind!==ModelKind.PARAM){
					console.warn(`>> Escaped ${ts.SyntaxKind[node.kind]} from parent ${ModelKind[pkind]}: ${node.parent.getText()} at ${fileName}`);
					continue;
				}
				currentNode = {
					kind:	ModelKind.LIST,
					name:	undefined,
					jsDoc:	undefined,
					deprecated: undefined,
					children: []
				};
				(pDesc as ModelNodeWithChilds).children[0] = currentNode;
				// Go through childs
				visitor.push((node as ts.ArrayTypeNode).elementType, currentNode, isInput, generics);
				break;
			case ts.SyntaxKind.TupleType:
				// Type type
				throw new Error(`Tuples are insupported, did you mean Array of type? at ${fileName}::${node.getText()}`);
				break;
		}
	}
}

/** Get field or entity informations */
function _getNodeMetadata(node: ts.Node, typeChecker: ts.TypeChecker){
	const result: GetNodeMatadataReturn= {
		ignore:		false,
		tsModel:	false,
		jsDoc:		undefined,
		defaultValue: undefined,
		deprecated: undefined,
		asserts:	undefined
	}
	//TODO add default value
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
	var jsDoc: string[];
	var assertTxt: string;
	const asserts: string[]= [];
	// JSDOC
	jsDoc= typeChecker.getTypeAtLocation(node).symbol?.getDocumentationComment(typeChecker).map(e=> e.text) ?? [];
	let jsDocTags= ts.getJSDocTags(node);
	if(jsDocTags.length){
		for(i=0, len= jsDocTags.length; i<len; ++i){
			let tag= jsDocTags[i];
			let tagName= tag.tagName.getText();
			switch(tagName){
				case 'assert':
					let tagText= tag.comment;
					if(Array.isArray(tagText))
						tagText= tagText.map((l: ts.JSDocText)=> l.text).join(', ');
					// FIXME check using multiple lines for jsdoc tag
					if(tagText){
						directives.push(tagText? `${tagName}(${tagText})` : tagName);
						asserts.push(`[${tagText}]`);
					}
					break;
				case 'tsModel':
					result.tsModel= true;
					break;
				case 'ignore':
					result.ignore= true;
					break;
				case 'deprecated':
					tagText= tag.comment;
					if(Array.isArray(tagText))
						tagText= tagText.map((l: ts.JSDocText)=> l.text).join("\n");
					result.deprecated= `${tagText}`;
					break;
			}
		}
	}
	// load decorators
	if(node.decorators){
		let decos= node.decorators;
		let decoExp: ts.CallExpression;
		for(i=0, len= decos.length; i<len; ++i){
			decoExp= decos[i].expression as ts.CallExpression;
			directives.push(decoExp.getText());
			let s= typeChecker.getSymbolAtLocation(decoExp) ?? typeChecker.getSymbolAtLocation(decoExp.expression);
			switch(s?.name){
				case 'assert':
					asserts.push(`[${decoExp.arguments.map(a => a.getText()).join(',')}]`);
					break;
				case 'tsModel':
					result.tsModel= true;
					break;
				case 'ignore':
					result.ignore= true;
					break;
				case 'deprecated':
					result.deprecated= decoExp.arguments.map(a => a.getText()).join(',');
					break;
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
			Object.assign(assertObj, ...asserts.map(e=> parseJSON(e)[0]));
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
	deprecated: string|undefined
	defaultValue: any
	asserts: AssertOptions|undefined
}

/** Nameless entities */
interface NamelessEntity{
	name:	string|undefined
	node:	ModelObjectNode
	ref:	ModelRefNode
};

