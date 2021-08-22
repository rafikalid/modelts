import { Visitor } from "@src/utils/visitor";
import Glob from "glob";
import ts from "typescript";
import { AllNodes, AssertOptions, BasicScalar, Enum, EnumMember, Field, FieldType, InputField, List, MethodDescriptor, ModelKind, Node, ObjectLiteral, OutputField, Param, Reference, Scalar, TypeNode, Union } from "./model";
import { DEFAULT_SCALARS } from "./types";
import JSON5 from 'json5';
const {parse: parseJSON}= JSON5;

/** Parse files */
export function parse(pathPattern:string, compilerOptions: ts.CompilerOptions): Map<string, Node>{
	const ROOT: Map<string, Node>= new Map();
	//* Load files using glob
	const files= Glob.sync(pathPattern);
	if (files.length === 0)
		throw new Error(`Model Parser>> No file found for pattern: ${pathPattern}`);
	//* Create compiler host
	const pHost= ts.createCompilerHost(compilerOptions, true); 
	//* Create program
	const program= ts.createProgram(files, compilerOptions, pHost);
	const typeChecker= program.getTypeChecker();
	//* STEP 1: RESOLVE EVERYTHING WITHOUT INHIRETANCE
	const visitor= new Visitor<ts.Node, AllNodes>();
	var srcFiles= program.getSourceFiles();
	for(let i=0, len=srcFiles.length; i<len; ++i){
		let srcFile= srcFiles[i];
		if(srcFile.isDeclarationFile) continue;
		visitor.push(srcFile.getChildren(), undefined, srcFile);
	}
	const it= visitor.it();
	var nodeName: string|undefined;
	const namelessEntities: NamelessEntity[]= [];
	rootLoop: while(true){
		// get next item
		let item= it.next();
		if(item.done) break;
		let {node, parentDescriptor: pDesc, srcFile, isInput}= item.value;
		let nodeType= typeChecker.getTypeAtLocation(node);
		let nodeSymbol= nodeType.symbol;
		// Node name
		nodeName= (node as ts.ClassDeclaration).name?.getText();
		if(nodeName==null) continue;
		// Flags
		let deprecated: string|undefined= undefined
		let asserts: string[]= [];
		// Extract JSDoc
		let jsDoc= nodeSymbol?.getDocumentationComment(typeChecker).map(e=> e.text) ?? [];
		let jsDocTags= ts.getJSDocTags(node);
		if(jsDocTags.length){
			for(let i=0, len= jsDocTags.length; i<len; ++i){
				let tag= jsDocTags[i];
				jsDoc.push(tag.getText());
				let tagName= tag.tagName.getText();
				let tagText:any;
				switch(tagName){
					case 'ignore':
						// Ignore this Node
						continue rootLoop;
					case 'deprecated':
						tagText= tag.comment;
						if(Array.isArray(tagText))
							tagText= tagText.map((l: ts.JSDocText)=> l.text).join("\n");
						deprecated= tagText.toString();
						break;
					case 'assert':
						tagText= tag.comment;
						if(Array.isArray(tagText))
							tagText= tagText.map((l: ts.JSDocText)=> l.text).join(', ');
						// FIXME check using multiple lines for jsdoc tag
						if(tagText){
							tagText= tagText.trim();
							if(!tagText.startsWith('{')) tagText= `{${tagText}}`;
							asserts.push(tagText);
						}
						break;
				}
			}
		}
		let comment= jsDoc.join("\n") || undefined;
		// Switch type
		switch(node.kind){
			case ts.SyntaxKind.InterfaceDeclaration:
			case ts.SyntaxKind.ClassDeclaration:
				// Check for heritage clause
				let classNode= node as ts.ClassDeclaration;
				classNode.heritageClauses?.forEach(n=> n.types.forEach(function(t){

					// Check for "ResolversOf" and "InputResolversOf"
					var s= typeChecker.getSymbolAtLocation(t.expression);
					var txt= s?.name;
					if(txt==='ResolversOf' || txt==='InputResolversOf'){
						resolverNode= t.typeArguments![0] as ts.TypeReferenceNode;
						isInput= txt==='InputResolversOf';
						return true;
					}
				}));
				break;
			case ts.SyntaxKind.PropertyDeclaration:
				if(pDesc==null) continue;
				if(
					pDesc.kind !== ModelKind.PLAIN_OBJECT
					&& pDesc.kind !== ModelKind.OBJECT_LITERAL
				) continue;
				// Get field
				let pField= pDesc.fields.get(nodeName);
				if(pField==null){
					pField= {
						input:	undefined,
						output:	undefined
					};
					pDesc.fields.set(nodeName, pField);
				}
				if(isInput!==true){
					//* Output field
					let f= pField.output;
					if(f==null){
						f={
							kind:		ModelKind.OUTPUT_FIELD,
							name:		nodeName,
							deprecated:	deprecated,
							jsDoc:		comment,
							required:	!(node as ts.PropertyDeclaration).questionToken,
							// type:		undefined,
							param:		undefined,
							method:		undefined
						} as OutputField;
						pField.output= f;
					} else {
						f.deprecated??= deprecated;
						f.jsDoc??= comment;
					}
					// Resolve type
					visitor.push((node as ts.PropertyDeclaration).initializer, f, srcFile);
				}
				if(isInput!==false){
					//* Input field
					let f= pField.input;
					if(f==null){
						f= {
							kind:			ModelKind.INPUT_FIELD,
							name:			nodeName,
							deprecated:		deprecated,
							jsDoc:			comment,
							required:		!(node as ts.PropertyDeclaration).questionToken,
							asserts:		_compileAsserts(asserts, undefined, srcFile),
							// TODO add default value
							defaultValue:	undefined,
							validate:		undefined
						} as InputField;
						pField.input= f;
					} else {
						f.deprecated ??= deprecated;
						f.jsDoc??= comment;
						f.asserts= _compileAsserts(asserts, f.asserts, srcFile)
					}
					visitor.push((node as ts.PropertyDeclaration).initializer, f, srcFile);
				}
				break;
			case ts.SyntaxKind.MethodDeclaration:
				if(pDesc==null) continue;
				if(
					pDesc.kind !== ModelKind.PLAIN_OBJECT
					// && pDesc.kind !== ModelKind.OBJECT_LITERAL
				) continue;
				// Get field
				let field= pDesc.fields.get(nodeName);
				if(field==null){
					field= {
						input:	undefined,
						output:	undefined
					};
					pDesc.fields.set(nodeName, field);
				}
				let parentNameNode= (node.parent as ts.ClassDeclaration).name;
				if(parentNameNode==null)
					throw new Error(`Expected a class as parent for "${nodeName}" at ${srcFile.fileName}`);
				let method: MethodDescriptor= {
					fileName:	srcFile.fileName,
					className:	parentNameNode.getText(),
					name:		nodeName,
					isStatic:	node.modifiers?.some(n=> n.kind===ts.SyntaxKind.StaticKeyword) ?? false
				};
				let inpOut: InputField | OutputField | undefined
				if(isInput===true){
					//* Input validator
					inpOut= field.input;
					if(inpOut==null){
						inpOut= {
							kind:			ModelKind.INPUT_FIELD,
							name:			nodeName,
							deprecated:		deprecated,
							jsDoc:			comment,
							required:		!(node as ts.PropertyDeclaration).questionToken,
							asserts:		_compileAsserts(asserts, undefined, srcFile),
							// TODO add default value
							defaultValue:	undefined,
							validate:		method
						} as InputField;
						field.input= inpOut;
					} else {
						inpOut.deprecated ??= deprecated;
						inpOut.jsDoc??= comment;
						inpOut.asserts= _compileAsserts(asserts, inpOut.asserts, srcFile);
						inpOut.validate= method;
					}
				} else {
					//* Output resolver
					inpOut= field.output;
					if(inpOut==null){
						inpOut={
							kind:		ModelKind.OUTPUT_FIELD,
							name:		nodeName,
							deprecated:	deprecated,
							jsDoc:		comment,
							required:	!(node as ts.PropertyDeclaration).questionToken,
							// type:		undefined,
							param:		undefined,
							method:		method
						} as OutputField;
						field.output= inpOut;
					} else {
						inpOut.deprecated??= deprecated;
						inpOut.jsDoc??= comment;
						inpOut.method= method;
					}
					// Resolve parameter
					let params = (node as ts.MethodDeclaration).parameters;
					if (params?.[1]!=null)
						visitor.push(params[1], inpOut, srcFile);
				}
				// Go through results
				visitor.push(
					(node as ts.MethodDeclaration).type
					?? (typeChecker.getReturnTypeOfSignature(typeChecker.getSignatureFromDeclaration(node as ts.MethodDeclaration)!).symbol?.declarations?.[0])
					, inpOut, srcFile);
				break;
			case ts.SyntaxKind.Parameter:
				if(pDesc==null ||  pDesc.kind !== ModelKind.OUTPUT_FIELD )
					throw new Error(`Expected parent as method. Got ${pDesc?ModelKind[pDesc.kind]: 'nothing'} at ${srcFile.fileName}::${node.getText()}`);
				let pRef: Param= {
					kind:		ModelKind.PARAM,
					name:		nodeName,
					deprecated:	deprecated,
					jsDoc:		comment,
				} as Param;
				pDesc.param= pRef;
				// Parse param type
				visitor.push((node as ts.ParameterDeclaration).type, pRef, srcFile);
				break;
			case ts.SyntaxKind.EnumDeclaration:
				let enumNode= node as ts.EnumDeclaration;
				// Check has "export" keyword
				if((enumNode.flags & ts.NodeFlags.ExportContext) === 0){
					console.warn(`PARSER>> Missing "export" keyword on ENUM: ${nodeName}`);
					continue rootLoop;
				}
				// Check for duplicate
				if(ROOT.has(nodeName)) throw new Error(`Duplicate ENUM "${nodeName}" at: ${srcFile.fileName}`);
				let enumEntity: Enum= {
					kind:		ModelKind.ENUM,
					name:		nodeName,
					deprecated:	deprecated,
					jsDoc:		comment,
					members:	[]
				};
				ROOT.set(nodeName, enumEntity);
				visitor.push(node.getChildren(), enumEntity, srcFile);
				break;
			case ts.SyntaxKind.EnumMember:
				//* Enum member
				if(pDesc==null || pDesc.kind!=ModelKind.ENUM) throw new Error(`Enexpected ENUM MEMBER "${nodeName}" at: ${srcFile.fileName}`);
				let enumMember: EnumMember= {
					kind:		ModelKind.ENUM_MEMBER,
					name:		nodeName,
					value:		typeChecker.getConstantValue(node as ts.EnumMember)!,
					deprecated:	deprecated,
					jsDoc:		comment
				}
				pDesc.members.push(enumMember);
				break;
			case ts.SyntaxKind.VariableStatement:
				// SCALARS, UNIONS
				let variableNode= node as ts.VariableStatement;
				let declarations= variableNode.declarationList.declarations;
				for(let i=0, len=declarations.length; i<len; ++i){
					let declaration= declarations[i];
					let type= declaration.type;
					let nodeName= declaration.name.getText();
					// Check for duplicate entity
					let s: ts.Symbol | undefined;
					if(
						type
						&& ts.isTypeReferenceNode(type)
						&& type.typeArguments?.length===1
						&& (s= typeChecker.getSymbolAtLocation(type.typeName))
					){
						let typeArg= type.typeArguments[0];
						let fieldName= typeArg.getText();
						switch(s.name){
							case 'ModelScalar':
								//* Scalar
								if(!ts.isTypeReferenceNode(typeArg))
									throw new Error(`Enexpected scalar name: "${fieldName}" at ${srcFile.fileName}::${typeArg.getStart()}`);
								if(ROOT.has(fieldName))
									throw new Error(`Already defined entity ${fieldName} at ${srcFile.fileName}: ${typeArg.getStart()}`);
								let scalarEntity: Scalar= {
									kind:		ModelKind.SCALAR,
									name:		fieldName,
									deprecated: deprecated,
									jsDoc:		comment,
									parser: {
										fileName:	srcFile.fileName,
										className:  nodeName,
										isStatic:	true,
										name:		undefined
									}
								};
								ROOT.set(fieldName, scalarEntity);
								break;
							case 'UNION':
								//* UNION
								if(!ts.isTypeReferenceNode(typeArg))
									throw new Error(`Enexpected UNION name: "${fieldName}" at ${srcFile.fileName}::${typeArg.getStart()}`);
								if(ROOT.has(fieldName))
									throw new Error(`Already defined entity ${fieldName} at ${srcFile.fileName}: ${typeArg.getStart()}`);
								let unionNode: Union={
									kind:		ModelKind.UNION,
									name:		fieldName,
									deprecated:	deprecated,
									jsDoc:		comment,
									types:		[],
									parser: {
										fileName:	srcFile.fileName,
										className:	nodeName,
										isStatic:	true,
										name:		undefined
									}
								};
								ROOT.set(fieldName, unionNode);
								let unionChilds= unionNode.types;
								// Parse members
								const union= typeChecker.getAliasedSymbol(
									typeChecker.getSymbolAtLocation(typeArg.typeName)!
								)?.declarations?.[0]
								?.getChildren().find(e=> e.kind===ts.SyntaxKind.UnionType);
								if(union==null || !ts.isUnionTypeNode(union))
									throw new Error(`Missing union types for: "${typeArg.getText()}" at ${typeArg.getSourceFile().fileName}`);
								else {
									let unionTypes= union.types;
									for(let k=0, klen= unionTypes.length; k<klen; ++k){
										let unionType= unionTypes[k];
										let dec= typeChecker.getTypeAtLocation(unionType).symbol?.declarations?.[0];
										if(dec==null || !(ts.isInterfaceDeclaration(dec) || ts.isClassDeclaration(dec)))
											throw new Error(`Illegal union type: ${dec?.getText()??typeArg.getText()} at ${typeArg.getSourceFile().fileName}`)
										else {
											let ref: Reference={
												kind:	ModelKind.REF,
												name:	dec.name!.getText(),
												fileName: srcFile.fileName,
												// TODO add support for Generic types in union
												params:		undefined
											};
											unionChilds.push(ref);
										}
									}
								}
								break;
						}
					}
				}
				break;
			case ts.SyntaxKind.TypeLiteral:
				//* Type literal are equivalent to nameless classes
				if(pDesc==null) continue;
				if(
					pDesc.kind !== ModelKind.OUTPUT_FIELD
					&& pDesc.kind !== ModelKind.INPUT_FIELD
					&& pDesc.kind !== ModelKind.LIST
					&& pDesc.kind !== ModelKind.PARAM
				) continue;
				let typeLiteral: ObjectLiteral= {
					kind:		ModelKind.OBJECT_LITERAL,
					deprecated:	deprecated,
					jsDoc:		comment,
					fields:		new Map()
				};
				let typeRef: Reference= {
					kind:		ModelKind.REF,
					name:		'',
					fileName:	srcFile.fileName,
					params:		undefined
				};
				namelessEntities.push({
					name:	(pDesc as OutputField).name,
					node:	typeLiteral,
					ref:	typeRef
				});
				pDesc.type= typeRef;
				// Go through fields
				visitor.push(node.getChildren(), typeLiteral, srcFile);
				break;
			case ts.SyntaxKind.UnionType:
				if(pDesc==null) continue;
				if(
					pDesc.kind !== ModelKind.OUTPUT_FIELD
					&& pDesc.kind !== ModelKind.INPUT_FIELD
					&& pDesc.kind !== ModelKind.LIST
					&& pDesc.kind !== ModelKind.PARAM
				) continue;
				let unionType:ts.TypeNode|undefined= undefined;
				(node as ts.UnionTypeNode).types.forEach(n=>{
					if(n.kind===ts.SyntaxKind.UndefinedKeyword)
						(pDesc as InputField|OutputField).required= false;
					else if(unionType==null)
						unionType= n;
					else
						throw new Error(`Please give a name to the union "${node.getText()}" at: ${srcFile.fileName}`);
				});
				if(unionType!=null)
					visitor.push(unionType, pDesc, srcFile);
				break;
			case ts.SyntaxKind.TypeReference:
				if(pDesc==null) continue;
				if(
					pDesc.kind !== ModelKind.OUTPUT_FIELD
					&& pDesc.kind !== ModelKind.INPUT_FIELD
					&& pDesc.kind !== ModelKind.LIST
					&& pDesc.kind !== ModelKind.REF
					&& pDesc.kind !== ModelKind.PARAM
				) continue;
				// Ignore promise
				if(nodeType.getSymbol()?.name === 'Promise'){
					visitor.push((node as ts.TypeReferenceNode).typeArguments!, pDesc, srcFile);
					continue;
				}
				// Add reference
				let targetRef= (node as ts.TypeReferenceNode);
				let refEnt: Reference={
					kind:		ModelKind.REF,
					fileName:	srcFile.fileName,
					name:		targetRef.typeName.getText(), // referenced node's name
					params:		targetRef.typeArguments==null ? undefined : []
				};
				if(pDesc.kind===ModelKind.REF)
					pDesc.params!.push(refEnt);
				else
					pDesc.type= refEnt;
				// Resolve types
				visitor.push(targetRef.typeArguments, refEnt, srcFile);
				break;
			case ts.SyntaxKind.StringKeyword:
			case ts.SyntaxKind.BooleanKeyword:
			case ts.SyntaxKind.NumberKeyword:
			case ts.SyntaxKind.SymbolKeyword:
			case ts.SyntaxKind.BigIntKeyword:
				if(pDesc==null) continue;
				if(
					pDesc.kind !== ModelKind.OUTPUT_FIELD
					&& pDesc.kind !== ModelKind.INPUT_FIELD
					&& pDesc.kind !== ModelKind.LIST
					&& pDesc.kind !== ModelKind.REF
					&& pDesc.kind !== ModelKind.PARAM
				) continue;
				let basicScalarRef: Reference= {
					kind:	ModelKind.REF,
					name:	node.getText(),
					fileName:	srcFile.fileName,
					params: undefined
				}
				if(pDesc.kind===ModelKind.REF)
					pDesc.params!.push(basicScalarRef);
				else
					pDesc.type= basicScalarRef;
				break;
			case ts.SyntaxKind.ArrayType:
				if(pDesc==null) continue;
				if(
					pDesc.kind !== ModelKind.OUTPUT_FIELD
					&& pDesc.kind !== ModelKind.INPUT_FIELD
					&& pDesc.kind !== ModelKind.LIST
					&& pDesc.kind !== ModelKind.REF
					&& pDesc.kind !== ModelKind.PARAM
				) continue;
				let arrTpe: List= {
					kind:		ModelKind.LIST,
					required:	true,
					deprecated:	deprecated,
					jsDoc:		comment
				} as List;
				if(pDesc.kind===ModelKind.REF)
					pDesc.params!.push(arrTpe);
				else
					pDesc.type= arrTpe;
				// Visite childs
				visitor.push((node as ts.ArrayTypeNode).elementType, arrTpe, srcFile);
				break;
			case ts.SyntaxKind.TypeOperator:
				//FIXME check what TypeOperatorNode means?
				visitor.push((node as ts.TypeOperatorNode).type, pDesc, srcFile);
				break;
			case ts.SyntaxKind.SyntaxList:
				visitor.push(node.getChildren(), pDesc, srcFile);
				break
			case ts.SyntaxKind.TupleType:
				throw new Error(`Tuples are insupported, did you mean Array of type? at ${srcFile.fileName}::${node.getText()}`);
				break;
		}
	}
	//* STEP 2: ADD DEFAULT SCALARS
	for(let i=0, len=  DEFAULT_SCALARS.length; i<len; ++i){
		let fieldName= DEFAULT_SCALARS[i];
		if(!ROOT.has(fieldName)){
			let scalarNode: BasicScalar={
				kind: ModelKind.BASIC_SCALAR,
				name: fieldName
			};
			ROOT.set(fieldName, scalarNode);
		}
	}
	return ROOT;
}

/** Nameless entities */
interface NamelessEntity{
	/** Proposed name or prefix */
	name:	string|undefined
	/** Target entity */
	node:	Node
	/** Target reference */
	ref:	Reference
}

/** Compile assert expressions */
function _compileAsserts(asserts: string[], prevAsserts: AssertOptions= {}, srcFile: ts.SourceFile): AssertOptions|undefined {
	try{
		return Object.assign(prevAsserts, ...asserts.map(e=> parseJSON(e)));
	}catch(err){
		throw new Error(`Fail to parse assert arguments at ${srcFile.fileName}\n${asserts.join("\n")}\n${err?.stack}`);
	}
}
