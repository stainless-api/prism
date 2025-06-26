import { IPrismDiagnostic } from '@stainless-api/prism-core';
import * as O from 'fp-ts/Option';
import { sequenceT } from 'fp-ts/Apply';
import { getSemigroup } from 'fp-ts/NonEmptyArray';
import { getApplicativeValidation } from 'fp-ts/Either';

export const sequenceOption = sequenceT(O.Apply);
export const sequenceValidation = sequenceT(getApplicativeValidation(getSemigroup<IPrismDiagnostic>()));
