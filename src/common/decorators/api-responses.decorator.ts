/**
 * Shared Swagger response decorators.
 *
 * Every route in this API sits behind the global ThrottlerGuard and the global
 * HttpExceptionFilter (see app.module.ts / main.ts), so 429 and 500 apply to every
 * endpoint, and every error response — regardless of status code — is serialized as
 * ErrorResponseDto. Success responses are wrapped by the global ResponseInterceptor
 * into `{ success: true, data: <payload> }`, so 2xx docs must reflect that envelope
 * rather than the bare payload type.
 */
import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
  ApiInternalServerErrorResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../swagger/response.dto';

type Model = Type<unknown>;
type ModelOrArray = Model | [Model];

function envelopeSchema(model: ModelOrArray) {
  const data = Array.isArray(model)
    ? { type: 'array' as const, items: { $ref: getSchemaPath(model[0]) } }
    : { $ref: getSchemaPath(model) };

  return {
    type: 'object' as const,
    properties: {
      success: { type: 'boolean' as const, example: true },
      data,
    },
  };
}

function rawEnvelopeSchema(dataSchema: Record<string, unknown>) {
  return {
    type: 'object' as const,
    properties: {
      success: { type: 'boolean' as const, example: true },
      data: dataSchema,
    },
  };
}

/** 200 OK wrapping a DTO (or `[Dto]` for an array) in the app's `{ success, data }` envelope. */
export function ApiOkEnvelope(model: ModelOrArray, description?: string) {
  const ref = Array.isArray(model) ? model[0] : model;
  return applyDecorators(ApiExtraModels(ref), ApiOkResponse({ description, schema: envelopeSchema(model) }));
}

/** 201 Created wrapping a DTO (or `[Dto]` for an array) in the app's `{ success, data }` envelope. */
export function ApiCreatedEnvelope(model: ModelOrArray, description?: string) {
  const ref = Array.isArray(model) ? model[0] : model;
  return applyDecorators(ApiExtraModels(ref), ApiCreatedResponse({ description, schema: envelopeSchema(model) }));
}

/** 200 OK for responses with no dedicated DTO (inline schema), still enveloped. */
export function ApiOkEnvelopeSchema(dataSchema: Record<string, unknown>, description?: string) {
  return ApiOkResponse({ description, schema: rawEnvelopeSchema(dataSchema) });
}

/** 201 Created for responses with no dedicated DTO (inline schema), still enveloped. */
export function ApiCreatedEnvelopeSchema(dataSchema: Record<string, unknown>, description?: string) {
  return ApiCreatedResponse({ description, schema: rawEnvelopeSchema(dataSchema) });
}

export function ApiBadRequest(description = 'VALIDATION_ERROR — request body/query failed validation') {
  return ApiBadRequestResponse({ type: ErrorResponseDto, description });
}

export function ApiUnauthorized(description = 'MISSING_ACCESS_TOKEN | INVALID_ACCESS_TOKEN') {
  return ApiUnauthorizedResponse({ type: ErrorResponseDto, description });
}

export function ApiForbidden(description = 'FORBIDDEN — insufficient permissions for this action') {
  return ApiForbiddenResponse({ type: ErrorResponseDto, description });
}

/** @param resource e.g. 'Product' → documents PRODUCT_NOT_FOUND */
export function ApiNotFound(resource = 'Resource') {
  const code = `${resource.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`;
  return ApiNotFoundResponse({ type: ErrorResponseDto, description: code });
}

export function ApiConflict(description = 'CONFLICT — resource already exists') {
  return ApiConflictResponse({ type: ErrorResponseDto, description });
}

export function ApiTooManyRequests() {
  return ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'TOO_MANY_REQUESTS — rate limit exceeded, retry later',
  });
}

export function ApiInternalServerError() {
  return ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    description: 'INTERNAL_SERVER_ERROR — unexpected server error',
  });
}

export interface StandardErrorOptions {
  /** Route requires authentication — adds 401. Default true; pass false for @Public() routes. */
  auth?: boolean;
  /** Adds 400. Pass a string to override the default VALIDATION_ERROR description. */
  badRequest?: boolean | string;
  /** Adds 403. Pass a string to override the default description. */
  forbidden?: boolean | string;
  /** Adds 404 for the named resource, e.g. 'Product' → PRODUCT_NOT_FOUND. */
  notFound?: string;
  /** Adds 409. Pass a string to override the default description. */
  conflict?: boolean | string;
}

/**
 * Standard error response set for a route. 429 + 500 are added unconditionally
 * (global ThrottlerGuard + global exception filter cover every route). 401 is
 * added unless `auth: false`. 400/403/404/409 are opt-in per route.
 */
export function ApiStandardErrors(options: StandardErrorOptions = {}) {
  const decorators = [ApiTooManyRequests(), ApiInternalServerError()];

  if (options.auth !== false) decorators.push(ApiUnauthorized());
  if (options.badRequest) {
    decorators.push(typeof options.badRequest === 'string' ? ApiBadRequest(options.badRequest) : ApiBadRequest());
  }
  if (options.forbidden) {
    decorators.push(typeof options.forbidden === 'string' ? ApiForbidden(options.forbidden) : ApiForbidden());
  }
  if (options.notFound) decorators.push(ApiNotFound(options.notFound));
  if (options.conflict) {
    decorators.push(typeof options.conflict === 'string' ? ApiConflict(options.conflict) : ApiConflict());
  }

  return applyDecorators(...decorators);
}
