import GeneratorShell from "./shell";
import * as path from "path";
import * as fs from "fs";
import FsExtension from "../extensions/fs";

const testDir = path.resolve(__dirname, "../test-files"),
    absoluteDir = "/tmp/makestuff";

function getAbsPathTo(destination: string): string {
    return path.resolve(absoluteDir, destination);
}

describe("shell", function () {
    let generator: GeneratorShell;
    const testComponentPath = "components/TestComponent";

    beforeEach(function () {
        generator = new GeneratorShell();
    });

    afterEach(function () {
        FsExtension.deleteFolderRecursive(testDir);
        FsExtension.deleteFolderRecursive(absoluteDir);
    });

    test("can create empty files with proper names", function () {
        const testComponentPath = getAbsPathTo("test/TestComponent"),
            testFiles = [
                "index.test",
                {outputName: "testFile.test"},
                {outputName: (data) => `raw.${data.name.raw}.test`},
                {outputName: (data) => `cc.${data.name.camelCase}.test`},
                {outputName: (data) => `pc.${data.name.pascalCase}.test`},
                {outputName: (data) => `kc.${data.name.kebabCase}.test`},
                {outputName: (data) => `tc.${data.name.trainCase}.test`},
                {outputName: (data) => `sc.${data.name.snakeCase}.test`},
                {outputName: (data) => `dc.${data.name.dotCase}.test`},
            ];

        generator.setupGenerator({
            name: "component",
            root: testDir,
            outputFiles: testFiles
        });

        const result = generator.run(testDir, "component", testComponentPath);

        expect(result.created.length).toBe(testFiles.length);
        expect(result.errors.length).toBe(0);

        result.created.forEach(function (filePath) {
            expect(fs.existsSync(filePath)).toBeTruthy();
        });

        const properFilenames = [
            "index.test",
            "testFile.test",
            "raw.TestComponent.test",
            "cc.testComponent.test",
            "pc.TestComponent.test",
            "kc.test-component.test",
            "tc.Test-Component.test",
            "sc.test_component.test",
            "dc.test.component.test",
        ]

        properFilenames.forEach(function (fileName) {
            const pathToFile = path.resolve(testComponentPath, fileName);
            expect(fs.existsSync(pathToFile)).toBeTruthy();
        })
    });

    test("can create files by template", function () {
        const testTemplate = "export default class <%= data.name.default %> {}",
            expectedTemplate = "export default class TestComponent {}",
            textTemplateFile = {
                outputName: "text-template.test",
                template: testTemplate
            },
            absolutePathFile = {
                outputName: "absolute.test",
                templatePath: getAbsPathTo("absolute-test.tpl")
            };

        FsExtension.writeFile(absolutePathFile.templatePath, testTemplate);

        generator.setupGenerator({
            name: "component",
            root: testDir,
            outputFiles: [
                textTemplateFile,
                absolutePathFile,
                // TODO: make test for relative path template (relative to the config file)
            ]
        });

        const result = generator.run(testDir, "component", testComponentPath);

        const pathToCreatedFiles = path.resolve(testDir, testComponentPath);
        const textTemplateFileContent = fs.readFileSync(
            path.resolve(pathToCreatedFiles, textTemplateFile.outputName),
            "UTF-8"
        );
        const absolutePathFileContent = fs.readFileSync(
            path.resolve(pathToCreatedFiles, textTemplateFile.outputName),
            "UTF-8"
        );

        expect(textTemplateFileContent).toBe(expectedTemplate);
        expect(absolutePathFileContent).toBe(expectedTemplate);
    });

    test("must throw the error if template file doesn't exists", function () {
        generator.setupGenerator({
            name: "component",
            root: testDir,
            outputFiles: [
                {
                    outputName: "absolute.test",
                    templatePath: getAbsPathTo("non-existing-template.tpl")
                }
            ]
        });

        // TODO: throw the typed error
        expect(function() {
            const result = generator.run(testDir, "component", testComponentPath);
        }).toThrowError();
    });

    test("can get additional template variables from config file", function () {
        const testContent = "111";

        generator.setupGenerator({
            name: "component",
            root: testDir,
            templateVars: function (input, predefinedSettings) {
                return {
                    testVar: testContent
                }
            },
            outputFiles: [
                {outputName: "additional-fields.test", template: "<%- custom.testVar %>"},
            ]
        });

        const result = generator.run(testDir, "component", testComponentPath);

        expect(result.created.length).toBe(1);

        const content = fs.readFileSync(
            result.created[0],
            "UTF-8"
        );

        expect(content).toBe(testContent);
    });
});
