import * as zod from 'zod';
import { ZodError } from 'zod';

import {
  fromZodError,
  isValidationError,
  isValidationErrorLike,
  ValidationError,
} from './ValidationError';

describe('fromZodError()', () => {
  test('handles zod.string() schema errors', () => {
    const emailSchema = zod.string().email();

    try {
      emailSchema.parse('foobar');
    } catch (err) {
      if (err instanceof ZodError) {
        const validationError = fromZodError(err);
        expect(validationError).toBeInstanceOf(ValidationError);
        expect(validationError.message).toMatchInlineSnapshot(
          `"Validation error: Invalid email"`
        );
        expect(validationError.details).toMatchInlineSnapshot(`
        [
          {
            "code": "invalid_string",
            "message": "Invalid email",
            "path": [],
            "validation": "email",
          },
        ]
      `);
      }
    }
  });

  test('handles zod.object() schema errors', () => {
    const objSchema = zod.object({
      id: zod.number().int().positive(),
      name: zod.string().min(2),
    });

    try {
      objSchema.parse({
        id: -1,
        name: 'a',
      });
    } catch (err) {
      if (err instanceof ZodError) {
        const validationError = fromZodError(err);
        expect(validationError).toBeInstanceOf(ValidationError);
        expect(validationError.message).toMatchInlineSnapshot(
          `"Validation error: Number must be greater than 0 at "id"; String must contain at least 2 character(s) at "name""`
        );
        expect(validationError.details).toMatchInlineSnapshot(`
        [
          {
            "code": "too_small",
            "exact": false,
            "inclusive": false,
            "message": "Number must be greater than 0",
            "minimum": 0,
            "path": [
              "id",
            ],
            "type": "number",
          },
          {
            "code": "too_small",
            "exact": false,
            "inclusive": true,
            "message": "String must contain at least 2 character(s)",
            "minimum": 2,
            "path": [
              "name",
            ],
            "type": "string",
          },
        ]
      `);
      }
    }
  });

  test('handles zod.array() schema errors', () => {
    const objSchema = zod.array(zod.number().int());

    try {
      objSchema.parse([1, 'a', true, 1.23]);
    } catch (err) {
      if (err instanceof ZodError) {
        const validationError = fromZodError(err);
        expect(validationError).toBeInstanceOf(ValidationError);
        expect(validationError.message).toMatchInlineSnapshot(
          `"Validation error: Expected number, received string at "[1]"; Expected number, received boolean at "[2]"; Expected integer, received float at "[3]""`
        );
        expect(validationError.details).toMatchInlineSnapshot(`
        [
          {
            "code": "invalid_type",
            "expected": "number",
            "message": "Expected number, received string",
            "path": [
              1,
            ],
            "received": "string",
          },
          {
            "code": "invalid_type",
            "expected": "number",
            "message": "Expected number, received boolean",
            "path": [
              2,
            ],
            "received": "boolean",
          },
          {
            "code": "invalid_type",
            "expected": "integer",
            "message": "Expected integer, received float",
            "path": [
              3,
            ],
            "received": "float",
          },
        ]
      `);
      }
    }
  });

  test('handles nested zod.object() schema errors', () => {
    const objSchema = zod.object({
      id: zod.number().int().positive(),
      arr: zod.array(zod.number().int()),
      nestedObj: zod.object({
        name: zod.string().min(2),
      }),
    });

    try {
      objSchema.parse({
        id: -1,
        arr: [1, 'a'],
        nestedObj: {
          name: 'a',
        },
      });
    } catch (err) {
      if (err instanceof ZodError) {
        const validationError = fromZodError(err);
        expect(validationError).toBeInstanceOf(ValidationError);
        expect(validationError.message).toMatchInlineSnapshot(
          `"Validation error: Number must be greater than 0 at "id"; Expected number, received string at "arr[1]"; String must contain at least 2 character(s) at "nestedObj.name""`
        );
        expect(validationError.details).toMatchInlineSnapshot(`
        [
          {
            "code": "too_small",
            "exact": false,
            "inclusive": false,
            "message": "Number must be greater than 0",
            "minimum": 0,
            "path": [
              "id",
            ],
            "type": "number",
          },
          {
            "code": "invalid_type",
            "expected": "number",
            "message": "Expected number, received string",
            "path": [
              "arr",
              1,
            ],
            "received": "string",
          },
          {
            "code": "too_small",
            "exact": false,
            "inclusive": true,
            "message": "String must contain at least 2 character(s)",
            "minimum": 2,
            "path": [
              "nestedObj",
              "name",
            ],
            "type": "string",
          },
        ]
      `);
      }
    }
  });

  test('schema.parse() path param to be part of error message', () => {
    const objSchema = zod.object({
      status: zod.literal('success'),
    });

    try {
      objSchema.parse(
        {},
        {
          path: ['custom-path'],
        }
      );
    } catch (err) {
      if (err instanceof ZodError) {
        const validationError = fromZodError(err);
        expect(validationError).toBeInstanceOf(ValidationError);
        expect(validationError.message).toMatchInlineSnapshot(
          `"Validation error: Invalid literal value, expected "success" at "custom-path.status""`
        );
      }
    }
  });

  test('handles zod.or() schema errors', () => {
    const success = zod.object({
      status: zod.literal('success'),
      data: zod.object({
        id: zod.string(),
      }),
    });

    const error = zod.object({
      status: zod.literal('error'),
    });

    const objSchema = success.or(error);

    try {
      objSchema.parse({});
    } catch (err) {
      if (err instanceof ZodError) {
        const validationError = fromZodError(err);
        expect(validationError).toBeInstanceOf(ValidationError);
        expect(validationError.message).toMatchInlineSnapshot(
          `"Validation error: Invalid literal value, expected "success" at "status"; Required at "data", or Invalid literal value, expected "error" at "status""`
        );
      }
    }
  });

  test('handles zod.and() schema errors', () => {
    const part1 = zod.object({
      prop1: zod.literal('value1'),
    });
    const part2 = zod.object({
      prop2: zod.literal('value2'),
    });

    const objSchema = part1.and(part2);

    try {
      objSchema.parse({});
    } catch (err) {
      if (err instanceof ZodError) {
        const validationError = fromZodError(err);
        expect(validationError).toBeInstanceOf(ValidationError);
        expect(validationError.message).toMatchInlineSnapshot(
          `"Validation error: Invalid literal value, expected "value1" at "prop1"; Invalid literal value, expected "value2" at "prop2""`
        );
      }
    }
  });
});

