import { IHttpContent, IHttpOperationResponse, IMediaTypeContent } from '@stoplight/types';
// @ts-ignore
import accepts from 'accepts';
import * as contentType from 'content-type';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import * as S from 'fp-ts/string';
import * as NEA from 'fp-ts/NonEmptyArray';
import * as Ord from 'fp-ts/Ord';
import { pipe } from 'fp-ts/function';
import { pick } from 'lodash';
import { ContentExample } from '../../';

export type IWithExampleMediaContent = IMediaTypeContent & { examples: NEA.NonEmptyArray<ContentExample> };

export function findFirstExample(httpContent: IHttpContent) {
  return pipe(O.fromNullable(httpContent.examples), O.chain(NEA.fromArray), O.chain(A.head));
}

export function findExampleByKey(httpContent: IHttpContent, exampleKey: string) {
  return pipe(O.fromNullable(httpContent.examples), O.chain(A.findFirst(({ key }) => key === exampleKey)));
}

export function findBestHttpContentByMediaType(
  contents: IMediaTypeContent[],
  mediaTypes: string[]
): O.Option<IMediaTypeContent> {
  const bestType: string | false = accepts({ headers: { accept: mediaTypes.join(',') } }).type(
    contents.map(c => c.mediaType)
  );

  return pipe(
    bestType,
    O.fromPredicate((bestType): bestType is string => !!bestType),
    O.chain(bestType => A.findFirst<IMediaTypeContent>(content => content.mediaType === bestType)(contents)),
    O.alt(() =>
      // Since media type parameters are not standardised (apart from the quality value), we're going to try again ignoring them all but q.
      pipe(
        mediaTypes
          .map(mt => contentType.parse(mt))
          .filter(({ parameters }) => Object.keys(parameters).some(k => k !== 'q'))
          .map(({ type, parameters }) => ({ type, parameters: pick(parameters, 'q') }))
          .map(mt => contentType.format(mt)),
        NEA.fromArray,
        O.chain(mediaTypesWithNoParameters => findBestHttpContentByMediaType(contents, mediaTypesWithNoParameters))
      )
    )
  );
}

export function findDefaultContentType(contents: IMediaTypeContent[]): O.Option<IMediaTypeContent> {
  return pipe(
    contents,
    A.findFirst(content => content.mediaType === '*/*')
  );
}

export function findLowest2XXResponse(httpResponses: IHttpOperationResponse[]): O.Option<IHttpOperationResponse> {
  return pipe(
    httpResponses,
    A.filter(response => /^2(\d\d|XX)$/.test(response.code)),
    A.sort(Ord.contramap((response: IHttpOperationResponse) => response.code)(S.Ord)),
    A.head,
    O.map(withResponseRangesNormalized)
  );
}

export function findFirstResponse(httpResponses: IHttpOperationResponse[]): O.Option<IHttpOperationResponse> {
  return pipe(httpResponses, A.head, O.map(withResponseRangesNormalized));
}

export function findResponseByStatusCode(
  httpResponses: IHttpOperationResponse[],
  statusCode: number
): O.Option<IHttpOperationResponse> {
  return pipe(
    httpResponses,
    A.findFirst(response => response.code.toLowerCase() === String(statusCode)),
    O.alt(() =>
      pipe(
        httpResponses,
        A.findFirst(response => response.code === `${String(statusCode).charAt(0)}XX`),
        O.map(response => ({ ...response, code: statusCode.toString() }))
      )
    )
  );
}

export function findDefaultResponse(
  httpResponses: IHttpOperationResponse[],
  statusCode = 200
): O.Option<IHttpOperationResponse> {
  return pipe(
    httpResponses,
    A.findFirst(response => response.code === 'default'),
    O.map(response => ({ ...response, code: statusCode.toString() }))
  );
}

export function contentHasExamples(content: IMediaTypeContent): content is IWithExampleMediaContent {
  return !!content.examples && content.examples.length !== 0;
}

function withResponseRangesNormalized(httpResponse: IHttpOperationResponse): IHttpOperationResponse {
  return /^\dXX$/.test(httpResponse.code)
    ? { ...httpResponse, code: `${httpResponse.code.charAt(0)}00` }
    : httpResponse;
}
