import { Api } from './api';
describe('API security and failure behavior',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('adds the antiforgery token to mutations',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({token:'csrf-value'}))).mockResolvedValueOnce(new Response(JSON.stringify({reference:3})));
  vi.stubGlobal('fetch',fetch);const api=new Api();await api.request('/contact',{message:'Hello'});
  expect(fetch.mock.calls[1][1].headers['X-XSRF-TOKEN']).toBe('csrf-value');expect(fetch.mock.calls[1][1].credentials).toBe('same-origin');
 });
 it('does not disguise an authorization failure as success',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:403})));await expect(new Api().request('/staff/news')).rejects.toThrow('staff account');
 });
 it('turns an unexpected non-JSON response into a useful error',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>proxy error</html>',{status:502})));await expect(new Api().request('/news')).rejects.toThrow('unexpected response');
 });
});
