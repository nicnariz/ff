import { friendlyError } from './errors';
describe('friendly errors',()=>{it.each([['INVITATION_EXPIRED','expirou'],['INVITATION_REVOKED','revogado'],['FAMILY_ACCESS_DENIED','acesso'],['NETWORK_ERROR','conexao']])('maps %s',(code,word)=>expect(friendlyError(new Error(code))).toContain(word));});
