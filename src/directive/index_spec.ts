import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';

describe('@ngneat/scam Directive Schematic', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngneat/scam',
    require.resolve('../collection.json')
  );
  const defaultOptions: any = {
    name: 'foo',
    module: undefined,
    export: false,
    prefix: 'app',
    flat: true,
    project: 'bar',
  };

  const workspaceOptions: any = {
    name: 'workspace',
    newProjectRoot: 'projects',
    version: '6.0.0',
  };

  const appOptions: any = {
    name: 'bar',
    inlineStyle: false,
    inlineTemplate: false,
    routing: false,
    style: 'css',
    skipTests: false,
    skipPackageJson: false,
  };
  let appTree: UnitTestTree;

  beforeEach(async () => {
    appTree = await schematicRunner
      .runExternalSchematicAsync(
        '@schematics/angular',
        'workspace',
        workspaceOptions
      )
      .toPromise();
    appTree = await schematicRunner
      .runExternalSchematicAsync(
        '@schematics/angular',
        'application',
        appOptions,
        appTree
      )
      .toPromise();
  });

  it('should create a directive', async () => {
    const options = { ...defaultOptions };

    const tree = await schematicRunner
      .runSchematicAsync('directive', options, appTree)
      .toPromise();
    const files = tree.files;

    expect(files).toContain('/projects/bar/src/app/foo/foo.directive.spec.ts');
    expect(files).toContain('/projects/bar/src/app/foo/foo.directive.ts');
    const moduleContent = tree.readContent(
      '/projects/bar/src/app/foo/foo.directive.ts'
    );
    expect(moduleContent).toMatch(/export class FooDirectiveModule/);
    expect(moduleContent).toMatch(/declarations: \[FooDirective]/);
  });

  it('should create a directive with aliases', async () => {
    const options = { ...defaultOptions };

    const tree = await schematicRunner
      .runSchematicAsync('d', options, appTree)
      .toPromise();
    const files = tree.files;

    expect(files).toContain('/projects/bar/src/app/foo/foo.directive.spec.ts');
    expect(files).toContain('/projects/bar/src/app/foo/foo.directive.ts');
    const moduleContent = tree.readContent(
      '/projects/bar/src/app/foo/foo.directive.ts'
    );
    expect(moduleContent).toMatch(/export class FooDirectiveModule/);
    expect(moduleContent).toMatch(/declarations: \[FooDirective]/);
  });

  it('should create and ignore the flat flag', async () => {
    const options = { ...defaultOptions, flat: false };

    const tree = await schematicRunner
      .runSchematicAsync('directive', options, appTree)
      .toPromise();
    const files = tree.files;

    expect(files).toContain('/projects/bar/src/app/foo/foo.directive.spec.ts');
    expect(files).toContain('/projects/bar/src/app/foo/foo.directive.ts');
  });

  it('should ignore the module option', async () => {
    const options = { ...defaultOptions, flat: false, module: 'foo.module' };
    const fooModule = '/projects/bar/src/app/foo/foo.module.ts';
    appTree.create(
      fooModule,
      `
      import { NgModule } from '@angular/core';

      @NgModule({
        imports: [],
        declarations: []
      })
      export class FooModule { }
    `
    );

    const tree = await schematicRunner
      .runSchematicAsync('directive', options, appTree)
      .toPromise();
    const fooModuleContent = tree.readContent(fooModule);
    expect(fooModuleContent).not.toMatch(
      /import { FooDirective } from '.\/foo.directive'/
    );
  });

  it('should not export the directive to app module', async () => {
    const options = { ...defaultOptions, export: true };

    const tree = await schematicRunner
      .runSchematicAsync('directive', options, appTree)
      .toPromise();
    const appModuleContent = tree.readContent(
      '/projects/bar/src/app/app.module.ts'
    );
    expect(appModuleContent).not.toMatch(
      /exports: \[\n(\s*) {2}FooDirective\n\1]/
    );
    const directiveModuleContent = tree.readContent(
      '/projects/bar/src/app/foo/foo.directive.ts'
    );
    expect(directiveModuleContent).toMatch(/export class FooDirectiveModule/);
  });

  it('should converts dash-cased-name to a camelCasedSelector', async () => {
    const options = { ...defaultOptions, name: 'my-dir' };

    const tree = await schematicRunner
      .runSchematicAsync('directive', options, appTree)
      .toPromise();
    const content = tree.readContent(
      '/projects/bar/src/app/my-dir/my-dir.directive.ts'
    );
    expect(content).toMatch(/selector: '\[appMyDir]'/);
  });

  it('should create the right selector with a path in the name', async () => {
    const options = { ...defaultOptions, name: 'sub/test' };
    appTree = await schematicRunner
      .runSchematicAsync('directive', options, appTree)
      .toPromise();

    const content = appTree.readContent(
      '/projects/bar/src/app/sub/test/test.directive.ts'
    );
    expect(content).toMatch(/selector: '\[appTest]'/);
  });

  it('should use the prefix', async () => {
    const options = { ...defaultOptions, prefix: 'pre' };
    const tree = await schematicRunner
      .runSchematicAsync('directive', options, appTree)
      .toPromise();

    const content = tree.readContent(
      '/projects/bar/src/app/foo/foo.directive.ts'
    );
    expect(content).toMatch(/selector: '\[preFoo]'/);
  });

  it('should use the default project prefix if none is passed', async () => {
    const options = { ...defaultOptions, prefix: undefined };
    const tree = await schematicRunner
      .runSchematicAsync('directive', options, appTree)
      .toPromise();

    const content = tree.readContent(
      '/projects/bar/src/app/foo/foo.directive.ts'
    );
    expect(content).toMatch(/selector: '\[appFoo]'/);
  });

  it('should use the supplied prefix if it is ""', async () => {
    const options = { ...defaultOptions, prefix: '' };
    const tree = await schematicRunner
      .runSchematicAsync('directive', options, appTree)
      .toPromise();

    const content = tree.readContent(
      '/projects/bar/src/app/foo/foo.directive.ts'
    );
    expect(content).toMatch(/selector: '\[foo]'/);
  });

  it('should respect the sourceRoot value', async () => {
    const config = JSON.parse(appTree.readContent('/angular.json'));
    config.projects.bar.sourceRoot = 'projects/bar/custom';
    appTree.overwrite('/angular.json', JSON.stringify(config, null, 2));

    appTree = await schematicRunner
      .runSchematicAsync('directive', defaultOptions, appTree)
      .toPromise();
    expect(appTree.files).toContain(
      '/projects/bar/custom/app/foo/foo.directive.ts'
    );
  });

  it('should respect the skipTests option', async () => {
    const options = { ...defaultOptions, skipTests: true };
    const tree = await schematicRunner
      .runSchematicAsync('directive', options, appTree)
      .toPromise();

    expect(tree.files).toContain('/projects/bar/src/app/foo/foo.directive.ts');
    expect(tree.files).not.toContain(
      '/projects/bar/src/app/foo/foo.directive.spec.ts'
    );
  });
});
