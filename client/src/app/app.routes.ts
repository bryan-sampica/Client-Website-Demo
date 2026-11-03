import { Routes } from '@angular/router';
import { Home, CatalogPage, DetailPage, SupportPage, NewsPage, ArticlePage, ReleasesPage, ContactPage, AuthPage, ExchangePage, PortalPage, ChatPage, EditorPage, NotFoundPage } from './pages';
export const routes: Routes = [
 {path:'',component:Home,title:'Widget Works — Little widgets. Big ideas.'},
 {path:'widgets',component:CatalogPage,title:'The widgets — Widget Works'},
 {path:'widgets/:slug',component:DetailPage,title:'Meet your widget'},
 {path:'support',component:SupportPage,title:'A helping hand'},
 {path:'support/chat',component:ChatPage,title:'Workshop chat'},
 {path:'exchange',component:ExchangePage,title:'Second Life — Widget Works'},
 {path:'releases',component:ReleasesPage,title:'New from the workshop'},
 {path:'news',component:NewsPage,title:'Field Notes'},
 {path:'news/:slug',component:ArticlePage,title:'Field Notes — Widget Works'},
 {path:'contact',component:ContactPage,title:'Say hello'},
 ...['login','register','forgot','reset'].map(mode=>({path:'account/'+mode,component:AuthPage,data:{mode},title:'Your account — Widget Works'})),
 {path:'portal',component:PortalPage,title:'Your workshop'},
 {path:'staff/support',component:ChatPage,data:{staff:true},title:'Support desk'},
 {path:'staff/news',component:EditorPage,title:'News editor'},
 {path:'**',component:NotFoundPage,title:'Page not found'}
];
