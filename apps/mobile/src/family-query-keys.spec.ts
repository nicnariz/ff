import { familyQueryKeys } from './family-query-keys';
describe('query keys',()=>{it('scopes details',()=>expect(familyQueryKeys.detail('a')).toContain('a'));it('scopes members and page',()=>expect(familyQueryKeys.members('b',2)).toEqual(['family-members','b',2]));it('scopes invitations',()=>expect(familyQueryKeys.invitations('c')).toEqual(['family-invitations','c']));});
