import * as Path from "path";
import * as fs from "fs";
import * as ejs from "ejs";
import StringExtension from "../extensions/string";
import FileExtension from "../extensions/fs";
import PathExtension from "../extensions/path";
import {
    INormalizedOutputFile, IOutputFile, IGeneratorCallbackData, IStrictGeneratorConfig, NamingConvention, TOutputFile
} from "./interfaces";

export type ExecutionResult = {
    created: Array<string>;
    errors: Array<string>;
};

export default class Generator {
    static allOptionName = "full";

    constructor(public readonly config: IStrictGeneratorConfig) {
    }

    execute(workingDir: string, path: string, options: Array<string>): ExecutionResult {
        const normalizedPath = PathExtension.trimLeadingSlashes(path),
            pathToEntityDir = Path.dirname(normalizedPath),
            rawEntityName = Path.basename(normalizedPath),
            normalizedEntityName = this.normalizeName(rawEntityName),
            result: ExecutionResult = {
                created: [],
                errors: []
            };

        const filesToCreate = [
            ...this.getNormalizedFiles(this.config.output, workingDir, rawEntityName, options),
            ...this.getOptionalFiles(options, workingDir, rawEntityName)
        ];

        const absoluteEntityDirPath = this.config.createDirectory
            ? Path.resolve(workingDir, pathToEntityDir, normalizedEntityName)
            : Path.resolve(workingDir, pathToEntityDir);

        filesToCreate.forEach(function(file) {
            const fullPathToFile = Path.resolve(absoluteEntityDirPath, file.name);

            try {
                FileExtension.writeFile(fullPathToFile, file.template);
                result.created.push(fullPathToFile);
            } catch (e) {
                result.errors.push(fullPathToFile);
            }
        });

        return result;
    }

    private getOptionalFiles(
        options: Array<string>,
        workingDir: string,
        rawEntityName: string
    ): Array<INormalizedOutputFile> {
        const allFiles = this.getNormalizedFiles(this.config.optionalOutput, workingDir, rawEntityName, options);
        const allOptionEnabled = options.indexOf(Generator.allOptionName) !== -1;

        if (allOptionEnabled) {
            return allFiles;
        }

        return allFiles
            .filter((file) => options.indexOf(file.optionName) !== -1);
    }

    private getNormalizedFiles(
        fileList: Array<TOutputFile>,
        workingDir: string,
        generatorName: string,
        options: Array<string>
    ): Array<INormalizedOutputFile> {
        const generatorData = this.getGeneratorCallbackData(generatorName, options);

        return fileList.map((file) => {
            if (typeof file === "string") {
                return {
                    name: file,
                    template: "",
                    optionName: "",
                    optionDescription: ""
                };
            }

            const template = this.createTemplate(file, generatorData, workingDir);
            const name = (typeof file.name === "function")
                ? file.name(generatorData)
                : file.name;

            return {
                name,
                template,
                optionName: this.cleanOptionName(file.optionName),
                optionDescription: file.optionDescription || ""
            };
        });
    }

    private cleanOptionName(optionName?: string): string {
        if (optionName) {
            const name = this.getNameParts(optionName);
            return name.long || name.short || "";
        }

        return "";
    }

    private getNameParts(name: string): {short: string, long: string} {
        const withoutSpecialSymbols = name.replace(/[-,]/g, "");
        const withOneWhitespace = withoutSpecialSymbols.replace(/[\s]+/g, " ");
        const shortAndLongParts = withOneWhitespace.split(" ");

        return {
            short: shortAndLongParts[0],
            long: shortAndLongParts[1]
        };
    }

    private createTemplate(
        description: IOutputFile,
        generatorData: IGeneratorCallbackData,
        workingDir: string
    ): string {
        const customData = typeof this.config.templateVars === "function"
            ? this.config.templateVars({}, generatorData)
            : {};

        const templateData = {
            ...generatorData,
            custom: customData
        };

        if (description.template) {
            return ejs.render(description.template, templateData);
        } else if (description.templatePath) {
            const pathToTemplate = this.normalizePathToTemplate(workingDir, description.templatePath);
            const rawTpl = fs.readFileSync(pathToTemplate, "UTF-8");

            return ejs.render(rawTpl, templateData);
        }

        return "";
    }

    private normalizePathToTemplate(workingDir: string, templatePath: string): string {
        const firstChar = templatePath[0];

        if (firstChar === "/") {
            // don't use the templatesRoot or the app root if the path is absolute
            return templatePath;
        } else {
            if (this.config.templatesRoot) {
                return Path.resolve(workingDir, this.config.templatesRoot, templatePath);
            } else {
                return Path.resolve(workingDir, templatePath);
            }
        }
    }

    private getGeneratorCallbackData(name: string, options: Array<string>): IGeneratorCallbackData {
        const optionsDictionary = this.createDummyOptionsDictionary(options);

        return {
            name: {
                raw: name,
                default: this.normalizeName(name),
                camelCase: StringExtension.camelCase(name),
                pascalCase: StringExtension.pascalCase(name),
                kebabCase: StringExtension.kebabCase(name),
                trainCase: StringExtension.trainCase(name),
                snakeCase: StringExtension.snakeCase(name),
                dotCase: StringExtension.dotCase(name)
            },
            command: {
                name: this.config.name,
                options: optionsDictionary,
                optionEnabled: (optionName: string) => {
                    const allOptionEnabled = Boolean(optionsDictionary[Generator.allOptionName]);
                    const particularOptionEnabled = Boolean(optionsDictionary[optionName]);

                    return allOptionEnabled || particularOptionEnabled;
                }
            },
            // TODO: remove it in 2.0, use command.options instead
            options: optionsDictionary
        };
    }

    private createDummyOptionsDictionary(options: Array<string>): Record<string, boolean> {
        return options.reduce((dictionary, option) => {
            dictionary[option] = true;
            return dictionary;
        }, {} as Record<string, boolean>);
    }

    private normalizeName(name: string): string {
        const namingConvention: NamingConvention = this.config.namingConvention
            ? this.config.namingConvention
            : "pascalCase";

        // Call one of string transformation functions
        if (StringExtension[namingConvention]) {
            return StringExtension[namingConvention](name);
        }

        return name;
    }
}
