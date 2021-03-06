import {
    ValidationResult,
    ObjectSchemaDefinition,
    ISchemaValidator,
    Schema
} from '../index';

export const validateObject = async (
    obj: any,
    schema: ObjectSchemaDefinition<any>,
    validator: ISchemaValidator<any, unknown[]>
): Promise<ValidationResult> => {
    if (
        typeof obj === 'undefined' &&
        typeof schema === 'object' &&
        schema.isRequired === false
    ) {
        return {
            valid: true
        };
    }
    if (typeof obj !== 'object') {
        return {
            valid: false,
            errors: [
                `expected to have type='object', but saw '${typeof obj}' instead`
            ]
        };
    }

    if (typeof schema.preprocessors === 'object' && schema.preprocessors) {
        await Promise.all(
            Object.keys(schema.preprocessors).map(async (key: string) => {
                if (key === '*') return;
                if (typeof schema.preprocessors[key] === 'function') {
                    obj[key] = await Promise.resolve(
                        (schema.preprocessors[key] as (unknown) => unknown)(
                            obj[key]
                        )
                    );
                } else {
                    const preprocessor = validator.preprocessors.get(
                        schema.preprocessors[key] as string
                    );
                    if (typeof preprocessor !== 'function') {
                        throw new Error(
                            `preprocessor '${schema.preprocessors[key]}' is unknown`
                        );
                    }
                    obj[key] = await Promise.resolve(preprocessor(obj[key]));
                }
            })
        );
        if ('*' in schema.preprocessors) {
            const objectPreprocessor = schema.preprocessors['*'];
            if (typeof objectPreprocessor === 'function') {
                await Promise.resolve(
                    (objectPreprocessor as (unknown) => unknown)(obj)
                );
            } else {
                const preprocessor = validator.preprocessors.get(
                    objectPreprocessor as string
                );
                if (typeof preprocessor !== 'function') {
                    throw new Error(
                        `preprocessor '${objectPreprocessor}' is unknown`
                    );
                }
                await Promise.resolve(preprocessor(obj));
            }
        }
    }

    if (typeof schema.properties === 'object' && schema.properties) {
        const errors = (
            await Promise.all(
                Object.entries(schema.properties).map(
                    async ([name, schema]: [string, Schema<any>]) => {
                        const result = await validator.validate(
                            schema,
                            obj[name]
                        );
                        if (result.valid) return result;
                        return {
                            valid: false,
                            errors: (result.errors || []).map(
                                (e) => `->${name} ${e}`
                            )
                        };
                    }
                )
            )
        )
            .filter((r) => !r.valid)
            .map((r) => r.errors)
            .flat(Infinity) as string[];
        if (errors.length) {
            return {
                valid: false,
                errors
            };
        }
    }

    return {
        valid: true
    };
};
