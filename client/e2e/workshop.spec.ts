import { test, expect, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HubConnectionBuilder, HttpTransportType } from '@microsoft/signalr';
const password='Workshop!Demo123';
const unique=()=>`${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
async function register(page:Page,name='Demo Customer') {
 const email=`user-${unique()}@example.test`;
 await page.goto('/account/register');await page.getByLabel('Your name').fill(name);await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Create account'}).click();await expect(page.getByRole('status')).toContainText('Account created');return email;
}
async function login(page:Page,email:string,pass=password) {
 await page.goto('/account/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(pass);await page.getByRole('button',{name:'Sign in',exact:false}).click();await expect(page).toHaveURL(/\/portal$/);await expect(page.getByText('Live connection')).toBeVisible();
}
async function staff(page:Page) {
 const text=await readFile(join(process.env['WIDGET_TEST_DATA']!, 'staff-credentials.txt'),'utf8');const pass=text.match(/Password: (.+)/)![1];await login(page,'staff@widget.local',pass);
}
async function post(page:Page,path:string,body:unknown) {
 return page.evaluate(async({path,body})=>{const token=await (await fetch('/api/auth/csrf')).json();const r=await fetch('/api'+path,{method:'POST',headers:{'Content-Type':'application/json','X-XSRF-TOKEN':token.token},body:JSON.stringify(body)});return {status:r.status,body:await r.json().catch(()=>null)};},{path,body});
}
test('landing, catalog, route refresh, responsive layout and not-found',async({page})=>{
 await page.goto('/');await expect(page.locator('header')).toHaveCSS('display','flex');await expect(page.getByRole('heading',{name:'Big ideas. Little widgets.'})).toBeVisible();await page.getByRole('link',{name:'Find your widget'}).click();await page.getByRole('link',{name:'Get to know Orbit'}).click();await page.reload();await expect(page.getByRole('heading',{name:'Orbit.'})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.goto('/');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/mobile-home.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/desktop-home.png',fullPage:true});await page.goto('/does-not-exist');await expect(page.getByRole('heading',{name:'Wrong turn. Good company.'})).toBeVisible();
});
test('registration, failed login, live toast, exchange, logout and auth isolation',async({page})=>{
 const email=await register(page);await page.goto('/account/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('WrongPassword!123');await page.getByRole('button',{name:'Sign in'}).click();await expect(page.getByRole('status')).toContainText('Sign-in failed');
 await login(page,email);await page.getByRole('button',{name:'Send me a live toast'}).click();await expect(page.getByRole('status').filter({hasText:'Dispatch from the workshop'})).toContainText('notification travelled through');await page.getByRole('button',{name:'Dismiss notification'}).click();
 expect((await page.request.get('/api/staff/news')).status()).toBe(403);expect((await post(page,'/staff/news',{title:'No',summary:'No',body:'No',published:true})).status).toBe(403);
 await page.goto('/exchange');await page.getByLabel('Tell us its story').fill('Ready for a second life');await page.getByRole('button',{name:'Request an exchange'}).click();await expect(page.getByText(/Request #\d+ received/)).toBeVisible();await page.goto('/portal');await expect(page.getByText('Awaiting workshop assessment')).toBeVisible();await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL('http://localhost:5081/');expect((await page.request.get('/api/auth/me')).status()).toBe(401);
});
test('password recovery is local, rejects bad tokens and makes old password invalid',async({page})=>{
 const email=await register(page);await page.goto('/account/forgot');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Recover password'}).click();await expect(page.getByRole('status')).toContainText('If the account exists');
 const mail=await readFile(join(process.env['WIDGET_TEST_DATA']!, 'latest-recovery.txt'),'utf8');expect(mail).toContain(email);const link=mail.split('Open on the local site: ')[1];
 expect((await post(page,'/auth/reset',{email,token:'invalid',password:'NewWorkshop!123'})).status).toBe(400);
 await page.goto(link);await page.getByLabel('Password',{exact:true}).fill('NewWorkshop!123');await page.getByRole('button',{name:'Reset password'}).click();await expect(page.getByRole('status')).toContainText('Password reset');
 expect((await post(page,'/auth/login',{email,password})).status).toBe(401);await login(page,email,'NewWorkshop!123');
 expect((await post(page,'/auth/reset',{email,token:new URL(link,'http://localhost').searchParams.get('token'),password:'AgainWorkshop!123'})).status).toBe(400);
});
test('real two-session chat, persisted history, customer isolation, reconnect and staff toast',async({page,browser})=>{
 test.setTimeout(90_000);const name='Customer '+unique();const email=await register(page,name);await login(page,email);await page.goto('/support/chat');await expect(page.getByText(/Conversation #/)).toBeVisible();await page.getByLabel('Message',{exact:true}).fill('Can you help with Orbit?');await page.getByRole('button',{name:'Send',exact:false}).click();await expect(page.getByText('Can you help with Orbit?',{exact:true})).toBeVisible();
 const threads=await (await page.request.get('/api/conversations')).json();const id=threads[0].id;
 const otherContext=await browser.newContext();const other=await otherContext.newPage();const otherEmail=await register(other);await login(other,otherEmail);expect((await other.request.get('/api/conversations/'+id+'/messages')).status()).toBe(404);const cookies=(await otherContext.cookies()).map(c=>c.name+'='+c.value).join('; ');const intruder=new HubConnectionBuilder().withUrl('http://localhost:5081/hubs/live',{headers:{Cookie:cookies},transport:HttpTransportType.WebSockets}).build();await intruder.start();await expect(intruder.invoke('Join',id)).rejects.toThrow('Conversation unavailable');await expect(intruder.invoke('Send',id,'Unauthorized message')).rejects.toThrow('Conversation unavailable');await intruder.stop();await otherContext.close();
 const staffContext=await browser.newContext();const agent=await staffContext.newPage();await staff(agent);await agent.goto('/staff/support');await agent.getByRole('button',{name:new RegExp(name)}).click();await expect(agent.getByText('Can you help with Orbit?',{exact:true})).toBeVisible();await agent.getByLabel('Message',{exact:true}).fill('Absolutely. The workshop is here.');await agent.getByRole('button',{name:'Send',exact:false}).click();await expect(page.getByText('Absolutely. The workshop is here.',{exact:true})).toBeVisible();await expect(page.getByRole('status').filter({hasText:'The workshop replied'})).toContainText('workshop replied');
 await page.reload();await expect(page.getByText('Absolutely. The workshop is here.',{exact:true})).toBeVisible();
 await page.context().setOffline(true);await expect(page.getByText('Reconnecting',{exact:true})).toBeVisible({timeout:35000});await agent.getByLabel('Message',{exact:true}).fill('A message while you were away.');await agent.getByRole('button',{name:'Send',exact:false}).click();await page.context().setOffline(false);await expect(page.getByText('A message while you were away.',{exact:true})).toBeVisible({timeout:30000});
 await staffContext.close();
});
test('contact persistence and CMS draft visibility, publication, announcement and safe text',async({page,browser})=>{
 const label='Field note '+unique();const email=await register(page);await login(page,email);
 await page.goto('/contact');await page.getByLabel('Your name').fill('Contact '+label);await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel("What's on your mind?").fill('Please tell me about Relay. '+label);await page.getByRole('button',{name:'Send your note'}).click();await expect(page.getByRole('status')).toContainText('Reference #');
 const ctx=await browser.newContext();const editor=await ctx.newPage();await staff(editor);await editor.goto('/staff/support');await expect(editor.getByText('Please tell me about Relay. '+label,{exact:true})).toBeVisible();await editor.goto('/staff/news');await editor.getByLabel('Title',{exact:true}).fill(label);await editor.getByLabel('Summary',{exact:true}).fill('A persisted draft');await editor.getByLabel('Article text').fill('<script>alert("unsafe")</script>\nA useful new idea.');await editor.getByRole('button',{name:'Save draft'}).click();await expect(editor.getByRole('status')).toContainText('Draft saved');
 const draft=editor.locator('article').filter({has:editor.getByRole('heading',{name:label,exact:true})});await expect(draft).toContainText('DRAFT');const publicNews=await (await page.request.get('/api/news')).json();expect(publicNews.some((n:any)=>n.title===label)).toBe(false);
 await draft.getByRole('button',{name:'Publish + notify'}).click();await expect(page.getByRole('status').filter({hasText:'Fresh from the workshop'})).toContainText(label);await page.goto('/news');await page.getByRole('link').filter({has:page.getByRole('heading',{name:label+' ↗',exact:true})}).click();await expect(page.locator('.article-body')).toContainText('<script>');expect(await page.locator('.article-body script').count()).toBe(0);await page.reload();await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible();await ctx.close();
});
test('API rejects missing CSRF and invalid contact data',async({page})=>{
 await page.goto('/contact');expect((await page.request.post('/api/contact',{data:{name:'No CSRF',email:'a@example.test',message:'blocked'}})).status()).toBe(400);
 expect((await post(page,'/contact',{name:'',email:'not-an-email',message:''})).status).toBe(400);expect((await post(page,'/auth/register',{name:'Test',email:null,password:null})).status).toBe(400);
});

test('signed-out support chat offers working account links in a compact prompt', async ({page}) => {
 await page.goto('/support/chat');
 await expect(page.getByText('Sign in / Create Account to get support through our chat')).toBeVisible();
 await expect(page.locator('.chat-layout')).toHaveCount(0);
 await expect(page.getByText('Sign in to use chat.')).toHaveCount(0);
 await page.getByRole('link',{name:'Create Account',exact:true}).click();
 await expect(page).toHaveURL(/\/account\/register$/);
 await page.goto('/support/chat');
 await page.locator('main').getByRole('link',{name:'Sign in',exact:true}).click();
 await expect(page).toHaveURL(/\/account\/login$/);
 expect((await page.request.get('/api/conversations')).status()).toBe(401);
});
