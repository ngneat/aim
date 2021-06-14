import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import { getFileContent } from '@schematics/angular/utility/test';

describe('@ngneat/scam Directive Schematic', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngneat/scam',
    require.resolve('../collection.dev.json')
  );
  const defaultOptions: any = {
    name: 'foo',
    module: undefined,
    export: false,
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

  it('should create a pipe', async () => {
    const options = { ...defaultOptions };

    const tree = await schematicRunner
      .runSchematicAsync('pipe', options, appTree)
      .toPromise();
    const files = tree.files;
    expect(files).toContain('/projects/bar/src/app/foo/foo.pipe.spec.ts');
    expect(files).toContain('/projects/bar/src/app/foo/foo.pipe.ts');
    const fileContent = getFileContent(
      tree,
      '/projects/bar/src/app/foo/foo.pipe.ts'
    );
    expect(fileContent).toMatch(/export class FooPipeModule/);
    expect(fileContent).toMatch(/declarations: \[FooPipe]/);
    expect(fileContent).toContain(
      'transform(value: unknown, ...args: unknown[])'
    );
  });

  it('should create a pipe with aliases', async () => {
    const options = { ...defaultOptions };

    const tree = await schematicRunner
      .runSchematicAsync('p', options, appTree)
      .toPromise();
    const files = tree.files;
    expect(files).toContain('/projects/bar/src/app/foo/foo.pipe.spec.ts');
    expect(files).toContain('/projects/bar/src/app/foo/foo.pipe.ts');
    const fileContent = getFileContent(
      tree,
      '/projects/bar/src/app/foo/foo.pipe.ts'
    );
    expect(fileContent).toMatch(/export class FooPipeModule/);
    expect(fileContent).toMatch(/declarations: \[FooPipe]/);
    expect(fileContent).toContain(
      'transform(value: unknown, ...args: unknown[])'
    );
  });

  it('should ignore the module option', async () => {
    const options = { ...defaultOptions, module: 'app.module.ts' };

    const tree = await schematicRunner
      .runSchematicAsync('pipe', options, appTree)
      .toPromise();
    const appModule = getFileContent(
      tree,
      '/projects/bar/src/app/app.module.ts'
    );

    expect(appModule).not.toMatch(/import { FooPipe } from '.\/foo.pipe'/);
  });

  it('should handle a path in the name and module options', async () => {
    appTree = await schematicRunner
      .runExternalSchematicAsync(
        '@schematics/angular',
        'module',
        { name: 'admin/module', project: 'bar' },
        appTree
      )
      .toPromise();

    const options = {
      ...defaultOptions,
      path: 'projects/bar/src/app/admin/module',
    };
    appTree = await schematicRunner
      .runSchematicAsync('pipe', options, appTree)
      .toPromise();

    const content = appTree.readContent(
      '/projects/bar/src/app/admin/module/module.module.ts'
    );
    expect(content).not.toMatch(/import { FooPipe }/);

    const fileContent = appTree.readContent(
      '/projects/bar/src/app/admin/module/foo/foo.pipe.ts'
    );
    expect(fileContent).toMatch(/export class FooPipeModule/);
  });

  it('should ignore the flat flag', async () => {
    const options = { ...defaultOptions, flat: false };

    const tree = await schematicRunner
      .runSchematicAsync('pipe', options, appTree)
      .toPromise();
    const files = tree.files;
    expect(files).toContain('/projects/bar/src/app/foo/foo.pipe.spec.ts');
    expect(files).toContain('/projects/bar/src/app/foo/foo.pipe.ts');
    const moduleContent = getFileContent(
      tree,
      '/projects/bar/src/app/app.module.ts'
    );
    expect(moduleContent).not.toMatch(/import.*Foo.*from/);
    expect(moduleContent).not.toMatch(
      /declarations:\s*\[[^\]]+?,\r?\n\s+FooPipe\r?\n/m
    );
  });

  it('should respect the skipTests option', async () => {
    const options = { ...defaultOptions, skipTests: true };
    const tree = await schematicRunner
      .runSchematicAsync('pipe', options, appTree)
      .toPromise();

    expect(tree.files).toContain('/projects/bar/src/app/foo/foo.pipe.ts');
    expect(tree.files).not.toContain(
      '/projects/bar/src/app/foo/foo.pipe.spec.ts'
    );
  });

  it('should respect the sourceRoot value', async () => {
    const config = JSON.parse(appTree.readContent('/angular.json'));
    config.projects.bar.sourceRoot = 'projects/bar/custom';
    appTree.overwrite('/angular.json', JSON.stringify(config, null, 2));

    appTree = await schematicRunner
      .runSchematicAsync('pipe', defaultOptions, appTree)
      .toPromise();
    expect(appTree.files).toContain('/projects/bar/custom/app/foo/foo.pipe.ts');
  });
});
