import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { Api } from './api';
@Component({selector:'app-root',imports:[RouterLink,RouterLinkActive,RouterOutlet],templateUrl:'./app.html'})
export class App {
  api=inject(Api); router=inject(Router); error='';
  constructor(){ this.api.restore().catch(()=>this.error='Start the local API to use accounts and live services.'); }
  async logout(){ try { await this.api.logout(); await this.router.navigateByUrl('/'); } catch(e:any){this.error=e.message;} }
}
