import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
const data = process.env['WIDGET_TEST_DATA'] ?? resolve('../server/App_Data/e2e-'+randomUUID());
process.env['WIDGET_TEST_DATA']=data;
export default defineConfig({
  testDir:'./e2e', fullyParallel:false, workers:1, retries:process.env['CI']?1:0,
  timeout:45_000, expect:{timeout:10_000}, reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://localhost:5081',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:{command:'dotnet run --project ../server --no-launch-profile --urls http://localhost:5081',url:'http://localhost:5081/api/health',reuseExistingServer:false,timeout:60_000,
    env:{ASPNETCORE_ENVIRONMENT:'Development',Demo__Enabled:'true',DataDirectory:data}},
});
