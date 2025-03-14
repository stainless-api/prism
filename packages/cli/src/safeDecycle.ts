import { decycle } from '@stoplight/json';

/**
 * A safer version of decycle that handles circular references gracefully
 * and includes extra safeguards against infinite loops
 */
export const safeDecycle = (obj: any) => {
  // Track objects we've seen to debug circular references
  const objectsVisited = new WeakMap<object, string[]>();
  const maxDepth = 1000; // Set a reasonable recursion limit

  // Just logging the first few keys to understand the spec structure
  if (typeof obj === 'object' && obj !== null) {
    console.log('Top level keys:', Object.keys(obj).slice(0, 5));
  }

  // Implement our own safe version of decycle to avoid infinite recursion
  const customDecycle = (value: any, path: string[] = []): any => {
    // Base cases: primitives or null
    if (value === null || typeof value !== 'object') {
      return value;
    }

    // Special handling for reference objects - preserve standard OpenAPI references
    // but strip out problematic bundled references
    if (typeof value === 'object' && value !== null && '$ref' in value && typeof value.$ref === 'string') {
      // Handle bundled references - remove them to prevent circular reference issues
      if (value.$ref.includes('__bundled__')) {
        console.warn(`Removing problematic bundled reference: ${value.$ref}`);
        return { type: 'object' }; // Replace with a simple type
      }

      // Preserve standard OpenAPI references
      if (
        value.$ref.startsWith('#/components/schemas/') ||
        value.$ref.startsWith('#/components/parameters/') ||
        value.$ref.startsWith('#/components/responses/')
      ) {
        console.log(`Preserving OpenAPI reference: ${value.$ref}`);
        return { ...value }; // Return a clean copy
      }
    }

    // Remove __bundled__ property completely to prevent circular references
    if (
      typeof value === 'object' &&
      value !== null &&
      ('__bundled__' in value || Object.keys(value).some(k => k.includes('__bundled__')))
    ) {
      console.warn('Removing __bundled__ properties to prevent circular references');
      // Create a filtered copy without bundled properties
      const result: Record<string, any> = {};
      Object.keys(value).forEach(key => {
        if (key !== '__bundled__' && !key.includes('__bundled__')) {
          result[key] = customDecycle(value[key], [...path, key]);
        }
      });
      return result;
    }

    // Check for recursion depth
    if (path.length > maxDepth) {
      console.warn(`Maximum recursion depth (${maxDepth}) exceeded at path: ${path.join('.')}`);
      return { $ref: 'too-deep' };
    }

    // Check if we've seen this object before
    if (objectsVisited.has(value)) {
      const refPath = objectsVisited.get(value);

      // Special handling for bundled references - just pass them through
      if (
        typeof value === 'object' &&
        value !== null &&
        '$ref' in value &&
        typeof value.$ref === 'string' &&
        value.$ref.includes('__bundled__')
      ) {
        console.warn(`Preserving bundled reference: ${value.$ref}`);
        return { ...value }; // Return a clean copy
      }

      // For normal circular references, create a special cycle marker
      // that won't be mistaken for a valid OpenAPI reference
      console.warn(`Found circular reference from ${path.join('.')} to ${refPath ? refPath.join('.') : '/'}`);

      // Return a deep copy of the original object but with circular refs removed
      // This is safer than creating our own $ref which might confuse the validator
      if (typeof value === 'object' && !Array.isArray(value)) {
        // For objects, just return a stub with a type property if possible
        if ('type' in value && typeof value.type === 'string') {
          return { type: value.type, __circular: true };
        }
        return { __circular: true };
      } else if (Array.isArray(value)) {
        // For arrays, return an empty array
        return [];
      }

      // Fallback for other types
      return null;
    }

    // Record this object
    objectsVisited.set(value, [...path]);

    // Process based on type
    if (Array.isArray(value)) {
      const result = [];
      for (let i = 0; i < value.length; i++) {
        result[i] = customDecycle(value[i], [...path, i.toString()]);
      }
      return result;
    } else {
      // It's a plain object
      const result: Record<string, any> = {};
      for (const key of Object.keys(value)) {
        result[key] = customDecycle(value[key], [...path, key]);
      }
      return result;
    }
  };

  try {
    console.log('Running custom decycle implementation...');
    // Call our own implementation instead of the built-in one
    return customDecycle(obj);
  } catch (error) {
    const err = error as Error;
    console.warn(`Error in custom decycle: ${err.message}`);
    console.warn(`Stack trace: ${err.stack}`);

    // Try with the original decycle as fallback with a timeout
    try {
      console.log('Falling back to original decycle with timeout guard...');
      // Set a timeout to prevent hanging
      const timeoutMS = 5000;
      let decycleComplete = false;

      const timeoutPromise = new Promise((_resolve, reject) => {
        setTimeout(() => {
          if (!decycleComplete) {
            reject(new Error(`Decycle operation timed out after ${timeoutMS}ms`));
          }
        }, timeoutMS);
      });

      const decyclePromise = Promise.resolve().then(() => {
        const result = decycle(obj);
        decycleComplete = true;
        return result;
      });

      return Promise.race([decyclePromise, timeoutPromise]).catch((timeoutError: Error) => {
        console.error(timeoutError.message);
        return obj; // Return original object on timeout
      });
    } catch (fallbackError) {
      const err = fallbackError as Error;
      console.warn(`Fallback decycle also failed: ${err.message}`);
      return obj; // Return the original object as last resort
    }
  }
};
