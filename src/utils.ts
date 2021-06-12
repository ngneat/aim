import { join, normalize, strings } from '@angular-devkit/core';
import {
  chain,
  externalSchematic,
  SchematicsException,
  Tree,
} from '@angular-devkit/schematics';
import { Project, QuoteKind, ScriptTarget, StructureKind } from 'ts-morph';
import {
  getWorkspace,
  buildDefaultPath,
} from '@schematics/angular/utility/workspace';
import { parseName } from '@schematics/angular/utility/parse-name';

export type Options = { name: string; path: string; project: string };
type Entity = 'component' | 'directive' | 'pipe';

export function appendModule(options: any, type: Entity) {
  return function (tree: Tree) {
    const typeStr = options.type ?? type;
    const fileName = typeStr
      ? `${strings.dasherize(options.name)}.${strings.dasherize(typeStr)}.ts`
      : `${strings.dasherize(options.name)}.ts`;

    const compPath = `${join(
      normalize(options.path),
      strings.dasherize(options.name), // because flat is always false
      fileName
    )}`;

    const project = new Project({
      manipulationSettings: {
        quoteKind: QuoteKind.Single,
      },
      compilerOptions: {
        target: ScriptTarget.ES2015,
      },
    });

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

    const name = strings.classify(options.name);
    const normalizeType = strings.classify(typeStr);
    const moduleName = `${name}${normalizeType}Module`;

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

    if (!options.project) {
      options.project = workspace.extensions.defaultProject as string;
    }

    const project = workspace.projects.get(options.project);

    if (!project) {
      throw new SchematicsException(
        `Project '${options.project}' does not exist.`
      );
    }

    if (options.path === undefined && project) {
      options.path = buildDefaultPath(project);
    }

    const parsedPath = parseName(options.path as string, options.name);
    options.name = parsedPath.name;
    options.path = parsedPath.path;

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
