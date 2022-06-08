import {
  Project,
  ArrayLiteralExpression,
  ObjectLiteralExpression,
  PropertyAssignment,
  Decorator,
  ClassDeclaration,
  SourceFile,
  SyntaxKind,
  ImportSpecifier,
} from 'ts-morph';

export function resolveDepsAndAims(project: Project) {
  const moduleRefs: Record<string, string[]> = {};

  const aimModules: Record<
    string,
    {
      dec: Decorator;
      class: ClassDeclaration;
      sourceFile: SourceFile;
    }
  > = {};

  for (const sourceFile of project.getSourceFiles()) {
    const content = sourceFile.getText();

    if (content.includes('@NgModule')) {
      for (const klass of sourceFile.getClasses()) {
        for (const decorator of klass.getDecorators()) {
          if (decorator.getName() === 'NgModule') {
            const refs = klass.findReferencesAsNodes();
            const importNames: string[] = [];

            for (const ref of refs) {
              const decorator = ref
                .getParentWhile((n) => n.getKindName() !== 'Decorator')
                ?.getParent() as Decorator;
              const isNgModule = decorator?.getName() === 'NgModule';

              if (isNgModule) {
                const ngModuleClass = decorator?.getParent()!;
                const ngModuleClassName = (
                  ngModuleClass as ClassDeclaration
                ).getName()!;
                importNames.push(ngModuleClassName);
              }
            }

            const className = klass.getName()!;
            moduleRefs[className] = importNames;

            if (isAIM(decorator)) {
              aimModules[className] = {
                dec: decorator,
                class: klass,
                sourceFile: sourceFile,
              };
            }
          }
        }
      }
    }
  }

  return { moduleRefs, aimModules };
}

export function refactorToAim(
  aimModules: ReturnType<typeof resolveDepsAndAims>['aimModules'],
  moduleRefs: ReturnType<typeof resolveDepsAndAims>['moduleRefs']
) {
  function checkIsPureAim(refs: string[]): boolean {
    let arr = refs.slice();
    let current = arr.shift();

    while (current) {
      if (!aimModules[current]) {
        return false;
      }

      if (moduleRefs[current]?.length) {
        arr.push(...moduleRefs[current]);
      }

      current = arr.shift();
    }

    return true;
  }

  for (const moduleName of Object.keys(aimModules)) {
    const currentModuleRefs = moduleRefs[moduleName];
    let isPureAim = true;

    if (currentModuleRefs?.length) {
      isPureAim = checkIsPureAim(currentModuleRefs);
    }

    if (isPureAim) {
      const aimModule = aimModules[moduleName];
      let importNames: string[] = [];
      const ngModuleArgs =
        aimModule.dec.getArguments()[0] as ObjectLiteralExpression;
      const declProp = (
        ngModuleArgs.getProperty('declarations') as
        | PropertyAssignment
        | undefined
      )?.getInitializer() as ArrayLiteralExpression | undefined;

      const declElements = declProp?.getElements();
      const relatedClassName = declElements?.[0].getText();

      const imports = (
        ngModuleArgs.getProperty('imports') as PropertyAssignment | undefined
      )?.getInitializer() as ArrayLiteralExpression | undefined;

      // We have imports in the `NgModule`
      if (imports?.getElements().length) {
        importNames = imports.getElements().map((e) => e.getText());
      }

      // It could have multiple decorators so we need to find the right one
      const relatedClassDec = aimModule.sourceFile
        .getClasses()
        .find((d) => d.getName() === relatedClassName)?.getDecorators()?.find((d) => {
          return d.getName().match(/Directive|Component|Pipe/);
        });

        if(!relatedClassDec) {
          continue;
        }

      const relatedClassDecoratorArgs =
        relatedClassDec.getArguments()[0] as ObjectLiteralExpression;

      relatedClassDecoratorArgs.addPropertyAssignment({
        name: 'standalone',
        initializer: 'true',
      });

      // Only components have `imports`
      if (importNames?.length && relatedClassDec.getName() === 'Component') {
        relatedClassDecoratorArgs.addPropertyAssignment({
          name: 'imports',
          initializer: `[${importNames.join(', ')}]`,
        });
      }

      aimModule.class.rename(relatedClassName!);

      const refsByPaths: Record<string, ImportSpecifier[]> = {};

      aimModule.class.findReferencesAsNodes().forEach(ref => {
        const isImportSpecifier = ref.getParent()?.isKind?.(SyntaxKind.ImportSpecifier);

        if (isImportSpecifier) {
          const refPath = ref.getSourceFile().getFilePath();
          refsByPaths[refPath] ??= [];
          refsByPaths[refPath].push(ref.getParent() as ImportSpecifier);
        }
      });

      Object.values(refsByPaths).forEach(refs => {
        // We have duplicated references
        if (refs.length > 1) {
          const [firstRef, ...rest] = refs;
          // Remove redudant imports
          rest.forEach((r) => r.remove());
        }
      })

      // Delete `NgModule`
      aimModule.class.remove();

      // Remove `NgModule` from imports
      aimModule.sourceFile
        .getImportDeclaration('@angular/core')
        ?.getNamedImports()
        .find((i) => i.getName() === 'NgModule')
        ?.remove();

    }
  }
}

export function save(project: Project) {
  project.saveSync();
}

export function isAIM(ngModuleDecorator: Decorator) {
  const ngModuleArgs =
    ngModuleDecorator.getArguments()[0] as ObjectLiteralExpression;

  if (!ngModuleArgs) {
    return false;
  }

  const declProp = (
    ngModuleArgs.getProperty('declarations') as PropertyAssignment | undefined
  )?.getInitializer() as ArrayLiteralExpression | undefined;
  const exportProp = (
    ngModuleArgs.getProperty('exports') as PropertyAssignment | undefined
  )?.getInitializer() as ArrayLiteralExpression | undefined;

  const declElements = declProp?.getElements();

  const isPass =
    declElements?.length === 1 &&
    !declElements[0].getType().isArray() &&
    exportProp?.getElements().length === 1 &&
    declElements[0].getText() === exportProp.getElements()[0].getText();

  return isPass;
}
