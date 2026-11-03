import { Injectable, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';
export interface User { id: string; email: string; displayName: string; roles: string[] }
export interface Widget { slug: string; name: string; tag: string; price: number; description: string; color: string }
export interface Article { id: number; slug: string; title: string; summary: string; body: string; published: boolean; publishedAt: string }
export interface Message { id: number; conversationId: number; senderId: string; senderName: string; text: string; sentAt: string }
@Injectable({providedIn:'root'})
export class Api {
  user = signal<User | null>(null); status = signal('Offline'); toast = signal<{title:string;message:string}|null>(null);
  messages = signal<Message[]>([]); conversation = signal<number|null>(null); private restoring?: Promise<void>; private connecting?: Promise<void>; private csrf = ''; private hub?: HubConnection;
  async request<T = any>(path: string, body?: unknown): Promise<T> {
    if (body !== undefined && !this.csrf) await this.token();
    const response = await fetch('/api'+path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: body === undefined ? {} : {'Content-Type':'application/json','X-XSRF-TOKEN':this.csrf}, body: body === undefined ? undefined : JSON.stringify(body) });
    const raw = await response.text(); let result: any = {}; try { result = raw ? JSON.parse(raw) : {}; } catch { throw new Error('The service returned an unexpected response.'); }
    if (!response.ok) throw new Error(result.error || (response.status === 401 ? 'Please sign in to continue.' : response.status === 403 ? 'This page requires a staff account.' : response.status === 429 ? 'Too many requests. Please try again in a minute.' : 'The request could not be completed.'));
    return result;
  }
  async token() { const response = await fetch('/api/auth/csrf'); if (!response.ok) throw new Error('The service is unavailable.'); this.csrf = (await response.json()).token; }
  restore() { return this.restoring ??= this.restoreCore().finally(()=>{this.restoring=undefined;}); }
  private async restoreCore() { try { this.user.set(await this.request<User>('/auth/me')); await this.connect(); } catch { this.user.set(null); } await this.token(); }
  async login(email:string,password:string) { await this.request('/auth/login',{email,password}); await this.restore(); }
  async logout() { await this.request('/auth/logout',{}); await this.hub?.stop(); this.user.set(null); this.conversation.set(null); this.messages.set([]); await this.token(); }
  connect() { return this.connecting ??= this.connectCore().finally(()=>{this.connecting=undefined;}); }
  private async connectCore() {
    if (this.hub) await this.hub.stop();
    this.hub = new HubConnectionBuilder().withUrl('/hubs/live').withAutomaticReconnect().build();
    this.hub.on('Toast', value => this.toast.set(value));
    this.hub.on('Message', (value:Message) => { if (value.conversationId === this.conversation()) this.messages.update(items => items.some(x=>x.id===value.id) ? items : [...items,value].sort((a,b)=>a.id-b.id)); });
    this.hub.onreconnecting(()=>this.status.set('Reconnecting'));
    this.hub.onclose(()=>this.status.set('Offline'));
    this.hub.onreconnected(async()=> { this.status.set('Live'); if (this.conversation()) await this.open(this.conversation()!); });
    await this.hub.start(); this.status.set('Live');
  }
  async open(id:number) {
    if (!this.hub || this.status() !== 'Live') await this.connect();
    this.conversation.set(id); this.messages.set([]); await this.hub!.invoke('Join',id);
    const history = await this.request<Message[]>('/conversations/'+id+'/messages');
    this.messages.update(live => [...new Map([...history,...live].map(m=>[m.id,m])).values()].sort((a,b)=>a.id-b.id));
  }
  async send(text:string) { if (this.status() !== 'Live') throw new Error('Reconnect before sending.'); await this.hub!.invoke('Send',this.conversation(),text); }
}