describe('isValidationError()', () => {
  test('returns true when argument is instance of ValidationError', () => {
    expect(
      isValidationError(new ValidationError('foobar', { details: [] }))
    ).toEqual(true);
  });

  test('returns false when argument is plain Error', () => {
    expect(isValidationError(new Error('foobar'))).toEqual(false);
  });

  test('returns false when argument is not an Error', () => {
    expect(isValidationError('foobar')).toEqual(false);
    expect(isValidationError(123)).toEqual(false);
    expect(
      isValidationError({
        message: 'foobar',
      })
    ).toEqual(false);
  });
});

describe('isValidationErrorLike()', () => {
  test('returns true when argument is an actual instance of ValidationError', () => {
    expect(
      isValidationErrorLike(new ValidationError('foobar', { details: [] }))
    ).toEqual(true);
  });

  test('returns true when argument resembles a ValidationError', () => {
    const err = new Error('foobar');
    // @ts-ignore
    err.type = 'ZodValidationError';

    expect(isValidationErrorLike(err)).toEqual(true);
  });

  test('returns false when argument is generic Error', () => {
    expect(isValidationErrorLike(new Error('foobar'))).toEqual(false);
  });

  test('returns false when argument is not an Error instance', () => {
    expect(isValidationErrorLike('foobar')).toEqual(false);
    expect(isValidationErrorLike(123)).toEqual(false);
    expect(
      isValidationErrorLike({
        message: 'foobar',
      })
    ).toEqual(false);
  });
});
