import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { Api } from './api';

describe('Framework Theory attribution', () => {
  it('links to the website in a separate tab with opener and referrer protection', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: Api, useValue: {
        restore: vi.fn().mockResolvedValue(undefined), user: signal(null), toast: signal(null)
      } }]
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.demo-strip a');
    expect(link.textContent).toBe('Crafted by Framework Theory ↗');
    expect(link.getAttribute('href')).toBe('https://www.framework-theory.com');
    expect(link.target).toBe('_blank');
    expect(link.relList.contains('noopener')).toBe(true);
    expect(link.relList.contains('noreferrer')).toBe(true);
  });
});
