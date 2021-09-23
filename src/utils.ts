import {join, normalize, strings} from '@angular-devkit/core';
import {chain, externalSchematic, SchematicsException, Tree,} from '@angular-devkit/schematics';
import {
  ObjectLiteralExpression,
  Project,
  PropertyAssignment,
  QuoteKind,
  ScriptTarget,
  SourceFile,
  StructureKind,
  SyntaxKind
} from 'ts-morph';
import {buildDefaultPath, getWorkspace,} from '@schematics/angular/utility/workspace';
import {parseName} from '@schematics/angular/utility/parse-name';

export type Options = Record<string, string> & {
  name: string;
  path: string;
  project: string;
  type?: string;
};
type Entity = 'component' | 'directive' | 'pipe';

function createSourceFile({tree, type, compPath}: {tree: Tree, type: Entity, compPath: string}) {
  const project = new Project({
    manipulationSettings: {
      quoteKind: QuoteKind.Single,
    },
    compilerOptions: {
      target: ScriptTarget.ES2015,
    },
  });

  return project.createSourceFile(
      `${type}.ts`,
      tree.read(compPath)!.toString()
  );
}

function resolveFileName(options: Options, type: string) {
  const typeStr = options.type ?? type;

  return typeStr
      ? `${strings.dasherize(options.name)}.${strings.dasherize(typeStr)}.ts`
      : `${strings.dasherize(options.name)}.ts`;
}

function resolvePath(options: Options, type: Entity) {
  return `${join(
      normalize(options.path),
      strings.dasherize(options.name), // because flat is always false
      resolveFileName(options, type)
  )}`;
}

function getPipeOptions(source: SourceFile): ObjectLiteralExpression {
  const [pipeOptions] = source.getClassOrThrow((dec) => !!dec.getDecorator('Pipe')).getDecoratorOrThrow('Pipe').getArguments() as [ObjectLiteralExpression];

  return pipeOptions;
}

export function prefixPipeName(options: Options) {
  return function (tree: Tree) {
    const compPath = resolvePath(options, 'pipe');
    const sourceFile = createSourceFile({tree, type: 'pipe', compPath});
    const pipeOptions = getPipeOptions(sourceFile);
    const nameProp = pipeOptions.getProperty('name') as PropertyAssignment;
    const [value] = nameProp.getChildrenOfKind(SyntaxKind.StringLiteral);
    const prefixed = strings.camelize(`${options.prefix} ${value.getLiteralValue()}`);

    nameProp.setInitializer(`'${prefixed}'`);

    tree.overwrite(compPath, sourceFile.getText());

    return tree;
  }
}

export function appendModule(options: Options, type: Entity) {
  return function (tree: Tree) {
    const typeStr = options.type ?? type;
    const compPath = resolvePath(options, type)
    const sourceFile = createSourceFile({tree, type, compPath});

    sourceFile.addImportDeclaration({
      moduleSpecifier: '@angular/common',
      namedImports: [
        {
          kind: StructureKind.ImportSpecifier,
          name: 'NgModule',
        },
      ],
    });

    const name = strings.classify(options.name);
    const normalizeType = strings.classify(typeStr);
    const className = `${name}${normalizeType}`;
    const moduleName = `${className}Module`;

    sourceFile
      .addClass({ name: moduleName, isExported: true })
      .insertDecorator(0, {
        name: 'NgModule',
        arguments: [
          `{
       imports: [],
       declarations: [${className}],
       exports: [${className}]
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

    if (type === 'pipe' && options.prefix) {
      rules.push(prefixPipeName(options));
    }

    return chain(rules);
  };
}
