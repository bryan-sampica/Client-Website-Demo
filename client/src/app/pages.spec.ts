import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ContactPage, AuthPage, ChatPage, ArticlePage } from './pages';
import { Api } from './api';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('Contact form behavior',()=>{
  const request=vi.fn();
  beforeEach(()=>{request.mockReset();TestBed.configureTestingModule({imports:[ContactPage],providers:[{provide:Api,useValue:{request}}]});});
  it('shows a saved reference and clears only the message after success',async()=>{
    request.mockResolvedValue({message:'Received.',reference:42});
    const f=TestBed.createComponent(ContactPage);f.componentInstance.name='Ada';f.componentInstance.email='ada@example.test';f.componentInstance.message='Please help';
    f.detectChanges(); await f.componentInstance.submit();f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Reference #42');expect(f.componentInstance.message).toBe('');expect(f.componentInstance.name).toBe('Ada');
  });
  it('preserves input and displays an actionable failure',async()=>{
    request.mockRejectedValue(new Error('The service is unavailable.'));
    const f=TestBed.createComponent(ContactPage);f.componentInstance.message='Keep this note';await f.componentInstance.submit();f.detectChanges();
    expect(f.nativeElement.querySelector('[role="status"]').textContent).toContain('unavailable');expect(f.componentInstance.message).toBe('Keep this note');expect(f.componentInstance.busy).toBe(false);
  });
  it('disables submission while a request is pending',async()=>{
    let finish!:(v:any)=>void;request.mockReturnValue(new Promise(r=>finish=r));
    const f=TestBed.createComponent(ContactPage);const pending=f.componentInstance.submit();f.detectChanges();expect(f.nativeElement.querySelector('button').disabled).toBe(true);
    finish({message:'Received',reference:1});await pending;f.detectChanges();expect(f.nativeElement.querySelector('button').disabled).toBe(false);
  });
});
describe('Account and content boundaries',()=>{
  it('keeps a failed login on the form and shows the server message',async()=>{
    TestBed.configureTestingModule({imports:[AuthPage],providers:[provideRouter([]),{provide:Api,useValue:{login:vi.fn().mockRejectedValue(new Error('Sign-in failed.'))}},{provide:ActivatedRoute,useValue:{data:of({mode:'login'}),snapshot:{queryParamMap:new Map()}}}]});
    const f=TestBed.createComponent(AuthPage);await f.componentInstance.submit();f.detectChanges();expect(f.nativeElement.textContent).toContain('Sign-in failed.');expect(f.componentInstance.failed).toBe(true);
  });
  it('renders CMS markup as inert text',async()=>{
    TestBed.configureTestingModule({imports:[ArticlePage],providers:[provideRouter([]),{provide:Api,useValue:{request:vi.fn().mockResolvedValue({title:'Safe article',body:'<img src=x onerror=alert(1)>',summary:'Demo',publishedAt:'2026-01-01'})}},{provide:ActivatedRoute,useValue:{snapshot:{paramMap:new Map([['slug','safe']])}}}]});
    const f=TestBed.createComponent(ArticlePage);await f.whenStable();f.detectChanges();expect(f.nativeElement.querySelector('.article-body').textContent).toContain('<img');expect(f.nativeElement.querySelector('.article-body img')).toBeNull();
  });
  it('retains an unsent chat message when disconnected',async()=>{
    TestBed.configureTestingModule({imports:[ChatPage],providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{data:{}}}},{provide:Api,useValue:{restore:vi.fn().mockResolvedValue(undefined),user:signal(null),send:vi.fn().mockRejectedValue(new Error('Reconnect before sending.')),status:signal('Offline'),conversation:signal(null),messages:signal([])}}]});
    const f=TestBed.createComponent(ChatPage);await f.whenStable();f.componentInstance.api.user.set({id:'customer',email:'customer@example.test',displayName:'Customer',roles:[]});f.componentInstance.text='Do not lose this';await f.componentInstance.send();f.detectChanges();expect(f.componentInstance.text).toBe('Do not lose this');expect(f.nativeElement.textContent).toContain('Reconnect before sending.');
  });
});

 describe('Signed-out support chat', () => {
  it('offers account links without the chat controls or an authentication error', async () => {
    const request = vi.fn();
    TestBed.configureTestingModule({imports:[ChatPage],providers:[provideRouter([]),
      {provide:ActivatedRoute,useValue:{snapshot:{data:{}}}},
      {provide:Api,useValue:{restore:vi.fn().mockResolvedValue(undefined),user:signal(null),request}}
    ]});
    const f = TestBed.createComponent(ChatPage);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Sign in / Create Account to get support through our chat');
    expect(f.nativeElement.querySelector('a[href="/account/login"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('a[href="/account/register"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('.chat-layout')).toBeNull();
    expect(f.nativeElement.querySelector('.error')).toBeNull();
    expect(f.componentInstance.error).toBe('');
    expect(request).not.toHaveBeenCalled();
  });
});
