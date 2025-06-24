import * as $RefParser from '@stoplight/json-schema-ref-parser';
import { get, camelCase, forOwn } from 'lodash';
import { JSONSchemaFaker } from 'json-schema-faker';
import type { JSONSchemaFakerOptions } from 'json-schema-faker';
import { resetJSONSchemaGenerator } from '@stoplight/prism-http';
import { safeDecycle } from './safeDecycle';

export async function configureExtensionsUserProvided(
  specFilePathOrObject: string | object,
  cliParamOptions: { [option: string]: any }
): Promise<void> {
  console.log('Parsing spec...');

  // Try to dereference the spec
  console.log('Dereferencing spec...');
  const dereferenced = await new $RefParser().dereference(specFilePathOrObject);
  console.log('Dereferencing complete, decycling...');

  // Apply safe decycle
  const result = safeDecycle(dereferenced);
  // Handle result which could be a Promise from our timeout mechanism
  const finalResult = await (result instanceof Promise ? result : Promise.resolve(result));
  console.log('Decycling complete');

  resetJSONSchemaGenerator();

  forOwn(get(finalResult, 'x-json-schema-faker', {}), (value: any, option: string) => {
    setFakerValue(option, value);
  });

  // cli parameter takes precidence, so it is set after spec extensions are configed
  for (const param in cliParamOptions) {
    if (cliParamOptions[param] !== undefined) {
      setFakerValue(param, cliParamOptions[param]);
    }
  }
}

function setFakerValue(option: string, value: any) {
  if (option === 'locale') {
    // necessary as workaround broken types in json-schema-faker
    // @ts-ignore
    return JSONSchemaFaker.locate('faker').setLocale(value);
  }
  // necessary as workaround broken types in json-schema-faker
  // @ts-ignore
  JSONSchemaFaker.option(camelCase(option) as keyof JSONSchemaFakerOptions, value);
}
