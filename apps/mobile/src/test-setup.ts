const values = new Map<string,string>();
jest.mock('expo-secure-store',()=>({getItemAsync:jest.fn((key:string)=>Promise.resolve(values.get(key)??null)),setItemAsync:jest.fn((key:string,value:string)=>{values.set(key,value);return Promise.resolve()}),deleteItemAsync:jest.fn((key:string)=>{values.delete(key);return Promise.resolve()})}));
beforeEach(()=>values.clear());
