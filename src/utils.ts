import { strings } from '@angular-devkit/core';
import { chain, externalSchematic, Tree } from '@angular-devkit/schematics';
import { Project, QuoteKind, ScriptTarget, StructureKind } from 'ts-morph';
import * as path from 'path';
import {
  getWorkspace,
  buildDefaultPath,
} from '@schematics/angular/utility/workspace';

export type Options = { name: string; path: string; project: string };
type Entity = 'component' | 'directive' | 'pipe';

export function appendModule(options: Options, type: Entity) {
  return function (tree: Tree) {
    const project = new Project({
      manipulationSettings: {
        quoteKind: QuoteKind.Single,
      },
      compilerOptions: {
        target: ScriptTarget.ES2015,
      },
    });

    const isComp = type === 'component';
    const basePath = path.resolve(options.path, options.name);
      const fileName = resolveFileName(options.name);

    const compPath = path.resolve(basePath, `${fileName}.${type}.ts`);
    const sourceFile = project.createSourceFile(
      `${type}.ts`,
      tree.read(compPath)?.toString()
    );

    sourceFile.addImportDeclaration({
      moduleSpecifier: '@angular/common',
      namedImports: [
        {
          kind: StructureKind.ImportSpecifier,
          name: 'CommonModule',
        },
      ],
    });

    sourceFile.getImportDeclaration('@angular/core')?.addNamedImports([
      {
        name: 'NgModule',
      },
    ]);

    const name = strings.classify(fileName);
    const normalizeType = strings.classify(type);
    const moduleName = isComp
      ? `${name}Module`
      : `${name}${normalizeType}Module`;

    sourceFile
      .addClass({ name: moduleName, isExported: true })
      .insertDecorator(0, {
        name: 'NgModule',
        arguments: [
          `{
       declarations: [${name}${normalizeType}],
       imports: [CommonModule],
       exports: [${name}${normalizeType}]
      }`,
        ],
      })
      .formatText({ indentSize: 2 });

    tree.overwrite(compPath, sourceFile.getText());

    return tree;
  };
}

export function ruleFactory(options: Options, type: Entity) {
  return async (tree: Tree) => {
    const workspace = await getWorkspace(tree);
    const project = workspace.projects.get(options.project);

    if (options.path === undefined && project) {
      options.path = buildDefaultPath(project);
    }

    const rules = [
      externalSchematic('@schematics/angular', type, {
        ...options,
        flat: false,
        export: true,
        skipImport: true,
      }),
      appendModule(options, type),
    ];

    return chain(rules);
  };
}

function resolveFileName(path: string) {
  const toArray = path.split('/');
  return toArray[toArray.length - 1];
}