import { describe, expect, it } from 'vitest';
import { isMatchingDictionaryRequest } from '../src/utils/dictionaryHelpers.js';

describe('dictionary request completion', () => {
  it('keeps unrelated pending words when optional identifiers are absent', () => {
    const requests = [{ id: 'first' }, { id: 'second' }];
    const approval = { id: 'approval-first', payload: { clientRequestId: 'first' } };
    expect(requests.filter((request) => !isMatchingDictionaryRequest(request, approval, 'user')))
      .toEqual([{ id: 'second' }]);
  });

  it('matches both collection approvals and their user-document fallback', () => {
    const request = { id: 'client', approvalId: 'server' };
    expect(isMatchingDictionaryRequest(request, { id: 'server' }, 'user')).toBe(true);
    expect(isMatchingDictionaryRequest(request, {
      id: 'userdict-user-client', source: 'userDoc', approvalId: 'server',
    }, 'user')).toBe(true);
  });

  it('clears successive words without restoring previously processed requests', () => {
    let pending = [{ id: 'first' }, { id: 'second' }, { id: 'untouched' }];
    for (const id of ['first', 'second']) {
      pending = pending.filter((request) => !isMatchingDictionaryRequest(request, {
        id: `userdict-user-${id}`, source: 'userDoc',
      }, 'user'));
    }
    expect(pending).toEqual([{ id: 'untouched' }]);
  });
});
